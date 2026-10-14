-- Full refunds only: immutable receipts, explicit manual payout acknowledgement, no external transfer.
BEGIN;
CREATE TABLE public.cafe_order_refunds (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 order_id uuid NOT NULL UNIQUE REFERENCES public.cafe_orders(id),
 receipt_id uuid NOT NULL UNIQUE REFERENCES public.cafe_payment_receipts(id),
 location_id uuid NOT NULL REFERENCES public.locations(id),
 actor_telegram_id bigint NOT NULL REFERENCES public.telegram_users(telegram_id),
 request_key uuid NOT NULL,
 amount_vnd integer NOT NULL CHECK(amount_vnd>0),
 payment_method text NOT NULL,
 reason text NOT NULL CHECK(length(trim(reason)) BETWEEN 3 AND 500),
 cash_shift_id uuid REFERENCES public.cafe_staff_shifts(id),
 refunded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(actor_telegram_id,request_key),
 CHECK((payment_method='cash')=(cash_shift_id IS NOT NULL))
);
CREATE INDEX cafe_refunds_location_time ON public.cafe_order_refunds(location_id,refunded_at);
ALTER TABLE public.cafe_order_refunds ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.cafe_order_refunds FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.cafe_order_refunds TO service_role;
CREATE OR REPLACE FUNCTION public.refund_cafe_order(p_order_id uuid,p_actor_telegram_id bigint,p_request_key uuid,p_reason text,p_payout_confirmed boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE o public.cafe_orders%rowtype; r public.cafe_payment_receipts%rowtype; f public.cafe_order_refunds%rowtype;
 actor_role text; staff text; shift public.cafe_staff_shifts%rowtype; available bigint; receipt_count int;
BEGIN
 IF p_request_key IS NULL OR p_payout_confirmed IS DISTINCT FROM true OR length(trim(coalesce(p_reason,''))) NOT BETWEEN 3 AND 500 THEN RAISE EXCEPTION 'Refund requires reason and confirmation of actual payout'; END IF;
 SELECT role INTO actor_role FROM public.telegram_users WHERE telegram_id=p_actor_telegram_id AND is_active=true;
 IF NOT FOUND THEN RAISE EXCEPTION 'Refund access denied'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('cafe-refund:'||p_actor_telegram_id::text||':'||p_request_key::text,0));
 SELECT * INTO o FROM public.cafe_orders WHERE id=p_order_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
 IF actor_role<>'super_admin' THEN
  SELECT staff_role INTO staff FROM public.cafe_staff WHERE telegram_id=p_actor_telegram_id AND location_id=o.location_id AND is_active=true;
  IF NOT FOUND OR actor_role NOT IN ('admin','employee') OR staff<>'manager' THEN RAISE EXCEPTION 'Refund access denied'; END IF;
 END IF;
 SELECT * INTO f FROM public.cafe_order_refunds WHERE actor_telegram_id=p_actor_telegram_id AND request_key=p_request_key;
 IF FOUND THEN
  IF f.order_id<>p_order_id OR f.reason<>trim(p_reason) THEN RAISE EXCEPTION 'Refund key reused with different payload'; END IF;
  RETURN jsonb_build_object('ok',true,'replayed',true,'refund',to_jsonb(f));
 END IF;
 IF o.payment_status<>'paid' THEN RAISE EXCEPTION 'Order has no refundable payment'; END IF;
 SELECT count(*) INTO receipt_count FROM public.cafe_payment_receipts WHERE order_id=o.id AND receipt_status='confirmed';
 SELECT * INTO r FROM public.cafe_payment_receipts WHERE order_id=o.id AND receipt_status='confirmed';
 IF receipt_count<>1 OR r.amount_vnd<>o.total_vnd THEN RAISE EXCEPTION 'Receipt reconciliation required before refund'; END IF;
 IF r.payment_method='cash' THEN
  SELECT * INTO shift FROM public.cafe_staff_shifts WHERE location_id=o.location_id AND staff_telegram_id=p_actor_telegram_id AND shift_status='open' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Open your cash shift before refund'; END IF;
  SELECT shift.opening_cash_vnd
   +coalesce((SELECT sum(amount_vnd) FROM public.cafe_payment_receipts WHERE location_id=o.location_id AND collected_by_telegram_id=p_actor_telegram_id AND payment_method='cash' AND receipt_status='confirmed' AND collected_at>=shift.opened_at),0)
   +coalesce((SELECT sum(amount_vnd) FROM public.cafe_cash_handovers WHERE location_id=o.location_id AND to_telegram_id=p_actor_telegram_id AND handover_status='accepted' AND accepted_at>=shift.opened_at),0)
   -coalesce((SELECT sum(amount_vnd) FROM public.cafe_cash_handovers WHERE location_id=o.location_id AND from_telegram_id=p_actor_telegram_id AND handover_status='accepted' AND accepted_at>=shift.opened_at),0)
   -coalesce((SELECT sum(amount_vnd) FROM public.cafe_order_refunds WHERE cash_shift_id=shift.id),0) INTO available;
  IF available<r.amount_vnd THEN RAISE EXCEPTION 'Insufficient recorded cash for refund'; END IF;
 END IF;
 INSERT INTO public.cafe_order_refunds(order_id,receipt_id,location_id,actor_telegram_id,request_key,amount_vnd,payment_method,reason,cash_shift_id)
 VALUES(o.id,r.id,o.location_id,p_actor_telegram_id,p_request_key,r.amount_vnd,r.payment_method,trim(p_reason),shift.id) RETURNING * INTO f;
 UPDATE public.cafe_orders SET payment_status='refunded',status='cancelled',updated_at=clock_timestamp() WHERE id=o.id;
 INSERT INTO public.cafe_order_events(order_id,actor_telegram_id,from_status,to_status,note)
 VALUES(o.id,p_actor_telegram_id,o.status,'cancelled','Полный возврат: '||trim(p_reason));
 RETURN jsonb_build_object('ok',true,'replayed',false,'refund',to_jsonb(f));
