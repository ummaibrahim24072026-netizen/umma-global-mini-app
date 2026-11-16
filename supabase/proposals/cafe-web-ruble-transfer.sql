BEGIN;

ALTER TABLE public.cafe_orders
 ADD COLUMN IF NOT EXISTS rub_payment_kopecks integer,
 ADD COLUMN IF NOT EXISTS rub_vnd_per_rub numeric(16,8),
 ADD COLUMN IF NOT EXISTS rub_rate_at timestamptz;

CREATE TABLE IF NOT EXISTS umma_private.cafe_web_rub_recipient (
 singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
 phone text NOT NULL CHECK (phone ~ '^\+7[0-9]{10}$'),
 recipient text NOT NULL CHECK (length(recipient) BETWEEN 2 AND 100),
 bank text NOT NULL CHECK (length(bank) BETWEEN 2 AND 100)
);
ALTER TABLE umma_private.cafe_web_rub_recipient ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON umma_private.cafe_web_rub_recipient FROM PUBLIC, anon, authenticated;

DO $migration$
DECLARE f regprocedure; definition text; anchor text;
BEGIN
 FOREACH f IN ARRAY ARRAY[
  'public.submit_cafe_guest_order_v3(uuid,text,uuid,jsonb,text,text,text,text,text)'::regprocedure,
  'public.submit_cafe_guest_delivery_v4(uuid,text,uuid,jsonb,text,text,text,text,text,text,double precision,double precision,text)'::regprocedure
 ] LOOP
  definition:=pg_get_functiondef(f);
  anchor:='not in (''cash'',''qr'') then raise exception ''Invalid payment method''';
  IF strpos(definition,anchor)=0 THEN RAISE EXCEPTION 'Guest payment validator changed in %',f; END IF;
  definition:=replace(definition,anchor,'not in (''cash'',''qr'',''bank_transfer'') then raise exception ''Invalid payment method''');
  IF f::text LIKE '%submit_cafe_guest_delivery_v4%' THEN
   anchor:='p_payment_method<>''qr'' then raise exception ''Web delivery requires prepayment by QR''';
   IF strpos(definition,anchor)=0 THEN RAISE EXCEPTION 'Delivery payment validator changed'; END IF;
   definition:=replace(definition,anchor,'p_payment_method not in (''qr'',''bank_transfer'') then raise exception ''Web delivery requires prepayment''');
  END IF;
  EXECUTE definition;
 END LOOP;
 definition:=pg_get_functiondef('public.cafe_self_service_guard()'::regprocedure);
 anchor:='NEW.requires_prepayment := ';
 IF strpos(definition,anchor)=0 THEN RAISE EXCEPTION 'Cafe prepayment guard changed'; END IF;
 EXECUTE replace(definition,anchor,anchor||
  '(NEW.source_module=''cafe'' AND NEW.payment_method=''bank_transfer'' AND NEW.created_via=''customer'' AND NEW.customer_telegram_id IS NULL) OR ');
END
$migration$;

CREATE OR REPLACE FUNCTION public.submit_cafe_web_ruble_order(p_args jsonb, p_vnd_per_rub numeric, p_quoted_at timestamptz)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $function$
DECLARE result jsonb; order_id uuid; saved public.cafe_orders%rowtype; amount integer;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Access denied'; END IF;
 IF p_args ? 'p_token_hash' THEN
  result:=public.submit_cafe_guest_delivery_v4((p_args->>'p_request_key')::uuid,p_args->>'p_ip_hash',
   (p_args->>'p_location_id')::uuid,p_args->'p_items',p_args->>'p_customer_name',p_args->>'p_customer_phone',
   p_args->>'p_source',p_args->>'p_table_number','bank_transfer',p_args->>'p_address',
   (p_args->>'p_lat')::double precision,(p_args->>'p_lng')::double precision,p_args->>'p_token_hash');
 ELSE
  result:=public.submit_cafe_guest_order_v3((p_args->>'p_request_key')::uuid,p_args->>'p_ip_hash',
   (p_args->>'p_location_id')::uuid,p_args->'p_items',p_args->>'p_customer_name',p_args->>'p_customer_phone',
   p_args->>'p_source',p_args->>'p_table_number','bank_transfer');
 END IF;
 order_id:=(result#>>'{order,id}')::uuid;
 SELECT * INTO STRICT saved FROM public.cafe_orders WHERE id=order_id FOR UPDATE;
 IF saved.payment_method<>'bank_transfer' OR (result->>'replayed')::boolean THEN RETURN result; END IF;
 IF p_vnd_per_rub IS NULL OR p_vnd_per_rub NOT BETWEEN 10 AND 10000 OR p_quoted_at IS NULL
    OR p_quoted_at NOT BETWEEN now()-interval '72 hours' AND now()+interval '1 minute'
    OR NOT EXISTS (SELECT 1 FROM umma_private.cafe_web_rub_recipient)
 THEN RAISE EXCEPTION 'RUBLE_RATE_UNAVAILABLE'; END IF;
 amount:=round(saved.total_vnd*100::numeric/p_vnd_per_rub);
 IF amount<=0 THEN RAISE EXCEPTION 'RUBLE_RATE_UNAVAILABLE'; END IF;
 UPDATE public.cafe_orders
 SET rub_payment_kopecks=amount,rub_vnd_per_rub=p_vnd_per_rub,rub_rate_at=p_quoted_at
 WHERE id=order_id;
 RETURN result;
END
$function$;
REVOKE ALL ON FUNCTION public.submit_cafe_web_ruble_order(jsonb,numeric,timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.submit_cafe_web_ruble_order(jsonb,numeric,timestamptz) TO service_role;

CREATE OR REPLACE FUNCTION public.cafe_guest_ruble_payment(p_order_id uuid)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER STABLE SET search_path=public,pg_temp AS $function$
 SELECT jsonb_build_object('currency','RUB','kopecks',o.rub_payment_kopecks,'rate',o.rub_vnd_per_rub,'rateAt',o.rub_rate_at,
  'bankName',r.bank,'phone',r.phone,'recipient',r.recipient)
 FROM public.cafe_orders o CROSS JOIN umma_private.cafe_web_rub_recipient r
 WHERE auth.role()='service_role' AND o.id=p_order_id AND o.rub_payment_kopecks IS NOT NULL
  AND o.payment_status='pending' AND o.status NOT IN ('cancelled','completed')
$function$;
REVOKE ALL ON FUNCTION public.cafe_guest_ruble_payment(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.cafe_guest_ruble_payment(uuid) TO service_role;

COMMIT;
