-- UMMA Market release: execute atomically through versioned migration; do not rerun.
BEGIN;

-- Source: market-stock-scan.sql
-- UMMA Stock & Scan: additive warehouse foundation. Existing Cafe tables and rows are preserved.
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
 stock_item_id uuid NOT NULL REFERENCES public.stock_items(id),
 sale_mode text NOT NULL CHECK(sale_mode IN ('piece','set','fixed_weight','individual_weight')),
 measure text NOT NULL CHECK(measure IN ('g','pcs')), fixed_quantity bigint CHECK(fixed_quantity>0),
 storage_conditions text, halal_evidence text, halal_verified boolean NOT NULL DEFAULT false, requires_quality_evidence boolean NOT NULL DEFAULT false, is_active boolean NOT NULL DEFAULT true
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
 batch_number text NOT NULL, expires_on date, storage_place text, quality_evidence jsonb NOT NULL DEFAULT '{}',
 status text NOT NULL CHECK(status IN ('available','quarantine')),
 raw_quantity bigint NOT NULL CHECK(raw_quantity>=0), raw_cost_vnd bigint NOT NULL CHECK(raw_cost_vnd>=0),
 created_at timestamptz NOT NULL DEFAULT now(), CHECK(raw_quantity>0 OR raw_cost_vnd=0)
);
CREATE INDEX market_batches_warehouse_idx ON public.market_batches(warehouse_id,variant_id,expires_on);
CREATE TABLE public.market_stock_units (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), batch_id uuid NOT NULL REFERENCES public.market_batches(id),
 variant_id uuid NOT NULL REFERENCES public.market_product_variants(id),
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
CREATE FUNCTION public.market_assert_batch_mutable(p_batch uuid,p_action text) RETURNS void LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$ BEGIN RETURN; END $$;
CREATE FUNCTION public.market_assert_warehouse_countable(p_warehouse uuid) RETURNS void LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$ BEGIN RETURN; END $$;
CREATE FUNCTION public.market_sync_balance(p_warehouse uuid,p_variant uuid) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
DECLARE v_location uuid; v_item uuid; v_qty numeric; v_cost bigint;
BEGIN
 SELECT w.location_id INTO STRICT v_location FROM public.market_warehouses w WHERE w.id=p_warehouse;
 SELECT stock_item_id INTO STRICT v_item FROM public.market_product_variants WHERE id=p_variant;
 SELECT coalesce(sum(b.raw_quantity),0)+coalesce((SELECT sum(u.quantity) FROM public.market_stock_units u JOIN public.market_batches b ON b.id=u.batch_id JOIN public.market_warehouses w ON w.id=b.warehouse_id WHERE w.location_id=v_location AND b.variant_id=p_variant AND u.status IN ('available','quarantine','reserved')),0),
 coalesce(sum(b.raw_cost_vnd),0)+coalesce((SELECT sum(u.cost_vnd) FROM public.market_stock_units u JOIN public.market_batches b ON b.id=u.batch_id JOIN public.market_warehouses w ON w.id=b.warehouse_id WHERE w.location_id=v_location AND b.variant_id=p_variant AND u.status IN ('available','quarantine','reserved')),0)
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
 WHEN 'writeoff_request' THEN ARRAY['warehouse','packer'] WHEN 'count_start' THEN ARRAY['warehouse']
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
  IF p_data->>'sale_mode' IN ('fixed_weight','individual_weight') AND p_data->>'measure'<>'g' THEN RAISE EXCEPTION 'Weight variants require grams'; END IF;
  IF nullif(p_data->>'category_id','') IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.categories WHERE id=(p_data->>'category_id')::uuid AND category_type='market') THEN RAISE EXCEPTION 'Invalid Market category'; END IF;
  IF p_data->>'measure' NOT IN ('g','pcs') THEN RAISE EXCEPTION 'Invalid measure'; END IF;
  INSERT INTO public.products(category_id,name_ru,name_en,name_vi,description_ru,description_en,description_vi,product_type,price_vnd,image_url,sku,is_active)
  VALUES(nullif(p_data->>'category_id','')::uuid,p_data->>'name_ru',coalesce(p_data->>'name_en',''),coalesce(p_data->>'name_vi',''),p_data->>'description_ru',p_data->>'description_en',p_data->>'description_vi','market',(p_data->>'price_vnd')::integer,nullif(p_data->>'image_url',''),nullif(p_data->>'sku',''),true) RETURNING id INTO v_product;
  INSERT INTO public.stock_items(name_ru,name_en,name_vi,item_type,base_unit,created_by_telegram_id)
  VALUES(p_data->>'name_ru',p_data->>'name_en',p_data->>'name_vi','finished_good',p_data->>'measure',p_actor) RETURNING id INTO v_item;
  INSERT INTO public.market_product_variants(product_id,stock_item_id,sale_mode,measure,fixed_quantity,storage_conditions,halal_evidence,requires_quality_evidence)
  VALUES(v_product,v_item,p_data->>'sale_mode',p_data->>'measure',nullif(p_data->>'fixed_quantity','')::bigint,p_data->>'storage_conditions',p_data->>'halal_evidence',coalesce((p_data->>'requires_quality_evidence')::boolean,false) OR EXISTS(SELECT 1 FROM public.categories WHERE id=nullif(p_data->>'category_id','')::uuid AND name_en IN ('Meat','Poultry'))) RETURNING * INTO v_v;
  INSERT INTO public.market_product_barcodes(code,variant_id,format) VALUES('UMMA-PRODUCT-'||v_v.id,v_v.id,'internal');
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
   IF nullif(v_row->'quality_evidence'->>'temperature_c','') IS NOT NULL THEN PERFORM (v_row->'quality_evidence'->>'temperature_c')::numeric; END IF;
   v_q:=(v_row->>'quantity')::bigint; v_cost:=(v_row->>'cost_vnd')::bigint;
   IF v_q IS NULL OR v_q<=0 OR v_cost IS NULL OR v_cost<0 OR nullif(v_row->>'batch_number','') IS NULL THEN RAISE EXCEPTION 'Invalid receipt line'; END IF;
   IF (v_row->>'planned_quantity')::bigint<v_q THEN RAISE EXCEPTION 'Accepted quantity exceeds planned quantity'; END IF;
   INSERT INTO public.purchase_items(purchase_document_id,stock_item_id,quantity,unit_cost_vnd,line_total_vnd,notes)
   VALUES(v_receipt,v_v.stock_item_id,v_q,v_cost::numeric/v_q,v_cost,v_row->>'notes');
   INSERT INTO public.market_batches(variant_id,warehouse_id,receipt_id,batch_number,expires_on,storage_place,status,raw_quantity,raw_cost_vnd,quality_evidence)
   VALUES(v_v.id,v_w.id,v_receipt,v_row->>'batch_number',nullif(v_row->>'expires_on','')::date,v_row->>'storage_place',CASE WHEN v_row->>'quality'='passed' AND (NOT v_v.requires_quality_evidence OR (nullif(v_row->'quality_evidence'->>'halal_document','') IS NOT NULL AND nullif(v_row->'quality_evidence'->>'provenance','') IS NOT NULL AND nullif(v_row->'quality_evidence'->>'temperature_c','') IS NOT NULL)) THEN 'available' ELSE 'quarantine' END,v_q,v_cost,coalesce(v_row->'quality_evidence','{}')) RETURNING id INTO v_batch;
   INSERT INTO public.stock_movements(location_id,stock_item_id,movement_type,quantity_delta,unit_cost_vnd,source_type,source_id,actor_telegram_id)
   VALUES(v_w.location_id,v_v.stock_item_id,'purchase_in',v_q,v_cost::numeric/v_q,'purchase_document',v_receipt,p_actor);
   PERFORM public.market_sync_balance(v_w.id,v_v.id);
   v_units:=v_units||jsonb_build_array(v_batch); v_total:=v_total+v_cost;
  END LOOP;
  UPDATE public.purchase_documents SET subtotal_vnd=v_total WHERE id=v_receipt;
  v_result:=jsonb_build_object('ok',true,'document_id',v_doc,'receipt_id',v_receipt,'batch_ids',v_units);
 ELSIF p_action='pack' THEN
  SELECT * INTO STRICT v_b FROM public.market_batches WHERE id=(p_data->>'batch_id')::uuid AND warehouse_id=v_w.id FOR UPDATE;
  PERFORM public.market_assert_batch_mutable(v_b.id,p_action);
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
   INSERT INTO public.market_stock_units(batch_id,variant_id,quantity,cost_vnd,packing_document_id) VALUES(v_b.id,coalesce((SELECT id FROM public.market_product_variants WHERE stock_item_id=v_v.stock_item_id AND sale_mode='fixed_weight' AND fixed_quantity=v_used AND is_active ORDER BY id LIMIT 1),v_b.variant_id),v_used,v_cost,v_doc) RETURNING id INTO v_unit;
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
    SELECT * INTO STRICT v_u FROM public.market_stock_units WHERE id=(p_data->>'unit_id')::uuid AND batch_id=v_b.id AND status IN ('available','quarantine','reserved') FOR UPDATE;
    v_q:=v_u.quantity;
   ELSIF v_q IS NULL OR v_q<=0 OR v_q>v_b.raw_quantity THEN RAISE EXCEPTION 'Invalid writeoff quantity'; END IF;
   INSERT INTO public.market_documents(warehouse_id,kind,status,reason,payload,actor_telegram_id)
   VALUES(v_w.id,'writeoff','pending',p_data->>'reason',p_data||jsonb_build_object('quantity',v_q),p_actor) RETURNING id INTO v_doc;
  ELSE
   SELECT * INTO STRICT v_v FROM public.market_product_variants WHERE id=v_b.variant_id;
   IF nullif(p_data->'quality_evidence'->>'temperature_c','') IS NOT NULL THEN PERFORM (p_data->'quality_evidence'->>'temperature_c')::numeric; END IF;
   IF p_action='release' AND v_v.requires_quality_evidence AND (nullif(coalesce(p_data->'quality_evidence',v_b.quality_evidence)->>'halal_document','') IS NULL OR nullif(coalesce(p_data->'quality_evidence',v_b.quality_evidence)->>'provenance','') IS NULL OR nullif(coalesce(p_data->'quality_evidence',v_b.quality_evidence)->>'temperature_c','') IS NULL) THEN RAISE EXCEPTION 'Meat quality, halal and temperature evidence required'; END IF;
   UPDATE public.market_batches SET quality_evidence=coalesce(p_data->'quality_evidence',quality_evidence),status=CASE WHEN p_action='quarantine' THEN 'quarantine' ELSE 'available' END WHERE id=v_b.id;
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
   PERFORM public.market_assert_batch_mutable(v_b.id,p_action);
   v_q:=(v_payload->>'quantity')::bigint;
   IF nullif(v_payload->>'unit_id','') IS NOT NULL THEN
    SELECT * INTO STRICT v_u FROM public.market_stock_units WHERE id=(v_payload->>'unit_id')::uuid AND batch_id=v_b.id AND status IN ('available','quarantine','reserved') FOR UPDATE;
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
  PERFORM public.market_assert_warehouse_countable(v_w.id);
  INSERT INTO public.market_documents(warehouse_id,kind,status,payload,actor_telegram_id)
  VALUES(v_w.id,'count','pending',p_data,p_actor) RETURNING id INTO v_doc;
  INSERT INTO public.market_inventory_count_items(document_id,batch_id,expected_raw,expected_units)
  SELECT v_doc,b.id,b.raw_quantity,coalesce((SELECT jsonb_agg(u.id ORDER BY u.id) FROM public.market_stock_units u WHERE u.batch_id=b.id AND u.status IN ('available','quarantine','reserved')),'[]') FROM public.market_batches b WHERE warehouse_id=v_w.id;
  v_result:=jsonb_build_object('ok',true,'document_id',v_doc);
 ELSIF p_action='count_submit' THEN
  SELECT * INTO STRICT v_d FROM public.market_documents WHERE id=(p_data->>'document_id')::uuid AND warehouse_id=v_w.id AND kind='count' AND status='pending' FOR UPDATE;
  FOR v_row IN SELECT * FROM jsonb_array_elements(p_data->'items') LOOP
   v_q:=(v_row->>'actual_raw')::bigint;
   IF v_q IS NULL OR v_q<0 OR jsonb_typeof(v_row->'actual_units')<>'array' THEN RAISE EXCEPTION 'Invalid count'; END IF;
   IF EXISTS(SELECT 1 FROM jsonb_array_elements_text(v_row->'actual_units') x GROUP BY x HAVING count(*)>1) THEN RAISE EXCEPTION 'Duplicate scanned unit'; END IF;
   IF EXISTS(SELECT 1 FROM jsonb_array_elements_text(v_row->'actual_units') x WHERE NOT EXISTS(SELECT 1 FROM public.market_stock_units u WHERE u.id::text=x AND u.batch_id=(v_row->>'batch_id')::uuid AND u.status IN ('available','quarantine','reserved'))) THEN RAISE EXCEPTION 'Unknown unit or invalid unit status'; END IF;
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
    FOR v_u IN SELECT * FROM public.market_stock_units WHERE batch_id=v_b.id AND status IN ('available','quarantine','reserved') LOOP
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
   IF NOT EXISTS(SELECT 1 FROM public.market_stock_units u JOIN public.market_batches b ON b.id=u.batch_id WHERE u.id=v_unit AND b.warehouse_id=v_w.id AND u.status IN ('available','quarantine','reserved')) THEN RAISE EXCEPTION 'Label unit unavailable'; END IF;
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
 FOR f IN SELECT p.oid::regprocedure signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN ('market_can','market_operation','market_sync_balance','market_guard_balance','market_immutable','market_assert_batch_mutable','market_assert_warehouse_countable') LOOP
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated',f.signature);
  EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role',f.signature);
 END LOOP;
