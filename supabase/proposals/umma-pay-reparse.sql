-- Permit a newly recognized, unchanged notification to retry matching. Confirmed events remain immutable.
BEGIN;
CREATE OR REPLACE FUNCTION public.umma_pay_ingest(p_token_hash text,p_event_key text,p_text_hash text,p_text text,p_posted_at timestamptz,p_amount integer,p_number bigint) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE d umma_private.pay_devices; e umma_private.pay_events; o public.cafe_orders; v_reason text;
BEGIN
 SELECT * INTO d FROM umma_private.pay_devices WHERE token_hash=p_token_hash AND enabled FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Device unauthorized'; END IF;
 UPDATE umma_private.pay_devices SET last_seen_at=now() WHERE id=d.id;
 INSERT INTO umma_private.pay_events(device_id,event_key,text_hash,raw_text,posted_at)
 VALUES(d.id,p_event_key,p_text_hash,p_text,p_posted_at) ON CONFLICT DO NOTHING RETURNING * INTO e;
 IF NOT FOUND THEN
  SELECT * INTO e FROM umma_private.pay_events WHERE device_id=d.id AND (event_key=p_event_key OR text_hash=p_text_hash) ORDER BY received_at LIMIT 1;
  IF e.state<>'review' OR e.reason IS DISTINCT FROM 'unrecognized_notification'
     OR p_amount IS NULL OR p_number IS NULL
     OR e.text_hash IS DISTINCT FROM p_text_hash OR e.raw_text IS DISTINCT FROM p_text
     OR e.posted_at IS DISTINCT FROM p_posted_at THEN
   RETURN jsonb_build_object('ok',true,'duplicate',true,'state',e.state,'reason',e.reason);
  END IF;
 END IF;
 IF p_amount IS NULL OR p_number IS NULL THEN v_reason:='unrecognized_notification';
 ELSIF p_posted_at>now()+interval '2 minutes' OR p_posted_at<now()-interval '24 hours' THEN v_reason:='notification_outside_window';
 ELSE
  SELECT * INTO o FROM public.cafe_orders WHERE order_number=p_number AND location_id=d.location_id FOR UPDATE;
  IF NOT FOUND THEN v_reason:='order_not_found';
  ELSIF o.payment_status<>'pending' THEN v_reason:='order_not_pending';
  ELSIF o.status IN ('completed','cancelled') THEN v_reason:='order_closed';
  ELSIF o.payment_method<>'qr' OR o.currency<>'VND' THEN v_reason:='payment_method_mismatch';
  ELSIF o.total_vnd<>p_amount THEN v_reason:='amount_mismatch';
  ELSIF p_posted_at<o.created_at-interval '2 minutes' THEN v_reason:='notification_before_order';
  ELSE
   INSERT INTO public.cafe_payment_receipts(order_id,location_id,collected_by_telegram_id,payment_method,amount_vnd,receipt_status,note,payment_source)
   VALUES(o.id,o.location_id,NULL,'qr',p_amount,'confirmed','UMMA Pay / VCB notification / '||e.id,'bank_notification');
   UPDATE public.cafe_orders SET payment_status='paid',paid_at=now(),paid_by_telegram_id=NULL,updated_at=now() WHERE id=o.id;
   INSERT INTO public.cafe_order_events(order_id,actor_telegram_id,from_status,to_status,note)
   VALUES(o.id,NULL,o.status,o.status,'UMMA Pay: оплата автоматически подтверждена по уведомлению Vietcombank');
   UPDATE umma_private.pay_events SET state='confirmed',reason=NULL,order_id=o.id WHERE id=e.id;
   RETURN jsonb_build_object('ok',true,'state','confirmed','orderNumber',o.order_number);
  END IF;
 END IF;
 UPDATE umma_private.pay_events SET reason=v_reason WHERE id=e.id;
 RETURN jsonb_build_object('ok',true,'state','review','reason',v_reason);
END $$;
COMMIT;
