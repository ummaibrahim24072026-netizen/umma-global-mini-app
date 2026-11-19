BEGIN;

ALTER TABLE public.cafe_payment_screens
  ADD COLUMN draft jsonb,
  ADD COLUMN display_revision bigint NOT NULL DEFAULT 0,
  ADD CONSTRAINT cafe_payment_screen_one_view CHECK (order_id IS NULL OR draft IS NULL);

CREATE FUNCTION public.cafe_screen_payment_amount(p_screen_id uuid, p_order_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT jsonb_build_object('channel',p.channel,'currency',p.currency,'amount',p.amount)
 FROM public.cafe_payment_screens s
 JOIN umma_private.cafe_counter_foreign_payments p ON p.order_id=s.order_id
 WHERE s.id=p_screen_id AND s.active AND p.order_id=p_order_id;
$$;

REVOKE ALL ON FUNCTION public.cafe_screen_payment_amount(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.cafe_screen_payment_amount(uuid,uuid) TO service_role;

COMMIT;
