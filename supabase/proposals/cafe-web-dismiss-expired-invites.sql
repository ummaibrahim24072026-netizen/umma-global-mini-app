ALTER TABLE public.cafe_web_invites
  ADD COLUMN IF NOT EXISTS dismissed_at timestamptz;
