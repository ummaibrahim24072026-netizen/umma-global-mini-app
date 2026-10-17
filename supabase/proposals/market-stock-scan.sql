-- UMMA Stock & Scan: additive warehouse foundation. Existing Cafe tables and rows are preserved.
BEGIN;
CREATE TABLE public.market_warehouses (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), location_id uuid NOT NULL REFERENCES public.locations(id),
 name text NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 160), is_active boolean NOT NULL DEFAULT true,
 created_by_telegram_id bigint REFERENCES public.telegram_users(telegram_id), created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(location_id,name)
);
CREATE TABLE public.market_staff_roles (
 telegram_id bigint NOT NULL REFERENCES public.telegram_users(telegram_id),
 location_id uuid NOT NULL REFERENCES public.locations(id),
 role text NOT NULL CHECK(role IN ('admin','receiver','packer','warehouse','picker','cashier','courier')),
 is_active boolean NOT NULL DEFAULT true, PRIMARY KEY(telegram_id,location_id,role)
);
-- Canonical catalogue, suppliers, purchase documents, stock items and movements are reused.
CREATE TABLE public.market_product_variants (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), product_id uuid NOT NULL REFERENCES public.products(id),
 stock_item_id uuid NOT NULL UNIQUE REFERENCES public.stock_items(id),
 sale_mode text NOT NULL CHECK(sale_mode IN ('piece','set','fixed_weight','individual_weight')),
 measure text NOT NULL CHECK(measure IN ('g','pcs')), fixed_quantity bigint CHECK(fixed_quantity>0),
 storage_conditions text, halal_evidence text, is_active boolean NOT NULL DEFAULT true
);
CREATE TABLE public.market_product_barcodes (
 code text PRIMARY KEY CHECK(length(code) BETWEEN 1 AND 128),
 variant_id uuid NOT NULL REFERENCES public.market_product_variants(id),
 format text NOT NULL DEFAULT 'unknown', CHECK(code NOT LIKE 'UMMA:%')
);
CREATE TABLE public.market_documents (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), number bigint GENERATED ALWAYS AS IDENTITY UNIQUE,
 warehouse_id uuid NOT NULL REFERENCES public.market_warehouses(id),
 kind text NOT NULL CHECK(kind IN ('receipt','packing','writeoff','quarantine','release','count','adjustment','transfer','print')),
 status text NOT NULL CHECK(status IN ('posted','pending','rejected')), reason text,
 payload jsonb NOT NULL DEFAULT '{}', result jsonb NOT NULL DEFAULT '{}',
 actor_telegram_id bigint NOT NULL REFERENCES public.telegram_users(telegram_id),
 approved_by bigint REFERENCES public.telegram_users(telegram_id),
 created_at timestamptz NOT NULL DEFAULT now(), posted_at timestamptz
);
CREATE TABLE public.market_batches (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), variant_id uuid NOT NULL REFERENCES public.market_product_variants(id),
 warehouse_id uuid NOT NULL REFERENCES public.market_warehouses(id), receipt_id uuid NOT NULL REFERENCES public.purchase_documents(id),
 batch_number text NOT NULL, expires_on date, storage_place text,
 status text NOT NULL CHECK(status IN ('available','quarantine')),
 raw_quantity bigint NOT NULL CHECK(raw_quantity>=0), raw_cost_vnd bigint NOT NULL CHECK(raw_cost_vnd>=0),
 created_at timestamptz NOT NULL DEFAULT now(), CHECK(raw_quantity>0 OR raw_cost_vnd=0)
);
CREATE INDEX market_batches_warehouse_idx ON public.market_batches(warehouse_id,variant_id,expires_on);
CREATE TABLE public.market_stock_units (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), batch_id uuid NOT NULL REFERENCES public.market_batches(id),
 quantity bigint NOT NULL CHECK(quantity>0), cost_vnd bigint NOT NULL CHECK(cost_vnd>=0),
 status text NOT NULL DEFAULT 'available' CHECK(status IN ('available','quarantine','written_off')),
 packing_document_id uuid NOT NULL REFERENCES public.market_documents(id), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX market_units_batch_idx ON public.market_stock_units(batch_id,status);
