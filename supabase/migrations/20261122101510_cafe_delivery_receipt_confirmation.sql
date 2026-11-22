ALTER TABLE public.cafe_orders ADD COLUMN customer_received_at timestamptz;

-- Reuse the normal delivery and stock transitions. A customer's confirmation
-- is independent evidence of handover, while pickup still requires a photo.
DO $migration$
DECLARE patch record; definition text;
BEGIN
 FOR patch IN SELECT * FROM (VALUES
  ('public.update_cafe_delivery_status(uuid,bigint,text,text)',
   'and not exists(select 1 from public.cafe_delivery_proofs where order_id=v_order.id',
   'and not (p_delivery_status=''delivered'' and v_order.customer_received_at is not null)
     and not exists(select 1 from public.cafe_delivery_proofs where order_id=v_order.id'),
  ('public.update_cafe_order_status(uuid,bigint,text,text)',
   'AND (SELECT count(DISTINCT kind) FROM public.cafe_delivery_proofs WHERE order_id=v_order.id AND courier_telegram_id=p_actor_telegram_id AND verified_at IS NOT NULL AND kind IN (''pickup'',''handover''))=2 THEN',
   'AND (v_order.customer_received_at IS NOT NULL OR
     (SELECT count(DISTINCT kind) FROM public.cafe_delivery_proofs WHERE order_id=v_order.id AND courier_telegram_id=p_actor_telegram_id AND verified_at IS NOT NULL AND kind IN (''pickup'',''handover''))=2) THEN'),
  ('public.confirm_cafe_delivery_proof(uuid,bigint)',
   'IF o.status IN (''completed'',''cancelled'') OR (f.kind=''pickup'' AND (o.status<>''ready'' OR o.delivery_status<>''courier_assigned'')) OR (f.kind=''handover'' AND o.delivery_status<>''picked_up'') THEN',
   'IF NOT (f.kind=''handover'' AND o.status=''completed'' AND o.customer_received_at IS NOT NULL)
     AND (o.status IN (''completed'',''cancelled'') OR (f.kind=''pickup'' AND (o.status<>''ready'' OR o.delivery_status<>''courier_assigned'')) OR (f.kind=''handover'' AND o.delivery_status<>''picked_up'')) THEN'),
  ('public.get_cafe_courier_dispatch_board(bigint)',
   '''completedToday'',',
   '''cashReceivedTodayVnd'', (SELECT coalesce(sum(r.amount_vnd),0)
     FROM public.cafe_payment_receipts r JOIN public.cafe_orders o ON o.id=r.order_id
     WHERE r.collected_by_telegram_id=p_actor AND o.courier_telegram_id=p_actor
       AND o.source_module=''cafe'' AND o.order_type=''delivery'' AND o.payment_timing=''on_delivery''
       AND r.payment_method=''cash'' AND r.receipt_status=''confirmed''
       AND r.collected_at >= date_trunc(''day'',now() AT TIME ZONE ''Asia/Ho_Chi_Minh'') AT TIME ZONE ''Asia/Ho_Chi_Minh''),
    ''completedToday'',')
 ) AS changes(signature, anchor, replacement)
 LOOP
  definition:=pg_get_functiondef(patch.signature::regprocedure);
  IF (length(definition)-length(replace(definition,patch.anchor,'')))/length(patch.anchor)<>1 THEN
   RAISE EXCEPTION 'Unexpected function definition for %',patch.signature;
  END IF;
  EXECUTE replace(definition,patch.anchor,patch.replacement);
 END LOOP;
END
$migration$;

CREATE FUNCTION public.confirm_cafe_guest_delivery_received(p_request_key uuid,p_order_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $function$
DECLARE o public.cafe_orders%rowtype;
BEGIN
 IF NOT EXISTS (
  SELECT 1 FROM umma_private.public_guest_requests
  WHERE request_key=p_request_key AND order_id=p_order_id
 ) THEN
  RETURN jsonb_build_object('ok',false,'code','ORDER_UNAVAILABLE');
 END IF;

 SELECT * INTO o FROM public.cafe_orders WHERE id=p_order_id FOR UPDATE;
 IF NOT FOUND OR o.source_module IS DISTINCT FROM 'cafe' OR o.order_type IS DISTINCT FROM 'delivery' THEN
  RETURN jsonb_build_object('ok',false,'code','ORDER_UNAVAILABLE');
 END IF;
 IF o.status='completed' AND o.delivery_status='delivered' THEN
  RETURN jsonb_build_object('ok',true,'status',o.status,'deliveryStatus',o.delivery_status);
 END IF;
 IF o.status IS DISTINCT FROM 'ready' OR o.payment_status IS DISTINCT FROM 'paid'
  OR o.delivery_status IS DISTINCT FROM 'picked_up' OR o.courier_telegram_id IS NULL
  OR NOT public.cafe_active_courier(o.courier_telegram_id,o.location_id)
  OR NOT EXISTS (
    SELECT 1 FROM public.cafe_delivery_proofs
    WHERE order_id=o.id AND courier_telegram_id=o.courier_telegram_id
     AND kind='pickup' AND verified_at IS NOT NULL
  ) THEN
  RETURN jsonb_build_object('ok',false,'code','DELIVERY_NOT_READY');
 END IF;
 UPDATE public.cafe_orders SET customer_received_at=clock_timestamp() WHERE id=o.id;
 PERFORM public.update_cafe_delivery_status(o.id,o.courier_telegram_id,'delivered','Клиент подтвердил получение заказа');
 SELECT * INTO STRICT o FROM public.cafe_orders WHERE id=p_order_id;
 IF o.status IS DISTINCT FROM 'completed' THEN RAISE EXCEPTION 'Delivery was not completed'; END IF;
 RETURN jsonb_build_object('ok',true,'status',o.status,'deliveryStatus',o.delivery_status);
END
$function$;
REVOKE ALL ON FUNCTION public.confirm_cafe_guest_delivery_received(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_cafe_guest_delivery_received(uuid,uuid) TO service_role;
