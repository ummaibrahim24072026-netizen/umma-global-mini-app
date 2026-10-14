-- Additional courier capability keeps the owner's existing staff/global roles.
BEGIN;
ALTER TABLE public.cafe_staff ADD COLUMN IF NOT EXISTS courier_available boolean NOT NULL DEFAULT false;
CREATE OR REPLACE FUNCTION public.cafe_active_courier(p_actor bigint,p_location uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public,pg_temp AS $$
 SELECT EXISTS(SELECT 1 FROM public.cafe_staff s JOIN public.telegram_users u USING(telegram_id)
 WHERE s.telegram_id=p_actor AND s.location_id=p_location AND s.is_active AND u.is_active
 AND ((s.staff_role='courier' AND u.role IN ('employee','admin')) OR (u.role='super_admin' AND s.courier_available)));
$$;
CREATE OR REPLACE FUNCTION public.set_cafe_self_courier(p_actor bigint,p_location uuid,p_enabled boolean) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE result public.cafe_staff%rowtype; waiting_order uuid;
BEGIN
 IF p_enabled IS NULL OR NOT EXISTS(SELECT 1 FROM public.telegram_users WHERE telegram_id=p_actor AND role='super_admin' AND is_active) THEN RAISE EXCEPTION 'Self courier access denied'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.locations WHERE id=p_location AND location_type='cafe' AND is_active) THEN RAISE EXCEPTION 'Cafe location not found'; END IF;
 IF NOT p_enabled AND EXISTS(SELECT 1 FROM public.cafe_orders WHERE location_id=p_location AND courier_telegram_id=p_actor AND order_type='delivery' AND delivery_status IN ('courier_assigned','picked_up') AND status NOT IN ('completed','cancelled')) THEN RAISE EXCEPTION 'Complete your active deliveries before going offline'; END IF;
 INSERT INTO public.cafe_staff(telegram_id,location_id,staff_role,is_active,can_accept_payments,courier_available)
 VALUES(p_actor,p_location,'courier',true,false,p_enabled)
 ON CONFLICT(telegram_id,location_id) DO UPDATE SET courier_available=excluded.courier_available,is_active=CASE WHEN excluded.courier_available THEN true ELSE cafe_staff.is_active END
 RETURNING * INTO result;
 IF p_enabled THEN
  FOR waiting_order IN SELECT id FROM public.cafe_orders WHERE location_id=p_location AND order_type='delivery' AND delivery_status='waiting_courier' AND status NOT IN ('completed','cancelled') ORDER BY id LOOP
   PERFORM public.ensure_cafe_courier_offers(waiting_order);
  END LOOP;
 END IF;
 RETURN jsonb_build_object('ok',true,'assignment',to_jsonb(result));
END $$;
REVOKE ALL ON FUNCTION public.set_cafe_self_courier(bigint,uuid,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.set_cafe_self_courier(bigint,uuid,boolean) TO service_role;
COMMIT;
