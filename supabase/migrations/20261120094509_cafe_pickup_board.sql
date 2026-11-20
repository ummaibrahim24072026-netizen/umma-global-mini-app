CREATE TABLE public.cafe_pickup_screens (
  actor_id bigint NOT NULL REFERENCES public.cafe_web_accounts(actor_id) ON DELETE CASCADE,
  location_id uuid NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  token_hash text UNIQUE NOT NULL CHECK (token_hash ~ '^[a-f0-9]{64}$'),
  PRIMARY KEY (actor_id, location_id)
);

ALTER TABLE public.cafe_pickup_screens ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.cafe_pickup_screens FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cafe_pickup_screens TO service_role;

CREATE INDEX cafe_order_events_pickup_call_idx ON public.cafe_order_events (created_at DESC, id DESC)
  WHERE to_status = 'completed' AND note = 'counter_pickup_call';
