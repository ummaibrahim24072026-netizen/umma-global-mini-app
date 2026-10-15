-- QR receipts use the existing private proof bucket and review workflow.
ALTER TABLE public.cafe_transfer_proofs
  DROP CONSTRAINT cafe_transfer_proofs_bank_country_check;
ALTER TABLE public.cafe_transfer_proofs
  ADD CONSTRAINT cafe_transfer_proofs_bank_country_check
  CHECK (bank_country IN ('RU', 'KZ', 'VN'));
