-- Courier work presence, one reserved nearest offer, then a shared delivery pool.
BEGIN;
CREATE TABLE public.cafe_courier_presence(
 courier_telegram_id bigint PRIMARY KEY REFERENCES public.telegram_users(telegram_id),
 online boolean NOT NULL DEFAULT false,last_seen_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE public.cafe_courier_presence ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.cafe_courier_presence FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.cafe_courier_presence TO service_role;
ALTER TABLE public.cafe_courier_offers ADD COLUMN offer_scope text NOT NULL DEFAULT 'pool' CHECK(offer_scope IN ('exclusive','pool'));
ALTER TABLE public.cafe_orders ALTER COLUMN dispatch_mode SET DEFAULT 'nearest';
CREATE OR REPLACE FUNCTION public.courier_dispatch_online(p_actor bigint) RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public,pg_temp AS $$
 SELECT EXISTS(SELECT 1 FROM public.cafe_courier_presence WHERE courier_telegram_id=p_actor AND online AND last_seen_at>=clock_timestamp()-interval '2 minutes');
$$;
CREATE OR REPLACE FUNCTION public.courier_dispatch_busy(p_actor bigint) RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public,pg_temp AS $$
 SELECT EXISTS(SELECT 1 FROM public.cafe_orders WHERE courier_telegram_id=p_actor AND order_type='delivery' AND status NOT IN ('completed','cancelled') AND NOT(delivery_status='delivered' AND payment_status='paid'));
$$;
CREATE OR REPLACE FUNCTION public.set_courier_dispatch_presence(p_actor bigint,p_online boolean) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF p_online IS NULL OR NOT EXISTS(SELECT 1 FROM public.cafe_staff s WHERE s.telegram_id=p_actor AND public.cafe_active_courier(p_actor,s.location_id)) THEN RAISE EXCEPTION 'Courier availability access denied'; END IF;
 INSERT INTO public.cafe_courier_presence(courier_telegram_id,online) VALUES(p_actor,p_online) ON CONFLICT(courier_telegram_id) DO UPDATE SET online=p_online,last_seen_at=clock_timestamp();
 IF NOT p_online THEN UPDATE public.cafe_courier_offers SET status='expired',expires_at=clock_timestamp(),responded_at=clock_timestamp() WHERE courier_telegram_id=p_actor AND status='offered'; END IF;
 RETURN jsonb_build_object('ok',true,'online',p_online);
END $$;
CREATE OR REPLACE FUNCTION public.respond_cafe_courier_offer(p_order_id uuid, p_actor_telegram_id bigint, p_accept boolean, p_reason text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE o public.cafe_orders%rowtype; f public.cafe_courier_offers%rowtype;
BEGIN
 PERFORM 1 FROM public.cafe_courier_presence WHERE courier_telegram_id=p_actor_telegram_id FOR UPDATE;
 IF p_accept IS NULL THEN RAISE EXCEPTION 'Courier response required'; END IF;
 SELECT * INTO o FROM public.cafe_orders WHERE id=p_order_id FOR UPDATE;
 IF NOT FOUND OR NOT public.cafe_active_courier(p_actor_telegram_id,o.location_id) THEN RAISE EXCEPTION 'Courier access denied'; END IF;
 SELECT * INTO f FROM public.cafe_courier_offers WHERE order_id=o.id AND courier_telegram_id=p_actor_telegram_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Courier offer not found'; END IF;
 IF f.status='accepted' AND p_accept AND o.courier_telegram_id=p_actor_telegram_id THEN RETURN jsonb_build_object('ok',true,'replayed',true,'order',to_jsonb(o)); END IF;
 IF f.status='declined' AND NOT p_accept AND f.reason=trim(p_reason) THEN RETURN jsonb_build_object('ok',true,'replayed',true); END IF;
 IF f.status<>'offered' OR f.expires_at<=clock_timestamp() OR o.status IN ('completed','cancelled') OR o.delivery_status<>'waiting_courier' THEN RAISE EXCEPTION 'Courier offer no longer available'; END IF;
 IF p_accept AND (NOT public.courier_dispatch_online(p_actor_telegram_id) OR public.courier_dispatch_busy(p_actor_telegram_id)) THEN RAISE EXCEPTION 'Go online and finish your current delivery first'; END IF;
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
END $function$
;
CREATE OR REPLACE FUNCTION public.update_cafe_courier_position(p_actor bigint, p_lat double precision, p_lng double precision, p_accuracy double precision)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.cafe_staff s WHERE s.telegram_id=p_actor AND public.cafe_active_courier(p_actor,s.location_id)) THEN RAISE EXCEPTION 'Courier access denied'; END IF;
 IF p_lat IS NULL OR p_lng IS NULL OR p_accuracy IS NULL OR p_lat NOT BETWEEN -90 AND 90 OR p_lng NOT BETWEEN -180 AND 180 OR p_accuracy NOT BETWEEN 0 AND 500 THEN RAISE EXCEPTION 'Invalid courier position'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.cafe_courier_presence WHERE courier_telegram_id=p_actor AND online) THEN RAISE EXCEPTION 'Courier is offline'; END IF;
 UPDATE public.cafe_courier_presence SET last_seen_at=clock_timestamp() WHERE courier_telegram_id=p_actor AND online;
 INSERT INTO public.cafe_courier_positions VALUES(p_actor,p_lat,p_lng,p_accuracy,clock_timestamp()) ON CONFLICT(courier_telegram_id) DO UPDATE SET latitude=excluded.latitude,longitude=excluded.longitude,accuracy_m=excluded.accuracy_m,updated_at=excluded.updated_at;
 RETURN jsonb_build_object('ok',true);
