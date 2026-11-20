ALTER TABLE public.cafe_orders
  ADD COLUMN green_sm_stage text CHECK (green_sm_stage IN ('booked','assigned','arrived','picked_up','delivered')),
  ADD COLUMN green_sm_booking_id text,
  ADD COLUMN green_sm_tracking_url text,
  ADD COLUMN preparation_station text CHECK (preparation_station IN ('kitchen','counter'));

CREATE FUNCTION public.cafe_web_fulfillment(
  p_order uuid, p_actor bigint, p_action text, p_payload jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE
  o public.cafe_orders%ROWTYPE;
  actor_role text;
  target_id bigint;
  target_role text;
  stage text := p_payload->>'stage';
  booking text := nullif(trim(p_payload->>'bookingId'),'');
  tracking text := nullif(trim(p_payload->>'trackingUrl'),'');
  stations constant text[] := ARRAY['kitchen','counter'];
  fulfillment_roles constant text[] := ARRAY['kitchen','manager','cashier','waiter'];
  steps constant text[] := ARRAY['booked','assigned','arrived','picked_up','delivered'];
BEGIN
  SELECT * INTO o FROM public.cafe_orders WHERE id=p_order FOR UPDATE;
  IF NOT FOUND OR o.source_module IS DISTINCT FROM 'cafe' THEN RAISE EXCEPTION 'Заказ недоступен'; END IF;
  SELECT CASE WHEN u.role='super_admin' THEN 'manager' ELSE s.staff_role END INTO actor_role
    FROM public.telegram_users u LEFT JOIN public.cafe_staff s
      ON s.telegram_id=u.telegram_id AND s.location_id=o.location_id AND s.is_active
    WHERE u.telegram_id=p_actor AND u.is_active AND u.role IN ('super_admin','admin','employee');
  IF actor_role IS NULL OR NOT actor_role=ANY(fulfillment_roles) THEN RAISE EXCEPTION 'Нет доступа к заказу'; END IF;

  IF p_action IN ('staff','transfer') THEN
    IF o.status<>'preparing' OR o.payment_status<>'paid' OR o.preorder_waiting
      OR (actor_role<>'manager' AND o.accepted_by_telegram_id IS DISTINCT FROM p_actor) THEN
      RAISE EXCEPTION 'Передать можно только заказ в работе. Обратитесь к ответственному сотруднику или руководителю';
    END IF;
    IF p_action='staff' THEN
      RETURN jsonb_build_object('ok',true,'staff',COALESCE((
        SELECT jsonb_agg(jsonb_build_object('id',s.telegram_id::text,'name',
          coalesce(nullif(concat_ws(' ',u.first_name,u.last_name),''),u.username,s.telegram_id::text),'role',s.staff_role)
          ORDER BY u.first_name,u.last_name,s.telegram_id)
        FROM public.cafe_staff s JOIN public.telegram_users u USING(telegram_id)
        WHERE s.location_id=o.location_id AND s.is_active AND u.is_active
          AND u.role IN ('super_admin','admin','employee') AND s.staff_role=ANY(fulfillment_roles)
          AND s.telegram_id IS DISTINCT FROM o.accepted_by_telegram_id),'[]'::jsonb));
    END IF;
    IF o.accepted_by_telegram_id::text IS DISTINCT FROM p_payload->>'expectedOwner' THEN
      RAISE EXCEPTION 'Ответственный уже изменился. Обновите заказ';
    END IF;
    target_id := (p_payload->>'targetId')::bigint;
    SELECT s.staff_role INTO target_role FROM public.cafe_staff s JOIN public.telegram_users u USING(telegram_id)
      WHERE s.location_id=o.location_id AND s.telegram_id=target_id AND s.is_active AND u.is_active
      AND u.role IN ('super_admin','admin','employee') AND s.staff_role=ANY(fulfillment_roles);
    IF NOT FOUND OR target_id IS NOT DISTINCT FROM o.accepted_by_telegram_id THEN RAISE EXCEPTION 'Сотрудник недоступен'; END IF;
    UPDATE public.cafe_orders SET accepted_by_telegram_id=target_id,accepted_at=now(),updated_at=now(),
      preparation_station=CASE WHEN target_role='kitchen' THEN stations[1] ELSE stations[2] END WHERE id=o.id;
    INSERT INTO public.cafe_order_events(order_id,actor_telegram_id,from_status,to_status,note)
      VALUES(o.id,p_actor,o.status,o.status,format('Передача приготовления: %s → %s',o.accepted_by_telegram_id,target_id));
    RETURN jsonb_build_object('ok',true);
  END IF;

  IF p_action NOT IN ('greenDetails','greenStage') OR (actor_role NOT IN ('manager','cashier','waiter') AND NOT EXISTS (
    SELECT 1 FROM public.cafe_staff WHERE telegram_id=p_actor AND location_id=o.location_id
    AND is_active AND staff_role='kitchen' AND can_accept_payments
  )) THEN
    RAISE EXCEPTION 'Нет доступа к доставке';
  END IF;
  IF (o.order_type='delivery' AND o.dispatch_mode='manual' AND o.created_via='customer'
    AND o.customer_telegram_id IS NULL AND o.requires_prepayment AND o.courier_telegram_id IS NULL) IS NOT TRUE
    OR o.status<>'ready' OR o.payment_status<>'paid' OR o.preorder_waiting THEN
    RAISE EXCEPTION 'Действие доступно для готовой оплаченной доставки Green SM';
  END IF;
  IF p_action='greenDetails' THEN
    IF length(booking)>120 OR length(tracking)>1000 OR (tracking IS NOT NULL AND
      tracking !~ '^https://([a-zA-Z0-9-]+\.)?(greensm\.com|xanhsm\.com)/[a-zA-Z0-9][^[:space:]\\]*$') THEN
      RAISE EXCEPTION 'Вставьте действительную HTTPS-ссылку Green SM';
    END IF;
    UPDATE public.cafe_orders SET green_sm_booking_id=booking,green_sm_tracking_url=tracking,updated_at=now() WHERE id=o.id;
  ELSE
    IF stage IS NULL OR array_position(steps,stage) IS DISTINCT FROM coalesce(array_position(steps,o.green_sm_stage),0)+1 THEN
      RAISE EXCEPTION 'Этап уже изменился или выбран не по порядку';
    END IF;
    UPDATE public.cafe_orders SET green_sm_stage=stage,updated_at=now() WHERE id=o.id;
    INSERT INTO public.cafe_order_events(order_id,actor_telegram_id,from_status,to_status,note)
      VALUES(o.id,p_actor,o.status,o.status,'Green SM: '||stage);
    IF stage='delivered' THEN
      PERFORM public.update_cafe_order_status(o.id,p_actor,'completed','Green SM: доставка подтверждена');
    END IF;
  END IF;
  RETURN jsonb_build_object('ok',true);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.cafe_web_fulfillment(uuid,bigint,text,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cafe_web_fulfillment(uuid,bigint,text,jsonb) TO service_role;

-- Keep the combined role's permission at the counter, after confirmed handover.
DO $$
DECLARE
  src text := pg_get_functiondef('public.update_cafe_order_status(uuid,bigint,text,text)'::regprocedure);
  green_guard constant text := 'v_green_delivery OR NOT EXISTS (';
  owner_guard constant text := 'AND v_order.customer_telegram_id IS NULL' || chr(10) || '    AND v_order.accepted_by_telegram_id IS DISTINCT FROM';
BEGIN
  IF array_length(string_to_array(src,green_guard),1)<>2 OR array_length(string_to_array(src,owner_guard),1)<>2 THEN
    RAISE EXCEPTION 'Unexpected cafe order completion definition';
  END IF;
  src := replace(src,green_guard,'(v_green_delivery AND v_order.green_sm_stage IS DISTINCT FROM ''delivered'') OR NOT EXISTS (');
  EXECUTE replace(src,owner_guard,'AND (v_order.customer_telegram_id IS NULL OR v_order.preparation_station IS NOT NULL)' || chr(10) ||
    '    AND v_order.accepted_by_telegram_id IS DISTINCT FROM');
END;
$$;

CREATE FUNCTION public.cafe_web_fulfillment_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN
  IF NEW.source_module='cafe' AND NEW.order_type='delivery' AND NEW.dispatch_mode='manual'
    AND NEW.created_via='customer' AND NEW.customer_telegram_id IS NULL AND NEW.requires_prepayment
    AND NEW.courier_telegram_id IS NULL AND NEW.status='completed' AND OLD.status<>'completed'
    AND NEW.green_sm_stage IS DISTINCT FROM 'delivered' THEN
    RAISE EXCEPTION 'Сначала подтвердите этапы доставки Green SM';
  END IF;
  IF NEW.source_module='cafe' AND NEW.customer_telegram_id IS NULL AND NEW.status='preparing' AND OLD.status<>'preparing'
     AND NEW.accepted_by_telegram_id IS NOT NULL THEN
    NEW.preparation_station := CASE WHEN EXISTS (SELECT 1 FROM public.cafe_staff
      WHERE telegram_id=NEW.accepted_by_telegram_id AND location_id=NEW.location_id AND is_active AND staff_role='kitchen')
      THEN 'kitchen' ELSE 'counter' END;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER zz_cafe_web_fulfillment_guard BEFORE UPDATE OF status ON public.cafe_orders
  FOR EACH ROW EXECUTE FUNCTION public.cafe_web_fulfillment_guard();

-- The channel carries only a generic invalidation. The client still reads orders via its authenticated endpoint.
CREATE FUNCTION public.cafe_web_fulfillment_signal()
RETURNS trigger LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN
  IF NEW.source_module='cafe' AND (TG_OP='INSERT' OR
    ROW(NEW.status,NEW.payment_status,NEW.accepted_by_telegram_id,NEW.delivery_status,NEW.green_sm_stage,NEW.green_sm_tracking_url)
    IS DISTINCT FROM ROW(OLD.status,OLD.payment_status,OLD.accepted_by_telegram_id,OLD.delivery_status,OLD.green_sm_stage,OLD.green_sm_tracking_url)) THEN
    PERFORM realtime.send('{}'::jsonb,'order-change','umma-fulfillment',false);
  END IF;
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$;
CREATE TRIGGER cafe_web_fulfillment_signal AFTER INSERT OR UPDATE OF status,payment_status,
  accepted_by_telegram_id,delivery_status,green_sm_stage,green_sm_tracking_url ON public.cafe_orders
  FOR EACH ROW EXECUTE FUNCTION public.cafe_web_fulfillment_signal();
