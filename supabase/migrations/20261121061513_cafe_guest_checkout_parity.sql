BEGIN;

CREATE TABLE umma_private.cafe_guest_cash_quotes (
 order_id uuid PRIMARY KEY REFERENCES public.cafe_orders(id) ON DELETE CASCADE,
 currency text NOT NULL CHECK (currency IN ('USD','EUR')),
 rate numeric(18,8) NOT NULL CHECK (rate BETWEEN 1000 AND 100000),
 quoted_at timestamptz NOT NULL
);
ALTER TABLE umma_private.cafe_guest_cash_quotes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON umma_private.cafe_guest_cash_quotes FROM PUBLIC, anon, authenticated;

-- Preserve the existing guest cart, reservation, delivery and request-key logic.
DO $migration$
DECLARE definition text; anchor text;
BEGIN
 definition:=pg_get_functiondef('public.submit_cafe_guest_order_v3(uuid,text,uuid,jsonb,text,text,text,text,text)'::regprocedure);
 anchor:='if v_table is not null and v_table !~ ''^[1-6]$'' then';
 IF strpos(definition,anchor)=0 THEN RAISE EXCEPTION 'Guest table validation changed'; END IF;
 definition:=replace(definition,anchor,'if v_table is not null and v_table<>''dine_in'' and v_table !~ ''^[1-6]$'' then');
 definition:=replace(definition,'case when v_table is not null then ''Стол №''||v_table',
   'case when v_table is not null and v_table<>''dine_in'' then ''Стол №''||v_table');
 EXECUTE definition;

 definition:=pg_get_functiondef('public.submit_cafe_guest_delivery_v4(uuid,text,uuid,jsonb,text,text,text,text,text,text,double precision,double precision,text)'::regprocedure);
 anchor:='if p_payment_method not in (''qr'',''bank_transfer'') then raise exception ''Web delivery requires prepayment''; end if;';
 IF strpos(definition,anchor)=0 THEN RAISE EXCEPTION 'Guest delivery payment validation changed'; END IF;
 -- Cash is collected at the counter before dispatch, under the same prepayment guard.
 EXECUTE replace(definition,anchor,'');

 definition:=pg_get_functiondef('public.cafe_counter_foreign_payment(bigint,text,jsonb)'::regprocedure);
 anchor:='created_via=''staff'' AND dispatch_mode=''manual'' AND requires_prepayment';
 IF strpos(definition,anchor)=0 THEN RAISE EXCEPTION 'Counter delivery scope changed'; END IF;
 definition:=replace(definition,anchor,'(created_via=''staff'' OR (customer_telegram_id IS NULL AND EXISTS
  (SELECT 1 FROM umma_private.public_guest_requests WHERE order_id=cafe_orders.id)))
  AND dispatch_mode=''manual'' AND requires_prepayment');
 anchor:='  IF p_action IN (''switch'',''settle'') THEN';
 IF strpos(definition,anchor)=0 THEN RAISE EXCEPTION 'Counter payment details changed'; END IF;
 definition:=replace(definition,anchor,$body$  IF p_action='details' AND sale.payment_method='cash' AND sale.created_via='customer' THEN
    RETURN jsonb_build_object('ok',true,'cashQuote',(SELECT jsonb_build_object(
      'currency',currency,'vndPerUnit',rate,'quotedAt',quoted_at)
      FROM umma_private.cafe_guest_cash_quotes WHERE order_id=sale.id));
  END IF;

$body$||anchor);
 EXECUTE definition;

 definition:=pg_get_functiondef('public.cafe_counter_fx_cash_settle(bigint,uuid,text,numeric,numeric,timestamptz)'::regprocedure);
 anchor:='sale.created_via IS DISTINCT FROM ''staff''';
 IF strpos(definition,anchor)=0 THEN RAISE EXCEPTION 'Counter cash scope changed'; END IF;
 definition:=replace(definition,anchor,'(sale.created_via IS DISTINCT FROM ''staff'' AND NOT EXISTS
  (SELECT 1 FROM umma_private.cafe_guest_cash_quotes WHERE order_id=sale.id AND currency=p_currency))');
 anchor:=' IF p_currency NOT IN';
 IF strpos(definition,anchor)=0 THEN RAISE EXCEPTION 'Counter rate validation changed'; END IF;
 definition:=replace(definition,anchor,$body$ IF sale.created_via='customer' THEN
  SELECT rate,quoted_at INTO STRICT p_rate,p_quoted_at FROM umma_private.cafe_guest_cash_quotes WHERE order_id=sale.id;
 END IF;
$body$||anchor);
 EXECUTE definition;

 definition:=pg_get_functiondef('public.cafe_counter_payment_guard()'::regprocedure);
 anchor:='AND EXISTS (SELECT 1 FROM umma_private.cafe_counter_foreign_payments WHERE order_id=NEW.id AND transaction_ref IS NULL)';
 IF strpos(definition,anchor)=0 THEN RAISE EXCEPTION 'Counter payment guard changed'; END IF;
 EXECUTE replace(definition,anchor,'AND (EXISTS (SELECT 1 FROM umma_private.cafe_counter_foreign_payments WHERE order_id=NEW.id AND transaction_ref IS NULL)
  OR (EXISTS (SELECT 1 FROM umma_private.cafe_guest_cash_quotes WHERE order_id=NEW.id)
   AND NOT EXISTS (SELECT 1 FROM umma_private.cafe_counter_fx_cash_receipts WHERE order_id=NEW.id)))');