END $function$
;

CREATE OR REPLACE FUNCTION public.ensure_cafe_courier_offers(p_order_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE o public.cafe_orders%rowtype;target bigint;cafe_lat double precision;cafe_lng double precision;
BEGIN
 SELECT * INTO o FROM public.cafe_orders WHERE id=p_order_id FOR UPDATE;
 IF NOT FOUND OR o.order_type<>'delivery' OR o.status IN ('completed','cancelled') OR o.delivery_status<>'waiting_courier' THEN RETURN jsonb_build_object('ok',true); END IF;
 UPDATE public.cafe_courier_offers f SET status='expired',responded_at=clock_timestamp() WHERE order_id=o.id AND status='offered' AND (expires_at<=clock_timestamp() OR NOT public.courier_dispatch_online(f.courier_telegram_id) OR public.courier_dispatch_busy(f.courier_telegram_id));
 IF o.dispatch_mode='manual' THEN RETURN jsonb_build_object('ok',true,'manual',true); END IF;
 IF EXISTS(SELECT 1 FROM public.cafe_courier_offers WHERE order_id=o.id AND status='offered' AND offer_scope='exclusive') THEN RETURN jsonb_build_object('ok',true); END IF;
 IF o.dispatch_mode='nearest' AND NOT EXISTS(SELECT 1 FROM public.cafe_courier_offers WHERE order_id=o.id) THEN
  SELECT latitude,longitude INTO cafe_lat,cafe_lng FROM public.locations WHERE id=o.location_id;
  IF cafe_lat IS NOT NULL AND cafe_lng IS NOT NULL THEN
   SELECT p.courier_telegram_id INTO target FROM public.cafe_courier_positions p
   WHERE p.updated_at>=clock_timestamp()-interval '90 seconds' AND public.cafe_active_courier(p.courier_telegram_id,o.location_id)
    AND public.courier_dispatch_online(p.courier_telegram_id) AND NOT public.courier_dispatch_busy(p.courier_telegram_id)
   ORDER BY power(sin(radians(p.latitude-cafe_lat)/2),2)+cos(radians(cafe_lat))*cos(radians(p.latitude))*power(sin(radians(p.longitude-cafe_lng)/2),2),p.courier_telegram_id LIMIT 1;
  END IF;
 END IF;
 INSERT INTO public.cafe_courier_offers(order_id,courier_telegram_id,expires_at,offer_scope)
 SELECT o.id,s.telegram_id,clock_timestamp()+CASE WHEN target IS NOT NULL THEN interval '60 seconds' ELSE interval '15 minutes' END,CASE WHEN target IS NOT NULL THEN 'exclusive' ELSE 'pool' END
 FROM public.cafe_staff s WHERE s.location_id=o.location_id AND public.cafe_active_courier(s.telegram_id,o.location_id)
  AND public.courier_dispatch_online(s.telegram_id) AND NOT public.courier_dispatch_busy(s.telegram_id) AND (target IS NULL OR s.telegram_id=target)
 ON CONFLICT(order_id,courier_telegram_id) DO UPDATE SET status='offered',expires_at=excluded.expires_at,offer_scope=excluded.offer_scope,created_at=clock_timestamp(),responded_at=NULL WHERE cafe_courier_offers.status='expired';
 INSERT INTO public.cafe_courier_notifications(offer_id) SELECT id FROM public.cafe_courier_offers WHERE order_id=o.id AND status='offered' ON CONFLICT(offer_id) DO NOTHING;
 RETURN jsonb_build_object('ok',true,'nearestCourier',target);
END $$;
CREATE OR REPLACE FUNCTION public.courier_offer_payload(p_order uuid,p_actor bigint,p_expires timestamptz,p_scope text) RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public,pg_temp AS $$
 SELECT jsonb_build_object('orderId',o.id,'orderNumber',o.order_number,'locationName',l.name,'pickupAddress',coalesce(l.address,l.name),
 'deliveryAddress',regexp_replace(coalesce(o.delivery_address,''),'Точка доставки:[^\n]*','','g'),'totalVnd',o.total_vnd,'deliveryFeeVnd',o.delivery_fee_vnd,
 'paymentTiming',o.payment_timing,'paymentStatus',o.payment_status,'kitchenStatus',o.status,'expiresAt',p_expires,'scope',p_scope,
 'pickupDistanceM',CASE WHEN p.updated_at>=clock_timestamp()-interval '90 seconds' AND l.latitude IS NOT NULL AND l.longitude IS NOT NULL THEN
  round((6371000*2*asin(sqrt(least(1.0,power(sin(radians(p.latitude-l.latitude)/2),2)+cos(radians(l.latitude))*cos(radians(p.latitude))*power(sin(radians(p.longitude-l.longitude)/2),2)))))::numeric) ELSE NULL END)
 FROM public.cafe_orders o JOIN public.locations l ON l.id=o.location_id LEFT JOIN public.cafe_courier_positions p ON p.courier_telegram_id=p_actor WHERE o.id=p_order;
$$;
CREATE OR REPLACE FUNCTION public.list_cafe_courier_offers(p_actor bigint) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT coalesce(jsonb_agg(public.courier_offer_payload(o.id,p_actor,f.expires_at,'exclusive') ORDER BY f.expires_at),'[]'::jsonb)
 FROM public.cafe_courier_offers f JOIN public.cafe_orders o ON o.id=f.order_id
 WHERE f.courier_telegram_id=p_actor AND f.status='offered' AND f.expires_at>clock_timestamp() AND (f.offer_scope='exclusive' OR o.dispatch_mode='manual')
 AND o.delivery_status='waiting_courier' AND o.status NOT IN ('completed','cancelled') AND public.cafe_active_courier(p_actor,o.location_id)
 AND public.courier_dispatch_online(p_actor) AND NOT public.courier_dispatch_busy(p_actor);
$$;
CREATE OR REPLACE FUNCTION public.list_cafe_available_deliveries(p_actor bigint) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT coalesce(jsonb_agg(public.courier_offer_payload(o.id,p_actor,NULL,'pool') ORDER BY o.created_at),'[]'::jsonb) FROM
 (SELECT * FROM public.cafe_orders o WHERE o.order_type='delivery' AND o.status NOT IN ('completed','cancelled') AND o.delivery_status='waiting_courier' AND o.dispatch_mode<>'manual'
 AND public.cafe_active_courier(p_actor,o.location_id) AND public.courier_dispatch_online(p_actor) AND NOT public.courier_dispatch_busy(p_actor)
 AND NOT EXISTS(SELECT 1 FROM public.cafe_courier_offers f WHERE f.order_id=o.id AND f.status='offered' AND f.offer_scope='exclusive' AND f.expires_at>clock_timestamp() AND public.courier_dispatch_online(f.courier_telegram_id) AND NOT public.courier_dispatch_busy(f.courier_telegram_id))
 ORDER BY (o.status='ready') DESC,o.created_at LIMIT 50) o;
$$;
CREATE OR REPLACE FUNCTION public.advance_cafe_courier_queue() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE o record;BEGIN
 FOR o IN SELECT id FROM public.cafe_orders WHERE order_type='delivery' AND delivery_status='waiting_courier' AND status NOT IN ('completed','cancelled') ORDER BY id LOOP PERFORM public.ensure_cafe_courier_offers(o.id); END LOOP;
 RETURN jsonb_build_object('ok',true);
END $$;
CREATE OR REPLACE FUNCTION public.get_cafe_courier_dispatch_board(p_actor bigint) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE online_now boolean;gps_at timestamptz;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.cafe_staff s WHERE s.telegram_id=p_actor AND public.cafe_active_courier(p_actor,s.location_id)) THEN RETURN jsonb_build_object('ok',true,'online',false,'eligible',false,'available','[]'::jsonb,'offers','[]'::jsonb); END IF;
 PERFORM public.advance_cafe_courier_queue();
 SELECT online INTO online_now FROM public.cafe_courier_presence WHERE courier_telegram_id=p_actor;
 SELECT updated_at INTO gps_at FROM public.cafe_courier_positions WHERE courier_telegram_id=p_actor;
 RETURN jsonb_build_object('ok',true,'online',coalesce(online_now,false),'eligible',true,'gpsFresh',coalesce(gps_at>=clock_timestamp()-interval '90 seconds',false),
 'busy',public.courier_dispatch_busy(p_actor),'offers',public.list_cafe_courier_offers(p_actor),'available',public.list_cafe_available_deliveries(p_actor),
 'activeCount',(SELECT count(*) FROM public.cafe_orders WHERE courier_telegram_id=p_actor AND order_type='delivery' AND status NOT IN ('completed','cancelled') AND NOT(delivery_status='delivered' AND payment_status='paid')),
 'completedToday',(SELECT count(*) FROM public.cafe_orders WHERE courier_telegram_id=p_actor AND order_type='delivery' AND delivery_status='delivered' AND payment_status='paid' AND updated_at >= date_trunc('day',now() AT TIME ZONE 'Asia/Ho_Chi_Minh') AT TIME ZONE 'Asia/Ho_Chi_Minh'));
