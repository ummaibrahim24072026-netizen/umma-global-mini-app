-- Route new cafe orders through UMMA and retain booked legacy deliveries.
DO $migration$
DECLARE patch record; definition text;
BEGIN
 FOR patch IN SELECT * FROM (VALUES
  ('public.submit_cafe_guest_delivery_v4(uuid,text,uuid,jsonb,text,text,text,text,text,text,double precision,double precision,text)',
   'not in (''cash'',''qr'',''bank_transfer'')',
   'not in (''cash'',''cash_at_counter'',''qr'',''bank_transfer'')'),
  ('public.submit_cafe_guest_delivery_v4(uuid,text,uuid,jsonb,text,text,text,text,text,text,double precision,double precision,text)',
   'values(p_location_id,''delivery'',p_payment_method,',
   'values(p_location_id,''delivery'',case when p_payment_method=''cash_at_counter'' then ''cash'' else p_payment_method end,'),
  ('public.submit_cafe_guest_delivery_v4(uuid,text,uuid,jsonb,text,text,text,text,text,text,double precision,double precision,text)',
   '''now'',''manual'',0)',
   'case when p_payment_method=''cash'' then ''on_delivery'' else ''now'' end,''nearest'',0)'),
  ('public.submit_cafe_guest_payment_choice(jsonb,text,numeric,timestamptz)',
   'p_args->>''p_customer_phone'',p_args->>''p_source'',p_args->>''p_table_number'',method_,',
   'p_args->>''p_customer_phone'',p_args->>''p_source'',p_args->>''p_table_number'',case when p_method in (''usd'',''eur'') then ''cash_at_counter'' else method_ end,'),
  ('public.cafe_self_service_guard()',
   'NEW.order_type=''delivery'' AND NEW.dispatch_mode=''manual'' AND NEW.created_via=''customer''',
   'NEW.order_type=''delivery'' AND NEW.payment_timing<>''on_delivery'' AND NEW.created_via=''customer'''),
  ('public.cafe_self_service_guard()',
   'AND NEW.dispatch_mode=''manual''',
   'AND NEW.dispatch_mode IN (''manual'',''nearest'')'),
  ('public.enforce_customer_order_payment_before_preparation()',
   'and new.payment_status is distinct from ''paid''',
   'and not (new.source_module=''cafe'' and new.order_type=''delivery'' and new.payment_method=''cash'' and new.payment_timing=''on_delivery'' and not coalesce(new.requires_prepayment,false))
     and new.payment_status is distinct from ''paid'''),
  ('public.execute_cafe_order_operation(bigint,uuid,text,jsonb)',
   'SET dispatch_mode=coalesce(p_arguments->>''p_dispatch_mode'',''broadcast''),',
   'SET dispatch_mode=case when p_arguments->>''p_dispatch_mode''=''manual'' then ''nearest'' else coalesce(p_arguments->>''p_dispatch_mode'',''broadcast'') end,'),
  ('public.cafe_counter_foreign_payment(bigint,text,jsonb)',
   'AND dispatch_mode=''manual'' AND requires_prepayment',
   'AND dispatch_mode IN (''manual'',''nearest'') AND requires_prepayment'),
  ('public.cafe_counter_fx_cash_settle(bigint,uuid,text,numeric,numeric,timestamptz)',
   'sale.dispatch_mode<>''manual'' OR NOT sale.requires_prepayment',
   'sale.dispatch_mode NOT IN (''manual'',''nearest'') OR NOT sale.requires_prepayment'),
  ('public.offer_cafe_courier(uuid,bigint,bigint)',
   '(o.dispatch_mode=''manual'' AND o.requires_prepayment AND o.created_via IN (''customer'',''staff'') AND o.customer_telegram_id IS NULL)',
   '(o.green_sm_stage IS NOT NULL OR o.green_sm_booking_id IS NOT NULL OR o.green_sm_tracking_url IS NOT NULL OR (o.requires_prepayment AND o.payment_status<>''paid''))'),
  ('public.update_cafe_order_status(uuid,bigint,text,text)',
   'v_green_delivery:=v_order.source_module=''cafe'' AND v_order.order_type=''delivery'' AND v_order.dispatch_mode=''manual''',
   'v_green_delivery:=(v_order.green_sm_stage IS NOT NULL OR v_order.green_sm_booking_id IS NOT NULL OR v_order.green_sm_tracking_url IS NOT NULL) AND v_order.source_module=''cafe'' AND v_order.order_type=''delivery'' AND v_order.dispatch_mode=''manual'''),
  ('public.cafe_web_fulfillment_guard()',
   'IF NEW.source_module=''cafe'' AND NEW.order_type=''delivery'' AND NEW.dispatch_mode=''manual''',
   'IF (NEW.green_sm_stage IS NOT NULL OR NEW.green_sm_booking_id IS NOT NULL OR NEW.green_sm_tracking_url IS NOT NULL) AND NEW.source_module=''cafe'' AND NEW.order_type=''delivery'' AND NEW.dispatch_mode=''manual'''),
  ('public.cafe_web_fulfillment(uuid,bigint,text,jsonb)',
   'o.order_type=''delivery'' AND o.dispatch_mode=''manual''',
   'o.order_type=''delivery'' AND o.dispatch_mode=''manual'' AND (o.green_sm_stage IS NOT NULL OR o.green_sm_booking_id IS NOT NULL OR o.green_sm_tracking_url IS NOT NULL)'),
  ('public.list_cafe_available_deliveries(bigint)',
   'AND public.courier_dispatch_online(p_actor) AND NOT public.courier_dispatch_busy(p_actor)',
   'AND public.courier_dispatch_online(p_actor) AND (NOT o.requires_prepayment OR o.payment_status=''paid'')'),
  ('public.claim_cafe_available_delivery(uuid,bigint)',
   'IF o.preorder_waiting OR o.order_type',
   'IF o.preorder_waiting OR (o.requires_prepayment AND o.payment_status<>''paid'') OR o.order_type'),
  ('public.respond_cafe_courier_offer(uuid,bigint,boolean,text)',
   'IF p_accept AND (NOT public.courier_dispatch_online(p_actor_telegram_id)',
   'IF p_accept AND o.requires_prepayment AND o.payment_status<>''paid'' THEN RAISE EXCEPTION ''Order must be paid before dispatch''; END IF;
    IF p_accept AND (NOT public.courier_dispatch_online(p_actor_telegram_id)'),
  ('public.ensure_cafe_courier_offers(uuid)',
   'IF NOT FOUND OR o.preorder_waiting OR o.order_type',
   'IF NOT FOUND OR o.preorder_waiting OR (o.requires_prepayment AND o.payment_status<>''paid'') OR o.order_type')
 ) AS changes(signature, anchor, replacement)
 LOOP
  definition:=pg_get_functiondef(patch.signature::regprocedure);
  IF (length(definition)-length(replace(definition,patch.anchor,'')))/length(patch.anchor)<>1 THEN
   RAISE EXCEPTION 'Unexpected definition for % near %',patch.signature,patch.anchor;
  END IF;
  EXECUTE replace(definition,patch.anchor,patch.replacement);
 END LOOP;
END
$migration$;

-- Take the oldest ready order after a short window for manual selection.
-- Match the manual claim lock order: courier row, then order row.
CREATE FUNCTION umma_private.assign_ready_cafe_delivery(p_actor bigint)
RETURNS void LANGUAGE plpgsql SET search_path=public,pg_temp AS $function$
DECLARE target uuid;
BEGIN
 PERFORM 1 FROM public.cafe_courier_presence
 WHERE courier_telegram_id=p_actor AND online AND last_seen_at>=clock_timestamp()-interval '2 minutes'
 FOR UPDATE SKIP LOCKED;
 IF NOT FOUND OR public.courier_dispatch_busy(p_actor) THEN RETURN; END IF;

 SELECT o.id INTO target
 FROM public.cafe_orders o
 WHERE o.source_module='cafe' AND o.order_type='delivery'
   AND o.status='ready' AND o.delivery_status='waiting_courier' AND o.courier_telegram_id IS NULL
   AND NOT o.preorder_waiting AND (NOT o.requires_prepayment OR o.payment_status='paid')
   AND o.dispatch_mode<>'manual' AND o.updated_at<=clock_timestamp()-interval '30 seconds'
   AND public.cafe_active_courier(p_actor,o.location_id)
   AND NOT EXISTS (
     SELECT 1 FROM public.cafe_courier_offers f
     WHERE f.order_id=o.id AND f.status='offered' AND f.offer_scope='exclusive'
       AND f.expires_at>clock_timestamp() AND f.courier_telegram_id<>p_actor
       AND public.courier_dispatch_online(f.courier_telegram_id)
       AND NOT public.courier_dispatch_busy(f.courier_telegram_id)
   )
 ORDER BY o.created_at,o.id LIMIT 1 FOR UPDATE OF o SKIP LOCKED;
 IF target IS NOT NULL THEN
  PERFORM public.claim_cafe_available_delivery(target,p_actor);
 END IF;
END
$function$;
REVOKE ALL ON FUNCTION umma_private.assign_ready_cafe_delivery(bigint) FROM PUBLIC,anon,authenticated;

DO $migration$
DECLARE definition text:=pg_get_functiondef('public.get_cafe_courier_dispatch_board(bigint)'::regprocedure);
BEGIN
 IF strpos(definition,'PERFORM public.advance_cafe_courier_queue();')=0 THEN
  RAISE EXCEPTION 'Unexpected courier board definition';
 END IF;
 EXECUTE replace(definition,'PERFORM public.advance_cafe_courier_queue();',
  'PERFORM umma_private.assign_ready_cafe_delivery(p_actor);');
END
$migration$;

UPDATE public.cafe_orders
SET dispatch_mode='nearest'
WHERE source_module='cafe' AND order_type='delivery' AND dispatch_mode='manual'
  AND created_via IN ('customer','staff') AND requires_prepayment
  AND customer_telegram_id IS NULL AND courier_telegram_id IS NULL
  AND status NOT IN ('completed','cancelled') AND delivery_status='waiting_courier'
  AND green_sm_stage IS NULL AND green_sm_booking_id IS NULL AND green_sm_tracking_url IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.cafe_courier_offers f
    WHERE f.order_id=cafe_orders.id AND f.status='offered' AND f.expires_at>clock_timestamp()
  );