END
$migration$;

CREATE FUNCTION public.cafe_guest_payment_rates(p_location_id uuid)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER STABLE SET search_path=public,pg_temp AS $function$
 SELECT jsonb_build_object(
  'sber', coalesce((SELECT lower(bank) ~ '(сбер|sber)' FROM umma_private.cafe_web_rub_recipient WHERE singleton),false),
  'kaspi', EXISTS (SELECT 1 FROM umma_private.cafe_counter_recipients WHERE location_id=p_location_id AND channel='kaspi'),
  'usdtRate',(SELECT vnd_per_unit FROM umma_private.cafe_counter_recipients WHERE location_id=p_location_id AND channel='usdt')
 ) WHERE auth.role()='service_role'
$function$;
REVOKE ALL ON FUNCTION public.cafe_guest_payment_rates(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cafe_guest_payment_rates(uuid) TO service_role;

CREATE FUNCTION public.cafe_guest_checkout_payment(p_order_id uuid)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER STABLE SET search_path=public,pg_temp AS $function$
 SELECT coalesce(
  (SELECT jsonb_build_object('currency',currency,'vndPerUnit',rate,'quotedAt',quoted_at)
   FROM umma_private.cafe_guest_cash_quotes WHERE order_id=p_order_id),
  (SELECT jsonb_build_object('currency',currency,'amount',amount,'bankName',bank,'recipient',recipient,'account',account,'network',network)
   FROM umma_private.cafe_counter_foreign_payments WHERE order_id=p_order_id),
  public.cafe_guest_ruble_payment(p_order_id)
 ) WHERE auth.role()='service_role'
$function$;
REVOKE ALL ON FUNCTION public.cafe_guest_checkout_payment(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cafe_guest_checkout_payment(uuid) TO service_role;

CREATE FUNCTION public.submit_cafe_guest_payment_choice(p_args jsonb, p_method text, p_rate numeric, p_quoted_at timestamptz)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $function$
DECLARE
 result jsonb;
 sale public.cafe_orders%rowtype;
 location_ uuid:=(p_args->>'p_location_id')::uuid;
 account_ umma_private.cafe_counter_recipients%rowtype;
 currency_ text;
 method_ text;
 amount_ numeric;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Access denied'; END IF;
 IF p_method IS NULL OR p_method NOT IN ('usd','eur','sber','kaspi','usdt') THEN RAISE EXCEPTION 'Invalid payment method'; END IF;
 method_:=CASE WHEN p_method IN ('usd','eur') THEN 'cash' ELSE 'bank_transfer' END;
 IF p_method='sber' THEN
  IF NOT coalesce((public.cafe_guest_payment_rates(location_)->>'sber')::boolean,false)
  THEN RAISE EXCEPTION 'PAYMENT_METHOD_UNAVAILABLE'; END IF;
  RETURN public.submit_cafe_web_ruble_order(p_args,p_rate,p_quoted_at);
 END IF;
 IF p_args ? 'p_token_hash' THEN
  result:=public.submit_cafe_guest_delivery_v4((p_args->>'p_request_key')::uuid,p_args->>'p_ip_hash',location_,p_args->'p_items',
   p_args->>'p_customer_name',p_args->>'p_customer_phone',p_args->>'p_source',p_args->>'p_table_number',method_,
   p_args->>'p_address',(p_args->>'p_lat')::double precision,(p_args->>'p_lng')::double precision,p_args->>'p_token_hash');
 ELSE
  result:=public.submit_cafe_guest_order_v3((p_args->>'p_request_key')::uuid,p_args->>'p_ip_hash',location_,p_args->'p_items',
   p_args->>'p_customer_name',p_args->>'p_customer_phone',p_args->>'p_source',p_args->>'p_table_number',method_);
 END IF;
 IF (result->>'replayed')::boolean THEN RETURN result; END IF;
 SELECT * INTO STRICT sale FROM public.cafe_orders WHERE id=(result#>>'{order,id}')::uuid FOR UPDATE;
 IF p_method IN ('usd','eur') THEN
  IF p_rate IS NULL OR p_rate NOT BETWEEN 1000 AND 100000 OR p_quoted_at IS NULL
   OR p_quoted_at NOT BETWEEN now()-interval '24 hours' AND now()+interval '1 minute'
  THEN RAISE EXCEPTION 'PAYMENT_RATE_UNAVAILABLE'; END IF;
  INSERT INTO umma_private.cafe_guest_cash_quotes(order_id,currency,rate,quoted_at)
  VALUES(sale.id,upper(p_method),p_rate,p_quoted_at);
  RETURN result;
 END IF;
 SELECT * INTO account_ FROM umma_private.cafe_counter_recipients WHERE location_id=sale.location_id AND channel=p_method;
 IF NOT FOUND THEN RAISE EXCEPTION 'PAYMENT_METHOD_UNAVAILABLE'; END IF;
 IF p_method='kaspi' AND (p_rate IS NULL OR p_rate NOT BETWEEN 1 AND 1000 OR p_quoted_at IS NULL
  OR p_quoted_at NOT BETWEEN now()-interval '72 hours' AND now()+interval '1 minute')
 THEN RAISE EXCEPTION 'PAYMENT_RATE_UNAVAILABLE'; END IF;
 currency_:=CASE WHEN p_method='kaspi' THEN 'KZT' ELSE 'USDT' END;
 amount_:=CASE WHEN p_method='kaspi' THEN round(sale.total_vnd/p_rate,2) ELSE round(sale.total_vnd/account_.vnd_per_unit,6) END;
 IF amount_<=0 THEN RAISE EXCEPTION 'PAYMENT_RATE_UNAVAILABLE'; END IF;
 INSERT INTO umma_private.cafe_counter_foreign_payments(order_id,channel,currency,amount,bank,recipient,account,network)
 VALUES(sale.id,p_method,currency_,amount_,CASE WHEN p_method='kaspi' THEN 'Kaspi' ELSE 'USDT' END,
  account_.recipient,account_.account,account_.network);
 RETURN result;
END
$function$;
REVOKE ALL ON FUNCTION public.submit_cafe_guest_payment_choice(jsonb,text,numeric,timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_cafe_guest_payment_choice(jsonb,text,numeric,timestamptz) TO service_role;

COMMIT;
