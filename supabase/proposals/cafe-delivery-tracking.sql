-- Per-delivery live position. No public courier directory or position history.
BEGIN;
CREATE TABLE public.cafe_delivery_tracking(order_id uuid PRIMARY KEY REFERENCES public.cafe_orders(id),courier_telegram_id bigint NOT NULL REFERENCES public.telegram_users(telegram_id),session_id uuid NOT NULL DEFAULT gen_random_uuid(),enabled boolean NOT NULL DEFAULT false,latitude double precision,longitude double precision,accuracy_m double precision,position_at timestamptz,sequence bigint NOT NULL DEFAULT 0,CHECK(latitude BETWEEN -90 AND 90),CHECK(longitude BETWEEN -180 AND 180),CHECK(accuracy_m BETWEEN 0 AND 500));
ALTER TABLE public.cafe_delivery_tracking ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.cafe_delivery_tracking FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.set_cafe_delivery_tracking(p_order uuid,p_actor bigint,p_enabled boolean) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE o public.cafe_orders%rowtype;t public.cafe_delivery_tracking%rowtype;
BEGIN
 SELECT * INTO o FROM public.cafe_orders WHERE id=p_order FOR UPDATE;
 IF NOT FOUND OR o.courier_telegram_id IS DISTINCT FROM p_actor OR NOT public.cafe_active_courier(p_actor,o.location_id) THEN RAISE EXCEPTION 'Tracking courier access denied'; END IF;
 IF p_enabled IS NULL OR (p_enabled AND (o.order_type<>'delivery' OR o.delivery_status<>'picked_up' OR o.status IN ('completed','cancelled'))) THEN RAISE EXCEPTION 'Tracking only during delivery'; END IF;
 INSERT INTO public.cafe_delivery_tracking(order_id,courier_telegram_id,enabled) VALUES(o.id,p_actor,p_enabled) ON CONFLICT(order_id) DO UPDATE SET courier_telegram_id=p_actor,enabled=p_enabled,session_id=gen_random_uuid(),latitude=NULL,longitude=NULL,accuracy_m=NULL,position_at=NULL,sequence=0 RETURNING * INTO t;
 RETURN jsonb_build_object('ok',true,'sessionId',t.session_id,'enabled',t.enabled);
END $$;
CREATE FUNCTION public.update_cafe_delivery_tracking(p_order uuid,p_actor bigint,p_session uuid,p_sequence bigint,p_lat double precision,p_lng double precision,p_accuracy double precision) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE o public.cafe_orders%rowtype;t public.cafe_delivery_tracking%rowtype;
BEGIN
 SELECT * INTO o FROM public.cafe_orders WHERE id=p_order FOR UPDATE;
 IF NOT FOUND OR o.courier_telegram_id IS DISTINCT FROM p_actor OR NOT public.cafe_active_courier(p_actor,o.location_id) THEN RAISE EXCEPTION 'Tracking courier access denied'; END IF;
 IF o.order_type<>'delivery' OR o.delivery_status<>'picked_up' OR o.status IN ('completed','cancelled') THEN RAISE EXCEPTION 'Tracking only during delivery'; END IF;
 IF p_lat IS NULL OR p_lng IS NULL OR p_accuracy IS NULL OR NOT(p_lat BETWEEN -90 AND 90 AND p_lng BETWEEN -180 AND 180 AND p_accuracy BETWEEN 0 AND 500) OR p_sequence IS NULL OR p_sequence<=0 THEN RAISE EXCEPTION 'Invalid tracking position'; END IF;
 SELECT * INTO t FROM public.cafe_delivery_tracking WHERE order_id=p_order FOR UPDATE;
 IF NOT FOUND OR NOT t.enabled OR t.session_id IS DISTINCT FROM p_session THEN RAISE EXCEPTION 'Tracking session stopped'; END IF;
 IF p_sequence<=t.sequence THEN RETURN jsonb_build_object('ok',true,'ignored',true); END IF;
 UPDATE public.cafe_delivery_tracking SET latitude=p_lat,longitude=p_lng,accuracy_m=p_accuracy,position_at=clock_timestamp(),sequence=p_sequence WHERE order_id=p_order;
 RETURN jsonb_build_object('ok',true);
END $$;
CREATE FUNCTION public.get_cafe_delivery_tracking(p_order uuid,p_actor bigint) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE o public.cafe_orders%rowtype;t public.cafe_delivery_tracking%rowtype;
BEGIN
 SELECT * INTO o FROM public.cafe_orders WHERE id=p_order;
 IF NOT FOUND OR o.customer_telegram_id IS DISTINCT FROM p_actor OR NOT EXISTS(SELECT 1 FROM public.telegram_users WHERE telegram_id=p_actor AND is_active) THEN RAISE EXCEPTION 'Tracking customer access denied'; END IF;
 IF o.order_type<>'delivery' THEN RETURN jsonb_build_object('ok',true,'state','unavailable'); END IF;
 IF o.delivery_status='delivered' THEN RETURN jsonb_build_object('ok',true,'state','delivered'); END IF;
 IF o.status IN ('cancelled','completed') THEN RETURN jsonb_build_object('ok',true,'state','unavailable'); END IF;
 IF o.delivery_status<>'picked_up' THEN RETURN jsonb_build_object('ok',true,'state','awaiting_pickup'); END IF;
 IF NOT public.cafe_active_courier(o.courier_telegram_id,o.location_id) THEN RETURN jsonb_build_object('ok',true,'state','unavailable'); END IF;
 SELECT * INTO t FROM public.cafe_delivery_tracking WHERE order_id=p_order AND courier_telegram_id=o.courier_telegram_id;
 IF NOT FOUND OR NOT t.enabled THEN RETURN jsonb_build_object('ok',true,'state','not_sharing'); END IF;
 IF t.position_at IS NULL OR t.position_at<clock_timestamp()-interval '60 seconds' THEN RETURN jsonb_build_object('ok',true,'state','stale','updatedAt',t.position_at); END IF;
 RETURN jsonb_build_object('ok',true,'state','live','latitude',t.latitude,'longitude',t.longitude,'accuracy',t.accuracy_m,'updatedAt',t.position_at);
END $$;
REVOKE ALL ON FUNCTION public.set_cafe_delivery_tracking(uuid,bigint,boolean),public.update_cafe_delivery_tracking(uuid,bigint,uuid,bigint,double precision,double precision,double precision),public.get_cafe_delivery_tracking(uuid,bigint) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.set_cafe_delivery_tracking(uuid,bigint,boolean),public.update_cafe_delivery_tracking(uuid,bigint,uuid,bigint,double precision,double precision,double precision),public.get_cafe_delivery_tracking(uuid,bigint) TO service_role;
COMMIT;
