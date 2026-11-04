BEGIN;
-- Future portions and physical portions have separate, transactionally locked reservations.
ALTER TABLE public.inventory ADD COLUMN planned_reserved_quantity integer NOT NULL DEFAULT 0 CHECK(planned_reserved_quantity>=0 AND planned_reserved_quantity<=planned_quantity);
ALTER TABLE public.cafe_order_items DROP CONSTRAINT cafe_order_items_ready_stock_state_check;
ALTER TABLE public.cafe_order_items ADD CONSTRAINT cafe_order_items_ready_stock_state_check CHECK(ready_stock_state IN ('planned','reserved','sold','released'));
ALTER TABLE public.cafe_order_items ADD COLUMN preorder_batch_revision uuid;
ALTER TABLE public.cafe_order_items ADD COLUMN preorder_ready_at timestamptz;
ALTER TABLE public.cafe_orders ADD COLUMN preorder_waiting boolean NOT NULL DEFAULT false;
ALTER TABLE public.cafe_orders ADD COLUMN preorder_expected_at timestamptz;
CREATE INDEX cafe_preorder_batches ON public.cafe_order_items(preorder_batch_revision,order_id) WHERE ready_stock_state='planned';
-- Checked function patches preserve the existing payment, guest capabilities and Market workflows.
CREATE FUNCTION umma_private.preorder_patch(signature text,anchor text,replacement text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE src text;BEGIN SELECT pg_get_functiondef(signature::regprocedure) INTO src;IF position(anchor IN src)=0 THEN RAISE EXCEPTION 'Preorder compatibility changed: % / %',signature,anchor;END IF;EXECUTE replace(src,anchor,replacement);END $$;
SELECT umma_private.preorder_patch('public.cafe_ready_catalog(uuid)', '''stockManaged'',managed', '''plannedQuantity'',coalesce(i.planned_quantity,0),''plannedAvailable'',greatest(0,coalesce(i.planned_quantity-i.planned_reserved_quantity,0)),''plannedReadyAt'',i.planned_ready_at,''planRevision'',i.plan_revision,''stockManaged'',managed');
SELECT umma_private.preorder_patch('public.cafe_ready_list(bigint,uuid)', '''plannedQuantity'',coalesce(i.planned_quantity,0)', '''plannedReserved'',coalesce(i.planned_reserved_quantity,0),''plannedQuantity'',coalesce(i.planned_quantity,0)');
-- Every guest creation and batch edit/finish takes this location lock before any order/inventory locks.
DO $$ DECLARE sig text;BEGIN
 FOREACH sig IN ARRAY ARRAY['public.submit_cafe_guest_order_v3(uuid,text,uuid,jsonb,text,text,text,text,text)','public.submit_cafe_guest_delivery_v4(uuid,text,uuid,jsonb,text,text,text,text,text,text,double precision,double precision,text)'] LOOP
  PERFORM umma_private.preorder_patch(sig,' perform pg_advisory_xact_lock(hashtextextended(p_ip_hash,0));',E' perform pg_advisory_xact_lock(hashtextextended(''preorder:''||p_location_id,0));\n if (select count(*) from jsonb_array_elements(p_items))<>(select count(distinct value->>''productId'') from jsonb_array_elements(p_items)) then raise exception ''Выберите для каждого блюда одну партию'';end if;\n perform pg_advisory_xact_lock(hashtextextended(p_ip_hash,0));');
  PERFORM umma_private.preorder_patch(sig,'quantity,unit_price_vnd)','quantity,unit_price_vnd,preorder_batch_revision)');
  PERFORM umma_private.preorder_patch(sig,'v_qty,v_product.price_vnd);','v_qty,v_product.price_vnd,nullif(v_item->>''planRevision'','''')::uuid);');
  PERFORM umma_private.preorder_patch(sig,' for v_item in select value',E' update public.cafe_orders set preorder_waiting=exists(select 1 from jsonb_array_elements(p_items) x where nullif(x->>''planRevision'','''') is not null),preorder_expected_at=(select max(i.planned_ready_at) from jsonb_array_elements(p_items) x join public.inventory i on i.product_id=(x->>''productId'')::uuid and i.location_id=p_location_id and i.plan_revision=nullif(x->>''planRevision'','''')::uuid) where id=v_order.id returning * into v_order;\n for v_item in select value');
  PERFORM umma_private.preorder_patch(sig,'''status'',v_order.status','''status'',v_order.status,''preorderWaiting'',v_order.preorder_waiting,''preorderExpectedAt'',v_order.preorder_expected_at');
 END LOOP;
END $$;
SELECT umma_private.preorder_patch('public.cafe_guest_order_status(uuid,uuid)', '''status'',v_order.status', '''status'',v_order.status,''preorderWaiting'',v_order.preorder_waiting,''preorderExpectedAt'',v_order.preorder_expected_at');
SELECT umma_private.preorder_patch('public.reserve_cafe_inventory_for_order_item()', '    IF NOT FOUND OR NOT v_inventory.ready_stock_confirmed', $branch$
    IF NEW.preorder_batch_revision IS NOT NULL THEN
      IF v_inventory.id IS NULL OR v_inventory.plan_revision IS DISTINCT FROM NEW.preorder_batch_revision OR v_inventory.planned_quantity-v_inventory.planned_reserved_quantity<NEW.quantity THEN RAISE EXCEPTION 'READY_STOCK_UNAVAILABLE: future batch';END IF;
      UPDATE public.inventory SET planned_reserved_quantity=planned_reserved_quantity+NEW.quantity,updated_at=now() WHERE id=v_inventory.id;
      NEW.ready_stock_state:='planned';NEW.preorder_ready_at:=v_inventory.planned_ready_at;NEW.unit_price_vnd:=v_product.price_vnd;NEW.accounting_stock_item_id:=NULL;
      UPDATE public.cafe_orders SET preorder_waiting=true,preorder_expected_at=greatest(preorder_expected_at,NEW.preorder_ready_at),stock_reserved_until=coalesce(stock_reserved_until,now()+interval '15 minutes') WHERE id=NEW.order_id;
      RETURN NEW;
    END IF;
    IF NOT FOUND OR NOT v_inventory.ready_stock_confirmed$branch$);
SELECT umma_private.preorder_patch('public.cafe_self_service_guard()', 'IF OLD.payment_status<>''paid'' AND NEW.payment_status=''paid'' AND OLD.status=''pending'' AND NEW.status=''pending'' THEN', 'IF NOT NEW.preorder_waiting AND OLD.payment_status<>''paid'' AND NEW.payment_status=''paid'' AND OLD.status=''pending'' AND NEW.status=''pending'' THEN');
-- No status button, courier offer or direct update may dispatch a still-cooking preorder.
CREATE FUNCTION public.cafe_preorder_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN
 IF NEW.preorder_waiting AND NEW.status IN ('preparing','ready','completed') THEN RAISE EXCEPTION 'Партия ещё готовится. Сначала примите готовые блюда на кухне.';END IF;
 IF NEW.preorder_waiting AND (NEW.courier_telegram_id IS NOT NULL OR NEW.delivery_status IN ('courier_assigned','picked_up','delivered')) THEN RAISE EXCEPTION 'Партия ещё готовится. Курьер будет доступен после приёма партии.';END IF;
 IF TG_OP='UPDATE' AND OLD.preorder_waiting AND NOT NEW.preorder_waiting AND EXISTS(SELECT 1 FROM cafe_order_items WHERE order_id=NEW.id AND ready_stock_state='planned') THEN RAISE EXCEPTION 'Preorder batch is still reserved';END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER zz_cafe_preorder_guard BEFORE INSERT OR UPDATE ON public.cafe_orders FOR EACH ROW EXECUTE FUNCTION public.cafe_preorder_guard();
CREATE FUNCTION public.cafe_preorder_cancel() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE item record;BEGIN
 IF NEW.status IS NOT DISTINCT FROM OLD.status OR NEW.status<>'cancelled' THEN RETURN NEW;END IF;
 FOR item IN SELECT * FROM cafe_order_items WHERE order_id=NEW.id AND ready_stock_state='planned' ORDER BY product_id,id FOR UPDATE LOOP
  UPDATE inventory SET planned_reserved_quantity=planned_reserved_quantity-item.quantity,updated_at=now() WHERE product_id=item.product_id AND location_id=NEW.location_id AND plan_revision=item.preorder_batch_revision AND planned_reserved_quantity>=item.quantity;
  IF NOT FOUND THEN RAISE EXCEPTION 'Preorder reservation mismatch';END IF;
  UPDATE cafe_order_items SET ready_stock_state='released' WHERE id=item.id;
 END LOOP;RETURN NEW;
END $$;
CREATE TRIGGER cafe_preorder_cancel AFTER UPDATE OF status ON public.cafe_orders FOR EACH ROW EXECUTE FUNCTION public.cafe_preorder_cancel();
-- Reserve/cancel lock parent order before inventory. Finish does the same to avoid deadlocks.
SELECT umma_private.preorder_patch('public.cafe_ready_plan(bigint,uuid,uuid,text,jsonb)', ' PERFORM pg_advisory_xact_lock(hashtextextended(''ready-stock:''', E' PERFORM pg_advisory_xact_lock(hashtextextended(''preorder:''||p_location,0));\n PERFORM 1 FROM cafe_orders o WHERE o.location_id=p_location AND EXISTS(SELECT 1 FROM cafe_order_items x WHERE x.order_id=o.id AND x.ready_stock_state=''planned'' AND x.product_id IN (SELECT (value->>''productId'')::uuid FROM jsonb_array_elements(p_items))) ORDER BY o.id FOR UPDATE;\n PERFORM pg_advisory_xact_lock(hashtextextended(''ready-stock:''');
SELECT umma_private.preorder_patch('public.cafe_ready_plan(bigint,uuid,uuid,text,jsonb)', '  IF p_action=''plan'' THEN', E'  IF p_action IN (''plan'',''cancel'') AND row.planned_reserved_quantity>0 THEN RAISE EXCEPTION ''Партия уже заказана: нельзя менять или отменять. Сначала разрешите предзаказы с клиентами.'';END IF;\n  IF p_action=''finish'' AND qty<row.planned_reserved_quantity THEN RAISE EXCEPTION ''Партия меньше резерва предзаказов (%). Укажите фактический выпуск или разрешите заказы.'',row.planned_reserved_quantity;END IF;\n  IF p_action=''plan'' THEN');
SELECT umma_private.preorder_patch('public.cafe_ready_plan(bigint,uuid,uuid,text,jsonb)', 'is_available=true,planned_quantity=0', 'is_available=true,reserved_quantity=reserved_quantity+row.planned_reserved_quantity,planned_reserved_quantity=0,planned_quantity=0');
SELECT umma_private.preorder_patch('public.cafe_ready_plan(bigint,uuid,uuid,text,jsonb)', '    INSERT INTO cafe_inventory_movements', E'    UPDATE cafe_order_items SET ready_stock_state=''reserved'' WHERE preorder_batch_revision=row.plan_revision AND ready_stock_state=''planned'' AND order_id IN (SELECT id FROM cafe_orders WHERE location_id=p_location);\n    INSERT INTO cafe_inventory_movements');
SELECT umma_private.preorder_patch('public.cafe_ready_plan(bigint,uuid,uuid,text,jsonb)', ' result:=public.cafe_ready_list', E' UPDATE cafe_orders o SET preorder_waiting=false,status=CASE WHEN o.payment_status=''paid'' OR NOT o.requires_prepayment THEN ''preparing'' ELSE ''pending'' END,updated_at=now() WHERE o.location_id=p_location AND o.preorder_waiting AND o.status NOT IN (''completed'',''cancelled'') AND NOT EXISTS(SELECT 1 FROM cafe_order_items x WHERE x.order_id=o.id AND x.ready_stock_state=''planned'');\n result:=public.cafe_ready_list');
-- Dispatch starts only once all future dishes in the order have been received.
SELECT umma_private.preorder_patch('public.ensure_cafe_courier_offers(uuid)', 'IF NOT FOUND OR o.order_type', 'IF NOT FOUND OR o.preorder_waiting OR o.order_type');
SELECT umma_private.preorder_patch('public.offer_cafe_courier(uuid,bigint,bigint)', 'IF o.order_type<>', 'IF o.preorder_waiting OR o.order_type<>');
SELECT umma_private.preorder_patch('public.claim_cafe_available_delivery(uuid,bigint)', 'IF o.order_type<>', 'IF o.preorder_waiting OR o.order_type<>');
SELECT umma_private.preorder_patch('public.list_cafe_available_deliveries(bigint)', 'o.order_type=''delivery''', 'NOT o.preorder_waiting AND o.order_type=''delivery''');
SELECT umma_private.preorder_patch('public.list_cafe_courier_offers(bigint)', 'o.delivery_status=''waiting_courier''', 'NOT o.preorder_waiting AND o.delivery_status=''waiting_courier''');
-- Block direct metadata changes which could move a reservation into another batch.
CREATE FUNCTION public.cafe_preorder_line_guard() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF NEW.preorder_batch_revision IS DISTINCT FROM OLD.preorder_batch_revision OR NEW.preorder_ready_at IS DISTINCT FROM OLD.preorder_ready_at THEN RAISE EXCEPTION 'Preorder batch cannot be edited';END IF;RETURN NEW;END $$;
CREATE TRIGGER cafe_preorder_line_guard BEFORE UPDATE OF preorder_batch_revision,preorder_ready_at ON public.cafe_order_items FOR EACH ROW EXECUTE FUNCTION public.cafe_preorder_line_guard();
-- A release event is separate from the later staff-confirmed assembled/ready event.
SELECT umma_private.preorder_patch('public.enqueue_cafe_web_push()', 'AND NEW.delivery_status IS NOT DISTINCT FROM OLD.delivery_status THEN', 'AND NEW.delivery_status IS NOT DISTINCT FROM OLD.delivery_status AND NEW.preorder_waiting IS NOT DISTINCT FROM OLD.preorder_waiting THEN');
SELECT umma_private.preorder_patch('public.enqueue_cafe_web_push()', '''changes'',jsonb_build_object(', '''preorderWaiting'',NEW.preorder_waiting,''preorderExpectedAt'',NEW.preorder_expected_at,''changes'',jsonb_build_object(''preorder'',CASE WHEN OLD.preorder_waiting AND NOT NEW.preorder_waiting THEN ''batch_ready'' END,');
DROP TRIGGER cafe_web_push ON public.cafe_orders;
CREATE TRIGGER cafe_web_push AFTER UPDATE OF status,payment_status,delivery_status,preorder_waiting ON public.cafe_orders FOR EACH ROW EXECUTE FUNCTION public.enqueue_cafe_web_push();
REVOKE ALL ON FUNCTION public.cafe_preorder_guard(),public.cafe_preorder_cancel(),public.cafe_preorder_line_guard() FROM PUBLIC,anon,authenticated;
DROP FUNCTION umma_private.preorder_patch(text,text,text);
COMMIT;
