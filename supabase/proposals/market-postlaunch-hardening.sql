-- Follow-up to the installed Market release. No stock, orders or payment data are changed.
BEGIN;
SET LOCAL lock_timeout='10s';
CREATE OR REPLACE FUNCTION public.market_order_guard() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
#variable_conflict use_column
DECLARE m public.market_orders; internal_ boolean:=current_setting('umma.market_order_write',true)='on';
BEGIN
 IF TG_OP='UPDATE' AND OLD.source_module IS DISTINCT FROM NEW.source_module THEN RAISE EXCEPTION 'Order module is immutable'; END IF;
 IF NEW.source_module<>'market' THEN RETURN NEW; END IF;
 IF TG_OP='INSERT' THEN IF internal_ IS DISTINCT FROM true THEN RAISE EXCEPTION 'Use Market checkout'; END IF; RETURN NEW; END IF;
 SELECT * INTO m FROM public.market_orders WHERE order_id=OLD.id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Market order extension missing'; END IF;
 IF OLD.payment_status='pending' AND NEW.payment_status='paid' AND (m.released OR (m.picked_at IS NULL AND m.reserve_until<now())) THEN RAISE EXCEPTION 'Market reservation expired; payment requires review'; END IF;
 IF NEW.status='ready' AND OLD.status<>'ready' AND (m.picked_at IS NULL OR EXISTS(SELECT 1 FROM public.market_reservations WHERE order_id=OLD.id AND state='reserved' AND picked_quantity<>quantity)) THEN RAISE EXCEPTION 'Complete all picking scans first'; END IF;
 IF NEW.delivery_status='picked_up' AND OLD.delivery_status<>'picked_up' AND (m.handed_at IS NULL OR m.handed_to IS DISTINCT FROM NEW.courier_telegram_id OR m.picked_at IS NULL OR (NEW.payment_timing IS DISTINCT FROM 'on_delivery' AND NEW.payment_status<>'paid')) THEN RAISE EXCEPTION 'Market handover not authorized'; END IF;
 IF NEW.status IS DISTINCT FROM OLD.status AND internal_ IS DISTINCT FROM true AND NOT(NEW.status='completed' AND OLD.status='ready' AND NEW.delivery_status='delivered' AND NEW.payment_status='paid') THEN RAISE EXCEPTION 'Use Market order controls'; END IF;
 IF NEW.status='completed' AND OLD.status<>'completed' AND (NEW.payment_status<>'paid' OR m.picked_at IS NULL OR (NEW.order_type='delivery' AND NEW.delivery_status<>'delivered')) THEN RAISE EXCEPTION 'Order must be picked, paid and delivered'; END IF;
 IF NEW.status='cancelled' AND NEW.payment_status='paid' THEN RAISE EXCEPTION 'Record full refund before cancellation'; END IF;
 IF (NEW.total_vnd,NEW.subtotal_vnd,NEW.delivery_fee_vnd,NEW.location_id) IS DISTINCT FROM (OLD.total_vnd,OLD.subtotal_vnd,OLD.delivery_fee_vnd,OLD.location_id) THEN RAISE EXCEPTION 'Confirmed order pricing is immutable'; END IF;
 RETURN NEW;
END $$;
DO $patch$
DECLARE src text;
BEGIN
 SELECT pg_get_functiondef('public.refund_cafe_order(uuid,bigint,uuid,text,boolean)'::regprocedure) INTO src;
 IF position('Use Market refund controls' IN src)=0 THEN
  IF position('IF o.payment_status' IN src)=0 THEN RAISE EXCEPTION 'Cafe refund compatibility changed'; END IF;
  src:=replace(src,'IF o.payment_status',E'IF o.source_module=''market'' THEN RAISE EXCEPTION ''Use Market refund controls''; END IF;\n IF o.payment_status');
  EXECUTE src;
 END IF;
END $patch$;
UPDATE storage.buckets SET allowed_mime_types=ARRAY['image/jpeg','image/png','image/webp','application/pdf'] WHERE id='market-evidence';
NOTIFY pgrst,'reload schema';
COMMIT;