CREATE TABLE public.market_operations (
 actor_telegram_id bigint NOT NULL, request_id uuid NOT NULL, action text NOT NULL, payload jsonb NOT NULL,
 result jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(actor_telegram_id,request_id)
);
CREATE TABLE public.market_inventory_count_items (
 document_id uuid NOT NULL REFERENCES public.market_documents(id), batch_id uuid NOT NULL REFERENCES public.market_batches(id),
 expected_raw bigint NOT NULL, actual_raw bigint CHECK(actual_raw>=0),
 expected_units jsonb NOT NULL, actual_units jsonb, surplus_cost_vnd bigint CHECK(surplus_cost_vnd>=0), PRIMARY KEY(document_id,batch_id)
);
CREATE TABLE public.market_scan_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), actor_telegram_id bigint NOT NULL,
 warehouse_id uuid NOT NULL REFERENCES public.market_warehouses(id), code text NOT NULL,
 result jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.market_print_jobs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), document_id uuid NOT NULL REFERENCES public.market_documents(id),
 unit_ids uuid[] NOT NULL, width_mm integer NOT NULL CHECK(width_mm BETWEEN 20 AND 150),
 height_mm integer NOT NULL CHECK(height_mm BETWEEN 20 AND 150),
 status text NOT NULL DEFAULT 'prepared' CHECK(status IN ('prepared','sent','failed')),
 error text, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX market_variants_product_idx ON public.market_product_variants(product_id);
CREATE INDEX market_roles_location_idx ON public.market_staff_roles(location_id) WHERE is_active;
CREATE INDEX market_documents_warehouse_idx ON public.market_documents(warehouse_id,created_at DESC);
CREATE UNIQUE INDEX market_one_active_count_idx ON public.market_documents(warehouse_id) WHERE kind='count' AND status='pending';
CREATE INDEX market_barcodes_variant_idx ON public.market_product_barcodes(variant_id);
CREATE INDEX market_batches_receipt_idx ON public.market_batches(receipt_id);
CREATE INDEX market_units_document_idx ON public.market_stock_units(packing_document_id);
CREATE INDEX market_counts_batch_idx ON public.market_inventory_count_items(batch_id);
CREATE INDEX market_print_document_idx ON public.market_print_jobs(document_id);
CREATE INDEX market_scan_warehouse_idx ON public.market_scan_events(warehouse_id,created_at DESC);
-- Service-only RPCs. Telegram signatures are verified in the Edge Function; never accept actor IDs from a client.
CREATE FUNCTION public.market_can(p_actor bigint,p_location uuid,p_roles text[])
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path=pg_catalog,public AS $$
 SELECT EXISTS(SELECT 1 FROM public.telegram_users u WHERE u.telegram_id=p_actor AND u.is_active
 AND (u.role='super_admin' OR EXISTS(SELECT 1 FROM public.market_staff_roles r
 WHERE r.telegram_id=u.telegram_id AND r.location_id=p_location AND r.is_active AND (r.role='admin' OR r.role=ANY(p_roles)))))
$$;
CREATE FUNCTION public.market_immutable() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
 IF TG_OP='DELETE' OR TG_TABLE_NAME<>'market_documents' THEN
  RAISE EXCEPTION 'Confirmed Market documents are immutable';
 END IF;
 IF OLD.status<>'pending' THEN RAISE EXCEPTION 'Confirmed Market documents are immutable'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER market_documents_immutable BEFORE UPDATE OR DELETE ON public.market_documents FOR EACH ROW EXECUTE FUNCTION public.market_immutable();
CREATE TRIGGER market_operations_immutable BEFORE UPDATE OR DELETE ON public.market_operations FOR EACH ROW EXECUTE FUNCTION public.market_immutable();
CREATE TRIGGER market_scans_immutable BEFORE UPDATE OR DELETE ON public.market_scan_events FOR EACH ROW EXECUTE FUNCTION public.market_immutable();
-- Freeze warehouse movements while a count is open; no false discrepancies from concurrent work.
-- The same warehouse advisory lock is held by every mutation, including count start/close.
CREATE FUNCTION public.market_sync_balance(p_warehouse uuid,p_variant uuid) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
DECLARE v_location uuid; v_item uuid; v_qty numeric; v_cost bigint;
BEGIN
 SELECT w.location_id INTO STRICT v_location FROM public.market_warehouses w WHERE w.id=p_warehouse;
 SELECT stock_item_id INTO STRICT v_item FROM public.market_product_variants WHERE id=p_variant;
 SELECT coalesce(sum(b.raw_quantity),0)+coalesce((SELECT sum(u.quantity) FROM public.market_stock_units u JOIN public.market_batches b ON b.id=u.batch_id JOIN public.market_warehouses w ON w.id=b.warehouse_id WHERE w.location_id=v_location AND b.variant_id=p_variant AND u.status<>'written_off'),0),
 coalesce(sum(b.raw_cost_vnd),0)+coalesce((SELECT sum(u.cost_vnd) FROM public.market_stock_units u JOIN public.market_batches b ON b.id=u.batch_id JOIN public.market_warehouses w ON w.id=b.warehouse_id WHERE w.location_id=v_location AND b.variant_id=p_variant AND u.status<>'written_off'),0)
 INTO v_qty,v_cost FROM public.market_batches b JOIN public.market_warehouses w ON w.id=b.warehouse_id WHERE w.location_id=v_location AND b.variant_id=p_variant;
 PERFORM set_config('umma.market_operation','on',true);
 INSERT INTO public.stock_balances(location_id,stock_item_id,quantity_on_hand,average_unit_cost_vnd)
 VALUES(v_location,v_item,v_qty,CASE WHEN v_qty>0 THEN v_cost/v_qty ELSE 0 END)
 ON CONFLICT(location_id,stock_item_id) DO UPDATE SET quantity_on_hand=excluded.quantity_on_hand,average_unit_cost_vnd=excluded.average_unit_cost_vnd,updated_at=now();
