-- Keep the deployed transition, stock and notification logic while extending counter fulfillment.
DO $migration$
DECLARE
  source text := pg_get_functiondef('public.update_cafe_order_status(uuid,bigint,text,text)'::regprocedure);
  permission_anchor constant text := '  IF NOT v_allowed THEN RAISE EXCEPTION ''Staff role cannot perform this order status transition''; END IF;';
  owner_anchor constant text := '    UPDATE public.cafe_orders SET status=p_new_status,updated_at=now(),';
BEGIN
  IF array_length(string_to_array(source, permission_anchor), 1) <> 2
    OR array_length(string_to_array(source, owner_anchor), 1) <> 2
    OR strpos(source, 'The enclosing transaction holds the order row lock') > 0 THEN
    RAISE EXCEPTION 'Unexpected cafe order transition definition';
  END IF;
  source := replace(source, permission_anchor, $patch$
  IF p_new_status='completed' AND v_staff_role='kitchen' AND (
    v_order.source_module='cafe' AND (
      v_green_delivery OR NOT EXISTS (
        SELECT 1 FROM public.cafe_staff
        WHERE telegram_id=p_actor_telegram_id AND location_id=v_order.location_id
          AND is_active AND staff_role='kitchen' AND can_accept_payments
      )
    )
  ) THEN
    RAISE EXCEPTION 'Staff role cannot perform this order status transition';
  END IF;

  IF v_order.source_module='cafe' AND p_new_status='ready'
    AND v_order.customer_telegram_id IS NULL
    AND v_order.accepted_by_telegram_id IS DISTINCT FROM p_actor_telegram_id
    AND v_order.accepted_by_telegram_id IS NOT NULL THEN
    RAISE EXCEPTION 'Order already accepted by another employee';
  END IF;

  -- The enclosing transaction holds the order row lock through every transition.
  IF p_new_status='completed' AND v_order.source_module='cafe'
    AND v_order.order_type IN ('pickup','dine_in')
    AND v_order.payment_status='paid' AND v_order.preorder_waiting IS NOT TRUE
    AND v_previous_status IN ('pending','confirmed','preparing')
    AND (v_staff_role IN ('manager','cashier','waiter') OR (
      v_staff_role='kitchen' AND EXISTS (
        SELECT 1 FROM public.cafe_staff
        WHERE telegram_id=p_actor_telegram_id AND location_id=v_order.location_id
          AND is_active AND staff_role='kitchen' AND can_accept_payments
      )
    )) THEN
    IF v_previous_status IN ('pending','confirmed') THEN
      PERFORM public.update_cafe_order_status(p_order_id,p_actor_telegram_id,'preparing',NULL);
    END IF;
    PERFORM public.update_cafe_order_status(p_order_id,p_actor_telegram_id,'ready',NULL);
    RETURN public.update_cafe_order_status(p_order_id,p_actor_telegram_id,'completed',p_note);
  END IF;

  IF NOT v_allowed THEN RAISE EXCEPTION 'Staff role cannot perform this order status transition'; END IF;
$patch$);
  source := replace(source, owner_anchor, $patch$
    UPDATE public.cafe_orders SET status=p_new_status,updated_at=now(),
      accepted_by_telegram_id=CASE WHEN p_new_status='preparing' AND v_order.source_module='cafe' THEN p_actor_telegram_id ELSE accepted_by_telegram_id END,
      accepted_at=CASE WHEN p_new_status='preparing' AND v_order.source_module='cafe' THEN now() ELSE accepted_at END,
$patch$);
  EXECUTE source;
END;
$migration$;

-- Web orders enter the paid queue. Only the employee who starts preparation takes ownership.
DO $migration$
DECLARE
  guard text := pg_get_functiondef('public.cafe_self_service_guard()'::regprocedure);
  history text := pg_get_functiondef('public.cafe_self_service_payment_event()'::regprocedure);
  guard_anchor constant text := '  NEW.status:=''preparing'';';
  history_anchor constant text := 'NEW.status=''preparing''';
  event_anchor constant text := '''pending'',''preparing'',';
BEGIN
  IF array_length(string_to_array(guard, guard_anchor),1) <> 2
     OR array_length(string_to_array(history, history_anchor),1) <> 2
     OR array_length(string_to_array(history, event_anchor),1) <> 2 THEN
    RAISE EXCEPTION 'Unexpected cafe payment trigger definitions';
  END IF;
  EXECUTE replace(guard, guard_anchor, $patch$
  IF NEW.customer_telegram_id IS NULL THEN
   NEW.status:='confirmed';
   NEW.accepted_by_telegram_id:=NULL;
   NEW.accepted_at:=NULL;
   NEW.confirmed_at:=coalesce(NEW.confirmed_at,now());
   RETURN NEW;
  END IF;
  NEW.status:='preparing';
$patch$);
  history := replace(history, history_anchor, 'NEW.status IN (''confirmed'',''preparing'')');
  EXECUTE replace(history, event_anchor, '''pending'',NEW.status,');
END;
$migration$;

REVOKE EXECUTE ON FUNCTION public.update_cafe_order_status(uuid,bigint,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_cafe_order_status(uuid,bigint,text,text) TO service_role;