END $$;
REVOKE ALL ON FUNCTION public.refund_cafe_order(uuid,bigint,uuid,text,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.refund_cafe_order(uuid,bigint,uuid,text,boolean) TO service_role;
CREATE OR REPLACE FUNCTION public.close_cafe_staff_shift(p_shift_id uuid, p_actor_telegram_id bigint, p_counted_cash_vnd integer, p_note text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_shift public.cafe_staff_shifts%rowtype;
  v_actor_role text;
  v_staff_role text;
  v_cash_sales integer := 0;
  v_handover_in integer := 0;
  v_handover_out integer := 0;
  v_expected integer;
  v_cash_refunds integer := 0;
begin
  if p_counted_cash_vnd is null or p_counted_cash_vnd < 0 then
    raise exception 'Фактическая сумма не может быть отрицательной';
  end if;

  select * into v_shift from public.cafe_staff_shifts where id = p_shift_id for update;
  if not found then raise exception 'Смена не найдена'; end if;
  if v_shift.shift_status <> 'open' then raise exception 'Смена уже закрыта'; end if;

  select role into v_actor_role from public.telegram_users
  where telegram_id = p_actor_telegram_id and is_active = true;
  if v_actor_role is null then raise exception 'Доступ запрещён'; end if;

  if p_actor_telegram_id <> v_shift.staff_telegram_id and v_actor_role <> 'super_admin' then
    select staff_role into v_staff_role from public.cafe_staff
    where location_id = v_shift.location_id and telegram_id = p_actor_telegram_id and is_active = true;
    if not found or v_staff_role not in ('manager','cashier') then raise exception 'Нет права закрыть чужую смену'; end if;
  end if;

  select coalesce(sum(amount_vnd),0)::integer into v_cash_sales
  from public.cafe_payment_receipts
  where location_id = v_shift.location_id
    and collected_by_telegram_id = v_shift.staff_telegram_id
    and payment_method = 'cash' and receipt_status = 'confirmed'
    and collected_at >= v_shift.opened_at and collected_at <= now();

  select coalesce(sum(amount_vnd),0)::integer into v_handover_out
  from public.cafe_cash_handovers
  where location_id = v_shift.location_id and from_telegram_id = v_shift.staff_telegram_id
    and handover_status = 'accepted'
    and accepted_at >= v_shift.opened_at and accepted_at <= now();

  select coalesce(sum(amount_vnd),0)::integer into v_handover_in
  from public.cafe_cash_handovers
  where location_id = v_shift.location_id and to_telegram_id = v_shift.staff_telegram_id
    and handover_status = 'accepted'
    and accepted_at >= v_shift.opened_at and accepted_at <= now();

  SELECT coalesce(sum(amount_vnd),0)::integer INTO v_cash_refunds FROM public.cafe_order_refunds
   WHERE cash_shift_id=v_shift.id AND refunded_at<=clock_timestamp();
  v_expected := v_shift.opening_cash_vnd + v_cash_sales + v_handover_in - v_handover_out - v_cash_refunds;

  update public.cafe_staff_shifts
  set closed_at = now(), closed_by_telegram_id = p_actor_telegram_id,
      expected_cash_vnd = v_expected, counted_cash_vnd = p_counted_cash_vnd,
      variance_vnd = p_counted_cash_vnd - v_expected,
      shift_status = 'closed', close_note = nullif(left(coalesce(p_note,''),1000),'')
  where id = p_shift_id returning * into v_shift;

  return jsonb_build_object('ok',true,'shift',to_jsonb(v_shift));
end;
$function$;
CREATE OR REPLACE FUNCTION public.get_cafe_cash_summary(p_location_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public,pg_temp AS $$
WITH payments AS (SELECT coalesce(sum(amount_vnd),0) total,coalesce(sum(amount_vnd) FILTER(WHERE payment_method='cash'),0) cash FROM public.cafe_payment_receipts WHERE location_id=p_location_id AND receipt_status='confirmed' AND collected_at>=now()-interval '24 hours' AND collected_at<=now()),
refunds AS (SELECT coalesce(sum(amount_vnd),0) total,coalesce(sum(amount_vnd) FILTER(WHERE payment_method='cash'),0) cash FROM public.cafe_order_refunds WHERE location_id=p_location_id AND refunded_at>=now()-interval '24 hours' AND refunded_at<=now())
SELECT jsonb_build_object('total24hVnd',payments.total-refunds.total,'cash24hVnd',payments.cash-refunds.cash,'gross24hVnd',payments.total,'refund24hVnd',refunds.total,'pendingHandovers',(SELECT count(*) FROM public.cafe_cash_handovers WHERE location_id=p_location_id AND handover_status='pending')) FROM payments,refunds;
$$;
COMMIT;
