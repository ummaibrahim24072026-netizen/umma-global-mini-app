BEGIN;
CREATE SCHEMA IF NOT EXISTS umma_private;
REVOKE ALL ON SCHEMA umma_private FROM PUBLIC,anon,authenticated;
ALTER TABLE public.cafe_payment_receipts ADD COLUMN payment_source text NOT NULL DEFAULT 'staff';
ALTER TABLE public.cafe_payment_receipts ALTER COLUMN collected_by_telegram_id DROP NOT NULL;
ALTER TABLE public.cafe_payment_receipts ADD CONSTRAINT cafe_receipt_source CHECK ((payment_source='staff' AND collected_by_telegram_id IS NOT NULL) OR (payment_source='bank_notification' AND collected_by_telegram_id IS NULL AND payment_method='qr'));
CREATE TABLE umma_private.pay_devices (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),location_id uuid NOT NULL REFERENCES public.locations(id),
 account text NOT NULL,activation_hash text UNIQUE,activation_expires timestamptz,
 token_hash text UNIQUE,enabled boolean NOT NULL DEFAULT true,paired_at timestamptz,last_seen_at timestamptz
);
CREATE TABLE umma_private.pay_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),device_id uuid NOT NULL REFERENCES umma_private.pay_devices(id),
 event_key text NOT NULL,text_hash text NOT NULL,raw_text text NOT NULL,posted_at timestamptz NOT NULL,
 received_at timestamptz NOT NULL DEFAULT now(),state text NOT NULL DEFAULT 'review',reason text,
 order_id uuid REFERENCES public.cafe_orders(id),UNIQUE(device_id,event_key),UNIQUE(device_id,text_hash)
);
ALTER TABLE umma_private.pay_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE umma_private.pay_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON umma_private.pay_devices,umma_private.pay_events FROM PUBLIC,anon,authenticated;
GRANT USAGE ON SCHEMA umma_private TO service_role;
GRANT SELECT,INSERT,UPDATE ON umma_private.pay_devices,umma_private.pay_events TO service_role;
-- These RPCs are service-only. INVOKER preserves the caller's privileges.
CREATE FUNCTION public.umma_pay_pair(p_activation_hash text,p_token_hash text) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE d umma_private.pay_devices;
BEGIN
 UPDATE umma_private.pay_devices SET token_hash=p_token_hash,paired_at=coalesce(paired_at,now())
 WHERE activation_hash=p_activation_hash AND activation_expires>now() AND enabled AND (token_hash IS NULL OR token_hash=p_token_hash) RETURNING * INTO d;
 IF NOT FOUND THEN RAISE EXCEPTION 'Invalid or expired activation code'; END IF;
 RETURN jsonb_build_object('deviceId',d.id,'account',d.account);
END $$;
CREATE FUNCTION public.umma_pay_device(p_token_hash text) RETURNS jsonb
LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
 SELECT jsonb_build_object('id',id,'account',account) FROM umma_private.pay_devices WHERE token_hash=p_token_hash AND enabled;
$$;
CREATE FUNCTION public.umma_pay_ingest(p_token_hash text,p_event_key text,p_text_hash text,p_text text,p_posted_at timestamptz,p_amount integer,p_number bigint) RETURNS jsonb
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
  RETURN jsonb_build_object('ok',true,'duplicate',true,'state',e.state,'reason',e.reason);
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
   UPDATE umma_private.pay_events SET state='confirmed',order_id=o.id WHERE id=e.id;
   RETURN jsonb_build_object('ok',true,'state','confirmed','orderNumber',o.order_number);
  END IF;
 END IF;
 UPDATE umma_private.pay_events SET reason=v_reason WHERE id=e.id;
 RETURN jsonb_build_object('ok',true,'state','review','reason',v_reason);
END $$;
REVOKE ALL ON FUNCTION public.umma_pay_pair(text,text),public.umma_pay_device(text),public.umma_pay_ingest(text,text,text,text,timestamptz,integer,bigint) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.umma_pay_pair(text,text),public.umma_pay_device(text),public.umma_pay_ingest(text,text,text,text,timestamptz,integer,bigint) TO service_role;
COMMIT;
