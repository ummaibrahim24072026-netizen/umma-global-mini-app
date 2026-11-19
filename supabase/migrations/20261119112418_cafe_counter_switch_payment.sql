BEGIN;

CREATE OR REPLACE FUNCTION public.cafe_counter_foreign_payment(p_actor bigint, p_action text, p_args jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE
  sale public.cafe_orders%rowtype;
  payment umma_private.cafe_counter_foreign_payments%rowtype;
  location_id_ uuid;
  rub umma_private.cafe_web_rub_recipient%rowtype;
  configured umma_private.cafe_counter_recipients%rowtype;
  method text:=p_args->>'method';
  request_key uuid;
  created jsonb;
  amount_ numeric;
  current_method text;
  switch_method text;
  reference_ text:=btrim(coalesce(p_args->>'reference',''));
BEGIN
  IF p_action IS NULL OR p_action NOT IN ('options','create','details','confirm','switch','settle') THEN RAISE EXCEPTION 'COUNTER_INVALID'; END IF;
  IF p_action IN ('details','confirm','switch','settle') THEN
    SELECT * INTO sale FROM public.cafe_orders
    WHERE id=(p_args->>'orderId')::uuid AND source_module='cafe' AND order_type IN ('pickup','dine_in')
    FOR UPDATE;
    location_id_:=sale.location_id;
  ELSE
    location_id_:=(p_args->>'locationId')::uuid;
  END IF;
  IF location_id_ IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.telegram_users u
    WHERE u.telegram_id=p_actor AND u.is_active AND (
      u.role='super_admin' OR (u.role IN ('admin','employee') AND EXISTS (
        SELECT 1 FROM public.cafe_staff s WHERE s.telegram_id=p_actor AND s.location_id=location_id_
        AND s.is_active AND s.can_accept_payments AND s.staff_role IN ('manager','cashier','kitchen')
      ))
    )
  ) THEN RAISE EXCEPTION 'COUNTER_ACCESS'; END IF;

  IF p_action IN ('switch','settle') THEN
    IF sale.created_via IS DISTINCT FROM 'staff' OR sale.order_type IS DISTINCT FROM 'pickup'
       OR sale.payment_method NOT IN ('cash','qr','bank_transfer')
    THEN RAISE EXCEPTION 'COUNTER_ACCESS'; END IF;
    SELECT * INTO payment FROM umma_private.cafe_counter_foreign_payments WHERE order_id=sale.id;
    current_method:=coalesce(payment.channel,sale.payment_method);
    IF p_action='settle' THEN
      IF current_method NOT IN ('cash','qr') OR current_method IS DISTINCT FROM (p_args->>'expectedMethod')
      THEN RAISE EXCEPTION 'COUNTER_METHOD_CHANGED'; END IF;
      IF sale.status IN ('completed','cancelled') OR sale.payment_status NOT IN ('pending','paid')
      THEN RAISE EXCEPTION 'COUNTER_CLOSED'; END IF;
      RETURN public.update_cafe_order_payment_cash(sale.id,p_actor,'paid',NULL,
        (p_args->>'tenderedAmountVnd')::integer,(p_args->>'changeGivenVnd')::integer);
    END IF;
    IF NOT sale.requires_prepayment OR sale.payment_status<>'pending' OR sale.status IN ('completed','cancelled')
    THEN RAISE EXCEPTION 'COUNTER_CLOSED'; END IF;
    IF method IS NULL OR method NOT IN ('cash','qr','rub','sber','tenge','kaspi','usdt') THEN RAISE EXCEPTION 'COUNTER_INVALID'; END IF;
    IF current_method=method THEN
      RETURN jsonb_build_object('ok',true,'paymentMethod',sale.payment_method,'paymentStatus',sale.payment_status,'status',sale.status,
        'payment',CASE WHEN payment.order_id IS NOT NULL THEN jsonb_build_object('channel',payment.channel,'currency',payment.currency,
          'amount',payment.amount,'bankName',payment.bank,'recipient',payment.recipient,'account',payment.account,'network',payment.network) END);
    END IF;
    IF current_method IS DISTINCT FROM (p_args->>'expectedMethod') THEN RAISE EXCEPTION 'COUNTER_METHOD_CHANGED'; END IF;
    IF payment.transaction_ref IS NOT NULL OR EXISTS (
      SELECT 1 FROM public.cafe_transfer_proofs WHERE order_id=sale.id AND review_status IN ('pending','confirmed')
    ) THEN RAISE EXCEPTION 'COUNTER_PAYMENT_PROOF'; END IF;
    switch_method:=CASE WHEN method IN ('cash','qr') THEN method ELSE 'bank_transfer' END;
    DELETE FROM umma_private.cafe_counter_foreign_payments WHERE order_id=sale.id;
    UPDATE public.cafe_orders SET payment_method=switch_method,updated_at=now() WHERE id=sale.id RETURNING * INTO sale;
    IF switch_method<>'bank_transfer' THEN
      RETURN jsonb_build_object('ok',true,'paymentMethod',sale.payment_method,'paymentStatus',sale.payment_status,'status',sale.status);
    END IF;
    payment:=NULL;
  END IF;

  IF p_action IN ('options','create','switch') THEN
    IF NOT EXISTS (SELECT 1 FROM public.locations l WHERE l.id=location_id_ AND l.is_active AND l.self_service_enabled AND l.location_type='cafe')
    THEN
      IF p_action='options' THEN RETURN jsonb_build_object('ok',true,'methods','{}'::jsonb); END IF;
      RAISE EXCEPTION 'COUNTER_UNAVAILABLE';
    END IF;
    SELECT * INTO rub FROM umma_private.cafe_web_rub_recipient WHERE singleton;
    IF p_action='options' THEN
      RETURN jsonb_build_object('ok',true,'methods',jsonb_build_object(
        'rub',rub.bank IS NOT NULL,
        'sber',coalesce(lower(rub.bank) ~ '(сбер|sber)',false),
        'tenge',EXISTS (SELECT 1 FROM umma_private.cafe_counter_recipients WHERE location_id=location_id_ AND channel='kaspi'),
        'kaspi',EXISTS (SELECT 1 FROM umma_private.cafe_counter_recipients WHERE location_id=location_id_ AND channel='kaspi'),
        'usdt',EXISTS (SELECT 1 FROM umma_private.cafe_counter_recipients WHERE location_id=location_id_ AND channel='usdt')
      ));
    END IF;

    IF p_action='create' THEN
      request_key:=(p_args->>'requestKey')::uuid;
      IF method IS NULL OR method NOT IN ('rub','sber','tenge','kaspi','usdt') OR request_key IS NULL THEN RAISE EXCEPTION 'COUNTER_INVALID'; END IF;
      -- The normal staff-order RPC freezes the original cart and serializes retries.
      created:=public.execute_cafe_order_operation(p_actor,request_key,'staffOrder',jsonb_build_object(
        'p_location_id',location_id_, 'p_items',p_args->'items', 'p_order_type','pickup',
        'p_payment_method','bank_transfer', 'p_payment_timing','now','p_customer_name','Гость',
        'p_counter_channel',method
      ));
      SELECT * INTO STRICT sale FROM public.cafe_orders WHERE id=(created#>>'{order,id}')::uuid FOR UPDATE;
    END IF;
    IF coalesce((created->>'replayed')::boolean,false) THEN
      SELECT * INTO payment FROM umma_private.cafe_counter_foreign_payments WHERE order_id=sale.id;
    ELSE
      IF method IN ('rub','sber') THEN
        IF rub.bank IS NULL OR (method='sber' AND lower(rub.bank) !~ '(сбер|sber)')
           OR (p_args->>'vndPerRub')::numeric IS NULL OR (p_args->>'vndPerRub')::numeric NOT BETWEEN 10 AND 10000
           OR (p_args->>'quotedAt')::timestamptz IS NULL OR (p_args->>'quotedAt')::timestamptz NOT BETWEEN now()-interval '72 hours' AND now()+interval '1 minute'
        THEN RAISE EXCEPTION 'COUNTER_RATE'; END IF;
        amount_:=round(sale.total_vnd/(p_args->>'vndPerRub')::numeric,2);
        payment.currency:='RUB';
        payment.bank:=rub.bank;
        payment.recipient:=rub.recipient;
        payment.account:=rub.phone;
      ELSE
        SELECT * INTO configured FROM umma_private.cafe_counter_recipients
        WHERE location_id=location_id_ AND channel=CASE WHEN method='usdt' THEN 'usdt' ELSE 'kaspi' END;
        IF NOT FOUND THEN RAISE EXCEPTION 'COUNTER_UNAVAILABLE'; END IF;
        IF method='usdt' THEN
          amount_:=round(sale.total_vnd/configured.vnd_per_unit,6);
        ELSE
          IF (p_args->>'vndPerKzt')::numeric IS NULL OR (p_args->>'vndPerKzt')::numeric NOT BETWEEN 1 AND 1000
             OR (p_args->>'quotedAt')::timestamptz IS NULL
             OR (p_args->>'quotedAt')::timestamptz NOT BETWEEN now()-interval '72 hours' AND now()+interval '1 minute'
          THEN RAISE EXCEPTION 'COUNTER_KZT_RATE'; END IF;
          amount_:=round(sale.total_vnd/(p_args->>'vndPerKzt')::numeric,2);
        END IF;
        payment.currency:=CASE WHEN method='usdt' THEN 'USDT' ELSE 'KZT' END;
        payment.bank:=CASE WHEN method='usdt' THEN 'USDT' ELSE 'Kaspi' END;
        payment.recipient:=configured.recipient;
        payment.account:=configured.account;
        payment.network:=configured.network;
      END IF;
      IF amount_<=0 THEN RAISE EXCEPTION 'COUNTER_RATE'; END IF;
      INSERT INTO umma_private.cafe_counter_foreign_payments(order_id,channel,currency,amount,bank,recipient,account,network)
      VALUES(sale.id,method,payment.currency,amount_,payment.bank,payment.recipient,payment.account,payment.network)
      RETURNING * INTO payment;
    END IF;
  ELSE
    SELECT * INTO payment FROM umma_private.cafe_counter_foreign_payments WHERE order_id=sale.id;
    IF NOT FOUND THEN
      IF p_action='confirm' THEN RAISE EXCEPTION 'COUNTER_METHOD_CHANGED'; END IF;
      RETURN jsonb_build_object('ok',true,'counter',false);
    END IF;
  END IF;

  IF p_action='confirm' THEN
    IF p_args ? 'expectedMethod' AND (p_args->>'expectedMethod' IS DISTINCT FROM payment.channel
        OR (p_args->>'expectedAmount')::numeric IS DISTINCT FROM payment.amount)
    THEN RAISE EXCEPTION 'COUNTER_METHOD_CHANGED'; END IF;
    IF payment.currency<>'USDT' THEN reference_:=upper(reference_);
    ELSIF reference_ ~* '^(0x)?[0-9a-f]{64}$' THEN reference_:=lower(regexp_replace(reference_,'^0x','','i')); END IF;
    IF coalesce((p_args->>'verified')::boolean,false) IS NOT TRUE OR
       reference_ !~ '^[A-Za-zА-Яа-яЁё0-9][A-Za-zА-Яа-яЁё0-9./_-]{3,99}$'
    THEN RAISE EXCEPTION 'COUNTER_REFERENCE'; END IF;
    IF sale.payment_status='paid' AND payment.transaction_ref=reference_ THEN
      RETURN jsonb_build_object('ok',true,'replayed',true);
    END IF;
    IF sale.payment_status<>'pending' OR sale.status IN ('completed','cancelled') THEN RAISE EXCEPTION 'COUNTER_CLOSED'; END IF;
    BEGIN
      UPDATE umma_private.cafe_counter_foreign_payments SET transaction_ref=reference_ WHERE order_id=sale.id;
    EXCEPTION WHEN unique_violation THEN RAISE EXCEPTION 'COUNTER_DUPLICATE_REFERENCE';
    END;
    RETURN public.update_cafe_order_payment_cash(sale.id,p_actor,'paid','Стойка · '||payment.currency||' · '||reference_,NULL,NULL);
  END IF;

  RETURN coalesce(created,'{}'::jsonb)||jsonb_build_object('ok',true,'counter',true,'paymentStatus',sale.payment_status,
    'status',sale.status,'paymentMethod',sale.payment_method,'payment',CASE WHEN payment.order_id IS NOT NULL THEN jsonb_build_object('channel',payment.channel,'currency',payment.currency,'amount',payment.amount,
      'bankName',payment.bank,'recipient',payment.recipient,'account',payment.account,'network',payment.network) END);
END $$;


COMMIT;
