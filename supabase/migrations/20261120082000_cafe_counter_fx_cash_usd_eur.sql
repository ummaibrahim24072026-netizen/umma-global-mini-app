BEGIN;
CREATE TABLE IF NOT EXISTS umma_private.cafe_counter_fx_cash_receipts (
 order_id uuid PRIMARY KEY REFERENCES public.cafe_orders(id) ON DELETE CASCADE,
 currency text NOT NULL CHECK(currency IN ('USD','EUR')),
 vnd_per_unit numeric(18,8) NOT NULL CHECK(vnd_per_unit BETWEEN 1000 AND 100000),
 received_amount numeric(18,2) NOT NULL CHECK(received_amount>0),
 received_vnd integer NOT NULL CHECK(received_vnd>0),
 change_vnd integer NOT NULL CHECK(change_vnd>=0),
 quoted_at timestamptz NOT NULL,
 collected_at timestamptz NOT NULL DEFAULT now(),
 collected_by bigint NOT NULL
);
ALTER TABLE umma_private.cafe_counter_fx_cash_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON umma_private.cafe_counter_fx_cash_receipts FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.cafe_counter_fx_cash_settle(p_actor bigint, p_order_id uuid, p_currency text, p_rate numeric, p_received numeric, p_quoted_at timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE sale public.cafe_orders%rowtype; received_vnd_ integer; change_ integer; existing umma_private.cafe_counter_fx_cash_receipts%rowtype; result_ jsonb;
BEGIN
 SELECT * INTO sale FROM public.cafe_orders WHERE id=p_order_id FOR UPDATE;
 IF NOT FOUND OR sale.source_module<>'cafe' OR sale.created_via IS DISTINCT FROM 'staff'
  OR sale.order_type<>'pickup' OR sale.payment_method<>'cash'
 THEN RAISE EXCEPTION 'COUNTER_ACCESS'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.telegram_users u WHERE u.telegram_id=p_actor AND u.is_active AND
  (u.role='super_admin' OR (u.role IN ('admin','employee') AND EXISTS
   (SELECT 1 FROM public.cafe_staff s WHERE s.telegram_id=p_actor AND s.location_id=sale.location_id
    AND s.is_active AND s.can_accept_payments AND s.staff_role IN ('manager','cashier','kitchen')))))
 THEN RAISE EXCEPTION 'COUNTER_ACCESS'; END IF;
 SELECT * INTO existing FROM umma_private.cafe_counter_fx_cash_receipts WHERE order_id=p_order_id;
 IF FOUND THEN
  IF sale.payment_status='paid' AND existing.currency=p_currency AND existing.received_amount=p_received
  THEN RETURN jsonb_build_object('ok',true,'replayed',true,'changeVnd',existing.change_vnd,'receivedVnd',existing.received_vnd); END IF;
  RAISE EXCEPTION 'COUNTER_CLOSED';
 END IF;
 IF sale.payment_status<>'pending' OR sale.status IN ('completed','cancelled') THEN RAISE EXCEPTION 'COUNTER_CLOSED'; END IF;
 IF p_currency NOT IN ('USD','EUR') OR p_rate IS NULL OR p_rate NOT BETWEEN 1000 AND 100000
  OR p_received IS NULL OR p_received<=0 OR p_received>1000000 OR p_received<>round(p_received,2)
  OR p_quoted_at IS NULL OR p_quoted_at NOT BETWEEN now()-interval '24 hours' AND now()+interval '1 minute'
 THEN RAISE EXCEPTION 'COUNTER_INVALID'; END IF;
 received_vnd_:=floor(p_received*p_rate);
 IF received_vnd_ < sale.total_vnd OR received_vnd_>2147483647 THEN RAISE EXCEPTION 'COUNTER_INSUFFICIENT'; END IF;
 change_:=received_vnd_-sale.total_vnd;
 INSERT INTO umma_private.cafe_counter_fx_cash_receipts(order_id,currency,vnd_per_unit,received_amount,received_vnd,change_vnd,quoted_at,collected_by)
 VALUES(p_order_id,p_currency,p_rate,p_received,received_vnd_,change_,p_quoted_at,p_actor);
 result_:=public.update_cafe_order_payment_cash(p_order_id,p_actor,'paid',
  'Наличные '||p_currency||' '||p_received||' · курс '||p_rate||' VND · сдача '||change_||' VND',received_vnd_,change_);
 RETURN result_||jsonb_build_object('ok',true,'changeVnd',change_,'receivedVnd',received_vnd_);
END $function$
;
REVOKE ALL ON FUNCTION public.cafe_counter_fx_cash_settle(bigint,uuid,text,numeric,numeric,timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.cafe_counter_fx_cash_settle(bigint,uuid,text,numeric,numeric,timestamptz) TO service_role;
COMMIT;