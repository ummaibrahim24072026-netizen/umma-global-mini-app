ALTER TABLE public.cafe_transfer_proofs ALTER COLUMN customer_telegram_id DROP NOT NULL;

-- Web receipts have no Telegram identity. A unique index also handles concurrent uploads.
CREATE UNIQUE INDEX IF NOT EXISTS cafe_transfer_proofs_guest_order_key
 ON public.cafe_transfer_proofs (order_id) WHERE customer_telegram_id IS NULL;

UPDATE storage.buckets
 SET allowed_mime_types = ARRAY['image/jpeg','image/png','image/webp','application/pdf']
 WHERE id = 'cafe-transfer-proofs';
