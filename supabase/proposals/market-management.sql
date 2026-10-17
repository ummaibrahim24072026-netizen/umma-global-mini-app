BEGIN;
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
 IF position('IF o.payment_status' IN src)=0 THEN RAISE EXCEPTION 'Refund order compatibility changed'; END IF;
 src:=replace(src,'IF o.payment_status',E'IF o.source_module=''market'' THEN RAISE EXCEPTION ''Use Market refund controls''; END IF;\n IF o.payment_status');
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

COMMIT;
