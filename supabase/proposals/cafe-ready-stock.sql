BEGIN;
ALTER TABLE public.locations ADD COLUMN ready_stock_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE public.inventory ADD COLUMN ready_stock_confirmed boolean NOT NULL DEFAULT false;
ALTER TABLE public.inventory ADD COLUMN ready_stock_state text NOT NULL DEFAULT 'preparing' CHECK(ready_stock_state IN ('ready','preparing','paused'));
ALTER TABLE public.cafe_order_items ADD COLUMN ready_stock_state text CHECK(ready_stock_state IN ('reserved','sold','released'));
ALTER TABLE public.cafe_orders ADD COLUMN stock_reserved_until timestamptz;
CREATE INDEX cafe_ready_reservations ON public.cafe_order_items(order_id) WHERE ready_stock_state='reserved';
CREATE INDEX cafe_ready_expiry ON public.cafe_orders(stock_reserved_until) WHERE status='pending' AND payment_status='pending';
CREATE TABLE umma_private.cafe_ready_operations(actor_id bigint NOT NULL,request_key uuid NOT NULL,payload jsonb NOT NULL,result jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(actor_id,request_key));
ALTER TABLE umma_private.cafe_ready_operations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON umma_private.cafe_ready_operations FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.cafe_ready_catalog(p_location uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE managed boolean; result jsonb;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Access denied'; END IF;
 SELECT ready_stock_enabled INTO managed FROM locations WHERE id=p_location AND is_active AND location_type IN ('cafe','restaurant');IF NOT FOUND THEN RAISE EXCEPTION 'Cafe unavailable'; END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',p.id,'name_ru',p.name_ru,'name_vi',p.name_vi,'name_en',p.name_en,'price_vnd',p.price_vnd,'image_url',p.image_url)||jsonb_build_object('stockManaged',managed,'available',CASE WHEN managed THEN CASE WHEN i.ready_stock_confirmed AND i.ready_stock_state='ready' AND i.is_available THEN greatest(0,i.quantity-i.reserved_quantity)::int ELSE 0 END ELSE 99 END) ORDER BY p.sort_order,p.name_ru),'[]') INTO result FROM products p LEFT JOIN inventory i ON i.product_id=p.id AND i.location_id=p_location WHERE p.product_type='cafe' AND p.is_active AND NOT p.catalog_preview AND p.price_vnd>0;
 RETURN jsonb_build_object('ok',true,'cafeResetEpoch',(SELECT cafe_reset_epoch FROM umma_runtime_settings WHERE id=true),'products',result);
END $$;
CREATE FUNCTION public.cafe_ready_list(p_actor bigint,p_location uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE result jsonb;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' OR NOT EXISTS(SELECT 1 FROM telegram_users u WHERE u.telegram_id=p_actor AND u.is_active AND (u.role='super_admin' OR (u.role IN ('admin','employee') AND EXISTS(SELECT 1 FROM cafe_staff s WHERE s.telegram_id=p_actor AND s.location_id=p_location AND s.is_active AND s.staff_role IN ('kitchen','manager','cashier'))))) THEN RAISE EXCEPTION 'Stock access denied'; END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',p.id,'name',p.name_ru,'quantity',CASE WHEN i.ready_stock_confirmed THEN i.quantity ELSE i.reserved_quantity END,'reserved',coalesce(i.reserved_quantity,0),'confirmed',coalesce(i.ready_stock_confirmed,false),'state',coalesce(i.ready_stock_state,'preparing'),'available',CASE WHEN i.ready_stock_confirmed AND i.ready_stock_state='ready' AND i.is_available THEN greatest(0,i.quantity-i.reserved_quantity) ELSE 0 END) ORDER BY p.sort_order,p.name_ru),'[]') INTO result FROM products p LEFT JOIN inventory i ON i.product_id=p.id AND i.location_id=p_location WHERE p.product_type='cafe' AND p.is_active AND NOT p.catalog_preview AND p.price_vnd>0;
 RETURN jsonb_build_object('ok',true,'products',result);