END $$;
GRANT USAGE,SELECT ON SEQUENCE public.market_documents_number_seq TO service_role;

-- Source: market-commerce.sql
-- Shared orders/payment/delivery with Market allocations. Apply after market-stock-scan.sql.
ALTER TABLE public.cafe_orders ADD COLUMN source_module text NOT NULL DEFAULT 'cafe' CHECK(source_module IN ('cafe','market'));
ALTER TABLE public.market_print_jobs ADD COLUMN variant_ids uuid[] NOT NULL DEFAULT '{}';
ALTER TABLE public.market_stock_units DROP CONSTRAINT market_stock_units_status_check;
ALTER TABLE public.market_stock_units ADD CONSTRAINT market_stock_units_status_check CHECK(status IN ('available','quarantine','reserved','sold','written_off','returned'));
ALTER TABLE public.market_batches ADD COLUMN reserved_raw bigint NOT NULL DEFAULT 0 CHECK(reserved_raw>=0 AND reserved_raw<=raw_quantity);
ALTER TABLE public.market_product_variants ADD COLUMN composition jsonb NOT NULL DEFAULT '[]';
ALTER TABLE public.market_warehouses ADD COLUMN delivery_fee_vnd integer NOT NULL DEFAULT 0 CHECK(delivery_fee_vnd>=0);
ALTER TABLE public.market_warehouses ADD COLUMN reservation_minutes integer NOT NULL DEFAULT 15 CHECK(reservation_minutes BETWEEN 5 AND 120);
ALTER TABLE public.market_warehouses ADD COLUMN expiry_days integer[] NOT NULL DEFAULT '{7,3,1,0,-1}';
ALTER TABLE public.market_warehouses ADD COLUMN bank_transfer_details text;
ALTER TABLE public.market_warehouses ADD COLUMN sales_enabled boolean NOT NULL DEFAULT true;
CREATE TABLE public.market_offers(
 warehouse_id uuid NOT NULL REFERENCES public.market_warehouses(id),variant_id uuid NOT NULL REFERENCES public.market_product_variants(id),
 price_vnd integer NOT NULL CHECK(price_vnd>0),is_listed boolean NOT NULL DEFAULT true,
 PRIMARY KEY(warehouse_id,variant_id)
);
CREATE TABLE public.market_orders(
 order_id uuid PRIMARY KEY REFERENCES public.cafe_orders(id),warehouse_id uuid NOT NULL REFERENCES public.market_warehouses(id),
 reserve_until timestamptz,picked_by bigint REFERENCES public.telegram_users(telegram_id),picked_at timestamptz,
 handed_by bigint REFERENCES public.telegram_users(telegram_id),handed_to bigint REFERENCES public.telegram_users(telegram_id),handed_at timestamptz,package_count integer CHECK(package_count>0),
 sold_at timestamptz,payment_instructions jsonb NOT NULL DEFAULT '{}',sale_posted boolean NOT NULL DEFAULT false,released boolean NOT NULL DEFAULT false
);
CREATE TABLE public.market_order_lines(
 item_id uuid PRIMARY KEY REFERENCES public.cafe_order_items(id),order_id uuid NOT NULL REFERENCES public.market_orders(order_id),
 variant_id uuid NOT NULL REFERENCES public.market_product_variants(id),unit_id uuid REFERENCES public.market_stock_units(id),
 quantity bigint NOT NULL CHECK(quantity>0),CHECK(unit_id IS NULL OR quantity>0)
);
CREATE TABLE public.market_reservations(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),order_id uuid NOT NULL REFERENCES public.market_orders(order_id),
 item_id uuid NOT NULL REFERENCES public.market_order_lines(item_id),batch_id uuid NOT NULL REFERENCES public.market_batches(id),
 unit_id uuid REFERENCES public.market_stock_units(id),quantity bigint NOT NULL CHECK(quantity>0),cost_vnd bigint NOT NULL CHECK(cost_vnd>=0),
 picked_quantity bigint NOT NULL DEFAULT 0 CHECK(picked_quantity>=0 AND picked_quantity<=quantity),
 returned_quantity bigint NOT NULL DEFAULT 0 CHECK(returned_quantity>=0 AND returned_quantity<=quantity),returned_cost_vnd bigint NOT NULL DEFAULT 0 CHECK(returned_cost_vnd>=0 AND returned_cost_vnd<=cost_vnd),
 state text NOT NULL DEFAULT 'reserved' CHECK(state IN ('reserved','sold','released')),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX market_unit_reserved_once ON public.market_reservations(unit_id) WHERE unit_id IS NOT NULL AND state IN ('reserved','sold');
CREATE INDEX market_reservations_order ON public.market_reservations(order_id,state);
CREATE INDEX market_reservations_batch ON public.market_reservations(batch_id,state);
CREATE INDEX market_orders_warehouse ON public.market_orders(warehouse_id);
CREATE INDEX market_lines_variant ON public.market_order_lines(variant_id);
CREATE INDEX market_lines_unit ON public.market_order_lines(unit_id);
CREATE INDEX market_orders_due ON public.market_orders(reserve_until) WHERE reserve_until IS NOT NULL AND NOT released AND NOT sale_posted;
CREATE INDEX market_offers_variant ON public.market_offers(variant_id);

CREATE TABLE public.market_order_issues(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),order_id uuid NOT NULL REFERENCES public.market_orders(order_id),item_id uuid NOT NULL REFERENCES public.market_order_lines(item_id),
 kind text NOT NULL CHECK(kind IN ('missing','substitution')),state text NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','waiting','accepted','rejected','refund_required','resolved')),
 reason text NOT NULL CHECK(length(trim(reason)) BETWEEN 3 AND 1000),replacement_unit_id uuid REFERENCES public.market_stock_units(id),replacement_snapshot jsonb NOT NULL DEFAULT '{}',
 proposed_by bigint NOT NULL REFERENCES public.telegram_users(telegram_id),customer_answer text,answered_at timestamptz,resolution text,resolved_by bigint REFERENCES public.telegram_users(telegram_id),created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX market_issues_order ON public.market_order_issues(order_id);
CREATE UNIQUE INDEX market_issue_open ON public.market_order_issues(item_id) WHERE state IN ('pending','waiting','rejected','refund_required');

CREATE TABLE public.market_picking_events(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),order_id uuid NOT NULL REFERENCES public.market_orders(order_id),
 actor bigint NOT NULL REFERENCES public.telegram_users(telegram_id),code text NOT NULL,allocation_id uuid REFERENCES public.market_reservations(id),
 ok boolean NOT NULL,error text,created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX market_picking_order ON public.market_picking_events(order_id,created_at);
CREATE TABLE public.market_refunds(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),order_id uuid NOT NULL REFERENCES public.market_orders(order_id),
 actor bigint NOT NULL REFERENCES public.telegram_users(telegram_id),amount_vnd integer NOT NULL CHECK(amount_vnd>0),
 payment_method text NOT NULL CHECK(payment_method IN ('cash','qr','bank_transfer','card')),cash_shift_id uuid REFERENCES public.cafe_staff_shifts(id),
 reason text NOT NULL CHECK(length(trim(reason)) BETWEEN 3 AND 1000),payout_reference text NOT NULL CHECK(length(trim(payout_reference)) BETWEEN 1 AND 200),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX market_refunds_order ON public.market_refunds(order_id);
CREATE TABLE public.market_alerts(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),warehouse_id uuid NOT NULL REFERENCES public.market_warehouses(id),
 batch_id uuid REFERENCES public.market_batches(id),kind text NOT NULL,threshold_days integer,day date NOT NULL DEFAULT current_date,
 message text NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(batch_id,kind,threshold_days,day)
);
CREATE INDEX market_alerts_warehouse ON public.market_alerts(warehouse_id,created_at DESC);

-- Preserve the existing Cafe reservation function and add a narrowly scoped Market branch.
DO $patch$ DECLARE src text; BEGIN
 SELECT pg_get_functiondef('public.reserve_cafe_inventory_for_order_item()'::regprocedure) INTO src;
 IF position('Market item must use checkout' IN src)>0 THEN RAISE EXCEPTION 'Market item bridge already installed'; END IF;
 src:=regexp_replace(src,'(?i)\mbegin\M',E'BEGIN\n IF EXISTS(SELECT 1 FROM public.cafe_orders WHERE id=NEW.order_id AND source_module=''market'') THEN\n  IF TG_OP<>''INSERT'' OR current_setting(''umma.market_order_write'',true) IS DISTINCT FROM ''on'' OR NEW.product_id IS NOT NULL OR NEW.accounting_stock_item_id IS NOT NULL THEN RAISE EXCEPTION ''Market item must use checkout''; END IF;\n  RETURN NEW;\n END IF;');
 EXECUTE src;
END $patch$;

