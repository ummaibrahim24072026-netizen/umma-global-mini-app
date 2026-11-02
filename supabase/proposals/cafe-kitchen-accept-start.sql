-- Accept and start cooking in one transaction, preserving the existing lifecycle.
CREATE OR REPLACE FUNCTION public.update_cafe_order_status(p_order_id uuid, p_actor_telegram_id bigint, p_new_status text, p_note text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_order public.cafe_orders%ROWTYPE;
  v_user public.telegram_users%ROWTYPE;
  v_staff_role text;
  v_previous_status text;
  v_allowed boolean:=false;
  v_item record;
  v_balance public.stock_balances%ROWTYPE;
BEGIN
  IF p_order_id IS NULL OR p_actor_telegram_id IS NULL THEN RAISE EXCEPTION 'Invalid order update request'; END IF;
  IF p_new_status NOT IN ('confirmed','preparing','ready','completed','cancelled') THEN RAISE EXCEPTION 'Invalid order status'; END IF;

  SELECT * INTO v_user FROM public.telegram_users WHERE telegram_id=p_actor_telegram_id AND is_active=true;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order management access denied'; END IF;
  SELECT * INTO v_order FROM public.cafe_orders WHERE id=p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
  v_previous_status:=v_order.status;
  IF p_new_status=v_previous_status THEN RAISE EXCEPTION 'Order already has this status'; END IF;
  IF p_new_status='completed' AND v_order.payment_status<>'paid' THEN RAISE EXCEPTION 'Order cannot be completed before payment is confirmed'; END IF;
  IF p_new_status='completed' AND v_order.order_type='delivery' AND coalesce(v_order.delivery_status,'waiting_courier')<>'delivered' THEN RAISE EXCEPTION 'Delivery must be confirmed before completing the order'; END IF;

  IF v_user.role='super_admin' THEN
    v_staff_role:='manager';
  ELSE
    IF v_user.role NOT IN ('admin','employee') THEN RAISE EXCEPTION 'Order management access denied'; END IF;
    SELECT staff_role INTO v_staff_role FROM public.cafe_staff
    WHERE telegram_id=p_actor_telegram_id AND location_id=v_order.location_id AND is_active=true;
    IF NOT FOUND THEN RAISE EXCEPTION 'No active staff assignment for this cafe'; END IF;
  END IF;

  -- All assigned non-courier cafe staff share the same fulfillment permissions.
  IF v_staff_role IN ('manager','cashier','waiter','kitchen') THEN
    v_allowed:=CASE
      WHEN v_previous_status='pending' AND p_new_status IN ('confirmed','preparing','cancelled') THEN true
      WHEN v_previous_status='confirmed' AND p_new_status IN ('preparing','cancelled') THEN true
      WHEN v_previous_status='preparing' AND p_new_status IN ('ready','cancelled') THEN true
      WHEN v_previous_status='ready' AND p_new_status IN ('completed','cancelled') THEN true
      ELSE false
    END;
  END IF;
  IF v_staff_role='courier' AND v_previous_status='ready' AND p_new_status='completed'
    AND v_order.order_type='delivery' AND v_order.courier_telegram_id=p_actor_telegram_id
    AND v_order.delivery_status='delivered' AND v_order.payment_status='paid'
    AND (SELECT count(DISTINCT kind) FROM public.cafe_delivery_proofs WHERE order_id=v_order.id AND courier_telegram_id=p_actor_telegram_id AND verified_at IS NOT NULL AND kind IN ('pickup','handover'))=2 THEN
    v_allowed:=true;
  END IF;
  IF NOT v_allowed THEN RAISE EXCEPTION 'Staff role cannot perform this order status transition'; END IF;

  IF p_new_status='cancelled' AND v_order.payment_status='paid' THEN
    RAISE EXCEPTION 'Paid order requires recorded refund before cancellation';
  END IF;

  IF p_new_status='confirmed' OR (v_previous_status='pending' AND p_new_status='preparing') THEN
    IF v_order.status<>'pending' OR v_order.accepted_by_telegram_id IS NOT NULL THEN RAISE EXCEPTION 'Order already accepted by another employee'; END IF;
    UPDATE public.cafe_orders SET status=p_new_status,accepted_by_telegram_id=p_actor_telegram_id,accepted_at=now(),confirmed_at=now(),updated_at=now()
    WHERE id=p_order_id RETURNING * INTO v_order;
  ELSE
    UPDATE public.cafe_orders SET status=p_new_status,updated_at=now(),
      completed_at=CASE WHEN p_new_status='completed' THEN now() ELSE completed_at END,
      cancelled_at=CASE WHEN p_new_status='cancelled' THEN now() ELSE cancelled_at END
    WHERE id=p_order_id RETURNING * INTO v_order;
  END IF;

  IF p_new_status='cancelled' THEN
    IF coalesce((SELECT inventory_control_enabled FROM public.umma_runtime_settings WHERE id=true),false) THEN
    FOR v_item IN
      SELECT product_id,quantity,accounting_stock_item_id
      FROM public.cafe_order_items WHERE order_id=v_order.id AND product_id IS NOT NULL
    LOOP
      UPDATE public.inventory SET reserved_quantity=greatest(0,reserved_quantity-v_item.quantity),updated_at=now()
      WHERE product_id=v_item.product_id AND location_id=v_order.location_id;
      IF v_item.accounting_stock_item_id IS NOT NULL THEN
        UPDATE public.stock_balances SET quantity_reserved=greatest(0,quantity_reserved-v_item.quantity),updated_at=now()
        WHERE stock_item_id=v_item.accounting_stock_item_id AND location_id=v_order.location_id;
      END IF;
      INSERT INTO public.cafe_inventory_movements(location_id,product_id,order_id,actor_telegram_id,movement_type,quantity,note)
      VALUES(v_order.location_id,v_item.product_id,v_order.id,p_actor_telegram_id,'released',v_item.quantity,'Order cancelled; stock released');
    END LOOP;
    END IF;
  ELSIF p_new_status='completed' THEN
    IF coalesce((SELECT inventory_control_enabled FROM public.umma_runtime_settings WHERE id=true),false) THEN
    FOR v_item IN
      SELECT id,product_id,quantity,accounting_stock_item_id
      FROM public.cafe_order_items WHERE order_id=v_order.id AND product_id IS NOT NULL
      ORDER BY accounting_stock_item_id NULLS LAST, id
    LOOP
      UPDATE public.inventory SET quantity=greatest(0,quantity-v_item.quantity),
        reserved_quantity=greatest(0,reserved_quantity-v_item.quantity),updated_at=now()
      WHERE product_id=v_item.product_id AND location_id=v_order.location_id;

      IF v_item.accounting_stock_item_id IS NOT NULL THEN
        SELECT * INTO v_balance FROM public.stock_balances
        WHERE location_id=v_order.location_id AND stock_item_id=v_item.accounting_stock_item_id FOR UPDATE;
        IF NOT FOUND OR v_balance.quantity_on_hand < v_item.quantity OR v_balance.quantity_reserved < v_item.quantity THEN
          RAISE EXCEPTION 'Accounting stock or reservation mismatch for product %', v_item.product_id;
        END IF;
        UPDATE public.stock_balances
        SET quantity_on_hand=quantity_on_hand-v_item.quantity,
            quantity_reserved=quantity_reserved-v_item.quantity,updated_at=now()
        WHERE id=v_balance.id;

        INSERT INTO public.stock_movements(location_id,stock_item_id,movement_type,quantity_delta,unit_cost_vnd,source_type,source_id,actor_telegram_id,note)
        VALUES(v_order.location_id,v_item.accounting_stock_item_id,'sale_out',-v_item.quantity,
          v_balance.average_unit_cost_vnd,'order',v_order.id,p_actor_telegram_id,'Completed order; cost of goods sold');
      END IF;

      INSERT INTO public.cafe_inventory_movements(location_id,product_id,order_id,actor_telegram_id,movement_type,quantity,note)
      VALUES(v_order.location_id,v_item.product_id,v_order.id,p_actor_telegram_id,'sold',v_item.quantity,'Order completed; stock deducted');
    END LOOP;
    END IF;
  END IF;

  INSERT INTO public.cafe_order_events(order_id,actor_telegram_id,from_status,to_status,note)
  VALUES(v_order.id,p_actor_telegram_id,v_previous_status,p_new_status,nullif(trim(p_note),''));

  RETURN jsonb_build_object('ok',true,'order',jsonb_build_object(
    'id',v_order.id,'orderNumber',v_order.order_number,'status',v_order.status,
    'acceptedByTelegramId',v_order.accepted_by_telegram_id,'acceptedAt',v_order.accepted_at,'updatedAt',v_order.updated_at));
END;
$function$;
