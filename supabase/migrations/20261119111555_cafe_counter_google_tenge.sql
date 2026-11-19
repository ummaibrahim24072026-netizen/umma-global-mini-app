BEGIN;

ALTER TABLE umma_private.cafe_counter_recipients
  ALTER COLUMN vnd_per_unit DROP NOT NULL,
  ADD CONSTRAINT cafe_counter_usdt_rate_required CHECK (channel <> 'usdt' OR vnd_per_unit IS NOT NULL);

-- Replace just the foreign-currency pricing branch. Preserve permissions and existing transaction logic.
DO $migration$
DECLARE
  definition text:=pg_get_functiondef('public.cafe_counter_foreign_payment(bigint,text,jsonb)'::regprocedure);
  old_pricing text:=$old$amount_:=round(sale.total_vnd/configured.vnd_per_unit,CASE WHEN method='usdt' THEN 6 ELSE 2 END);$old$;
  google_pricing text:=$new$IF method='usdt' THEN
          amount_:=round(sale.total_vnd/configured.vnd_per_unit,6);
        ELSE
          IF (p_args->>'vndPerKzt')::numeric IS NULL OR (p_args->>'vndPerKzt')::numeric NOT BETWEEN 1 AND 1000
             OR (p_args->>'quotedAt')::timestamptz IS NULL
             OR (p_args->>'quotedAt')::timestamptz NOT BETWEEN now()-interval '72 hours' AND now()+interval '1 minute'
          THEN RAISE EXCEPTION 'COUNTER_KZT_RATE'; END IF;
          amount_:=round(sale.total_vnd/(p_args->>'vndPerKzt')::numeric,2);
        END IF;$new$;
BEGIN
  IF strpos(definition,old_pricing)=0 THEN RAISE EXCEPTION 'Counter pricing logic changed'; END IF;
  EXECUTE replace(definition,old_pricing,google_pricing);
END
$migration$;

COMMIT;
