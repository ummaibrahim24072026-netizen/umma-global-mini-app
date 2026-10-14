-- Proposal only. Courier acceptance, geo offers and private proof metadata.
BEGIN;
ALTER TABLE public.cafe_orders ADD COLUMN IF NOT EXISTS dispatch_mode text NOT NULL DEFAULT 'broadcast' CHECK(dispatch_mode IN ('broadcast','nearest','manual'));
CREATE TABLE public.cafe_courier_positions(courier_telegram_id bigint PRIMARY KEY REFERENCES public.telegram_users(telegram_id),latitude double precision NOT NULL CHECK(latitude BETWEEN -90 AND 90),longitude double precision NOT NULL CHECK(longitude BETWEEN -180 AND 180),accuracy_m double precision NOT NULL CHECK(accuracy_m BETWEEN 0 AND 500),updated_at timestamptz NOT NULL DEFAULT clock_timestamp());
CREATE TABLE public.cafe_courier_offers(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),order_id uuid NOT NULL REFERENCES public.cafe_orders(id),courier_telegram_id bigint NOT NULL REFERENCES public.telegram_users(telegram_id),status text NOT NULL DEFAULT 'offered' CHECK(status IN ('offered','accepted','declined','expired','closed')),reason text,created_at timestamptz NOT NULL DEFAULT clock_timestamp(),expires_at timestamptz NOT NULL,responded_at timestamptz,UNIQUE(order_id,courier_telegram_id),CHECK(status<>'declined' OR length(trim(reason)) BETWEEN 3 AND 500));
CREATE INDEX cafe_courier_offers_recipient ON public.cafe_courier_offers(courier_telegram_id,status,expires_at);
CREATE TABLE public.cafe_delivery_proofs(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),order_id uuid NOT NULL REFERENCES public.cafe_orders(id),courier_telegram_id bigint NOT NULL REFERENCES public.telegram_users(telegram_id),request_key uuid NOT NULL,kind text NOT NULL CHECK(kind IN ('pickup','handover')),object_path text NOT NULL UNIQUE,image_sha256 text NOT NULL CHECK(image_sha256 ~ '^[a-f0-9]{64}$'),mime_type text NOT NULL CHECK(mime_type IN ('image/jpeg','image/png')),size_bytes integer NOT NULL CHECK(size_bytes BETWEEN 512 AND 8388608),verified_at timestamptz,created_at timestamptz NOT NULL DEFAULT clock_timestamp(),UNIQUE(courier_telegram_id,request_key));
CREATE TABLE public.cafe_courier_notifications(offer_id uuid PRIMARY KEY REFERENCES public.cafe_courier_offers(id),sent_at timestamptz,attempts integer NOT NULL DEFAULT 0,next_attempt_at timestamptz NOT NULL DEFAULT clock_timestamp(),leased_until timestamptz,last_error text);
ALTER TABLE public.cafe_courier_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cafe_courier_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cafe_delivery_proofs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cafe_courier_notifications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.cafe_courier_positions,public.cafe_courier_offers,public.cafe_delivery_proofs,public.cafe_courier_notifications FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.cafe_courier_positions,public.cafe_courier_offers,public.cafe_delivery_proofs TO service_role;