CREATE FUNCTION public.market_catalog(p_warehouse uuid DEFAULT NULL) RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path=pg_catalog,public AS $$
 SELECT jsonb_build_object('ok',true,'warehouses',coalesce((SELECT jsonb_agg(jsonb_build_object('id',w.id,'name',w.name,'location_id',w.location_id,'delivery_fee_vnd',w.delivery_fee_vnd,'reservation_minutes',w.reservation_minutes,'qr_enabled',l.id='e22788bd-4734-4b3a-911e-ba103d52617a'::uuid,'transfer_enabled',length(trim(coalesce(w.bank_transfer_details,'')))>0,'location',jsonb_build_object('name',l.name,'address',l.address,'city',l.city,'country',l.country,'latitude',l.latitude,'longitude',l.longitude,'delivery_zone',l.delivery_zone))) FROM public.market_warehouses w JOIN public.locations l ON l.id=w.location_id WHERE w.is_active AND w.sales_enabled AND l.is_active),'[]'),
 'categories',coalesce((SELECT jsonb_agg(to_jsonb(c) ORDER BY sort_order) FROM public.categories c WHERE category_type='market' AND is_active),'[]'),
 'offers',coalesce((SELECT jsonb_agg(jsonb_build_object('warehouse_id',o.warehouse_id,'variant_id',v.id,'price_vnd',o.price_vnd,'sale_mode',v.sale_mode,'measure',v.measure,'fixed_quantity',v.fixed_quantity,'storage_conditions',v.storage_conditions,'halal_evidence',CASE WHEN v.halal_verified AND length(trim(coalesce(v.halal_evidence,'')))>0 THEN 'verified' ELSE NULL END,'composition',v.composition,'product',jsonb_build_object('id',p.id,'category_id',p.category_id,'name_ru',p.name_ru,'name_en',p.name_en,'name_vi',p.name_vi,'description_ru',p.description_ru,'description_en',p.description_en,'description_vi',p.description_vi,'image_url',p.image_url,'weight_value',p.weight_value,'weight_unit',p.weight_unit),
 'available_quantity',coalesce((SELECT sum(b.raw_quantity-b.reserved_raw) FROM public.market_batches b WHERE b.warehouse_id=o.warehouse_id AND b.variant_id IN (SELECT id FROM public.market_product_variants WHERE stock_item_id=v.stock_item_id) AND b.status='available' AND (b.expires_on IS NULL OR b.expires_on>=(now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date)),0),
 'units',coalesce((SELECT jsonb_agg(jsonb_build_object('id',u.id,'quantity',u.quantity,'batch_number',b.batch_number,'expires_on',b.expires_on,'price_vnd',CASE WHEN v.sale_mode='individual_weight' THEN round(o.price_vnd::numeric*u.quantity/1000)::integer ELSE o.price_vnd END) ORDER BY b.expires_on NULLS LAST,u.id) FROM public.market_stock_units u JOIN public.market_batches b ON b.id=u.batch_id WHERE b.warehouse_id=o.warehouse_id AND u.variant_id=v.id AND (v.sale_mode<>'fixed_weight' OR u.quantity=v.fixed_quantity) AND u.status='available' AND b.status='available' AND (b.expires_on IS NULL OR b.expires_on>=(now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date)),'[]')))
 FROM public.market_offers o JOIN public.market_warehouses w ON w.id=o.warehouse_id JOIN public.market_product_variants v ON v.id=o.variant_id JOIN public.products p ON p.id=v.product_id
 WHERE (p_warehouse IS NULL OR o.warehouse_id=p_warehouse) AND w.is_active AND w.sales_enabled AND o.is_listed AND v.is_active AND p.is_active),'[]'));
$$;
CREATE FUNCTION public.market_quote(p_warehouse uuid,p_items jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
#variable_conflict use_column
DECLARE i jsonb; v public.market_product_variants; o public.market_offers; u public.market_stock_units; b public.market_batches;
 p public.products; result jsonb:='[]'; price_ integer; count_ integer; total_ bigint:=0; need_ bigint; available_ bigint;
BEGIN
 IF jsonb_typeof(p_items)<>'array' OR jsonb_array_length(p_items) NOT BETWEEN 1 AND 50 THEN RAISE EXCEPTION 'Choose 1..50 items'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.market_warehouses w JOIN public.locations l ON l.id=w.location_id WHERE w.id=p_warehouse AND w.is_active AND w.sales_enabled AND l.is_active) THEN RAISE EXCEPTION 'Store unavailable'; END IF;
 IF EXISTS(SELECT 1 FROM public.market_documents WHERE warehouse_id=p_warehouse AND kind='count' AND status='pending') THEN RAISE EXCEPTION 'Stocktake in progress; orders temporarily paused'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_items) a GROUP BY a->>'variant_id',coalesce(a->>'unit_id','') HAVING count(*)>1) THEN RAISE EXCEPTION 'Duplicate cart line'; END IF;
 FOR i IN SELECT * FROM jsonb_array_elements(p_items) LOOP
  SELECT * INTO STRICT v FROM public.market_product_variants WHERE id=(i->>'variant_id')::uuid AND is_active;
  SELECT * INTO STRICT p FROM public.products WHERE id=v.product_id AND is_active;
  SELECT * INTO STRICT o FROM public.market_offers WHERE warehouse_id=p_warehouse AND variant_id=v.id AND is_listed;
  count_:=(i->>'count')::integer; IF count_ IS NULL OR count_ NOT BETWEEN 1 AND 99 THEN RAISE EXCEPTION 'Invalid quantity'; END IF;
  IF v.sale_mode IN ('individual_weight','fixed_weight') THEN
   SELECT * INTO STRICT u FROM public.market_stock_units WHERE id=(i->>'unit_id')::uuid AND variant_id IN (SELECT id FROM public.market_product_variants WHERE stock_item_id=v.stock_item_id) AND status='available';
   SELECT * INTO STRICT b FROM public.market_batches WHERE id=u.batch_id AND warehouse_id=p_warehouse AND status='available' AND (expires_on IS NULL OR expires_on>=(now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date);
   IF count_<>1 OR (v.sale_mode='fixed_weight' AND u.quantity<>v.fixed_quantity) THEN RAISE EXCEPTION 'Choose one exact package per line'; END IF;
   need_:=u.quantity;price_:=CASE WHEN v.sale_mode='individual_weight' THEN round(o.price_vnd::numeric*u.quantity/1000)::integer ELSE o.price_vnd END;
  ELSE
   IF nullif(i->>'unit_id','') IS NOT NULL THEN RAISE EXCEPTION 'Unexpected package'; END IF;
   need_:=coalesce(v.fixed_quantity,1)*count_;price_:=o.price_vnd;
   SELECT coalesce(sum(raw_quantity-reserved_raw),0) INTO available_ FROM public.market_batches WHERE variant_id IN (SELECT id FROM public.market_product_variants WHERE stock_item_id=v.stock_item_id) AND warehouse_id=p_warehouse AND status='available' AND (expires_on IS NULL OR expires_on>=(now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date);
   IF available_<need_ THEN RAISE EXCEPTION 'Insufficient stock'; END IF;
  END IF;
  IF price_<=0 THEN RAISE EXCEPTION 'Invalid price'; END IF;
  total_:=total_+price_::bigint*count_;
  result:=result||jsonb_build_array(jsonb_build_object('variant_id',v.id,'unit_id',nullif(i->>'unit_id',''),'count',count_,'quantity',need_,'unit_price_vnd',price_,'name_ru',p.name_ru,'name_en',p.name_en,'name_vi',p.name_vi));
 END LOOP;
 IF total_>2000000000 THEN RAISE EXCEPTION 'Order total too large'; END IF;
 RETURN jsonb_build_object('ok',true,'items',result,'subtotal_vnd',total_);
END $$;
CREATE OR REPLACE FUNCTION public.market_assert_batch_mutable(p_batch uuid,p_action text) RETURNS void LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM public.market_reservations WHERE batch_id=p_batch AND state='reserved') THEN RAISE EXCEPTION 'Batch has reserved orders; resolve reservations first'; END IF;
END $$;
CREATE OR REPLACE FUNCTION public.market_assert_warehouse_countable(p_warehouse uuid) RETURNS void LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM public.market_reservations r JOIN public.market_orders o ON o.order_id=r.order_id WHERE o.warehouse_id=p_warehouse AND r.state='reserved') THEN RAISE EXCEPTION 'Complete or cancel active reservations before stocktake'; END IF;
END $$;
-- Only this internal helper consumes/releases allocations; caller holds the shared order row lock.
CREATE FUNCTION public.market_settle_stock(p_order uuid,p_sale boolean) RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
#variable_conflict use_column
DECLARE m public.market_orders; w public.market_warehouses; r public.market_reservations; b public.market_batches; v public.market_product_variants;
BEGIN
 SELECT * INTO STRICT m FROM public.market_orders WHERE order_id=p_order FOR UPDATE;
 IF m.sale_posted OR m.released THEN RETURN; END IF;
 SELECT * INTO STRICT w FROM public.market_warehouses WHERE id=m.warehouse_id;
 PERFORM pg_advisory_xact_lock(hashtextextended('market-location:'||w.location_id,0));
 IF p_sale AND EXISTS(SELECT 1 FROM public.market_documents WHERE warehouse_id=w.id AND kind='count' AND status='pending') THEN RAISE EXCEPTION 'Stocktake in progress'; END IF;
 FOR r IN SELECT * FROM public.market_reservations WHERE order_id=p_order AND state='reserved' ORDER BY batch_id,id FOR UPDATE LOOP
  SELECT * INTO STRICT b FROM public.market_batches WHERE id=r.batch_id FOR UPDATE;
  SELECT * INTO STRICT v FROM public.market_product_variants WHERE id=b.variant_id;
  IF p_sale AND (r.picked_quantity<>r.quantity OR b.status<>'available' OR b.expires_on<(now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date) THEN RAISE EXCEPTION 'Unverified, quarantined or expired goods cannot be handed over'; END IF;
  IF r.unit_id IS NOT NULL THEN
   IF NOT EXISTS(SELECT 1 FROM public.market_stock_units WHERE id=r.unit_id AND status='reserved') THEN RAISE EXCEPTION 'Package reservation mismatch'; END IF;
   UPDATE public.market_stock_units SET status=CASE WHEN p_sale THEN 'sold' ELSE 'available' END WHERE id=r.unit_id;
  ELSE
   UPDATE public.market_batches SET reserved_raw=reserved_raw-r.quantity,raw_quantity=raw_quantity-CASE WHEN p_sale THEN r.quantity ELSE 0 END,raw_cost_vnd=raw_cost_vnd-CASE WHEN p_sale THEN r.cost_vnd ELSE 0 END WHERE id=b.id;
  END IF;
  UPDATE public.market_reservations SET state=CASE WHEN p_sale THEN 'sold' ELSE 'released' END WHERE id=r.id;
  IF p_sale THEN
   INSERT INTO public.stock_movements(location_id,stock_item_id,movement_type,quantity_delta,unit_cost_vnd,source_type,source_id)
   VALUES(w.location_id,v.stock_item_id,'sale_out',-r.quantity,r.cost_vnd::numeric/r.quantity,'order',p_order);
  END IF;
  PERFORM public.market_sync_balance(w.id,v.id);
 END LOOP;
 UPDATE public.market_orders SET sale_posted=p_sale,sold_at=CASE WHEN p_sale THEN now() ELSE sold_at END,released=NOT p_sale,reserve_until=NULL WHERE order_id=p_order;
END $$;
CREATE FUNCTION public.market_order_guard() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
#variable_conflict use_column
DECLARE m public.market_orders; internal_ boolean:=current_setting('umma.market_order_write',true)='on';
BEGIN
 IF TG_OP='UPDATE' AND OLD.source_module IS DISTINCT FROM NEW.source_module THEN RAISE EXCEPTION 'Order module is immutable'; END IF;
 IF NEW.source_module<>'market' THEN RETURN NEW; END IF;
 IF TG_OP='INSERT' THEN IF internal_ IS DISTINCT FROM true THEN RAISE EXCEPTION 'Use Market checkout'; END IF; RETURN NEW; END IF;
 SELECT * INTO m FROM public.market_orders WHERE order_id=OLD.id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Market order extension missing'; END IF;
 IF NEW.status='ready' AND OLD.status<>'ready' AND (m.picked_at IS NULL OR EXISTS(SELECT 1 FROM public.market_reservations WHERE order_id=OLD.id AND state='reserved' AND picked_quantity<>quantity)) THEN RAISE EXCEPTION 'Complete all picking scans first'; END IF;
 IF NEW.delivery_status='picked_up' AND OLD.delivery_status<>'picked_up' AND (m.handed_at IS NULL OR m.handed_to IS DISTINCT FROM NEW.courier_telegram_id OR m.picked_at IS NULL OR (NEW.payment_timing IS DISTINCT FROM 'on_delivery' AND NEW.payment_status<>'paid')) THEN RAISE EXCEPTION 'Market handover not authorized'; END IF;
 IF NEW.status IS DISTINCT FROM OLD.status AND internal_ IS DISTINCT FROM true AND NOT(NEW.status='completed' AND OLD.status='ready' AND NEW.delivery_status='delivered' AND NEW.payment_status='paid') THEN RAISE EXCEPTION 'Use Market order controls'; END IF;
 IF NEW.status='completed' AND OLD.status<>'completed' AND (NEW.payment_status<>'paid' OR m.picked_at IS NULL OR (NEW.order_type='delivery' AND NEW.delivery_status<>'delivered')) THEN RAISE EXCEPTION 'Order must be picked, paid and delivered'; END IF;
 IF NEW.status='cancelled' AND NEW.payment_status='paid' THEN RAISE EXCEPTION 'Record full refund before cancellation'; END IF;
 IF (NEW.total_vnd,NEW.subtotal_vnd,NEW.delivery_fee_vnd,NEW.location_id) IS DISTINCT FROM (OLD.total_vnd,OLD.subtotal_vnd,OLD.delivery_fee_vnd,OLD.location_id) THEN RAISE EXCEPTION 'Confirmed order pricing is immutable'; END IF;
 RETURN NEW;
END $$;
CREATE FUNCTION public.market_order_changed() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
BEGIN
 IF NEW.source_module<>'market' THEN RETURN NEW; END IF;
 IF NEW.payment_status='paid' THEN UPDATE public.market_orders SET reserve_until=NULL WHERE order_id=NEW.id; END IF;
 IF NEW.status='cancelled' AND OLD.status<>'cancelled' THEN PERFORM public.market_settle_stock(NEW.id,false); END IF;
 IF (NEW.delivery_status='picked_up' AND OLD.delivery_status<>'picked_up') OR (NEW.status='completed' AND NEW.order_type='pickup' AND OLD.status<>'completed') THEN PERFORM public.market_settle_stock(NEW.id,true); END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER market_order_guard BEFORE INSERT OR UPDATE ON public.cafe_orders FOR EACH ROW EXECUTE FUNCTION public.market_order_guard();
CREATE TRIGGER market_order_changed AFTER UPDATE ON public.cafe_orders FOR EACH ROW EXECUTE FUNCTION public.market_order_changed();
CREATE FUNCTION public.market_commerce_operation(p_actor bigint,p_request uuid,p_action text,p_data jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
#variable_conflict use_column
DECLARE
 w public.market_warehouses; o public.cafe_orders; m public.market_orders; old_ public.market_operations;
 r public.market_reservations; b public.market_batches; u public.market_stock_units; v public.market_product_variants;
 issue_ public.market_order_issues;line_ public.market_order_lines;oi_ public.cafe_order_items;
 quote_ jsonb; i jsonb; result_ jsonb; order_ uuid; item_ uuid; qty_ bigint; cost_ bigint; left_ bigint; free_cost_ bigint;
 shift_ public.cafe_staff_shifts; cash_ bigint; method_ text;
 price_ integer; total_ integer; amount_ integer; already_ bigint; alloc_ uuid; code_ text; error_ text; refund_ uuid;
BEGIN
 IF p_actor IS NULL OR p_request IS NULL OR NOT EXISTS(SELECT 1 FROM public.telegram_users WHERE telegram_id=p_actor AND is_active) THEN RAISE EXCEPTION 'Market access denied'; END IF;
 SELECT * INTO STRICT w FROM public.market_warehouses WHERE id=(p_data->>'warehouse_id')::uuid AND is_active;
 IF p_action NOT IN ('order_create','order_cancel','substitution_answer') AND NOT public.market_can(p_actor,w.location_id,CASE WHEN p_action IN ('pick_scan','pick_complete','handover','missing','substitution_propose','issue_resolve') THEN ARRAY['picker'] WHEN p_action IN ('payment_confirm','pickup_complete') THEN ARRAY['cashier'] ELSE ARRAY['admin'] END) THEN RAISE EXCEPTION 'Market access denied'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('market-request:'||p_actor||':'||p_request,0));
 IF p_action<>'order_create' THEN
  SELECT c.* INTO STRICT o FROM public.cafe_orders c JOIN public.market_orders x ON x.order_id=c.id WHERE c.id=(p_data->>'order_id')::uuid AND x.warehouse_id=w.id FOR UPDATE OF c;
  SELECT * INTO STRICT m FROM public.market_orders WHERE order_id=o.id FOR UPDATE;
  IF p_action='substitution_answer' AND o.customer_telegram_id IS DISTINCT FROM p_actor THEN RAISE EXCEPTION 'Only the customer may consent'; END IF;
  IF p_action='order_cancel' AND o.customer_telegram_id IS DISTINCT FROM p_actor AND NOT public.market_can(p_actor,w.location_id,ARRAY['admin']) THEN RAISE EXCEPTION 'Order access denied'; END IF;
 END IF;
 SELECT * INTO old_ FROM public.market_operations WHERE actor_telegram_id=p_actor AND request_id=p_request;
 IF FOUND THEN IF old_.action<>p_action OR old_.payload<>p_data THEN RAISE EXCEPTION 'Idempotency key reused with different data'; END IF;RETURN old_.result||'{"replayed":true}'::jsonb; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('market-location:'||w.location_id,0));
 PERFORM set_config('umma.market_order_write','on',true);
 IF p_action='order_create' THEN
  quote_:=public.market_quote(w.id,p_data->'items');
  IF p_data->>'order_type' NOT IN ('pickup','delivery') OR p_data->>'payment_method' NOT IN ('cash','qr','bank_transfer') THEN RAISE EXCEPTION 'Invalid checkout method'; END IF;
  IF length(trim(coalesce(p_data->>'customer_name','')))<1 OR length(trim(coalesce(p_data->>'customer_phone','')))<3 THEN RAISE EXCEPTION 'Name and phone required'; END IF;
  IF p_data->>'payment_method'='qr' AND NOT EXISTS(SELECT 1 FROM public.locations WHERE id=w.location_id AND id='e22788bd-4734-4b3a-911e-ba103d52617a'::uuid) THEN RAISE EXCEPTION 'QR recipient not configured for this store'; END IF;
  IF p_data->>'payment_method'='bank_transfer' AND length(trim(coalesce(w.bank_transfer_details,'')))=0 THEN RAISE EXCEPTION 'Bank transfer details not configured'; END IF;
  total_:=(quote_->>'subtotal_vnd')::integer+CASE WHEN p_data->>'order_type'='delivery' THEN w.delivery_fee_vnd ELSE 0 END;
  IF (p_data->>'expected_total_vnd')::bigint IS DISTINCT FROM total_ THEN RAISE EXCEPTION 'Price changed; review the final total'; END IF;
  INSERT INTO public.cafe_orders(customer_telegram_id,location_id,status,order_type,payment_method,payment_status,customer_name,customer_phone,delivery_address,customer_note,subtotal_vnd,delivery_fee_vnd,total_vnd,created_via,payment_timing,source_module,delivery_status)
  VALUES(p_actor,w.location_id,'pending',p_data->>'order_type',p_data->>'payment_method','pending',left(p_data->>'customer_name',120),left(p_data->>'customer_phone',40),left(p_data->>'delivery_address',600),left(p_data->>'note',500),(quote_->>'subtotal_vnd')::integer,total_-(quote_->>'subtotal_vnd')::integer,total_,'customer',CASE WHEN p_data->>'payment_method'='cash' AND p_data->>'order_type'='delivery' THEN 'on_delivery' ELSE 'now' END,'market',CASE WHEN p_data->>'order_type'='delivery' THEN 'waiting_courier' ELSE 'not_required' END) RETURNING * INTO o;
  INSERT INTO public.market_orders(order_id,warehouse_id,payment_instructions,reserve_until) VALUES(o.id,w.id,CASE WHEN o.payment_method='bank_transfer' THEN jsonb_build_object('details',w.bank_transfer_details) ELSE '{}'::jsonb END,CASE WHEN o.payment_method<>'cash' THEN now()+make_interval(mins=>w.reservation_minutes) ELSE now()+interval '2 hours' END);
  FOR i IN SELECT * FROM jsonb_array_elements(quote_->'items') LOOP
   SELECT * INTO STRICT v FROM public.market_product_variants WHERE id=(i->>'variant_id')::uuid;
   INSERT INTO public.cafe_order_items(order_id,product_name_ru,product_name_en,product_name_vi,quantity,unit_price_vnd)
   VALUES(o.id,'Market · '||(i->>'name_ru'),i->>'name_en',i->>'name_vi',(i->>'count')::integer,(i->>'unit_price_vnd')::integer) RETURNING id INTO item_;
   INSERT INTO public.market_order_lines(item_id,order_id,variant_id,unit_id,quantity) VALUES(item_,o.id,v.id,nullif(i->>'unit_id','')::uuid,(i->>'quantity')::bigint);
   IF nullif(i->>'unit_id','') IS NOT NULL THEN
    SELECT * INTO STRICT u FROM public.market_stock_units WHERE id=(i->>'unit_id')::uuid AND variant_id IN (SELECT id FROM public.market_product_variants WHERE stock_item_id=v.stock_item_id) AND status='available' FOR UPDATE;
    UPDATE public.market_stock_units SET status='reserved' WHERE id=u.id;
    INSERT INTO public.market_reservations(order_id,item_id,batch_id,unit_id,quantity,cost_vnd) VALUES(o.id,item_,u.batch_id,u.id,u.quantity,u.cost_vnd);
   ELSE
    left_:=(i->>'quantity')::bigint;
    FOR b IN SELECT * FROM public.market_batches WHERE warehouse_id=w.id AND variant_id IN (SELECT id FROM public.market_product_variants WHERE stock_item_id=v.stock_item_id) AND status='available' AND raw_quantity>reserved_raw AND (expires_on IS NULL OR expires_on>=(now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date) ORDER BY expires_on NULLS LAST,created_at,id FOR UPDATE LOOP
     qty_:=least(left_,b.raw_quantity-b.reserved_raw);
     SELECT b.raw_cost_vnd-coalesce(sum(cost_vnd),0) INTO free_cost_ FROM public.market_reservations WHERE batch_id=b.id AND unit_id IS NULL AND state='reserved';
     cost_:=round(free_cost_::numeric*qty_/(b.raw_quantity-b.reserved_raw));
     INSERT INTO public.market_reservations(order_id,item_id,batch_id,quantity,cost_vnd) VALUES(o.id,item_,b.id,qty_,cost_);
     UPDATE public.market_batches SET reserved_raw=reserved_raw+qty_ WHERE id=b.id;
     left_:=left_-qty_;EXIT WHEN left_=0;
    END LOOP;
    IF left_<>0 THEN RAISE EXCEPTION 'Insufficient stock'; END IF;
   END IF;
   PERFORM public.market_sync_balance(w.id,v.id);
  END LOOP;
  INSERT INTO public.cafe_order_events(order_id,actor_telegram_id,to_status,note) VALUES(o.id,p_actor,'pending','UMMA Market: товары зарезервированы');
  result_:=jsonb_build_object('ok',true,'order_id',o.id,'order_number',o.order_number,'total_vnd',o.total_vnd);
 ELSIF p_action='order_cancel' THEN
  IF m.sale_posted OR o.status IN ('completed','cancelled') OR o.payment_status='paid' OR m.picked_at IS NOT NULL THEN RAISE EXCEPTION 'Order requires administrator return/refund review'; END IF;
  UPDATE public.cafe_orders SET status='cancelled',cancelled_at=now(),updated_at=now() WHERE id=o.id;
  result_:=jsonb_build_object('ok',true,'order_id',o.id);
 ELSIF p_action='payment_confirm' THEN
  IF (p_data->>'received_confirmed')::boolean IS DISTINCT FROM true OR length(trim(coalesce(p_data->>'reference','')))=0 THEN RAISE EXCEPTION 'Confirm actual received funds with a reference'; END IF;
  IF o.status IN ('cancelled','completed') OR o.payment_status<>'pending' OR m.released THEN RAISE EXCEPTION 'Order payment already resolved or order closed'; END IF;
  IF o.payment_method<>'cash' AND m.reserve_until<now() THEN RAISE EXCEPTION 'Reservation expired; review late payment before refund'; END IF;
  IF (p_data->>'amount_vnd')::bigint IS DISTINCT FROM o.total_vnd THEN RAISE EXCEPTION 'Payment amount mismatch'; END IF;
  IF o.payment_method='cash' AND NOT EXISTS(SELECT 1 FROM public.cafe_staff_shifts WHERE location_id=o.location_id AND staff_telegram_id=p_actor AND shift_status='open') THEN RAISE EXCEPTION 'Open a cash shift before recording cash'; END IF;
  INSERT INTO public.cafe_payment_receipts(order_id,location_id,collected_by_telegram_id,payment_method,amount_vnd,receipt_status,note) VALUES(o.id,o.location_id,p_actor,o.payment_method,o.total_vnd,'confirmed',left(p_data->>'reference',500));
  UPDATE public.cafe_orders SET payment_status='paid',paid_at=now(),paid_by_telegram_id=p_actor,updated_at=now() WHERE id=o.id;
  result_:=jsonb_build_object('ok',true,'order_id',o.id);
 ELSIF p_action IN ('missing','substitution_propose') THEN
  IF m.sale_posted OR m.handed_at IS NOT NULL OR o.status IN ('completed','cancelled') THEN RAISE EXCEPTION 'Order already handed over or closed'; END IF;
  SELECT * INTO STRICT line_ FROM public.market_order_lines WHERE item_id=(p_data->>'item_id')::uuid AND order_id=o.id;
  SELECT * INTO STRICT oi_ FROM public.cafe_order_items WHERE id=line_.item_id;
  quote_:='{}';
  IF p_action='substitution_propose' THEN
   IF line_.unit_id IS NULL OR oi_.quantity<>1 THEN RAISE EXCEPTION 'For a different SKU or amount, refund/cancel this item and create a new order with customer consent'; END IF;
   SELECT * INTO STRICT u FROM public.market_stock_units WHERE id=(p_data->>'replacement_unit_id')::uuid AND variant_id=line_.variant_id AND status='available';
   SELECT * INTO STRICT b FROM public.market_batches WHERE id=u.batch_id AND warehouse_id=w.id AND status='available' AND (expires_on IS NULL OR expires_on>=(now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date);
   SELECT * INTO STRICT v FROM public.market_product_variants WHERE id=line_.variant_id;
   SELECT CASE WHEN v.sale_mode='individual_weight' THEN round(price_vnd::numeric*u.quantity/1000)::integer ELSE price_vnd END INTO STRICT price_ FROM public.market_offers WHERE warehouse_id=w.id AND variant_id=v.id AND is_listed;
   IF price_<>oi_.unit_price_vnd THEN RAISE EXCEPTION 'Replacement changes the price; use a confirmed refund and a new order'; END IF;
   quote_:=jsonb_build_object('unit_id',u.id,'quantity',u.quantity,'measure',v.measure,'price_vnd',price_,'batch_number',b.batch_number,'expires_on',b.expires_on);
  END IF;
  INSERT INTO public.market_order_issues(order_id,item_id,kind,reason,replacement_unit_id,replacement_snapshot,proposed_by)
  VALUES(o.id,line_.item_id,CASE WHEN p_action='missing' THEN 'missing' ELSE 'substitution' END,p_data->>'reason',CASE WHEN p_action='substitution_propose' THEN u.id ELSE NULL END,quote_,p_actor) RETURNING id INTO alloc_;
  UPDATE public.market_reservations SET picked_quantity=0 WHERE item_id=line_.item_id AND state='reserved';
  UPDATE public.market_orders SET picked_at=NULL,picked_by=NULL WHERE order_id=o.id;
  UPDATE public.cafe_orders SET status='preparing',updated_at=now() WHERE id=o.id;
  result_:=jsonb_build_object('ok',true,'issue_id',alloc_);
 ELSIF p_action='substitution_answer' THEN
  SELECT * INTO STRICT issue_ FROM public.market_order_issues WHERE id=(p_data->>'issue_id')::uuid AND order_id=o.id AND state='pending' FOR UPDATE;
  IF o.status IN ('completed','cancelled') OR m.sale_posted THEN RAISE EXCEPTION 'Order closed'; END IF;
  IF p_data->>'answer'='accept' AND issue_.kind='substitution' THEN
   SELECT * INTO STRICT u FROM public.market_stock_units WHERE id=issue_.replacement_unit_id AND status='available' FOR UPDATE;
   SELECT * INTO STRICT b FROM public.market_batches WHERE id=u.batch_id AND warehouse_id=w.id AND status='available' AND (expires_on IS NULL OR expires_on>=(now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date);
   SELECT * INTO STRICT r FROM public.market_reservations WHERE item_id=issue_.item_id AND state='reserved' AND unit_id IS NOT NULL FOR UPDATE;
   IF r.unit_id=u.id THEN RAISE EXCEPTION 'Replacement must be a different package'; END IF;
   UPDATE public.market_stock_units SET status='available' WHERE id=r.unit_id AND status='reserved';
   UPDATE public.market_reservations SET state='released' WHERE id=r.id;
   UPDATE public.market_stock_units SET status='reserved' WHERE id=u.id;
   INSERT INTO public.market_reservations(order_id,item_id,batch_id,unit_id,quantity,cost_vnd) VALUES(o.id,issue_.item_id,u.batch_id,u.id,u.quantity,u.cost_vnd);
   UPDATE public.market_order_lines SET unit_id=u.id,quantity=u.quantity WHERE item_id=issue_.item_id;
   UPDATE public.market_order_issues SET state='accepted',customer_answer='accept',answered_at=now() WHERE id=issue_.id;
   PERFORM public.market_sync_balance(w.id,u.variant_id);
  ELSIF p_data->>'answer' IN ('wait','reject') THEN
   UPDATE public.market_order_issues SET state=CASE WHEN p_data->>'answer'='wait' THEN 'waiting' ELSE 'rejected' END,customer_answer=p_data->>'answer',answered_at=now() WHERE id=issue_.id;
  ELSIF p_data->>'answer'='cancel' THEN
   UPDATE public.market_order_issues SET state=CASE WHEN o.payment_status='paid' THEN 'refund_required' ELSE 'resolved' END,customer_answer='cancel',answered_at=now() WHERE id=issue_.id;
   IF o.payment_status<>'paid' THEN UPDATE public.cafe_orders SET status='cancelled',cancelled_at=now(),updated_at=now() WHERE id=o.id; END IF;
  ELSE RAISE EXCEPTION 'Invalid customer answer'; END IF;
  result_:=jsonb_build_object('ok',true,'order_id',o.id);
 ELSIF p_action='issue_resolve' THEN
  IF length(trim(coalesce(p_data->>'reason','')))<3 THEN RAISE EXCEPTION 'Resolution reason required'; END IF;
  UPDATE public.market_order_issues SET state='resolved',resolution=p_data->>'reason',resolved_by=p_actor WHERE id=(p_data->>'issue_id')::uuid AND order_id=o.id AND state IN ('waiting','rejected');
  IF NOT FOUND THEN RAISE EXCEPTION 'Await customer consent or refund'; END IF;
  result_:=jsonb_build_object('ok',true,'order_id',o.id);
 ELSIF p_action='pick_scan' THEN
  code_:=left(p_data->>'code',128);error_:=NULL;
  SELECT * INTO r FROM public.market_reservations WHERE id=(p_data->>'allocation_id')::uuid AND order_id=o.id AND state='reserved' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Allocation not found'; END IF;
  SELECT * INTO STRICT b FROM public.market_batches WHERE id=r.batch_id;
  SELECT * INTO STRICT v FROM public.market_product_variants WHERE id=b.variant_id;
  qty_:=coalesce((p_data->>'quantity')::bigint,CASE WHEN r.unit_id IS NOT NULL THEN r.quantity ELSE 1 END);
  IF o.status IN ('cancelled','completed','ready') OR m.picked_at IS NOT NULL THEN error_:='Picking already closed';
  ELSIF EXISTS(SELECT 1 FROM public.market_order_issues WHERE item_id=r.item_id AND state IN ('pending','waiting','rejected','refund_required')) THEN error_:='Resolve the item issue with the customer first';
  ELSIF o.payment_method<>'cash' AND o.payment_status<>'paid' THEN error_:='Confirm payment before picking';
  ELSIF b.status<>'available' OR b.expires_on<(now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date THEN error_:='Batch quarantined or expired';
  ELSIF r.unit_id IS NOT NULL AND code_ IS DISTINCT FROM 'UMMA:'||r.unit_id THEN error_:='Wrong package. Required UMMA:'||r.unit_id;
  ELSIF r.unit_id IS NULL AND NOT EXISTS(SELECT 1 FROM public.market_product_barcodes WHERE code=code_ AND variant_id=v.id) THEN error_:='Wrong manufacturer barcode';
  ELSIF qty_<=0 OR qty_>r.quantity-r.picked_quantity OR (r.unit_id IS NOT NULL AND qty_<>r.quantity) THEN error_:='Quantity exceeds unverified requirement';
  END IF;
  INSERT INTO public.market_picking_events(order_id,actor,code,allocation_id,ok,error) VALUES(o.id,p_actor,coalesce(code_,''),r.id,error_ IS NULL,error_);
  IF error_ IS NULL THEN
   UPDATE public.market_reservations SET picked_quantity=picked_quantity+qty_ WHERE id=r.id;
   UPDATE public.cafe_orders SET status='preparing',updated_at=now() WHERE id=o.id;
  END IF;
  result_:=jsonb_build_object('ok',error_ IS NULL,'error',error_,'order_id',o.id);
 ELSIF p_action='pick_complete' THEN
  IF o.status IN ('cancelled','completed','ready') OR m.released OR m.picked_at IS NOT NULL OR NOT EXISTS(SELECT 1 FROM public.market_reservations WHERE order_id=o.id AND state='reserved') OR EXISTS(SELECT 1 FROM public.market_reservations r JOIN public.market_batches b ON b.id=r.batch_id WHERE r.order_id=o.id AND r.state='reserved' AND (r.picked_quantity<>r.quantity OR b.status<>'available' OR b.expires_on<(now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date)) THEN RAISE EXCEPTION 'All required positions must be verified and available'; END IF;
  IF EXISTS(SELECT 1 FROM public.market_order_issues WHERE order_id=o.id AND state IN ('pending','waiting','rejected','refund_required')) THEN RAISE EXCEPTION 'Customer consent or issue resolution required'; END IF;
  IF o.payment_method<>'cash' AND o.payment_status<>'paid' THEN RAISE EXCEPTION 'Payment required'; END IF;
  UPDATE public.market_orders SET picked_by=p_actor,picked_at=now(),reserve_until=NULL WHERE order_id=o.id;
  UPDATE public.cafe_orders SET status='ready',updated_at=now() WHERE id=o.id;
  result_:=jsonb_build_object('ok',true,'order_id',o.id);
 ELSIF p_action='handover' THEN
  IF o.order_type<>'delivery' OR o.status<>'ready' OR o.courier_telegram_id IS NULL OR m.picked_at IS NULL OR m.sale_posted THEN RAISE EXCEPTION 'A ready order and assigned courier are required'; END IF;
  IF o.payment_timing IS DISTINCT FROM 'on_delivery' AND o.payment_status<>'paid' THEN RAISE EXCEPTION 'Confirm payment before handover'; END IF;
  UPDATE public.market_orders SET handed_by=p_actor,handed_to=o.courier_telegram_id,handed_at=now(),package_count=(p_data->>'package_count')::integer WHERE order_id=o.id;
  IF (p_data->>'package_count')::integer IS NULL THEN RAISE EXCEPTION 'Package count required'; END IF;
  result_:=jsonb_build_object('ok',true,'order_id',o.id);
 ELSIF p_action='pickup_complete' THEN
  IF o.order_type<>'pickup' OR o.status<>'ready' OR o.payment_status<>'paid' THEN RAISE EXCEPTION 'Ready and paid pickup required'; END IF;
  UPDATE public.market_orders SET handed_by=p_actor,handed_at=now(),package_count=(p_data->>'package_count')::integer WHERE order_id=o.id;
  IF (p_data->>'package_count')::integer IS NULL THEN RAISE EXCEPTION 'Package count required'; END IF;
  UPDATE public.cafe_orders SET status='completed',completed_at=now(),updated_at=now() WHERE id=o.id;
  result_:=jsonb_build_object('ok',true,'order_id',o.id);
 ELSIF p_action='refund' THEN
  amount_:=(p_data->>'amount_vnd')::integer;
  IF (p_data->>'payout_confirmed')::boolean IS DISTINCT FROM true OR length(trim(coalesce(p_data->>'reason','')))<3 OR length(trim(coalesce(p_data->>'reference','')))=0 THEN RAISE EXCEPTION 'Confirm actual refund with reason and payout reference'; END IF;
  IF o.payment_status NOT IN ('paid','refunded') THEN RAISE EXCEPTION 'No confirmed payment to refund'; END IF;
  SELECT coalesce(sum(amount_vnd),0) INTO already_ FROM public.market_refunds WHERE order_id=o.id;
  IF amount_ IS NULL OR amount_<=0 OR amount_>o.total_vnd-already_ THEN RAISE EXCEPTION 'Refund exceeds received funds'; END IF;
  IF already_+amount_=o.total_vnd AND m.sale_posted AND o.status<>'completed' AND EXISTS(SELECT 1 FROM public.market_reservations WHERE order_id=o.id AND state='sold' AND returned_quantity<quantity) THEN RAISE EXCEPTION 'Finish delivery or record the physical return before a full in-transit refund'; END IF;
  method_:=coalesce(p_data->>'payment_method',o.payment_method);
  IF method_='cash' THEN
   SELECT * INTO STRICT shift_ FROM public.cafe_staff_shifts WHERE location_id=o.location_id AND staff_telegram_id=p_actor AND shift_status='open' FOR UPDATE;
   SELECT shift_.opening_cash_vnd+coalesce((SELECT sum(amount_vnd) FROM public.cafe_payment_receipts WHERE location_id=o.location_id AND collected_by_telegram_id=p_actor AND payment_method='cash' AND receipt_status='confirmed' AND collected_at>=shift_.opened_at),0)
    +coalesce((SELECT sum(amount_vnd) FROM public.cafe_cash_handovers WHERE to_telegram_id=p_actor AND location_id=o.location_id AND handover_status='accepted' AND accepted_at>=shift_.opened_at),0)
    -coalesce((SELECT sum(amount_vnd) FROM public.cafe_cash_handovers WHERE from_telegram_id=p_actor AND location_id=o.location_id AND handover_status='accepted' AND accepted_at>=shift_.opened_at),0)
    -coalesce((SELECT sum(amount_vnd) FROM public.cafe_order_refunds WHERE cash_shift_id=shift_.id),0)
    -coalesce((SELECT sum(amount_vnd) FROM public.market_refunds WHERE cash_shift_id=shift_.id),0) INTO cash_;
   IF cash_<amount_ THEN RAISE EXCEPTION 'Insufficient recorded cash for refund'; END IF;
  END IF;
  INSERT INTO public.market_refunds(order_id,actor,amount_vnd,payment_method,cash_shift_id,reason,payout_reference) VALUES(o.id,p_actor,amount_,method_,shift_.id,p_data->>'reason',p_data->>'reference') RETURNING id INTO refund_;
  IF already_+amount_=o.total_vnd THEN UPDATE public.cafe_orders SET payment_status='refunded',status=CASE WHEN NOT m.sale_posted OR status<>'completed' THEN 'cancelled' ELSE status END,updated_at=now() WHERE id=o.id; END IF;
  result_:=jsonb_build_object('ok',true,'refund_id',refund_,'refunded_vnd',already_+amount_);
 ELSE RAISE EXCEPTION 'Unknown commerce operation'; END IF;
 INSERT INTO public.market_operations(actor_telegram_id,request_id,action,payload,result) VALUES(p_actor,p_request,p_action,p_data,result_);
 RETURN result_;
END $$;
CREATE FUNCTION public.market_expire_reservations() RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
#variable_conflict use_column
DECLARE x record; n integer:=0;
BEGIN
 PERFORM set_config('umma.market_order_write','on',true);
 FOR x IN SELECT o.id FROM public.cafe_orders o JOIN public.market_orders m ON m.order_id=o.id WHERE m.reserve_until<now() AND NOT m.released AND NOT m.sale_posted AND m.picked_at IS NULL AND o.payment_status='pending' AND o.status<>'cancelled' ORDER BY o.id FOR UPDATE OF o SKIP LOCKED LOOP
  UPDATE public.cafe_orders SET status='cancelled',cancelled_at=now(),updated_at=now() WHERE id=x.id AND payment_status='pending';
  INSERT INTO public.cafe_order_events(order_id,to_status,note) VALUES(x.id,'cancelled','UMMA Market: срок резервирования истёк');n:=n+1;
 END LOOP;
 INSERT INTO public.market_alerts(warehouse_id,batch_id,kind,threshold_days,day,message)
 SELECT b.warehouse_id,b.id,'expiry',d.days,(now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date,'Партия '||b.batch_number||': срок годности '||b.expires_on FROM public.market_batches b JOIN public.market_warehouses w ON w.id=b.warehouse_id CROSS JOIN LATERAL unnest(w.expiry_days) d(days)
 WHERE b.expires_on=(now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date+d.days AND (b.raw_quantity>0 OR EXISTS(SELECT 1 FROM public.market_stock_units u WHERE u.batch_id=b.id AND u.status IN ('available','reserved','quarantine'))) ON CONFLICT DO NOTHING;
 RETURN jsonb_build_object('ok',true,'expired',n);
END $$;

CREATE FUNCTION public.market_order_view(p_actor bigint,p_warehouse uuid DEFAULT NULL,p_staff boolean DEFAULT false) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=pg_catalog,public AS $$
#variable_conflict use_column
DECLARE w public.market_warehouses; financial_ boolean:=false;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.telegram_users WHERE telegram_id=p_actor AND is_active) THEN RAISE EXCEPTION 'Market access denied'; END IF;
 IF p_staff THEN
  SELECT * INTO STRICT w FROM public.market_warehouses WHERE id=p_warehouse;
  IF NOT public.market_can(p_actor,w.location_id,ARRAY['receiver','warehouse','packer','picker','cashier']) THEN RAISE EXCEPTION 'Market access denied'; END IF;
  financial_:=public.market_can(p_actor,w.location_id,ARRAY['admin']);
 END IF;
 RETURN jsonb_build_object('ok',true,'orders',coalesce((SELECT jsonb_agg(x ORDER BY x->>'created_at' DESC) FROM (
  SELECT (to_jsonb(c)-'created_by_telegram_id'-'paid_by_telegram_id'-'accepted_by_telegram_id')||jsonb_build_object('warehouse_id',m.warehouse_id,'payment_instructions',m.payment_instructions,'reserve_until',m.reserve_until,'picked_at',m.picked_at,'handed_at',m.handed_at,'sale_posted',m.sale_posted,
  'issues',coalesce((SELECT jsonb_agg(to_jsonb(z)-'proposed_by'-'resolved_by') FROM public.market_order_issues z WHERE z.order_id=c.id),'[]'),
  'refunded_vnd',coalesce((SELECT sum(amount_vnd) FROM public.market_refunds WHERE order_id=c.id),0),
  'items',coalesce((SELECT jsonb_agg(to_jsonb(i)||jsonb_build_object('variant_id',l.variant_id,'unit_id',l.unit_id,'base_quantity',l.quantity)) FROM public.cafe_order_items i JOIN public.market_order_lines l ON l.item_id=i.id WHERE i.order_id=c.id),'[]'),
  'allocations',coalesce((SELECT jsonb_agg((to_jsonb(r)-'cost_vnd'-'returned_cost_vnd')||CASE WHEN financial_ THEN jsonb_build_object('cost_vnd',r.cost_vnd,'returned_cost_vnd',r.returned_cost_vnd) ELSE '{}'::jsonb END||jsonb_build_object('batch_number',b.batch_number,'expires_on',b.expires_on,'storage_place',b.storage_place,'batch_status',b.status,'variant_id',l.variant_id,'measure',v.measure)) FROM public.market_reservations r JOIN public.market_batches b ON b.id=r.batch_id JOIN public.market_order_lines l ON l.item_id=r.item_id JOIN public.market_product_variants v ON v.id=l.variant_id WHERE r.order_id=c.id),'[]')) x
  FROM public.cafe_orders c JOIN public.market_orders m ON m.order_id=c.id WHERE (CASE WHEN p_staff THEN m.warehouse_id=p_warehouse ELSE c.customer_telegram_id=p_actor END) ORDER BY c.created_at DESC LIMIT 200
 ) rows_),'[]'));
END $$;

DO $$ DECLARE t text; f record; BEGIN
 FOREACH t IN ARRAY ARRAY['market_offers','market_orders','market_order_lines','market_reservations','market_picking_events','market_refunds','market_alerts','market_order_issues'] LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);EXECUTE format('REVOKE ALL ON public.%I FROM anon,authenticated',t);EXECUTE format('GRANT ALL ON public.%I TO service_role',t);
 END LOOP;
 FOR f IN SELECT oid::regprocedure signature FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname IN ('market_catalog','market_quote','market_settle_stock','market_order_guard','market_order_changed','market_commerce_operation','market_expire_reservations','market_order_view') LOOP
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated',f.signature);EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role',f.signature);
 END LOOP;
END $$;
CREATE TRIGGER market_picking_immutable BEFORE UPDATE OR DELETE ON public.market_picking_events FOR EACH ROW EXECUTE FUNCTION public.market_immutable();
CREATE TRIGGER market_refunds_immutable BEFORE UPDATE OR DELETE ON public.market_refunds FOR EACH ROW EXECUTE FUNCTION public.market_immutable();

-- Source: market-management.sql
ALTER TABLE public.market_warehouses ADD COLUMN loss_alert_vnd bigint NOT NULL DEFAULT 500000 CHECK(loss_alert_vnd>=0);
CREATE UNIQUE INDEX market_variant_shape ON public.market_product_variants(product_id,sale_mode,coalesce(fixed_quantity,0));
CREATE TABLE public.market_writeoff_corrections(original_document_id uuid PRIMARY KEY REFERENCES public.market_documents(id),correction_document_id uuid NOT NULL UNIQUE REFERENCES public.market_documents(id));
ALTER TABLE public.market_writeoff_corrections ENABLE ROW LEVEL SECURITY;REVOKE ALL ON public.market_writeoff_corrections FROM anon,authenticated;GRANT ALL ON public.market_writeoff_corrections TO service_role;
CREATE TABLE public.market_receiving_drafts(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),warehouse_id uuid NOT NULL REFERENCES public.market_warehouses(id),supplier_id uuid NOT NULL REFERENCES public.suppliers(id),
 lines jsonb NOT NULL,received jsonb NOT NULL DEFAULT '{}',state text NOT NULL DEFAULT 'draft' CHECK(state IN ('draft','partial','closed','rejected')),
 created_by bigint NOT NULL REFERENCES public.telegram_users(telegram_id),created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX market_receiving_warehouse ON public.market_receiving_drafts(warehouse_id,state);
ALTER TABLE public.market_receiving_drafts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.market_receiving_drafts FROM anon,authenticated;GRANT ALL ON public.market_receiving_drafts TO service_role;
ALTER TABLE public.market_documents DROP CONSTRAINT market_documents_kind_check;
ALTER TABLE public.market_documents ADD CONSTRAINT market_documents_kind_check CHECK(kind IN ('receipt','packing','writeoff','quarantine','release','count','adjustment','transfer','print','customer_return','supplier_return'));
CREATE OR REPLACE FUNCTION public.market_sync_balance(p_warehouse uuid,p_variant uuid) RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
#variable_conflict use_column
DECLARE loc_ uuid;item_ uuid;qty_ bigint;cost_ bigint;reserved_ bigint;
BEGIN
 SELECT location_id INTO STRICT loc_ FROM public.market_warehouses WHERE id=p_warehouse;
 SELECT stock_item_id INTO STRICT item_ FROM public.market_product_variants WHERE id=p_variant;
 SELECT coalesce(sum(b.raw_quantity),0),coalesce(sum(b.raw_cost_vnd),0),coalesce(sum(b.reserved_raw),0) INTO qty_,cost_,reserved_
 FROM public.market_batches b JOIN public.market_product_variants v ON v.id=b.variant_id JOIN public.market_warehouses w ON w.id=b.warehouse_id WHERE w.location_id=loc_ AND v.stock_item_id=item_;
 SELECT qty_+coalesce(sum(u.quantity),0),cost_+coalesce(sum(u.cost_vnd),0),reserved_+coalesce(sum(u.quantity) FILTER(WHERE u.status='reserved'),0) INTO qty_,cost_,reserved_
 FROM public.market_stock_units u JOIN public.market_batches b ON b.id=u.batch_id JOIN public.market_product_variants v ON v.id=b.variant_id JOIN public.market_warehouses w ON w.id=b.warehouse_id WHERE w.location_id=loc_ AND v.stock_item_id=item_ AND u.status IN ('available','quarantine','reserved');
 PERFORM set_config('umma.market_operation','on',true);
 INSERT INTO public.stock_balances(location_id,stock_item_id,quantity_on_hand,quantity_reserved,average_unit_cost_vnd)
 VALUES(loc_,item_,qty_,reserved_,CASE WHEN qty_>0 THEN cost_::numeric/qty_ ELSE 0 END)
 ON CONFLICT(location_id,stock_item_id) DO UPDATE SET quantity_on_hand=excluded.quantity_on_hand,quantity_reserved=excluded.quantity_reserved,average_unit_cost_vnd=excluded.average_unit_cost_vnd,updated_at=now();
END $$;
CREATE FUNCTION public.market_management_operation(p_actor bigint,p_request uuid,p_action text,p_data jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
#variable_conflict use_column
DECLARE w public.market_warehouses;target_ public.market_warehouses;v public.market_product_variants;b public.market_batches;u public.market_stock_units;r public.market_reservations;
 old_ public.market_operations;draft_ public.market_receiving_drafts;result_ jsonb;data_ jsonb;i jsonb;lines_ jsonb;received_ jsonb;sub_ jsonb;
 original_ public.market_documents;doc_ uuid;batch_ uuid;product_ uuid;variant_ uuid;qty_ bigint;cost_ bigint;planned_ bigint;accepted_ bigint;loss_ bigint;key_ text;id_ uuid;location_ uuid;
BEGIN
 IF p_actor IS NULL OR p_request IS NULL THEN RAISE EXCEPTION 'Missing operation identity'; END IF;
 SELECT * INTO STRICT w FROM public.market_warehouses WHERE id=(p_data->>'warehouse_id')::uuid AND is_active;
 IF NOT public.market_can(p_actor,w.location_id,CASE WHEN p_action IN ('receipt_draft','receipt_accept','receipt_close') THEN ARRAY['receiver'] WHEN p_action='transfer' THEN ARRAY['warehouse'] WHEN p_action IN ('shift_open','shift_close') THEN ARRAY['cashier'] WHEN p_action IN ('pack_with_loss','product_print') THEN ARRAY['packer','warehouse'] ELSE ARRAY['admin'] END) THEN RAISE EXCEPTION 'Market access denied'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('market-request:'||p_actor||':'||p_request,0));
 SELECT * INTO old_ FROM public.market_operations WHERE actor_telegram_id=p_actor AND request_id=p_request;
 IF FOUND THEN IF old_.action<>p_action OR old_.payload<>p_data THEN RAISE EXCEPTION 'Idempotency key reused with different data'; END IF;RETURN old_.result||'{"replayed":true}'::jsonb; END IF;
 IF p_action='transfer' THEN
  SELECT * INTO STRICT target_ FROM public.market_warehouses WHERE id=(p_data->>'target_warehouse_id')::uuid AND is_active AND id<>w.id;
  IF NOT public.market_can(p_actor,target_.location_id,ARRAY['warehouse']) THEN RAISE EXCEPTION 'Destination access denied'; END IF;
  FOR location_ IN SELECT x FROM unnest(ARRAY[w.location_id,target_.location_id]) x ORDER BY x LOOP PERFORM pg_advisory_xact_lock(hashtextextended('market-location:'||location_,0)); END LOOP;
 ELSE PERFORM pg_advisory_xact_lock(hashtextextended('market-location:'||w.location_id,0)); END IF;
 IF EXISTS(SELECT 1 FROM public.market_documents WHERE warehouse_id IN (w.id,target_.id) AND kind='count' AND status='pending') THEN RAISE EXCEPTION 'Stocktake in progress'; END IF;
 IF p_action='shift_open' THEN
  INSERT INTO public.cafe_staff_shifts(location_id,staff_telegram_id,opened_by_telegram_id,opening_cash_vnd) VALUES(w.location_id,p_actor,p_actor,(p_data->>'opening_cash_vnd')::integer) RETURNING id INTO id_;
  result_:=jsonb_build_object('ok',true,'shift_id',id_);
 ELSIF p_action='shift_close' THEN
  IF NOT EXISTS(SELECT 1 FROM public.cafe_staff_shifts WHERE id=(p_data->>'shift_id')::uuid AND location_id=w.location_id AND staff_telegram_id=p_actor) THEN RAISE EXCEPTION 'Shift access denied'; END IF;
  result_:=public.close_cafe_staff_shift((p_data->>'shift_id')::uuid,p_actor,(p_data->>'counted_cash_vnd')::integer,p_data->>'note');
 ELSIF p_action='product_print' THEN
  SELECT * INTO STRICT v FROM public.market_product_variants WHERE id=(p_data->>'variant_id')::uuid;
  INSERT INTO public.market_documents(warehouse_id,kind,status,payload,actor_telegram_id,posted_at) VALUES(w.id,'print','posted',p_data,p_actor,now()) RETURNING id INTO doc_;
  INSERT INTO public.market_print_jobs(document_id,unit_ids,variant_ids,width_mm,height_mm) VALUES(doc_,'{}',ARRAY[v.id],60,40) RETURNING id INTO id_;
  result_:=jsonb_build_object('ok',true,'job_id',id_);
 ELSIF p_action='offer_save' THEN
  SELECT * INTO STRICT v FROM public.market_product_variants WHERE id=(p_data->>'variant_id')::uuid;
  INSERT INTO public.market_offers(warehouse_id,variant_id,price_vnd,is_listed) VALUES(w.id,v.id,(p_data->>'price_vnd')::integer,coalesce((p_data->>'is_listed')::boolean,true))
  ON CONFLICT(warehouse_id,variant_id) DO UPDATE SET price_vnd=excluded.price_vnd,is_listed=excluded.is_listed;
  IF v.sale_mode='fixed_weight' THEN
   UPDATE public.market_stock_units u SET variant_id=v.id FROM public.market_batches b JOIN public.market_product_variants source ON source.id=b.variant_id WHERE u.batch_id=b.id AND b.warehouse_id=w.id AND source.stock_item_id=v.stock_item_id AND u.quantity=v.fixed_quantity AND u.status IN ('available','quarantine');
  END IF;
  result_:='{"ok":true}';
 ELSIF p_action='settings' THEN
  UPDATE public.market_warehouses SET bank_transfer_details=nullif(p_data->>'bank_transfer_details',''),delivery_fee_vnd=(p_data->>'delivery_fee_vnd')::integer,reservation_minutes=(p_data->>'reservation_minutes')::integer,loss_alert_vnd=(p_data->>'loss_alert_vnd')::bigint,sales_enabled=coalesce((p_data->>'sales_enabled')::boolean,true),expiry_days=CASE WHEN jsonb_typeof(p_data->'expiry_days')='array' THEN ARRAY(SELECT value::integer FROM jsonb_array_elements_text(p_data->'expiry_days')) ELSE expiry_days END WHERE id=w.id;
  result_:='{"ok":true}';
 ELSIF p_action='category_save' THEN
  IF nullif(p_data->>'id','') IS NULL THEN
   INSERT INTO public.categories(name_ru,name_en,name_vi,category_type) VALUES(p_data->>'name_ru',coalesce(p_data->>'name_en',''),coalesce(p_data->>'name_vi',''),'market') RETURNING id INTO id_;
  ELSE
   UPDATE public.categories SET name_ru=p_data->>'name_ru',name_en=coalesce(p_data->>'name_en',''),name_vi=coalesce(p_data->>'name_vi',''),is_active=coalesce((p_data->>'is_active')::boolean,true) WHERE id=(p_data->>'id')::uuid AND category_type='market' RETURNING id INTO id_;
   IF NOT FOUND THEN RAISE EXCEPTION 'Market category not found'; END IF;
  END IF;
  result_:=jsonb_build_object('ok',true,'category_id',id_);
 ELSIF p_action='product_update' THEN
  SELECT * INTO STRICT v FROM public.market_product_variants WHERE id=(p_data->>'variant_id')::uuid;
  IF nullif(p_data->>'category_id','') IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.categories WHERE id=(p_data->>'category_id')::uuid AND category_type='market') THEN RAISE EXCEPTION 'Invalid category'; END IF;
  IF nullif(p_data->>'image_url','') IS NOT NULL AND p_data->>'image_url' NOT LIKE 'https://%' THEN RAISE EXCEPTION 'HTTPS product image required'; END IF;
  UPDATE public.products SET name_ru=p_data->>'name_ru',name_en=coalesce(p_data->>'name_en',''),name_vi=coalesce(p_data->>'name_vi',''),description_ru=p_data->>'description_ru',description_en=p_data->>'description_en',description_vi=p_data->>'description_vi',category_id=nullif(p_data->>'category_id','')::uuid,image_url=nullif(p_data->>'image_url',''),is_active=coalesce((p_data->>'is_active')::boolean,true),updated_at=now() WHERE id=v.product_id AND product_type='market';
  UPDATE public.market_product_variants SET storage_conditions=p_data->>'storage_conditions',halal_evidence=p_data->>'halal_evidence',halal_verified=coalesce((p_data->>'halal_verified')::boolean,false) AND length(trim(coalesce(p_data->>'halal_evidence','')))>0,requires_quality_evidence=coalesce((p_data->>'requires_quality_evidence')::boolean,false),is_active=coalesce((p_data->>'is_active')::boolean,true),composition=coalesce(p_data->'composition','[]') WHERE product_id=v.product_id;
  result_:='{"ok":true}';
 ELSIF p_action='variant_create' THEN
  SELECT * INTO STRICT v FROM public.market_product_variants WHERE id=(p_data->>'source_variant_id')::uuid;
  IF p_data->>'sale_mode' IN ('fixed_weight','individual_weight') AND v.measure<>'g' THEN RAISE EXCEPTION 'Weight variants require grams'; END IF;
  INSERT INTO public.market_product_variants(product_id,stock_item_id,sale_mode,measure,fixed_quantity,storage_conditions,halal_evidence,halal_verified,requires_quality_evidence,composition)
  VALUES(v.product_id,v.stock_item_id,p_data->>'sale_mode',v.measure,nullif(p_data->>'fixed_quantity','')::bigint,v.storage_conditions,v.halal_evidence,v.halal_verified,v.requires_quality_evidence,v.composition) RETURNING id INTO variant_;
  result_:=jsonb_build_object('ok',true,'variant_id',variant_);
 ELSIF p_action='receipt_draft' THEN
  IF jsonb_typeof(p_data->'lines')<>'array' OR jsonb_array_length(p_data->'lines') NOT BETWEEN 1 AND 200 THEN RAISE EXCEPTION 'Planned lines required'; END IF;
  FOR i IN SELECT * FROM jsonb_array_elements(p_data->'lines') LOOP
   IF (i->>'quantity')::bigint IS NULL OR (i->>'quantity')::bigint<=0 OR NOT EXISTS(SELECT 1 FROM public.market_product_variants WHERE id=(i->>'variant_id')::uuid AND is_active) THEN RAISE EXCEPTION 'Invalid planned line'; END IF;
  END LOOP;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_data->'lines') x GROUP BY x->>'variant_id' HAVING count(*)>1) THEN RAISE EXCEPTION 'Duplicate planned product'; END IF;
  INSERT INTO public.market_receiving_drafts(warehouse_id,supplier_id,lines,created_by) VALUES(w.id,(p_data->>'supplier_id')::uuid,p_data->'lines',p_actor) RETURNING id INTO id_;
  result_:=jsonb_build_object('ok',true,'draft_id',id_);
 ELSIF p_action IN ('receipt_accept','receipt_close') THEN
  SELECT * INTO STRICT draft_ FROM public.market_receiving_drafts WHERE id=(p_data->>'draft_id')::uuid AND warehouse_id=w.id AND state IN ('draft','partial') FOR UPDATE;
  IF p_action='receipt_close' THEN
   IF length(trim(coalesce(p_data->>'reason','')))<3 THEN RAISE EXCEPTION 'Reason for rejected/missing goods required'; END IF;
   UPDATE public.market_receiving_drafts SET state=CASE WHEN received='{}' THEN 'rejected' ELSE 'closed' END WHERE id=draft_.id;
   result_:='{"ok":true}';
  ELSE
   received_:=draft_.received;
   FOR i IN SELECT * FROM jsonb_array_elements(p_data->'items') LOOP
    key_:=i->>'variant_id';SELECT (x->>'quantity')::bigint INTO STRICT planned_ FROM jsonb_array_elements(draft_.lines) x WHERE x->>'variant_id'=key_;
    accepted_:=coalesce((received_->>key_)::bigint,0)+(i->>'quantity')::bigint;
    IF accepted_>planned_ THEN RAISE EXCEPTION 'Accepted quantity exceeds remaining plan'; END IF;
    received_:=jsonb_set(received_,ARRAY[key_],to_jsonb(accepted_));
   END LOOP;
   sub_:=public.market_operation(p_actor,gen_random_uuid(),'receive',jsonb_build_object('warehouse_id',w.id,'supplier_id',draft_.supplier_id,'items',p_data->'items','draft_id',draft_.id));
   UPDATE public.market_receiving_drafts SET received=received_,state=CASE WHEN NOT EXISTS(SELECT 1 FROM jsonb_array_elements(draft_.lines) x WHERE coalesce((received_->>(x->>'variant_id'))::bigint,0)<(x->>'quantity')::bigint) THEN 'closed' ELSE 'partial' END WHERE id=draft_.id;
   result_:=sub_;
  END IF;
 ELSIF p_action='pack_with_loss' THEN
  loss_:=(p_data->>'loss_quantity')::bigint;IF loss_ IS NULL OR loss_<=0 THEN RAISE EXCEPTION 'Positive loss required'; END IF;
  sub_:=public.market_operation(p_actor,gen_random_uuid(),'writeoff_request',jsonb_build_object('warehouse_id',w.id,'batch_id',p_data->>'batch_id','quantity',loss_,'reason',coalesce(p_data->>'reason','Потери при фасовке')));
  IF public.market_can(p_actor,w.location_id,ARRAY['admin']) THEN
   PERFORM public.market_operation(p_actor,gen_random_uuid(),'writeoff_approve',jsonb_build_object('warehouse_id',w.id,'document_id',sub_->>'document_id'));
   result_:=public.market_operation(p_actor,gen_random_uuid(),'pack',(p_data-'reason')||jsonb_build_object('loss_quantity',0));
  ELSE result_:=sub_||'{"approval_required":true}'::jsonb; END IF;
 ELSIF p_action IN ('transfer','supplier_return') THEN
  SELECT * INTO STRICT b FROM public.market_batches WHERE id=(p_data->>'batch_id')::uuid AND warehouse_id=w.id FOR UPDATE;
  PERFORM public.market_assert_batch_mutable(b.id,p_action);SELECT * INTO STRICT v FROM public.market_product_variants WHERE id=b.variant_id;
  IF length(trim(coalesce(p_data->>'reason','')))<3 THEN RAISE EXCEPTION 'Reason required'; END IF;
  IF nullif(p_data->>'unit_id','') IS NOT NULL THEN
   SELECT * INTO STRICT u FROM public.market_stock_units WHERE id=(p_data->>'unit_id')::uuid AND batch_id=b.id AND status IN ('available','quarantine') FOR UPDATE;qty_:=u.quantity;cost_:=u.cost_vnd;
  ELSE
   qty_:=(p_data->>'quantity')::bigint;IF qty_ IS NULL OR qty_<=0 OR qty_>b.raw_quantity THEN RAISE EXCEPTION 'Invalid transfer quantity'; END IF;
   cost_:=round(b.raw_cost_vnd::numeric*qty_/b.raw_quantity);
  END IF;
  INSERT INTO public.market_documents(warehouse_id,kind,status,reason,payload,result,actor_telegram_id,posted_at) VALUES(w.id,p_action,'posted',p_data->>'reason',p_data,jsonb_build_object('quantity',qty_,'cost_vnd',cost_),p_actor,now()) RETURNING id INTO doc_;
  IF p_action='transfer' THEN
   INSERT INTO public.market_batches(variant_id,warehouse_id,receipt_id,batch_number,expires_on,storage_place,status,raw_quantity,raw_cost_vnd,quality_evidence)
   VALUES(b.variant_id,target_.id,b.receipt_id,b.batch_number,b.expires_on,p_data->>'target_storage_place',b.status,CASE WHEN u.id IS NULL THEN qty_ ELSE 0 END,CASE WHEN u.id IS NULL THEN cost_ ELSE 0 END,b.quality_evidence) RETURNING id INTO batch_;
  END IF;
  IF u.id IS NULL THEN UPDATE public.market_batches SET raw_quantity=raw_quantity-qty_,raw_cost_vnd=raw_cost_vnd-cost_ WHERE id=b.id;
  ELSIF p_action='transfer' THEN UPDATE public.market_stock_units SET batch_id=batch_ WHERE id=u.id;
  ELSE UPDATE public.market_stock_units SET status='returned' WHERE id=u.id; END IF;
  INSERT INTO public.stock_movements(location_id,stock_item_id,movement_type,quantity_delta,unit_cost_vnd,source_type,source_id,actor_telegram_id) VALUES(w.location_id,v.stock_item_id,'transfer_out',-qty_,cost_::numeric/qty_,'transfer',doc_,p_actor);
  IF p_action='transfer' THEN
   INSERT INTO public.stock_movements(location_id,stock_item_id,movement_type,quantity_delta,unit_cost_vnd,source_type,source_id,actor_telegram_id) VALUES(target_.location_id,v.stock_item_id,'transfer_in',qty_,cost_::numeric/qty_,'transfer',doc_,p_actor);
   PERFORM public.market_sync_balance(target_.id,v.id);
  END IF;
  PERFORM public.market_sync_balance(w.id,v.id);result_:=jsonb_build_object('ok',true,'document_id',doc_,'target_batch_id',batch_);
 ELSIF p_action='reverse_writeoff' THEN
  SELECT * INTO STRICT original_ FROM public.market_documents WHERE id=(p_data->>'document_id')::uuid AND warehouse_id=w.id AND kind='writeoff' AND status='posted';
  IF EXISTS(SELECT 1 FROM public.market_writeoff_corrections WHERE original_document_id=original_.id) THEN RAISE EXCEPTION 'Writeoff already corrected'; END IF;
  IF length(trim(coalesce(p_data->>'reason','')))<3 THEN RAISE EXCEPTION 'Correction reason required'; END IF;
  SELECT * INTO STRICT b FROM public.market_batches WHERE id=(original_.payload->>'batch_id')::uuid;
  qty_:=(original_.payload->>'quantity')::bigint;cost_:=(original_.result->>'cost_vnd')::bigint;
  INSERT INTO public.market_documents(warehouse_id,kind,status,reason,payload,result,actor_telegram_id,posted_at) VALUES(w.id,'adjustment','posted',p_data->>'reason',p_data,jsonb_build_object('restored_cost_vnd',cost_,'quantity',qty_),p_actor,now()) RETURNING id INTO doc_;
  INSERT INTO public.market_batches(variant_id,warehouse_id,receipt_id,batch_number,expires_on,storage_place,status,raw_quantity,raw_cost_vnd,quality_evidence)
  VALUES(b.variant_id,w.id,b.receipt_id,b.batch_number||'/CORRECTION',b.expires_on,b.storage_place,'quarantine',CASE WHEN nullif(original_.payload->>'unit_id','') IS NULL THEN qty_ ELSE 0 END,CASE WHEN nullif(original_.payload->>'unit_id','') IS NULL THEN cost_ ELSE 0 END,b.quality_evidence) RETURNING id INTO batch_;
  IF nullif(original_.payload->>'unit_id','') IS NOT NULL THEN
   SELECT * INTO STRICT u FROM public.market_stock_units WHERE id=(original_.payload->>'unit_id')::uuid AND status='written_off';
   INSERT INTO public.market_stock_units(batch_id,variant_id,quantity,cost_vnd,status,packing_document_id) VALUES(batch_,u.variant_id,qty_,cost_,'quarantine',doc_) RETURNING id INTO id_;
  END IF;
  INSERT INTO public.market_writeoff_corrections VALUES(original_.id,doc_);
  SELECT * INTO STRICT v FROM public.market_product_variants WHERE id=b.variant_id;
  INSERT INTO public.stock_movements(location_id,stock_item_id,movement_type,quantity_delta,unit_cost_vnd,source_type,source_id,actor_telegram_id) VALUES(w.location_id,v.stock_item_id,'adjustment_in',qty_,cost_::numeric/qty_,'manual_adjustment',doc_,p_actor);
  PERFORM public.market_sync_balance(w.id,v.id);result_:=jsonb_build_object('ok',true,'document_id',doc_,'batch_id',batch_,'unit_id',id_);
 ELSIF p_action='customer_return' THEN
  -- Lock the shared order before inspecting a sold allocation. Location lock does not wait on existing order mutations here: caller must not run concurrently with handover.
  SELECT * INTO STRICT r FROM public.market_reservations WHERE id=(p_data->>'allocation_id')::uuid AND state='sold' FOR UPDATE;
  IF NOT EXISTS(SELECT 1 FROM public.market_orders WHERE order_id=r.order_id AND warehouse_id=w.id) THEN RAISE EXCEPTION 'Return warehouse mismatch'; END IF;
  qty_:=(p_data->>'quantity')::bigint;
  IF qty_ IS NULL OR qty_<=0 OR qty_>r.quantity-r.returned_quantity OR (r.unit_id IS NOT NULL AND qty_<>r.quantity) THEN RAISE EXCEPTION 'Return exceeds sold quantity'; END IF;
  IF length(trim(coalesce(p_data->>'reason','')))<3 THEN RAISE EXCEPTION 'Return reason required'; END IF;
  cost_:=round((r.cost_vnd-r.returned_cost_vnd)::numeric*qty_/(r.quantity-r.returned_quantity));
  SELECT * INTO STRICT b FROM public.market_batches WHERE id=r.batch_id;
  INSERT INTO public.market_documents(warehouse_id,kind,status,reason,payload,result,actor_telegram_id,posted_at) VALUES(w.id,'customer_return','posted',p_data->>'reason',p_data,jsonb_build_object('quantity',qty_,'cost_vnd',cost_),p_actor,now()) RETURNING id INTO doc_;
  INSERT INTO public.market_batches(variant_id,warehouse_id,receipt_id,batch_number,expires_on,storage_place,status,raw_quantity,raw_cost_vnd,quality_evidence)
  VALUES(b.variant_id,w.id,b.receipt_id,b.batch_number||'/RETURN',b.expires_on,p_data->>'storage_place','quarantine',CASE WHEN r.unit_id IS NULL THEN qty_ ELSE 0 END,CASE WHEN r.unit_id IS NULL THEN cost_ ELSE 0 END,jsonb_build_object('return_document',doc_)) RETURNING id INTO batch_;
  IF r.unit_id IS NOT NULL THEN
   SELECT * INTO STRICT u FROM public.market_stock_units WHERE id=r.unit_id;
   INSERT INTO public.market_stock_units(batch_id,variant_id,quantity,cost_vnd,status,packing_document_id) VALUES(batch_,u.variant_id,qty_,cost_,'quarantine',doc_) RETURNING id INTO id_;
  END IF;
  UPDATE public.market_reservations SET returned_quantity=returned_quantity+qty_,returned_cost_vnd=returned_cost_vnd+cost_ WHERE id=r.id;
  SELECT * INTO STRICT v FROM public.market_product_variants WHERE id=b.variant_id;
  INSERT INTO public.stock_movements(location_id,stock_item_id,movement_type,quantity_delta,unit_cost_vnd,source_type,source_id,actor_telegram_id) VALUES(w.location_id,v.stock_item_id,'adjustment_in',qty_,cost_::numeric/qty_,'manual_adjustment',doc_,p_actor);
  PERFORM public.market_sync_balance(w.id,v.id);result_:=jsonb_build_object('ok',true,'document_id',doc_,'batch_id',batch_,'unit_id',id_);
 ELSE RAISE EXCEPTION 'Unknown management operation'; END IF;
 INSERT INTO public.market_operations(actor_telegram_id,request_id,action,payload,result) VALUES(p_actor,p_request,p_action,p_data,result_);RETURN result_;
END $$;
CREATE FUNCTION public.market_report(p_actor bigint,p_warehouse uuid,p_from timestamptz,p_to timestamptz) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=pg_catalog,public AS $$
#variable_conflict use_column
DECLARE w public.market_warehouses;result_ jsonb;
BEGIN
 SELECT * INTO STRICT w FROM public.market_warehouses WHERE id=p_warehouse;
 IF NOT public.market_can(p_actor,w.location_id,ARRAY['admin']) THEN RAISE EXCEPTION 'Market access denied'; END IF;
 IF p_from IS NULL OR p_to IS NULL OR p_to<=p_from THEN RAISE EXCEPTION 'Invalid report interval'; END IF;
 SELECT jsonb_build_object('ok',true,'from',p_from,'to',p_to,
 'revenue_vnd',coalesce((SELECT sum(c.total_vnd) FROM public.cafe_orders c JOIN public.market_orders m ON m.order_id=c.id WHERE m.warehouse_id=w.id AND m.sale_posted AND m.sold_at>=p_from AND m.sold_at<p_to),0),
 'cogs_vnd',coalesce((SELECT sum(r.cost_vnd) FROM public.market_reservations r JOIN public.market_orders m ON m.order_id=r.order_id JOIN public.cafe_orders c ON c.id=m.order_id WHERE m.warehouse_id=w.id AND r.state='sold' AND m.sold_at>=p_from AND m.sold_at<p_to),0),
 'returned_cogs_vnd',coalesce((SELECT sum((d.result->>'cost_vnd')::bigint) FROM public.market_documents d WHERE warehouse_id=w.id AND kind='customer_return' AND posted_at>=p_from AND posted_at<p_to),0),
 'sales_refunds_vnd',coalesce((SELECT sum(f.amount_vnd) FROM public.market_refunds f JOIN public.market_orders m ON m.order_id=f.order_id WHERE m.warehouse_id=w.id AND m.sale_posted AND m.sold_at<p_to AND ((m.sold_at>=p_from AND f.created_at<m.sold_at) OR (f.created_at>=greatest(p_from,m.sold_at) AND f.created_at<p_to))),0),
 'refunds_vnd',coalesce((SELECT sum(f.amount_vnd) FROM public.market_refunds f JOIN public.market_orders m ON m.order_id=f.order_id WHERE m.warehouse_id=w.id AND f.created_at>=p_from AND f.created_at<p_to),0),
 'writeoffs_vnd',coalesce((SELECT sum((d.result->>'cost_vnd')::bigint) FROM public.market_documents d WHERE d.warehouse_id=w.id AND d.kind='writeoff' AND d.status='posted' AND d.posted_at>=p_from AND d.posted_at<p_to),0),
 'shortage_vnd',coalesce((SELECT sum((d.result->>'shortage_cost_vnd')::bigint) FROM public.market_documents d WHERE d.warehouse_id=w.id AND d.kind='count' AND d.status='posted' AND d.posted_at>=p_from AND d.posted_at<p_to),0),
 'surplus_vnd',coalesce((SELECT sum((d.result->>'surplus_cost_vnd')::bigint) FROM public.market_documents d WHERE d.warehouse_id=w.id AND d.kind='count' AND d.status='posted' AND d.posted_at>=p_from AND d.posted_at<p_to),0),
 'stock_cost_vnd',coalesce((SELECT sum(raw_cost_vnd) FROM public.market_batches WHERE warehouse_id=w.id),0)+coalesce((SELECT sum(u.cost_vnd) FROM public.market_stock_units u JOIN public.market_batches b ON b.id=u.batch_id WHERE b.warehouse_id=w.id AND u.status IN ('available','reserved','quarantine')),0),
 'picking_errors',coalesce((SELECT count(*) FROM public.market_picking_events e JOIN public.market_orders m ON m.order_id=e.order_id WHERE m.warehouse_id=w.id AND NOT e.ok AND e.created_at>=p_from AND e.created_at<p_to),0),
 'restored_writeoffs_vnd',coalesce((SELECT sum((d.result->>'restored_cost_vnd')::bigint) FROM public.market_documents d WHERE warehouse_id=w.id AND kind='adjustment' AND posted_at>=p_from AND posted_at<p_to),0),
 'supplier_returns_vnd',coalesce((SELECT sum((d.result->>'cost_vnd')::bigint) FROM public.market_documents d WHERE warehouse_id=w.id AND kind='supplier_return' AND posted_at>=p_from AND posted_at<p_to),0)) INTO result_;
 RETURN result_||jsonb_build_object('gross_profit_vnd',(result_->>'revenue_vnd')::bigint-(result_->>'sales_refunds_vnd')::bigint-(result_->>'cogs_vnd')::bigint+(result_->>'returned_cogs_vnd')::bigint,'loss_threshold_exceeded',(result_->>'writeoffs_vnd')::bigint+(result_->>'shortage_vnd')::bigint>w.loss_alert_vnd);
END $$;
REVOKE ALL ON FUNCTION public.market_management_operation(bigint,uuid,text,jsonb),public.market_report(bigint,uuid,timestamptz,timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.market_management_operation(bigint,uuid,text,jsonb),public.market_report(bigint,uuid,timestamptz,timestamptz) TO service_role;

CREATE OR REPLACE FUNCTION public.get_cafe_cash_summary(p_location_id uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path=pg_catalog,public AS $$
WITH payments AS(SELECT coalesce(sum(amount_vnd),0) total,coalesce(sum(amount_vnd) FILTER(WHERE payment_method='cash'),0) cash FROM public.cafe_payment_receipts WHERE location_id=p_location_id AND receipt_status='confirmed' AND collected_at>=now()-interval '24 hours' AND collected_at<=now()),
refund_rows AS(SELECT amount_vnd,payment_method,refunded_at FROM public.cafe_order_refunds WHERE location_id=p_location_id UNION ALL SELECT f.amount_vnd,f.payment_method,f.created_at FROM public.market_refunds f JOIN public.market_orders m ON m.order_id=f.order_id JOIN public.market_warehouses w ON w.id=m.warehouse_id WHERE w.location_id=p_location_id),
refunds AS(SELECT coalesce(sum(amount_vnd),0) total,coalesce(sum(amount_vnd) FILTER(WHERE payment_method='cash'),0) cash FROM refund_rows WHERE refunded_at>=now()-interval '24 hours' AND refunded_at<=now())
SELECT jsonb_build_object('total24hVnd',payments.total-refunds.total,'cash24hVnd',payments.cash-refunds.cash,'gross24hVnd',payments.total,'refund24hVnd',refunds.total,'pendingHandovers',(SELECT count(*) FROM public.cafe_cash_handovers WHERE location_id=p_location_id AND handover_status='pending')) FROM payments,refunds;
$$;
DO $patch$ DECLARE src text; BEGIN
 SELECT pg_get_functiondef('public.close_cafe_staff_shift(uuid,bigint,integer,text)'::regprocedure) INTO src;
 IF position('v_expected :=' IN src)=0 THEN RAISE EXCEPTION 'Cash shift compatibility changed'; END IF;
 src:=replace(src,'v_expected :=',E'v_cash_refunds := v_cash_refunds + coalesce((SELECT sum(amount_vnd) FROM public.market_refunds WHERE cash_shift_id=v_shift.id AND created_at<=clock_timestamp()),0);\n  v_expected :=');
 EXECUTE src;
 SELECT pg_get_functiondef('public.refund_cafe_order(uuid,bigint,uuid,text,boolean)'::regprocedure) INTO src;
 IF position('INTO available;' IN src)=0 THEN RAISE EXCEPTION 'Refund compatibility changed'; END IF;
 src:=replace(src,'INTO available;',E'INTO available;\n  available:=available-coalesce((SELECT sum(amount_vnd) FROM public.market_refunds WHERE cash_shift_id=shift.id),0);');
 EXECUTE src;
END $patch$;


CREATE UNIQUE INDEX market_loss_alert_daily ON public.market_alerts(warehouse_id,kind,day) WHERE kind='loss';
CREATE FUNCTION public.market_loss_alert() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
DECLARE amount_ bigint;limit_ bigint;
BEGIN
 IF NEW.status<>'posted' OR NEW.kind NOT IN ('writeoff','count') THEN RETURN NEW; END IF;
 SELECT loss_alert_vnd INTO limit_ FROM public.market_warehouses WHERE id=NEW.warehouse_id;
 SELECT coalesce(sum(coalesce((result->>'cost_vnd')::bigint,(result->>'shortage_cost_vnd')::bigint,0)),0) INTO amount_ FROM public.market_documents WHERE warehouse_id=NEW.warehouse_id AND status='posted' AND kind IN ('writeoff','count') AND posted_at>=date_trunc('day',now() AT TIME ZONE 'Asia/Ho_Chi_Minh') AT TIME ZONE 'Asia/Ho_Chi_Minh';
 IF amount_>limit_ THEN INSERT INTO public.market_alerts(warehouse_id,kind,day,message) VALUES(NEW.warehouse_id,'loss',(now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date,'Превышен настроенный порог потерь') ON CONFLICT DO NOTHING; END IF;RETURN NEW;
END $$;
CREATE TRIGGER market_loss_alert AFTER INSERT OR UPDATE ON public.market_documents FOR EACH ROW EXECUTE FUNCTION public.market_loss_alert();
REVOKE ALL ON FUNCTION public.market_loss_alert() FROM PUBLIC,anon,authenticated;GRANT EXECUTE ON FUNCTION public.market_loss_alert() TO service_role;



-- Source: market-quality.sql
-- Apply the meat quality gate to both existing and new catalogue category names.
CREATE FUNCTION public.market_require_meat_evidence() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM public.products p JOIN public.categories c ON c.id=p.category_id
 WHERE p.id=NEW.product_id AND c.category_type='market'
 AND (c.name_en ~* '(meat|poultry|chicken)' OR c.name_ru ~* '(мяс|птиц|куриц)')) THEN
  NEW.requires_quality_evidence:=true;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER market_require_meat_evidence BEFORE INSERT OR UPDATE ON public.market_product_variants
FOR EACH ROW EXECUTE FUNCTION public.market_require_meat_evidence();
REVOKE ALL ON FUNCTION public.market_require_meat_evidence() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.market_require_meat_evidence() TO service_role;

-- Source: market-launch-setup.sql
-- Deployment setup. No inventory, prices or customer transactions are fabricated.
INSERT INTO public.categories(name_ru,name_en,name_vi,category_type,sort_order)
SELECT c.ru,c.en,c.vi,'market',c.position FROM (VALUES
 ('Овощи','Vegetables','Rau củ',10),('Фрукты','Fruit','Trái cây',20),
 ('Мясо','Meat','Thịt',30),('Птица','Poultry','Gia cầm',40),
 ('Молочные продукты','Dairy','Sản phẩm sữa',50),('Бакалея','Groceries','Thực phẩm khô',60),
 ('Крупы','Grains','Ngũ cốc',70),('Специи','Spices','Gia vị',80),
 ('Хлеб и выпечка','Bread and bakery','Bánh mì và bánh nướng',90),
 ('Напитки','Drinks','Đồ uống',100),('Замороженные продукты','Frozen food','Thực phẩm đông lạnh',110),
 ('Сладости','Sweets','Bánh kẹo',120),('Бытовые товары','Household goods','Đồ gia dụng',130),
 ('Упаковка и расходные материалы','Packaging and supplies','Bao bì và vật tư',140)
) c(ru,en,vi,position) WHERE NOT EXISTS(SELECT 1 FROM public.categories e WHERE e.category_type='market' AND e.name_ru=c.ru);
-- Share the existing payment/delivery location, retaining separate warehouse stock.
INSERT INTO public.market_warehouses(location_id,name)
SELECT id,'UMMA Market — Nha Trang' FROM public.locations
WHERE name='HALAL UMMA' AND city='Nha Trang' AND is_active
ON CONFLICT(location_id,name) DO NOTHING;
-- Existing managers retain administrative scope. Additional roles are explicitly assigned in Market settings.
INSERT INTO public.market_staff_roles(telegram_id,location_id,role)
SELECT s.telegram_id,s.location_id,'admin' FROM public.cafe_staff s
JOIN public.telegram_users u ON u.telegram_id=s.telegram_id AND u.is_active
WHERE s.is_active AND s.staff_role='manager' AND EXISTS(SELECT 1 FROM public.market_warehouses w WHERE w.location_id=s.location_id)
ON CONFLICT DO NOTHING;
INSERT INTO public.market_staff_roles(telegram_id,location_id,role)
SELECT s.telegram_id,s.location_id,'cashier' FROM public.cafe_staff s
JOIN public.telegram_users u ON u.telegram_id=s.telegram_id AND u.is_active
WHERE s.is_active AND s.staff_role='cashier' AND s.can_accept_payments
AND EXISTS(SELECT 1 FROM public.market_warehouses w WHERE w.location_id=s.location_id)
ON CONFLICT DO NOTHING;
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES('market-catalog','market-catalog',true,5242880,ARRAY['image/jpeg','image/png','image/webp']),
('market-evidence','market-evidence',false,5242880,ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT(id) DO NOTHING;
-- Restrictive policy also holds if other modules add permissive storage policies later.
CREATE POLICY market_files_service_only ON storage.objects AS RESTRICTIVE FOR ALL TO anon,authenticated
USING(bucket_id NOT IN ('market-catalog','market-evidence'))
WITH CHECK(bucket_id NOT IN ('market-catalog','market-evidence'));
SELECT cron.schedule('umma-market-maintenance','* * * * *','select public.market_expire_reservations();');
NOTIFY pgrst,'reload schema';
COMMIT;
