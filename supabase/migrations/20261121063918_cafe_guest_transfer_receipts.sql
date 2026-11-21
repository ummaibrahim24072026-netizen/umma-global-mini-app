BEGIN;

ALTER TABLE public.cafe_transfer_proofs DROP CONSTRAINT cafe_transfer_proofs_bank_country_check;
ALTER TABLE public.cafe_transfer_proofs ADD CONSTRAINT cafe_transfer_proofs_bank_country_check
  CHECK (bank_country IN ('RU','KZ','VN','CRYPTO'));

CREATE FUNCTION umma_private.is_cafe_guest_checkout(p_order_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE SET search_path = pg_catalog AS $function$
  SELECT EXISTS (SELECT 1 FROM umma_private.public_guest_requests WHERE order_id=p_order_id)
$function$;
REVOKE ALL ON FUNCTION umma_private.is_cafe_guest_checkout(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION umma_private.is_cafe_guest_checkout(uuid) TO service_role;

-- The counter passes only order IDs already scoped to the cashier's assigned cafe.
CREATE FUNCTION public.cafe_counter_proof_status(p_order_ids uuid[])
RETURNS TABLE (order_id uuid, requires_guest_proof boolean, has_pending_proof boolean)
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = pg_catalog AS $function$
  SELECT ids.id, umma_private.is_cafe_guest_checkout(ids.id), EXISTS (
    SELECT 1 FROM public.cafe_transfer_proofs p WHERE p.order_id=ids.id AND p.review_status='pending'
  )
  FROM unnest(p_order_ids) AS ids(id)
$function$;
REVOKE ALL ON FUNCTION public.cafe_counter_proof_status(uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cafe_counter_proof_status(uuid[]) TO service_role;

CREATE FUNCTION umma_private.confirm_guest_transfer_proof()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $function$
BEGIN
  IF NEW.payment_method NOT IN ('qr','bank_transfer') OR NOT umma_private.is_cafe_guest_checkout(NEW.id) THEN RETURN NEW; END IF;

  IF NEW.paid_by_telegram_id IS NULL THEN RAISE EXCEPTION 'GUEST_PAYMENT_PROOF_REQUIRED'; END IF;
  UPDATE public.cafe_transfer_proofs
    SET review_status='confirmed', reviewed_by_telegram_id=NEW.paid_by_telegram_id, reviewed_at=now()
    WHERE order_id=NEW.id AND review_status='pending';
  IF NOT FOUND THEN RAISE EXCEPTION 'GUEST_PAYMENT_PROOF_REQUIRED'; END IF;
  RETURN NEW;
END
$function$;
REVOKE ALL ON FUNCTION umma_private.confirm_guest_transfer_proof() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER cafe_confirm_guest_transfer_proof
  AFTER UPDATE OF payment_status ON public.cafe_orders
  FOR EACH ROW WHEN (NEW.payment_status='paid' AND OLD.payment_status IS DISTINCT FROM 'paid')
  EXECUTE FUNCTION umma_private.confirm_guest_transfer_proof();

-- Record matched bank notifications for web guests, while leaving confirmation to the counter.
DO $migration$
DECLARE
  definition text:=pg_get_functiondef('public.umma_pay_ingest(text,text,text,text,timestamptz,integer,bigint)'::regprocedure);
  anchor text:='ELSIF p_posted_at<o.created_at-interval ''2 minutes'' THEN v_reason:=''notification_before_order'';';
BEGIN
  IF strpos(definition,anchor)=0 THEN RAISE EXCEPTION 'UMMA Pay matching rules changed'; END IF;
  EXECUTE replace(definition,anchor,anchor||$body$
  ELSIF umma_private.is_cafe_guest_checkout(o.id) THEN
   UPDATE umma_private.pay_events SET order_id=o.id WHERE id=e.id;
   v_reason:='guest_receipt_review';
$body$);
END
$migration$;

COMMIT;
