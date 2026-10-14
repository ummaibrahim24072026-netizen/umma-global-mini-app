-- Proposed schema/API hardening. Never apply to production without owner approval.
BEGIN;
ALTER TABLE public.cafe_orders ADD COLUMN IF NOT EXISTS payment_timing text CHECK(payment_timing IN ('now','later','on_delivery'));
CREATE SCHEMA IF NOT EXISTS umma_private;
CREATE TABLE IF NOT EXISTS umma_private.cafe_order_requests (
  actor_telegram_id bigint NOT NULL REFERENCES public.telegram_users(telegram_id),
  request_key uuid NOT NULL,
  action text NOT NULL CHECK (action IN ('customerOrder','staffOrder','addItems')),
  arguments jsonb NOT NULL,
  result jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (actor_telegram_id,request_key)
);
ALTER TABLE umma_private.cafe_order_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON SCHEMA umma_private FROM PUBLIC, anon, authenticated;
REVOKE ALL ON umma_private.cafe_order_requests FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.execute_cafe_order_operation(
  p_actor_telegram_id bigint, p_request_key uuid, p_action text, p_arguments jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $function$
DECLARE
  v_cached umma_private.cafe_order_requests%rowtype;
  v_result jsonb;
  v_user public.telegram_users%rowtype;
  v_location uuid;
  v_staff_role text;
  v_payment_timing text;
BEGIN
  IF p_request_key IS NULL OR p_arguments IS NULL OR p_action IS NULL OR p_action NOT IN ('customerOrder','staffOrder','addItems') OR jsonb_typeof(p_arguments)<>'object' THEN
    RAISE EXCEPTION 'Invalid idempotent order request';
  END IF;
  SELECT * INTO v_user FROM public.telegram_users WHERE telegram_id=p_actor_telegram_id AND is_active=true;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order operation access denied'; END IF;
  -- Re-check authorization even for a replay after a staff assignment is revoked.
  IF p_action IN ('staffOrder','addItems') THEN
    IF v_user.role NOT IN ('super_admin','admin','employee') THEN RAISE EXCEPTION 'Staff access denied'; END IF;
    IF p_action='staffOrder' THEN v_location:=(p_arguments->>'p_location_id')::uuid;
    ELSE SELECT location_id INTO v_location FROM public.cafe_orders WHERE id=(p_arguments->>'p_order_id')::uuid;
    END IF;
    IF v_user.role<>'super_admin' THEN
      SELECT staff_role INTO v_staff_role FROM public.cafe_staff WHERE telegram_id=p_actor_telegram_id AND location_id=v_location AND is_active=true;
      IF NOT FOUND OR v_staff_role NOT IN ('manager','cashier','waiter','kitchen') THEN RAISE EXCEPTION 'Staff operation access denied'; END IF;
    END IF;
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_actor_telegram_id::text||':'||p_request_key::text,0));
  SELECT * INTO v_cached FROM umma_private.cafe_order_requests WHERE actor_telegram_id=p_actor_telegram_id AND request_key=p_request_key;
  IF FOUND THEN
    IF v_cached.action<>p_action OR v_cached.arguments IS DISTINCT FROM p_arguments THEN RAISE EXCEPTION 'Idempotency key reused with different order'; END IF;
    RETURN v_cached.result || jsonb_build_object('replayed',true);
  END IF;
  IF p_action IN ('customerOrder','staffOrder') THEN
    v_payment_timing:=coalesce(p_arguments->>'p_payment_timing','now');
    IF v_payment_timing NOT IN ('now','later','on_delivery') OR (v_payment_timing='later' AND p_arguments->>'p_order_type'<>'dine_in') OR (v_payment_timing='on_delivery' AND (p_arguments->>'p_order_type'<>'delivery' OR p_arguments->>'p_payment_method'<>'cash')) THEN RAISE EXCEPTION 'Invalid payment timing for order'; END IF;
  END IF;
  IF p_action='customerOrder' THEN
    v_result:=public.create_cafe_order(p_actor_telegram_id,p_arguments->'p_items',p_arguments->>'p_order_type',
      (p_arguments->>'p_location_id')::uuid,p_arguments->>'p_customer_name',p_arguments->>'p_customer_phone',
      p_arguments->>'p_delivery_address',p_arguments->>'p_payment_method',p_arguments->>'p_customer_note');
  ELSIF p_action='staffOrder' THEN
    v_result:=public.create_cafe_staff_order(p_actor_telegram_id,(p_arguments->>'p_location_id')::uuid,
      p_arguments->'p_items',p_arguments->>'p_order_type',p_arguments->>'p_customer_name',p_arguments->>'p_customer_phone',
      p_arguments->>'p_delivery_address',p_arguments->>'p_payment_method',p_arguments->>'p_customer_note');
  ELSE
    v_result:=public.add_cafe_staff_order_items(p_actor_telegram_id,(p_arguments->>'p_order_id')::uuid,p_arguments->'p_items');
  END IF;
  IF p_action IN ('customerOrder','staffOrder') THEN
    UPDATE public.cafe_orders SET payment_timing=v_payment_timing WHERE id=(v_result->'order'->>'id')::uuid;
    v_result:=jsonb_set(v_result,'{order,paymentTiming}',to_jsonb(v_payment_timing),true);
    IF p_arguments->>'p_order_type'='delivery' THEN
      IF coalesce(p_arguments->>'p_dispatch_mode','broadcast') NOT IN ('broadcast','nearest') THEN RAISE EXCEPTION 'Invalid courier dispatch mode'; END IF;
      UPDATE public.cafe_orders SET dispatch_mode=coalesce(p_arguments->>'p_dispatch_mode','broadcast') WHERE id=(v_result->'order'->>'id')::uuid;
      PERFORM public.ensure_cafe_courier_offers((v_result->'order'->>'id')::uuid);
    END IF;
  END IF;
  INSERT INTO umma_private.cafe_order_requests(actor_telegram_id,request_key,action,arguments,result)
    VALUES(p_actor_telegram_id,p_request_key,p_action,p_arguments,v_result);
  RETURN v_result || jsonb_build_object('replayed',false);
END;
$function$;
REVOKE ALL ON FUNCTION public.execute_cafe_order_operation(bigint,uuid,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.execute_cafe_order_operation(bigint,uuid,text,jsonb) TO service_role;
COMMIT;