END $$;
CREATE OR REPLACE FUNCTION public.claim_cafe_available_delivery(p_order uuid,p_actor bigint) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE o public.cafe_orders%rowtype;
BEGIN
 PERFORM 1 FROM public.cafe_courier_presence WHERE courier_telegram_id=p_actor FOR UPDATE;
 SELECT * INTO o FROM public.cafe_orders WHERE id=p_order FOR UPDATE;
 IF NOT FOUND OR NOT public.cafe_active_courier(p_actor,o.location_id) THEN RAISE EXCEPTION 'Courier access denied'; END IF;
 IF o.courier_telegram_id=p_actor AND o.delivery_status='courier_assigned' THEN RETURN jsonb_build_object('ok',true,'replayed',true,'order',to_jsonb(o)); END IF;
 IF NOT public.courier_dispatch_online(p_actor) OR public.courier_dispatch_busy(p_actor) THEN RAISE EXCEPTION 'Go online and finish your current delivery first'; END IF;
 IF o.order_type<>'delivery' OR o.delivery_status<>'waiting_courier' OR o.status IN ('completed','cancelled') OR o.dispatch_mode='manual' THEN RAISE EXCEPTION 'Delivery is no longer available'; END IF;
 IF EXISTS(SELECT 1 FROM public.cafe_courier_offers f WHERE f.order_id=o.id AND f.status='offered' AND f.offer_scope='exclusive' AND f.expires_at>clock_timestamp() AND f.courier_telegram_id<>p_actor AND public.courier_dispatch_online(f.courier_telegram_id) AND NOT public.courier_dispatch_busy(f.courier_telegram_id)) THEN RAISE EXCEPTION 'Delivery is currently offered to another courier'; END IF;
 INSERT INTO public.cafe_courier_offers(order_id,courier_telegram_id,expires_at,offer_scope) VALUES(o.id,p_actor,clock_timestamp()+interval '15 minutes','pool')
 ON CONFLICT(order_id,courier_telegram_id) DO UPDATE SET status='offered',reason=NULL,expires_at=excluded.expires_at,offer_scope='pool';
 RETURN public.respond_cafe_courier_offer(o.id,p_actor,true);
END $$;

DO $$ DECLARE f record;BEGIN
 FOR f IN SELECT p.oid::regprocedure signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN ('courier_dispatch_online','courier_dispatch_busy','set_courier_dispatch_presence','ensure_cafe_courier_offers','courier_offer_payload','list_cafe_courier_offers','list_cafe_available_deliveries','advance_cafe_courier_queue','get_cafe_courier_dispatch_board','claim_cafe_available_delivery','respond_cafe_courier_offer','update_cafe_courier_position') LOOP
 EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated',f.signature);EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role',f.signature);
 END LOOP;
END $$;
COMMIT;

