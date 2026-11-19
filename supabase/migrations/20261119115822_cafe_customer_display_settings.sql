BEGIN;

ALTER TABLE public.cafe_payment_screens ADD COLUMN display_layout text NOT NULL DEFAULT 'auto'
  CHECK (display_layout IN ('auto','phone','tablet-small','tablet-large','monitor'));

CREATE OR REPLACE FUNCTION public.cafe_screen_payment_amount(p_screen_id uuid, p_order_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT jsonb_build_object('channel',p.channel,'currency',p.currency,'amount',p.amount) ||
  CASE WHEN o.payment_status='pending' AND o.status NOT IN ('cancelled','completed')
         AND o.payment_method='bank_transfer' AND p.currency IN ('RUB','KZT') AND p.account ~ '^\+7[0-9]{10}$'
    THEN jsonb_build_object('phone',p.account,'bank',p.bank,'recipient',p.recipient)
    ELSE '{}'::jsonb END
 FROM public.cafe_payment_screens s
 JOIN umma_private.cafe_counter_foreign_payments p ON p.order_id=s.order_id
 JOIN public.cafe_orders o ON o.id=p.order_id AND o.location_id=s.location_id
 WHERE s.id=p_screen_id AND s.active AND p.order_id=p_order_id;
$$;

COMMIT;
