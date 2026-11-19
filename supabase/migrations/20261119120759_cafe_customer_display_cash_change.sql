ALTER TABLE public.cafe_payment_screens
  ADD COLUMN cash_received_preview integer CHECK (cash_received_preview >= 0);