END $$;
CREATE FUNCTION public.cafe_ready_adjust(p_actor bigint,p_location uuid,p_key uuid,p_mode text,p_items jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE previous umma_private.cafe_ready_operations%rowtype; payload jsonb:=jsonb_build_object('location',p_location,'mode',p_mode,'items',p_items); item jsonb; row public.inventory%rowtype; qty int; result jsonb;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' OR NOT EXISTS(SELECT 1 FROM telegram_users u WHERE u.telegram_id=p_actor AND u.is_active AND (u.role='super_admin' OR (u.role IN ('admin','employee') AND EXISTS(SELECT 1 FROM cafe_staff s WHERE s.telegram_id=p_actor AND s.location_id=p_location AND s.is_active AND s.staff_role IN ('kitchen','manager'))))) THEN RAISE EXCEPTION 'Stock edit access denied'; END IF;
 IF p_key IS NULL OR p_mode NOT IN ('add','set','preparing','paused','resume') OR jsonb_typeof(p_items)<>'array' OR jsonb_array_length(p_items) NOT BETWEEN 1 AND 150 THEN RAISE EXCEPTION 'Invalid stock request'; END IF;
 IF NOT EXISTS(SELECT 1 FROM locations WHERE id=p_location AND is_active AND location_type IN ('cafe','restaurant')) THEN RAISE EXCEPTION 'Cafe unavailable'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('ready-stock:'||p_actor||':'||p_key,0));
 SELECT * INTO previous FROM umma_private.cafe_ready_operations WHERE actor_id=p_actor AND request_key=p_key;
 IF FOUND THEN IF previous.payload<>payload THEN RAISE EXCEPTION 'Stock request key mismatch'; END IF;RETURN previous.result;END IF;
 IF (SELECT count(*) FROM jsonb_array_elements(p_items))<>(SELECT count(DISTINCT value->>'productId') FROM jsonb_array_elements(p_items)) THEN RAISE EXCEPTION 'Duplicate product'; END IF;
 FOR item IN SELECT value FROM jsonb_array_elements(p_items) ORDER BY value->>'productId' LOOP
  IF NOT EXISTS(SELECT 1 FROM products WHERE id=(item->>'productId')::uuid AND product_type='cafe' AND is_active AND NOT catalog_preview AND price_vnd>0) THEN RAISE EXCEPTION 'Product unavailable'; END IF;
  INSERT INTO inventory(product_id,location_id,quantity,reserved_quantity) VALUES((item->>'productId')::uuid,p_location,0,0) ON CONFLICT(product_id,location_id) DO NOTHING;
  SELECT * INTO row FROM inventory WHERE product_id=(item->>'productId')::uuid AND location_id=p_location FOR UPDATE;
  IF p_mode IN ('add','set') THEN
   IF coalesce(item->>'quantity','')!~ '^[0-9]{1,5}$' THEN RAISE EXCEPTION 'Укажите целое количество от 0 до 99999'; END IF;qty:=(item->>'quantity')::int;
   IF p_mode='add' THEN qty:=CASE WHEN row.ready_stock_confirmed THEN row.quantity ELSE row.reserved_quantity END+qty; END IF;
   IF qty<row.reserved_quantity THEN RAISE EXCEPTION 'Остаток не может быть меньше резерва (%)',row.reserved_quantity; END IF;
   UPDATE inventory SET quantity=qty,ready_stock_confirmed=true,ready_stock_state='ready',is_available=true,updated_at=now() WHERE id=row.id;
  ELSE
   UPDATE inventory SET ready_stock_state=CASE WHEN p_mode='resume' THEN 'ready' ELSE p_mode END,is_available=(p_mode='resume'),updated_at=now() WHERE id=row.id;
  END IF;
  INSERT INTO cafe_inventory_movements(location_id,product_id,actor_telegram_id,movement_type,quantity,note) VALUES(p_location,row.product_id,p_actor,'stock_set',coalesce(qty,row.quantity),'Готовые порции: '||p_mode);
 END LOOP;
 UPDATE locations SET ready_stock_enabled=true WHERE id=p_location;
 result:=public.cafe_ready_list(p_actor,p_location);
 INSERT INTO umma_private.cafe_ready_operations VALUES(p_actor,p_key,payload,result,now());RETURN result;
