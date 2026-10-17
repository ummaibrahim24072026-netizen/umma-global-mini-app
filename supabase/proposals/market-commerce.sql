-- Shared orders/payment/delivery with Market allocations. Apply after market-stock-scan.sql.
BEGIN;
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
 IF OLD.payment_status='pending' AND NEW.payment_status='paid' AND (m.released OR (m.picked_at IS NULL AND m.reserve_until<now())) THEN RAISE EXCEPTION 'Market reservation expired; payment requires review'; END IF;
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
COMMIT;