END $$;
CREATE FUNCTION public.market_guard_balance() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM public.market_product_variants WHERE stock_item_id=coalesce(NEW.stock_item_id,OLD.stock_item_id))
 AND current_setting('umma.market_operation',true) IS DISTINCT FROM 'on' THEN
 RAISE EXCEPTION 'Market stock must be changed through Stock & Scan'; END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END $$;
CREATE TRIGGER market_balance_guard BEFORE INSERT OR UPDATE OR DELETE ON public.stock_balances FOR EACH ROW EXECUTE FUNCTION public.market_guard_balance();
CREATE FUNCTION public.market_operation(p_actor bigint,p_request uuid,p_action text,p_data jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
DECLARE
 v_w public.market_warehouses%ROWTYPE; v_b public.market_batches%ROWTYPE;
 v_u public.market_stock_units%ROWTYPE; v_v public.market_product_variants%ROWTYPE;
 v_d public.market_documents%ROWTYPE; v_old public.market_operations%ROWTYPE;
 v_doc uuid; v_receipt uuid; v_product uuid; v_item uuid; v_batch uuid; v_unit uuid; v_target uuid;
 v_q bigint; v_cost bigint; v_total bigint:=0; v_surplus bigint:=0; v_loss bigint; v_used bigint; v_raw bigint;
 v_row jsonb; v_result jsonb; v_units jsonb:='[]'; v_payload jsonb; v_roles text[]; v_count record;
BEGIN
 IF p_actor IS NULL OR p_request IS NULL OR p_data IS NULL THEN RAISE EXCEPTION 'Missing operation identity'; END IF;
 SELECT * INTO STRICT v_w FROM public.market_warehouses WHERE id=(p_data->>'warehouse_id')::uuid AND is_active;
 v_roles:=CASE p_action WHEN 'receive' THEN ARRAY['receiver'] WHEN 'supplier_create' THEN ARRAY['receiver'] WHEN 'pack' THEN ARRAY['packer']
 WHEN 'writeoff_request' THEN ARRAY['warehouse'] WHEN 'count_start' THEN ARRAY['warehouse']
 WHEN 'count_submit' THEN ARRAY['warehouse'] WHEN 'quarantine' THEN ARRAY['warehouse']
 WHEN 'scan' THEN ARRAY['receiver','packer','warehouse','picker'] WHEN 'print' THEN ARRAY['packer','warehouse']
 WHEN 'print_result' THEN ARRAY['packer','warehouse'] ELSE ARRAY['admin'] END;
 IF NOT public.market_can(p_actor,v_w.location_id,v_roles) THEN RAISE EXCEPTION 'Market access denied'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('market-request:'||p_actor||':'||p_request,0));
 SELECT * INTO v_old FROM public.market_operations WHERE actor_telegram_id=p_actor AND request_id=p_request;
 IF FOUND THEN
  IF v_old.action<>p_action OR v_old.payload<>p_data THEN RAISE EXCEPTION 'Idempotency key reused with different data'; END IF;
  RETURN v_old.result||'{"replayed":true}'::jsonb;
 END IF;
 -- Location lock also protects aggregate balances when two warehouses share an item.
 PERFORM pg_advisory_xact_lock(hashtextextended('market-location:'||v_w.location_id,0));
 PERFORM pg_advisory_xact_lock(hashtextextended('market-warehouse:'||v_w.id,0));
 IF p_action NOT IN ('scan','print','print_result','count_submit','count_approve','count_reject') AND EXISTS(
 SELECT 1 FROM public.market_documents WHERE warehouse_id=v_w.id AND kind='count' AND status='pending') THEN
 RAISE EXCEPTION 'Inventory count in progress: warehouse movements paused'; END IF;
 IF p_action='staff_assign' THEN
  IF NOT EXISTS(SELECT 1 FROM public.telegram_users WHERE telegram_id=p_actor AND role='super_admin' AND is_active) THEN RAISE EXCEPTION 'Market access denied'; END IF;
  INSERT INTO public.market_staff_roles(telegram_id,location_id,role,is_active)
  VALUES((p_data->>'telegram_id')::bigint,v_w.location_id,p_data->>'role',coalesce((p_data->>'is_active')::boolean,true))
  ON CONFLICT(telegram_id,location_id,role) DO UPDATE SET is_active=excluded.is_active;
  v_result:='{"ok":true}';
 ELSIF p_action='supplier_create' THEN
  IF length(trim(coalesce(p_data->>'name','')))=0 THEN RAISE EXCEPTION 'Supplier name required'; END IF;
  INSERT INTO public.suppliers(name) VALUES(left(trim(p_data->>'name'),160)) RETURNING id INTO v_item;
  v_result:=jsonb_build_object('ok',true,'supplier_id',v_item);
 ELSIF p_action='product_create' THEN
  IF length(trim(coalesce(p_data->>'name_ru','')))=0 THEN RAISE EXCEPTION 'Product name required'; END IF;
  IF p_data->>'measure' NOT IN ('g','pcs') THEN RAISE EXCEPTION 'Invalid measure'; END IF;
  INSERT INTO public.products(name_ru,name_en,name_vi,description_ru,product_type,price_vnd,image_url,sku,is_active)
  VALUES(p_data->>'name_ru',coalesce(p_data->>'name_en',''),coalesce(p_data->>'name_vi',''),p_data->>'description_ru','market',(p_data->>'price_vnd')::integer,nullif(p_data->>'image_url',''),nullif(p_data->>'sku',''),true) RETURNING id INTO v_product;
  INSERT INTO public.stock_items(name_ru,name_en,name_vi,item_type,base_unit,created_by_telegram_id)
  VALUES(p_data->>'name_ru',p_data->>'name_en',p_data->>'name_vi','finished_good',p_data->>'measure',p_actor) RETURNING id INTO v_item;
  INSERT INTO public.market_product_variants(product_id,stock_item_id,sale_mode,measure,fixed_quantity,storage_conditions,halal_evidence)
  VALUES(v_product,v_item,p_data->>'sale_mode',p_data->>'measure',nullif(p_data->>'fixed_quantity','')::bigint,p_data->>'storage_conditions',p_data->>'halal_evidence') RETURNING * INTO v_v;
  IF nullif(p_data->>'barcode','') IS NOT NULL THEN
   INSERT INTO public.market_product_barcodes(code,variant_id) VALUES(p_data->>'barcode',v_v.id);
  END IF;
  v_result:=jsonb_build_object('ok',true,'variant',to_jsonb(v_v));
 ELSIF p_action='barcode_link' THEN
  INSERT INTO public.market_product_barcodes(code,variant_id,format) VALUES(p_data->>'code',(p_data->>'variant_id')::uuid,coalesce(p_data->>'format','unknown'));
  v_result:='{"ok":true}';
 ELSIF p_action='receive' THEN
  IF NOT EXISTS(SELECT 1 FROM public.suppliers WHERE id=(p_data->>'supplier_id')::uuid AND is_active) THEN RAISE EXCEPTION 'Active supplier required'; END IF;
  IF jsonb_array_length(p_data->'items') NOT BETWEEN 1 AND 200 THEN RAISE EXCEPTION 'Receipt requires 1..200 items'; END IF;
  INSERT INTO public.purchase_documents(location_id,supplier_id,document_number,status,created_by_telegram_id,posted_by_telegram_id,posted_at,notes)
  VALUES(v_w.location_id,(p_data->>'supplier_id')::uuid,'UMMA-'||p_request,'posted',p_actor,p_actor,now(),p_data->>'notes') RETURNING id INTO v_receipt;
  INSERT INTO public.market_documents(warehouse_id,kind,status,payload,actor_telegram_id,posted_at)
  VALUES(v_w.id,'receipt','posted',p_data,p_actor,now()) RETURNING id INTO v_doc;
  FOR v_row IN SELECT * FROM jsonb_array_elements(p_data->'items') LOOP
   SELECT * INTO STRICT v_v FROM public.market_product_variants WHERE id=(v_row->>'variant_id')::uuid AND is_active;
   v_q:=(v_row->>'quantity')::bigint; v_cost:=(v_row->>'cost_vnd')::bigint;
   IF v_q IS NULL OR v_q<=0 OR v_cost IS NULL OR v_cost<0 OR nullif(v_row->>'batch_number','') IS NULL THEN RAISE EXCEPTION 'Invalid receipt line'; END IF;
   IF (v_row->>'planned_quantity')::bigint<v_q THEN RAISE EXCEPTION 'Accepted quantity exceeds planned quantity'; END IF;
   INSERT INTO public.purchase_items(purchase_document_id,stock_item_id,quantity,unit_cost_vnd,line_total_vnd,notes)
   VALUES(v_receipt,v_v.stock_item_id,v_q,v_cost::numeric/v_q,v_cost,v_row->>'notes');
   INSERT INTO public.market_batches(variant_id,warehouse_id,receipt_id,batch_number,expires_on,storage_place,status,raw_quantity,raw_cost_vnd)
   VALUES(v_v.id,v_w.id,v_receipt,v_row->>'batch_number',nullif(v_row->>'expires_on','')::date,v_row->>'storage_place',CASE WHEN v_row->>'quality'='passed' THEN 'available' ELSE 'quarantine' END,v_q,v_cost) RETURNING id INTO v_batch;
   INSERT INTO public.stock_movements(location_id,stock_item_id,movement_type,quantity_delta,unit_cost_vnd,source_type,source_id,actor_telegram_id)
   VALUES(v_w.location_id,v_v.stock_item_id,'purchase_in',v_q,v_cost::numeric/v_q,'purchase_document',v_receipt,p_actor);
   PERFORM public.market_sync_balance(v_w.id,v_v.id);
   v_units:=v_units||jsonb_build_array(v_batch); v_total:=v_total+v_cost;
  END LOOP;
  UPDATE public.purchase_documents SET subtotal_vnd=v_total WHERE id=v_receipt;
  v_result:=jsonb_build_object('ok',true,'document_id',v_doc,'receipt_id',v_receipt,'batch_ids',v_units);
 ELSIF p_action='pack' THEN
  SELECT * INTO STRICT v_b FROM public.market_batches WHERE id=(p_data->>'batch_id')::uuid AND warehouse_id=v_w.id FOR UPDATE;
  IF v_b.status<>'available' OR v_b.expires_on<(now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date THEN RAISE EXCEPTION 'Batch blocked or expired'; END IF;
  SELECT * INTO STRICT v_v FROM public.market_product_variants WHERE id=v_b.variant_id;
  IF jsonb_array_length(p_data->'quantities') NOT BETWEEN 1 AND 500 THEN RAISE EXCEPTION 'Packing requires 1..500 units'; END IF;
  v_loss:=coalesce((p_data->>'loss_quantity')::bigint,0); v_raw:=(p_data->>'remaining_quantity')::bigint;
  SELECT sum(value::bigint) INTO v_used FROM jsonb_array_elements_text(p_data->'quantities');
  IF v_raw IS NULL OR v_raw<0 OR v_loss<0 OR v_b.raw_quantity<>v_used+v_raw+v_loss THEN RAISE EXCEPTION 'Weight balance mismatch'; END IF;
  IF v_loss>0 THEN RAISE EXCEPTION 'Record and approve packing loss as a writeoff before packing'; END IF;
  INSERT INTO public.market_documents(warehouse_id,kind,status,payload,actor_telegram_id,posted_at)
  VALUES(v_w.id,'packing','posted',p_data,p_actor,now()) RETURNING id INTO v_doc;
  v_total:=v_b.raw_cost_vnd; v_q:=v_b.raw_quantity;
  FOR v_row IN SELECT value FROM jsonb_array_elements(p_data->'quantities') LOOP
   v_used:=(v_row#>>'{}')::bigint;
   IF v_used<=0 THEN RAISE EXCEPTION 'Exact positive weight or quantity required'; END IF;
   v_cost:=round(v_total::numeric*v_used/v_q); v_total:=v_total-v_cost; v_q:=v_q-v_used;
   INSERT INTO public.market_stock_units(batch_id,quantity,cost_vnd,packing_document_id) VALUES(v_b.id,v_used,v_cost,v_doc) RETURNING id INTO v_unit;
   v_units:=v_units||jsonb_build_array(v_unit);
  END LOOP;
  UPDATE public.market_batches SET raw_quantity=v_q,raw_cost_vnd=v_total WHERE id=v_b.id;
  v_result:=jsonb_build_object('ok',true,'document_id',v_doc,'unit_ids',v_units);
 ELSIF p_action IN ('writeoff_request','quarantine','release') THEN
  SELECT * INTO STRICT v_b FROM public.market_batches WHERE id=(p_data->>'batch_id')::uuid AND warehouse_id=v_w.id FOR UPDATE;
  IF length(trim(coalesce(p_data->>'reason','')))=0 THEN RAISE EXCEPTION 'Reason required'; END IF;
  IF p_action='writeoff_request' THEN
   v_q:=(p_data->>'quantity')::bigint;
   IF nullif(p_data->>'unit_id','') IS NOT NULL THEN
    SELECT * INTO STRICT v_u FROM public.market_stock_units WHERE id=(p_data->>'unit_id')::uuid AND batch_id=v_b.id AND status<>'written_off' FOR UPDATE;
    v_q:=v_u.quantity;
   ELSIF v_q IS NULL OR v_q<=0 OR v_q>v_b.raw_quantity THEN RAISE EXCEPTION 'Invalid writeoff quantity'; END IF;
   INSERT INTO public.market_documents(warehouse_id,kind,status,reason,payload,actor_telegram_id)
   VALUES(v_w.id,'writeoff','pending',p_data->>'reason',p_data||jsonb_build_object('quantity',v_q),p_actor) RETURNING id INTO v_doc;
  ELSE
   UPDATE public.market_batches SET status=CASE WHEN p_action='quarantine' THEN 'quarantine' ELSE 'available' END WHERE id=v_b.id;
   INSERT INTO public.market_documents(warehouse_id,kind,status,reason,payload,actor_telegram_id,posted_at)
   VALUES(v_w.id,p_action,'posted',p_data->>'reason',p_data,p_actor,now()) RETURNING id INTO v_doc;
  END IF;
  v_result:=jsonb_build_object('ok',true,'document_id',v_doc);
 ELSIF p_action IN ('writeoff_approve','writeoff_reject') THEN
  SELECT * INTO STRICT v_d FROM public.market_documents WHERE id=(p_data->>'document_id')::uuid AND warehouse_id=v_w.id AND kind='writeoff' FOR UPDATE;
  IF v_d.status<>'pending' THEN RAISE EXCEPTION 'Writeoff already resolved'; END IF;
  v_payload:=v_d.payload;
  IF p_action='writeoff_approve' THEN
   SELECT * INTO STRICT v_b FROM public.market_batches WHERE id=(v_payload->>'batch_id')::uuid AND warehouse_id=v_w.id FOR UPDATE;
   v_q:=(v_payload->>'quantity')::bigint;
   IF nullif(v_payload->>'unit_id','') IS NOT NULL THEN
    SELECT * INTO STRICT v_u FROM public.market_stock_units WHERE id=(v_payload->>'unit_id')::uuid AND batch_id=v_b.id AND status<>'written_off' FOR UPDATE;
    v_q:=v_u.quantity; v_cost:=v_u.cost_vnd;
    UPDATE public.market_stock_units SET status='written_off' WHERE id=v_u.id;
   ELSE
    IF v_q<=0 OR v_q>v_b.raw_quantity THEN RAISE EXCEPTION 'Insufficient raw stock'; END IF;
    v_cost:=round(v_b.raw_cost_vnd::numeric*v_q/v_b.raw_quantity);
    UPDATE public.market_batches SET raw_quantity=raw_quantity-v_q,raw_cost_vnd=raw_cost_vnd-v_cost WHERE id=v_b.id;
   END IF;
   SELECT * INTO STRICT v_v FROM public.market_product_variants WHERE id=v_b.variant_id;
   INSERT INTO public.stock_movements(location_id,stock_item_id,movement_type,quantity_delta,unit_cost_vnd,source_type,source_id,actor_telegram_id)
   VALUES(v_w.location_id,v_v.stock_item_id,'waste_out',-v_q,v_cost::numeric/v_q,'manual_adjustment',v_d.id,p_actor);
   PERFORM public.market_sync_balance(v_w.id,v_v.id);
  ELSE v_cost:=0; END IF;
  UPDATE public.market_documents SET status=CASE WHEN p_action='writeoff_approve' THEN 'posted' ELSE 'rejected' END,approved_by=p_actor,posted_at=now(),result=jsonb_build_object('cost_vnd',v_cost) WHERE id=v_d.id;
  v_result:=jsonb_build_object('ok',true,'document_id',v_d.id,'cost_vnd',v_cost);
 ELSIF p_action='count_start' THEN
  INSERT INTO public.market_documents(warehouse_id,kind,status,payload,actor_telegram_id)
  VALUES(v_w.id,'count','pending',p_data,p_actor) RETURNING id INTO v_doc;
  INSERT INTO public.market_inventory_count_items(document_id,batch_id,expected_raw,expected_units)
  SELECT v_doc,b.id,b.raw_quantity,coalesce((SELECT jsonb_agg(u.id ORDER BY u.id) FROM public.market_stock_units u WHERE u.batch_id=b.id AND u.status<>'written_off'),'[]') FROM public.market_batches b WHERE warehouse_id=v_w.id;
  v_result:=jsonb_build_object('ok',true,'document_id',v_doc);
 ELSIF p_action='count_submit' THEN
  SELECT * INTO STRICT v_d FROM public.market_documents WHERE id=(p_data->>'document_id')::uuid AND warehouse_id=v_w.id AND kind='count' AND status='pending' FOR UPDATE;
  FOR v_row IN SELECT * FROM jsonb_array_elements(p_data->'items') LOOP
   v_q:=(v_row->>'actual_raw')::bigint;
   IF v_q IS NULL OR v_q<0 OR jsonb_typeof(v_row->'actual_units')<>'array' THEN RAISE EXCEPTION 'Invalid count'; END IF;
   IF EXISTS(SELECT 1 FROM jsonb_array_elements_text(v_row->'actual_units') x GROUP BY x HAVING count(*)>1) THEN RAISE EXCEPTION 'Duplicate scanned unit'; END IF;
   IF EXISTS(SELECT 1 FROM jsonb_array_elements_text(v_row->'actual_units') x WHERE NOT EXISTS(SELECT 1 FROM public.market_stock_units u WHERE u.id::text=x AND u.batch_id=(v_row->>'batch_id')::uuid AND u.status<>'written_off')) THEN RAISE EXCEPTION 'Unknown unit or invalid unit status'; END IF;
   UPDATE public.market_inventory_count_items SET actual_raw=v_q,actual_units=v_row->'actual_units',surplus_cost_vnd=nullif(v_row->>'surplus_cost_vnd','')::bigint WHERE document_id=v_d.id AND batch_id=(v_row->>'batch_id')::uuid;
   IF NOT FOUND THEN RAISE EXCEPTION 'Batch outside count'; END IF;
  END LOOP;
  v_result:=jsonb_build_object('ok',true,'document_id',v_d.id);
 ELSIF p_action IN ('count_approve','count_reject') THEN
  SELECT * INTO STRICT v_d FROM public.market_documents WHERE id=(p_data->>'document_id')::uuid AND warehouse_id=v_w.id AND kind='count' AND status='pending' FOR UPDATE;
  IF p_action='count_approve' THEN
   IF EXISTS(SELECT 1 FROM public.market_inventory_count_items WHERE document_id=v_d.id AND (actual_raw IS NULL OR actual_units IS NULL)) THEN RAISE EXCEPTION 'Count incomplete'; END IF;
   FOR v_count IN SELECT * FROM public.market_inventory_count_items WHERE document_id=v_d.id ORDER BY batch_id LOOP
    SELECT * INTO STRICT v_b FROM public.market_batches WHERE id=v_count.batch_id FOR UPDATE;
    SELECT * INTO STRICT v_v FROM public.market_product_variants WHERE id=v_b.variant_id;
    -- Surplus is recorded separately and requires an explicit documented cost, never guessed.
    IF v_count.actual_raw>v_count.expected_raw THEN
     IF v_count.surplus_cost_vnd IS NULL THEN RAISE EXCEPTION 'Surplus cost required before approval'; END IF;
     v_q:=v_count.actual_raw-v_count.expected_raw;
     UPDATE public.market_batches SET raw_quantity=v_count.actual_raw,raw_cost_vnd=raw_cost_vnd+v_count.surplus_cost_vnd WHERE id=v_b.id;
     INSERT INTO public.stock_movements(location_id,stock_item_id,movement_type,quantity_delta,unit_cost_vnd,source_type,source_id,actor_telegram_id)
     VALUES(v_w.location_id,v_v.stock_item_id,'adjustment_in',v_q,v_count.surplus_cost_vnd::numeric/v_q,'manual_adjustment',v_d.id,p_actor);
     v_surplus:=v_surplus+v_count.surplus_cost_vnd;
    END IF;
    v_q:=greatest(v_count.expected_raw-v_count.actual_raw,0);
    v_cost:=CASE WHEN v_b.raw_quantity>0 THEN round(v_b.raw_cost_vnd::numeric*v_q/v_b.raw_quantity) ELSE 0 END;
    IF v_count.actual_raw<=v_count.expected_raw THEN
     UPDATE public.market_batches SET raw_quantity=v_count.actual_raw,raw_cost_vnd=raw_cost_vnd-v_cost WHERE id=v_b.id;
    END IF;
    FOR v_u IN SELECT * FROM public.market_stock_units WHERE batch_id=v_b.id AND status<>'written_off' LOOP
     IF NOT v_count.actual_units ? v_u.id::text THEN
      UPDATE public.market_stock_units SET status='written_off' WHERE id=v_u.id;
      v_q:=v_q+v_u.quantity; v_cost:=v_cost+v_u.cost_vnd;
     END IF;
    END LOOP;
    IF v_q>0 THEN
     INSERT INTO public.stock_movements(location_id,stock_item_id,movement_type,quantity_delta,unit_cost_vnd,source_type,source_id,actor_telegram_id)
     VALUES(v_w.location_id,v_v.stock_item_id,'adjustment_out',-v_q,v_cost::numeric/v_q,'manual_adjustment',v_d.id,p_actor);
    END IF;
    v_total:=v_total+v_cost; PERFORM public.market_sync_balance(v_w.id,v_v.id);
   END LOOP;
  END IF;
  UPDATE public.market_documents SET status=CASE WHEN p_action='count_approve' THEN 'posted' ELSE 'rejected' END,approved_by=p_actor,posted_at=now(),result=jsonb_build_object('shortage_cost_vnd',v_total,'surplus_cost_vnd',v_surplus) WHERE id=v_d.id;
  v_result:=jsonb_build_object('ok',true,'document_id',v_d.id,'shortage_cost_vnd',v_total,'surplus_cost_vnd',v_surplus);
 ELSIF p_action='scan' THEN
  IF length(coalesce(p_data->>'code','')) NOT BETWEEN 1 AND 128 THEN RAISE EXCEPTION 'Invalid scan code'; END IF;
  IF p_data->>'code' LIKE 'UMMA:%' THEN
   SELECT * INTO STRICT v_u FROM public.market_stock_units WHERE id=substring(p_data->>'code' FROM 6)::uuid;
   SELECT * INTO STRICT v_b FROM public.market_batches WHERE id=v_u.batch_id AND warehouse_id=v_w.id;
   v_result:=jsonb_build_object('ok',true,'type','unit','unit',to_jsonb(v_u)-'cost_vnd','batch',to_jsonb(v_b)-'raw_cost_vnd','blocked',v_u.status<>'available' OR v_b.status<>'available' OR coalesce(v_b.expires_on<(now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date,false));
  ELSE
   SELECT v.* INTO v_v FROM public.market_product_barcodes c JOIN public.market_product_variants v ON v.id=c.variant_id WHERE c.code=p_data->>'code';
   v_result:=jsonb_build_object('ok',true,'type',CASE WHEN FOUND THEN 'product' ELSE 'unknown' END,'variant',CASE WHEN FOUND THEN to_jsonb(v_v) ELSE null END);
  END IF;
  INSERT INTO public.market_scan_events(actor_telegram_id,warehouse_id,code,result) VALUES(p_actor,v_w.id,p_data->>'code',v_result);
 ELSIF p_action='print' THEN
  IF jsonb_array_length(p_data->'unit_ids') NOT BETWEEN 1 AND 500 THEN RAISE EXCEPTION 'Select 1..500 labels'; END IF;
  FOR v_unit IN SELECT value::uuid FROM jsonb_array_elements_text(p_data->'unit_ids') LOOP
   IF NOT EXISTS(SELECT 1 FROM public.market_stock_units u JOIN public.market_batches b ON b.id=u.batch_id WHERE u.id=v_unit AND b.warehouse_id=v_w.id AND u.status<>'written_off') THEN RAISE EXCEPTION 'Label unit unavailable'; END IF;
  END LOOP;
  INSERT INTO public.market_documents(warehouse_id,kind,status,payload,actor_telegram_id,posted_at)
  VALUES(v_w.id,'print','posted',p_data,p_actor,now()) RETURNING id INTO v_doc;
  INSERT INTO public.market_print_jobs(document_id,unit_ids,width_mm,height_mm)
  VALUES(v_doc,ARRAY(SELECT value::uuid FROM jsonb_array_elements_text(p_data->'unit_ids')),coalesce((p_data->>'width_mm')::integer,60),coalesce((p_data->>'height_mm')::integer,40)) RETURNING id INTO v_unit;
  v_result:=jsonb_build_object('ok',true,'job_id',v_unit);
 ELSIF p_action='print_result' THEN
  UPDATE public.market_print_jobs j SET status=CASE WHEN p_data->>'status'='failed' THEN 'failed' ELSE 'sent' END,error=left(p_data->>'error',500)
  FROM public.market_documents d WHERE j.id=(p_data->>'job_id')::uuid AND j.document_id=d.id AND d.warehouse_id=v_w.id AND d.actor_telegram_id=p_actor AND j.status='prepared';
  IF NOT FOUND THEN RAISE EXCEPTION 'Print job unavailable'; END IF;
  v_result:='{"ok":true}';
 ELSE RAISE EXCEPTION 'Unknown Market operation'; END IF;
 INSERT INTO public.market_operations(actor_telegram_id,request_id,action,payload,result) VALUES(p_actor,p_request,p_action,p_data,v_result);
 RETURN v_result;
END $$;
DO $$ DECLARE t text; f record; BEGIN
 FOREACH t IN ARRAY ARRAY['market_warehouses','market_staff_roles','market_product_variants','market_product_barcodes','market_documents','market_batches','market_stock_units','market_operations','market_inventory_count_items','market_scan_events','market_print_jobs'] LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated',t);
  EXECUTE format('GRANT ALL ON public.%I TO service_role',t);
 END LOOP;
 FOR f IN SELECT p.oid::regprocedure signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN ('market_can','market_operation','market_sync_balance','market_guard_balance','market_immutable') LOOP
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated',f.signature);
  EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role',f.signature);
 END LOOP;
END $$;
GRANT USAGE,SELECT ON SEQUENCE public.market_documents_number_seq TO service_role;
COMMIT;