END $$;
-- Preserve legacy validation/accounting outside the new per-cafe ready-portion mechanism.
DO $patch$
DECLARE src text; anchor text:='  select coalesce((select inventory_control_enabled';
BEGIN
 SELECT pg_get_functiondef('public.reserve_cafe_inventory_for_order_item()'::regprocedure) INTO src;
 IF position(anchor IN src)=0 THEN RAISE EXCEPTION 'Reservation compatibility changed'; END IF;
 src:=replace(src,anchor,$branch$
  IF (SELECT ready_stock_enabled FROM public.locations WHERE id=v_location_id) THEN
    PERFORM 1 FROM public.cafe_orders WHERE id=NEW.order_id AND status NOT IN ('completed','cancelled') FOR UPDATE;
    IF NOT FOUND OR NEW.quantity<=0 OR NEW.quantity<>trunc(NEW.quantity) THEN RAISE EXCEPTION 'Invalid reserved order item'; END IF;
    SELECT * INTO v_inventory FROM public.inventory WHERE product_id=NEW.product_id AND location_id=v_location_id FOR UPDATE;
    IF NOT FOUND OR NOT v_inventory.ready_stock_confirmed OR v_inventory.ready_stock_state<>'ready' OR NOT v_inventory.is_available OR v_inventory.quantity-v_inventory.reserved_quantity<NEW.quantity THEN RAISE EXCEPTION 'READY_STOCK_UNAVAILABLE: %',v_product.name_ru; END IF;
    UPDATE public.inventory SET reserved_quantity=reserved_quantity+NEW.quantity,updated_at=now() WHERE id=v_inventory.id;
    NEW.ready_stock_state:='reserved';NEW.accounting_stock_item_id:=NULL;NEW.unit_price_vnd:=v_product.price_vnd;
    UPDATE public.cafe_orders SET stock_reserved_until=coalesce(stock_reserved_until,now()+interval '15 minutes') WHERE id=NEW.order_id AND status='pending' AND payment_status='pending' AND accepted_by_telegram_id IS NULL;
    INSERT INTO public.cafe_inventory_movements(location_id,product_id,order_id,movement_type,quantity,note) VALUES(v_location_id,NEW.product_id,NEW.order_id,'reserved',NEW.quantity,'Готовые порции зарезервированы');
    RETURN NEW;
  END IF;
$branch$||anchor);
 EXECUTE src;
 SELECT pg_get_functiondef('public.update_cafe_order_status(uuid,bigint,text,text)'::regprocedure) INTO src;
 src:=replace(src,'WHERE order_id=v_order.id AND product_id IS NOT NULL','WHERE order_id=v_order.id AND product_id IS NOT NULL AND ready_stock_state IS NULL');EXECUTE src;