CREATE OR REPLACE FUNCTION public.cafe_active_courier(p_actor bigint,p_location uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public,pg_temp AS $$
 SELECT EXISTS(SELECT 1 FROM public.cafe_staff s JOIN public.telegram_users u USING(telegram_id) WHERE s.telegram_id=p_actor AND s.location_id=p_location AND s.staff_role='courier' AND s.is_active AND u.is_active AND u.role IN ('employee','admin'));
$$;
CREATE OR REPLACE FUNCTION public.ensure_cafe_courier_offers(p_order_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE o public.cafe_orders%rowtype; target bigint; cafe_lat double precision;cafe_lng double precision;
BEGIN
 SELECT * INTO o FROM public.cafe_orders WHERE id=p_order_id FOR UPDATE;
 IF NOT FOUND OR o.order_type<>'delivery' OR o.status IN ('completed','cancelled') OR o.delivery_status<>'waiting_courier' THEN RETURN jsonb_build_object('ok',true); END IF;
 UPDATE public.cafe_courier_offers SET status='expired',responded_at=clock_timestamp() WHERE order_id=o.id AND status='offered' AND expires_at<=clock_timestamp();
 IF o.dispatch_mode IN ('nearest','manual') THEN
  IF EXISTS(SELECT 1 FROM public.cafe_courier_offers WHERE order_id=o.id AND status='offered') THEN RETURN jsonb_build_object('ok',true); END IF;
  SELECT latitude,longitude INTO cafe_lat,cafe_lng FROM public.locations WHERE id=o.location_id;
  IF cafe_lat IS NOT NULL AND cafe_lng IS NOT NULL THEN
   SELECT p.courier_telegram_id INTO target FROM public.cafe_courier_positions p
   WHERE p.updated_at>=clock_timestamp()-interval '10 minutes' AND public.cafe_active_courier(p.courier_telegram_id,o.location_id)
     AND NOT EXISTS(SELECT 1 FROM public.cafe_courier_offers f WHERE f.order_id=o.id AND f.courier_telegram_id=p.courier_telegram_id AND f.status<>'expired')
   ORDER BY (EXISTS(SELECT 1 FROM public.cafe_courier_offers f WHERE f.order_id=o.id AND f.courier_telegram_id=p.courier_telegram_id))::integer, power(sin(radians(p.latitude-cafe_lat)/2),2)+cos(radians(cafe_lat))*cos(radians(p.latitude))*power(sin(radians(p.longitude-cafe_lng)/2),2),p.courier_telegram_id LIMIT 1;
  END IF;
 END IF;
 -- Missing/stale geo falls back to all remaining active couriers; no fabricated location.
 INSERT INTO public.cafe_courier_offers(order_id,courier_telegram_id,expires_at)
 SELECT o.id,s.telegram_id,clock_timestamp()+CASE WHEN target IS NOT NULL THEN interval '2 minutes' ELSE interval '15 minutes' END
 FROM public.cafe_staff s WHERE s.location_id=o.location_id AND public.cafe_active_courier(s.telegram_id,o.location_id) AND (target IS NULL OR s.telegram_id=target)
 ON CONFLICT(order_id,courier_telegram_id) DO UPDATE SET status='offered',expires_at=excluded.expires_at,created_at=clock_timestamp(),responded_at=NULL WHERE cafe_courier_offers.status='expired';
 INSERT INTO public.cafe_courier_notifications(offer_id) SELECT id FROM public.cafe_courier_offers WHERE order_id=o.id AND status='offered' ON CONFLICT(offer_id) DO UPDATE SET sent_at=NULL,next_attempt_at=clock_timestamp() WHERE cafe_courier_notifications.sent_at IS NOT NULL AND cafe_courier_notifications.sent_at<(SELECT created_at FROM public.cafe_courier_offers WHERE id=excluded.offer_id);
 RETURN jsonb_build_object('ok',true,'nearestCourier',target);
END $$;
CREATE OR REPLACE FUNCTION public.offer_cafe_courier(p_order_id uuid,p_actor_telegram_id bigint,p_courier_telegram_id bigint) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE o public.cafe_orders%rowtype; actor_role text; staff text; f public.cafe_courier_offers%rowtype;
BEGIN
 SELECT u.role INTO actor_role FROM public.telegram_users u WHERE telegram_id=p_actor_telegram_id AND u.is_active;
 SELECT * INTO o FROM public.cafe_orders WHERE id=p_order_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
 SELECT s.staff_role INTO staff FROM public.cafe_staff s WHERE s.telegram_id=p_actor_telegram_id AND s.location_id=o.location_id AND s.is_active;
 IF coalesce(actor_role,'')<>'super_admin' AND (coalesce(actor_role,'') NOT IN ('admin','employee') OR coalesce(staff,'') NOT IN ('manager','cashier','waiter','kitchen')) THEN RAISE EXCEPTION 'Courier dispatch access denied'; END IF;
 IF o.order_type<>'delivery' OR o.status IN ('completed','cancelled') OR o.delivery_status<>'waiting_courier' OR NOT public.cafe_active_courier(p_courier_telegram_id,o.location_id) THEN RAISE EXCEPTION 'Order cannot be offered to courier'; END IF;
 UPDATE public.cafe_orders SET dispatch_mode='manual' WHERE id=o.id RETURNING * INTO o;
 UPDATE public.cafe_courier_offers SET status='expired',expires_at=clock_timestamp(),responded_at=clock_timestamp() WHERE order_id=o.id AND courier_telegram_id<>p_courier_telegram_id AND status='offered';
 SELECT * INTO f FROM public.cafe_courier_offers WHERE order_id=o.id AND courier_telegram_id=p_courier_telegram_id;
 IF FOUND THEN
  IF f.status='declined' OR f.status='accepted' OR f.status='closed' THEN RAISE EXCEPTION 'Courier already responded to this order'; END IF;
  IF f.status='expired' OR f.expires_at<=clock_timestamp() THEN
   UPDATE public.cafe_courier_offers SET status='offered',expires_at=clock_timestamp()+interval '15 minutes',created_at=clock_timestamp(),responded_at=NULL WHERE id=f.id;
   UPDATE public.cafe_courier_notifications SET sent_at=NULL,leased_until=NULL,next_attempt_at=clock_timestamp() WHERE offer_id=f.id;
   RETURN jsonb_build_object('ok',true,'replayed',false,'order',to_jsonb(o));
  END IF;
  RETURN jsonb_build_object('ok',true,'replayed',true,'order',to_jsonb(o));
 END IF;
 INSERT INTO public.cafe_courier_offers(order_id,courier_telegram_id,expires_at) VALUES(o.id,p_courier_telegram_id,clock_timestamp()+interval '15 minutes') RETURNING * INTO f;
 INSERT INTO public.cafe_courier_notifications(offer_id) VALUES(f.id);
 RETURN jsonb_build_object('ok',true,'replayed',false,'order',to_jsonb(o));
END $$;
CREATE OR REPLACE FUNCTION public.respond_cafe_courier_offer(p_order_id uuid,p_actor_telegram_id bigint,p_accept boolean,p_reason text DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE o public.cafe_orders%rowtype; f public.cafe_courier_offers%rowtype;
BEGIN
 IF p_accept IS NULL THEN RAISE EXCEPTION 'Courier response required'; END IF;
 SELECT * INTO o FROM public.cafe_orders WHERE id=p_order_id FOR UPDATE;
 IF NOT FOUND OR NOT public.cafe_active_courier(p_actor_telegram_id,o.location_id) THEN RAISE EXCEPTION 'Courier access denied'; END IF;
 SELECT * INTO f FROM public.cafe_courier_offers WHERE order_id=o.id AND courier_telegram_id=p_actor_telegram_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Courier offer not found'; END IF;
 IF f.status='accepted' AND p_accept AND o.courier_telegram_id=p_actor_telegram_id THEN RETURN jsonb_build_object('ok',true,'replayed',true,'order',to_jsonb(o)); END IF;
 IF f.status='declined' AND NOT p_accept AND f.reason=trim(p_reason) THEN RETURN jsonb_build_object('ok',true,'replayed',true); END IF;
 IF f.status<>'offered' OR f.expires_at<=clock_timestamp() OR o.status IN ('completed','cancelled') OR o.delivery_status<>'waiting_courier' THEN RAISE EXCEPTION 'Courier offer no longer available'; END IF;
 IF NOT p_accept AND length(trim(coalesce(p_reason,''))) NOT BETWEEN 3 AND 500 THEN RAISE EXCEPTION 'Decline reason required'; END IF;
 UPDATE public.cafe_courier_offers SET status=CASE WHEN p_accept THEN 'accepted' ELSE 'declined' END,reason=CASE WHEN p_accept THEN NULL ELSE trim(p_reason) END,responded_at=clock_timestamp() WHERE id=f.id;
 IF p_accept THEN
  UPDATE public.cafe_orders SET courier_telegram_id=p_actor_telegram_id,delivery_status='courier_assigned',updated_at=clock_timestamp() WHERE id=o.id RETURNING * INTO o;
  UPDATE public.cafe_courier_offers SET status='closed',responded_at=clock_timestamp() WHERE order_id=o.id AND id<>f.id AND status='offered';
  INSERT INTO public.cafe_order_events(order_id,actor_telegram_id,from_status,to_status,note) VALUES(o.id,p_actor_telegram_id,'waiting_courier','courier_assigned','Курьер принял предложение');
 ELSE
  PERFORM public.ensure_cafe_courier_offers(o.id);
 END IF;
 RETURN jsonb_build_object('ok',true,'replayed',false,'order',to_jsonb(o));
END $$;
CREATE OR REPLACE FUNCTION public.update_cafe_courier_position(p_actor bigint,p_lat double precision,p_lng double precision,p_accuracy double precision) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.cafe_staff s WHERE s.telegram_id=p_actor AND public.cafe_active_courier(p_actor,s.location_id)) THEN RAISE EXCEPTION 'Courier access denied'; END IF;
 IF p_lat IS NULL OR p_lng IS NULL OR p_accuracy IS NULL OR p_lat NOT BETWEEN -90 AND 90 OR p_lng NOT BETWEEN -180 AND 180 OR p_accuracy NOT BETWEEN 0 AND 500 THEN RAISE EXCEPTION 'Invalid courier position'; END IF;
 INSERT INTO public.cafe_courier_positions VALUES(p_actor,p_lat,p_lng,p_accuracy,clock_timestamp()) ON CONFLICT(courier_telegram_id) DO UPDATE SET latitude=excluded.latitude,longitude=excluded.longitude,accuracy_m=excluded.accuracy_m,updated_at=excluded.updated_at;
 RETURN jsonb_build_object('ok',true);
END $$;
CREATE OR REPLACE FUNCTION public.list_cafe_courier_offers(p_actor bigint) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT coalesce(jsonb_agg(jsonb_build_object('orderId',o.id,'orderNumber',o.order_number,'locationName',l.name,'totalVnd',o.total_vnd,'kitchenStatus',o.status,'expiresAt',f.expires_at)),'[]'::jsonb)
 FROM public.cafe_courier_offers f JOIN public.cafe_orders o ON o.id=f.order_id JOIN public.locations l ON l.id=o.location_id
 WHERE f.courier_telegram_id=p_actor AND f.status='offered' AND f.expires_at>clock_timestamp() AND o.delivery_status='waiting_courier' AND o.status NOT IN ('completed','cancelled') AND public.cafe_active_courier(p_actor,o.location_id);
$$;
CREATE OR REPLACE FUNCTION public.begin_cafe_delivery_proof(p_order_id uuid,p_actor bigint,p_key uuid,p_kind text,p_sha text,p_mime text,p_size integer) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE o public.cafe_orders%rowtype; f public.cafe_delivery_proofs%rowtype;
BEGIN
 SELECT * INTO o FROM public.cafe_orders WHERE id=p_order_id FOR UPDATE;
 IF NOT FOUND OR o.courier_telegram_id IS DISTINCT FROM p_actor OR NOT public.cafe_active_courier(p_actor,o.location_id) THEN RAISE EXCEPTION 'Proof courier access denied'; END IF;
 SELECT * INTO f FROM public.cafe_delivery_proofs WHERE courier_telegram_id=p_actor AND request_key=p_key;
 IF FOUND THEN
  IF f.order_id<>o.id OR f.kind<>p_kind OR f.image_sha256<>p_sha OR f.mime_type<>p_mime OR f.size_bytes<>p_size THEN RAISE EXCEPTION 'Proof key reused with different photo'; END IF;
  RETURN jsonb_build_object('ok',true,'proof',to_jsonb(f),'replayed',true);
 END IF;
 IF p_key IS NULL OR p_kind NOT IN ('pickup','handover') OR o.status IN ('completed','cancelled') OR (p_kind='pickup' AND (o.status<>'ready' OR o.delivery_status<>'courier_assigned')) OR (p_kind='handover' AND o.delivery_status<>'picked_up') THEN RAISE EXCEPTION 'Proof not allowed at this delivery stage'; END IF;
 IF p_kind='handover' AND EXISTS(SELECT 1 FROM public.cafe_delivery_proofs WHERE order_id=o.id AND courier_telegram_id=p_actor AND kind='pickup' AND verified_at IS NOT NULL AND image_sha256=p_sha) THEN RAISE EXCEPTION 'Take a new photo at handover; pickup image cannot be reused'; END IF;
 INSERT INTO public.cafe_delivery_proofs(order_id,courier_telegram_id,request_key,kind,object_path,image_sha256,mime_type,size_bytes)
 VALUES(o.id,p_actor,p_key,p_kind,o.id::text||'/'||p_actor::text||'/'||p_key::text||CASE WHEN p_mime='image/jpeg' THEN '.jpg' ELSE '.png' END,p_sha,p_mime,p_size) RETURNING * INTO f;
 RETURN jsonb_build_object('ok',true,'proof',to_jsonb(f),'replayed',false);
END $$;
CREATE OR REPLACE FUNCTION public.confirm_cafe_delivery_proof(p_id uuid,p_actor bigint) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE f public.cafe_delivery_proofs%rowtype; o public.cafe_orders%rowtype;
BEGIN
 SELECT * INTO f FROM public.cafe_delivery_proofs WHERE id=p_id AND courier_telegram_id=p_actor;
 IF NOT FOUND THEN RAISE EXCEPTION 'Proof not found'; END IF;
 SELECT * INTO o FROM public.cafe_orders WHERE id=f.order_id FOR UPDATE;
 IF o.courier_telegram_id IS DISTINCT FROM p_actor OR NOT public.cafe_active_courier(p_actor,o.location_id) THEN RAISE EXCEPTION 'Proof courier access denied'; END IF;
 IF f.verified_at IS NOT NULL THEN RETURN jsonb_build_object('ok',true,'proof',to_jsonb(f)); END IF;
 IF o.status IN ('completed','cancelled') OR (f.kind='pickup' AND (o.status<>'ready' OR o.delivery_status<>'courier_assigned')) OR (f.kind='handover' AND o.delivery_status<>'picked_up') THEN RAISE EXCEPTION 'Proof not allowed at this delivery stage'; END IF;
 UPDATE public.cafe_delivery_proofs SET verified_at=clock_timestamp() WHERE id=f.id RETURNING * INTO f;
 RETURN jsonb_build_object('ok',true,'proof',to_jsonb(f));
END $$;
-- Queue leases make concurrent notification workers safe; failed sends remain retryable.
CREATE OR REPLACE FUNCTION public.lease_cafe_courier_notifications() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE outbox jsonb;
BEGIN
 WITH selected AS (SELECT n.offer_id FROM public.cafe_courier_notifications n JOIN public.cafe_courier_offers f ON f.id=n.offer_id JOIN public.cafe_orders o ON o.id=f.order_id WHERE n.sent_at IS NULL AND n.next_attempt_at<=clock_timestamp() AND coalesce(n.leased_until,'-infinity')<clock_timestamp() AND f.status='offered' AND f.expires_at>clock_timestamp() AND o.delivery_status='waiting_courier' AND o.status NOT IN ('completed','cancelled') AND public.cafe_active_courier(f.courier_telegram_id,o.location_id) ORDER BY n.next_attempt_at LIMIT 50 FOR UPDATE OF n SKIP LOCKED), leased AS (UPDATE public.cafe_courier_notifications n SET leased_until=clock_timestamp()+interval '1 minute',attempts=attempts+1 FROM selected WHERE n.offer_id=selected.offer_id RETURNING n.offer_id)
 SELECT coalesce(jsonb_agg(jsonb_build_object('offerId',f.id,'courierId',f.courier_telegram_id,'orderNumber',o.order_number,'locationName',l.name,'ready',o.status='ready')),'[]'::jsonb) INTO outbox FROM leased JOIN public.cafe_courier_offers f ON f.id=leased.offer_id JOIN public.cafe_orders o ON o.id=f.order_id JOIN public.locations l ON l.id=o.location_id;
 RETURN outbox;
END $$;
CREATE OR REPLACE FUNCTION public.finish_cafe_courier_notification(p_offer uuid,p_success boolean,p_error text DEFAULT NULL) RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path=public,pg_temp AS $$
 UPDATE public.cafe_courier_notifications SET sent_at=CASE WHEN p_success THEN clock_timestamp() ELSE sent_at END,leased_until=NULL,next_attempt_at=clock_timestamp()+interval '30 seconds',last_error=CASE WHEN p_success THEN NULL ELSE left(p_error,500) END WHERE offer_id=p_offer;
$$;
CREATE OR REPLACE FUNCTION public.advance_cafe_courier_queue() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE o record;
BEGIN
 FOR o IN SELECT id FROM public.cafe_orders WHERE order_type='delivery' AND delivery_status='waiting_courier' AND status NOT IN ('completed','cancelled') LOOP PERFORM public.ensure_cafe_courier_offers(o.id); END LOOP;
 RETURN jsonb_build_object('ok',true);
END $$;
CREATE OR REPLACE FUNCTION public.authorize_cafe_delivery_proof_view(p_proof uuid,p_actor bigint) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE f public.cafe_delivery_proofs%rowtype;o public.cafe_orders%rowtype;actor_role text;staff text;
BEGIN
 SELECT role INTO actor_role FROM public.telegram_users WHERE telegram_id=p_actor AND is_active;
 IF NOT FOUND THEN RAISE EXCEPTION 'Proof view access denied'; END IF;
 SELECT * INTO f FROM public.cafe_delivery_proofs WHERE id=p_proof AND verified_at IS NOT NULL;
 IF NOT FOUND THEN RAISE EXCEPTION 'Proof not found'; END IF;
 SELECT * INTO o FROM public.cafe_orders WHERE id=f.order_id;
 SELECT staff_role INTO staff FROM public.cafe_staff WHERE telegram_id=p_actor AND location_id=o.location_id AND is_active;
 IF actor_role<>'super_admin' AND NOT(coalesce(actor_role,'') IN ('admin','employee') AND (coalesce(staff,'')='manager' OR (coalesce(staff,'')='courier' AND f.courier_telegram_id=p_actor AND o.courier_telegram_id=p_actor))) THEN RAISE EXCEPTION 'Proof view access denied'; END IF;
 RETURN jsonb_build_object('ok',true,'path',f.object_path);
END $$;
DO $$ DECLARE f record; BEGIN
 FOR f IN SELECT p.oid::regprocedure signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN ('cafe_active_courier','ensure_cafe_courier_offers','offer_cafe_courier','respond_cafe_courier_offer','update_cafe_courier_position','list_cafe_courier_offers','begin_cafe_delivery_proof','confirm_cafe_delivery_proof','lease_cafe_courier_notifications','finish_cafe_courier_notification','advance_cafe_courier_queue','authorize_cafe_delivery_proof_view') LOOP
 EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated',f.signature);
 EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role',f.signature);
 END LOOP;
END $$;
COMMIT;