END $patch$;
DO $patch$ DECLARE src text;BEGIN
 SELECT pg_get_functiondef('public.cafe_guest_order_status(uuid,uuid)'::regprocedure) INTO src;
 IF position('''status'',v_order.status' IN src)=0 THEN RAISE EXCEPTION 'Guest receipt compatibility changed';END IF;
 EXECUTE replace(src,'''status'',v_order.status','''status'',v_order.status,''stockReservedUntil'',v_order.stock_reserved_until');
END $patch$;
CREATE FUNCTION public.cafe_ready_settle() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE item record; consume boolean;
BEGIN
 IF NEW.status IS NOT DISTINCT FROM OLD.status OR NEW.status NOT IN ('completed','cancelled') THEN RETURN NEW; END IF;
 consume:=NEW.status='completed' OR OLD.delivery_status IN ('picked_up','delivered');
 FOR item IN SELECT * FROM cafe_order_items WHERE order_id=NEW.id AND ready_stock_state='reserved' ORDER BY product_id,id FOR UPDATE LOOP
  UPDATE inventory SET reserved_quantity=reserved_quantity-item.quantity,quantity=quantity-CASE WHEN consume THEN item.quantity ELSE 0 END,updated_at=now() WHERE product_id=item.product_id AND location_id=NEW.location_id AND reserved_quantity>=item.quantity AND quantity>=item.quantity;
  IF NOT FOUND THEN RAISE EXCEPTION 'Ready stock reservation mismatch'; END IF;
  UPDATE cafe_order_items SET ready_stock_state=CASE WHEN consume THEN 'sold' ELSE 'released' END WHERE id=item.id;
  INSERT INTO cafe_inventory_movements(location_id,product_id,order_id,movement_type,quantity,note) VALUES(NEW.location_id,item.product_id,NEW.id,CASE WHEN consume THEN 'sold' ELSE 'released' END,item.quantity,'Готовые порции: завершение заказа');
 END LOOP;RETURN NEW;
END $$;
CREATE TRIGGER cafe_ready_settle AFTER UPDATE OF status ON public.cafe_orders FOR EACH ROW EXECUTE FUNCTION public.cafe_ready_settle();
CREATE FUNCTION public.cafe_ready_line_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN
 IF OLD.ready_stock_state IS NOT NULL THEN RAISE EXCEPTION 'Reserved stock lines cannot be edited or deleted; cancel the order'; END IF;RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END $$;
CREATE TRIGGER cafe_ready_line_guard BEFORE UPDATE OF quantity,product_id,order_id OR DELETE ON public.cafe_order_items FOR EACH ROW EXECUTE FUNCTION public.cafe_ready_line_guard();
CREATE FUNCTION public.cafe_ready_expire() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE o record;
BEGIN
 FOR o IN SELECT id FROM cafe_orders WHERE stock_reserved_until<now() AND status='pending' AND payment_status='pending' AND accepted_by_telegram_id IS NULL AND courier_telegram_id IS NULL ORDER BY stock_reserved_until FOR UPDATE SKIP LOCKED LIMIT 50 LOOP
  UPDATE cafe_orders SET status='cancelled',cancelled_at=now(),updated_at=now() WHERE id=o.id;
  INSERT INTO cafe_order_events(order_id,from_status,to_status,note) VALUES(o.id,'pending','cancelled','Истёк 15-минутный резерв неоплаченного заказа');
 END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.cafe_ready_catalog(uuid),public.cafe_ready_list(bigint,uuid),public.cafe_ready_adjust(bigint,uuid,uuid,text,jsonb),public.cafe_ready_expire(),public.cafe_ready_settle(),public.cafe_ready_line_guard() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.cafe_ready_catalog(uuid),public.cafe_ready_list(bigint,uuid),public.cafe_ready_adjust(bigint,uuid,uuid,text,jsonb) TO service_role;
-- No invented saleable quantities. Preserve commitments made before activation; kitchen confirms physical counts.
DO $$ BEGIN IF coalesce((SELECT inventory_control_enabled FROM umma_runtime_settings WHERE id=true),false) THEN RAISE EXCEPTION 'Reconcile legacy accounting before ready-stock activation';END IF;END $$;
UPDATE locations SET ready_stock_enabled=true WHERE location_type IN ('cafe','restaurant') AND is_active;
UPDATE cafe_order_items i SET ready_stock_state='reserved' FROM cafe_orders o JOIN locations l ON l.id=o.location_id WHERE i.order_id=o.id AND o.source_module='cafe' AND o.status NOT IN ('completed','cancelled') AND l.ready_stock_enabled AND i.product_id IS NOT NULL;
UPDATE inventory i SET reserved_quantity=coalesce((SELECT sum(x.quantity) FROM cafe_order_items x JOIN cafe_orders o ON o.id=x.order_id WHERE x.product_id=i.product_id AND o.location_id=i.location_id AND x.ready_stock_state='reserved'),0),quantity=greatest(i.quantity,coalesce((SELECT sum(x.quantity) FROM cafe_order_items x JOIN cafe_orders o ON o.id=x.order_id WHERE x.product_id=i.product_id AND o.location_id=i.location_id AND x.ready_stock_state='reserved'),0)) WHERE EXISTS(SELECT 1 FROM locations l WHERE l.id=i.location_id AND l.ready_stock_enabled);
ALTER TABLE public.locations ALTER COLUMN ready_stock_enabled SET DEFAULT true;
SELECT cron.schedule('umma-ready-stock-expiry','* * * * *','SELECT public.cafe_ready_expire()');
COMMIT;
