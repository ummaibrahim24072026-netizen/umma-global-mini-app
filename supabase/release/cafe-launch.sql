-- Reviewable release proposal. NOT deployed. One atomic transaction.
BEGIN;

-- cafe-lifecycle-hardening.sql
-- Proposed fixes, NOT applied to the remote project.
-- Apply in a staging database first; production requires explicit owner approval.

CREATE OR REPLACE FUNCTION public.update_cafe_order_payment(p_order_id uuid, p_actor_telegram_id bigint, p_payment_status text, p_note text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_order public.cafe_orders%rowtype;
  v_user public.telegram_users%rowtype;
  v_staff_role text;
  v_can_accept_payments boolean := false;
  v_previous text;
begin
  if p_order_id is null or p_actor_telegram_id is null then
    raise exception 'Invalid payment update request';
  end if;
  if p_payment_status not in ('paid','pending') then
    raise exception 'Invalid payment status';
  end if;

  select * into v_user from public.telegram_users
  where telegram_id = p_actor_telegram_id and is_active = true;
  if not found then raise exception 'Payment management access denied'; end if;

  select * into v_order from public.cafe_orders where id = p_order_id for update;
  if not found then raise exception 'Order not found'; end if;

  if v_user.role = 'super_admin' then
    v_staff_role := 'manager';
    v_can_accept_payments := true;
  else
    if v_user.role not in ('admin','employee') then
      raise exception 'Payment management access denied';
    end if;
    select staff_role, can_accept_payments into v_staff_role, v_can_accept_payments
    from public.cafe_staff
    where telegram_id = p_actor_telegram_id and location_id = v_order.location_id and is_active = true;
    if not found then raise exception 'No active staff assignment for this cafe'; end if;
    if coalesce(v_can_accept_payments, false) is not true then
      raise exception 'Payment acceptance permission denied';
    end if;
  end if;

  if v_staff_role not in ('manager','cashier','waiter','kitchen','courier') then
    raise exception 'Staff role cannot update payment';
  end if;

  if v_staff_role='courier' and (v_order.order_type<>'delivery' or v_order.courier_telegram_id is distinct from p_actor_telegram_id or v_order.delivery_status not in ('picked_up','delivered')) then
    raise exception 'Courier can accept payment only for own collected delivery';
  end if;
  if v_order.status in ('completed','cancelled') then
    raise exception 'Closed order cannot receive payment changes';
  end if;
  v_previous := v_order.payment_status;
  if p_payment_status = v_previous then
    return jsonb_build_object('ok',true,'order',jsonb_build_object(
      'id',v_order.id,'orderNumber',v_order.order_number,
      'paymentStatus',v_order.payment_status,'paidAt',v_order.paid_at,
      'paidByTelegramId',v_order.paid_by_telegram_id));
  end if;
  if p_payment_status = 'pending' and v_previous = 'paid' then
    raise exception 'Use recorded refund instead of voiding payment';
  end if;


  if p_payment_status = 'paid' and v_previous <> 'paid' then
    insert into public.cafe_payment_receipts
      (order_id, location_id, collected_by_telegram_id, payment_method, amount_vnd, receipt_status, note)
    values
      (v_order.id, v_order.location_id, p_actor_telegram_id, v_order.payment_method,
       v_order.total_vnd, 'confirmed', coalesce(nullif(trim(p_note),''),'Оплата заказа подтверждена'));

  end if;

  update public.cafe_orders
  set payment_status = p_payment_status,
      paid_at = case when p_payment_status = 'paid' then coalesce(paid_at,now()) else null end,
      paid_by_telegram_id = case when p_payment_status = 'paid' then p_actor_telegram_id else null end,
      updated_at = now()
  where id = p_order_id returning * into v_order;

  -- cafe_order_events stores order lifecycle statuses, not payment statuses.
  insert into public.cafe_order_events(order_id,actor_telegram_id,from_status,to_status,note)
  values (
    v_order.id, p_actor_telegram_id, v_order.status, v_order.status,
    concat_ws(' · ',
      coalesce(nullif(trim(p_note),''), 'Payment updated'),
      'Payment: ' || coalesce(v_previous,'unknown') || ' → ' || p_payment_status)
  );

  return jsonb_build_object(
    'ok',true,
    'order',jsonb_build_object(
      'id',v_order.id,'orderNumber',v_order.order_number,
      'paymentStatus',v_order.payment_status,'paidAt',v_order.paid_at,
      'paidByTelegramId',v_order.paid_by_telegram_id
    )
  );
end;
$function$;
CREATE OR REPLACE FUNCTION public.update_cafe_order_payment_cash(p_order_id uuid, p_actor_telegram_id bigint, p_payment_status text, p_note text DEFAULT NULL::text, p_tendered_amount_vnd integer DEFAULT NULL::integer, p_change_given_vnd integer DEFAULT NULL::integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_order public.cafe_orders%rowtype;
  v_result jsonb;
begin
  select * into v_order from public.cafe_orders where id = p_order_id for update;
  if not found then raise exception 'Order not found'; end if;

  if p_payment_status = 'paid' and v_order.payment_status = 'paid' then
    -- Authorize the retry and preserve the original collector/receipt.
    return public.update_cafe_order_payment(p_order_id, p_actor_telegram_id, p_payment_status, p_note);
  end if;

  if p_payment_status = 'paid' and v_order.payment_method = 'cash' then
    if p_tendered_amount_vnd is null or p_change_given_vnd is null
       or p_tendered_amount_vnd < v_order.total_vnd
       or p_change_given_vnd <> p_tendered_amount_vnd - v_order.total_vnd then
      raise exception 'Invalid cash received amount or change';
    end if;
  end if;

  v_result := public.update_cafe_order_payment(p_order_id, p_actor_telegram_id, p_payment_status, p_note);

  if p_payment_status = 'paid' and v_order.payment_method = 'cash' then
    update public.cafe_payment_receipts
       set tendered_amount_vnd = p_tendered_amount_vnd,
           change_given_vnd = p_change_given_vnd
     where id = (
       select id from public.cafe_payment_receipts
        where order_id = p_order_id
          and collected_by_telegram_id = p_actor_telegram_id
          and receipt_status = 'confirmed'
        order by collected_at desc, created_at desc
        limit 1
     );
    if not found then raise exception 'Cash receipt was not recorded'; end if;
  end if;
  return v_result;
end;
$function$;
CREATE OR REPLACE FUNCTION public.add_cafe_staff_order_items(p_staff_telegram_id bigint, p_order_id uuid, p_items jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_order public.cafe_orders%rowtype;
  v_user public.telegram_users%rowtype;
  v_staff_role text;
  v_item jsonb;
  v_product public.products%rowtype;
  v_quantity integer;
  v_added integer := 0;
  v_previous_status text;
begin
  if p_staff_telegram_id is null or p_staff_telegram_id <= 0 then raise exception 'Invalid staff'; end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 50 then raise exception 'Invalid order items'; end if;
  select * into v_user from public.telegram_users where telegram_id=p_staff_telegram_id and is_active=true;
  if not found or v_user.role not in ('super_admin','admin','employee') then raise exception 'Staff access denied'; end if;
  select * into v_order from public.cafe_orders where id=p_order_id for update;
  if not found then raise exception 'Order not found'; end if;
  if v_order.order_type <> 'dine_in' then raise exception 'Only dine-in bills can receive additional items'; end if;
  if v_order.payment_status = 'paid' or v_order.status in ('completed','cancelled') then raise exception 'Bill is already closed'; end if;
  if v_user.role <> 'super_admin' then
    select staff_role into v_staff_role from public.cafe_staff where telegram_id=p_staff_telegram_id and location_id=v_order.location_id and is_active=true;
    if not found or v_staff_role not in ('manager','waiter','cashier','kitchen') then raise exception 'Staff cannot add items to this bill'; end if;
  end if;
  v_previous_status := v_order.status;
  for v_item in select value from jsonb_array_elements(p_items) loop
    if jsonb_typeof(v_item)<>'object' or not(v_item?'productId') or not(v_item?'quantity') then raise exception 'Invalid item'; end if;
    v_quantity := (v_item->>'quantity')::integer;
    if v_quantity < 1 or v_quantity > 99 then raise exception 'Invalid item quantity'; end if;
    select * into v_product from public.products where id=(v_item->>'productId')::uuid and product_type='cafe' and is_active=true;
    if not found then raise exception 'Product not found or unavailable'; end if;
    insert into public.cafe_order_items(order_id,product_id,product_name_ru,product_name_vi,product_name_en,quantity,unit_price_vnd)
    values(v_order.id,v_product.id,v_product.name_ru,v_product.name_vi,v_product.name_en,v_quantity,v_product.price_vnd);
    v_added := v_added + 1;
  end loop;
  update public.cafe_orders
    set subtotal_vnd=(select coalesce(sum(line_total_vnd),0) from public.cafe_order_items where order_id=v_order.id),
        total_vnd=(select coalesce(sum(line_total_vnd),0) from public.cafe_order_items where order_id=v_order.id),
        status=case when status='ready' then 'preparing' else status end,
        updated_at=now()
    where id=v_order.id returning * into v_order;
  insert into public.cafe_order_events(order_id,actor_telegram_id,from_status,to_status,note)
  values(v_order.id,p_staff_telegram_id,v_previous_status,v_order.status,'Добавлено позиций в открытый счёт: '||v_added);
  return jsonb_build_object('ok',true,'orderId',v_order.id,'orderNumber',v_order.order_number,'addedItems',v_added,'totalVnd',v_order.total_vnd,'paymentStatus',v_order.payment_status);
end;
$function$;
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
      WHEN v_previous_status='pending' AND p_new_status IN ('confirmed','cancelled') THEN true
      WHEN v_previous_status='confirmed' AND p_new_status IN ('preparing','cancelled') THEN true
      WHEN v_previous_status='preparing' AND p_new_status IN ('ready','cancelled') THEN true
      WHEN v_previous_status='ready' AND p_new_status IN ('completed','cancelled') THEN true
      ELSE false
    END;
  END IF;
  IF NOT v_allowed THEN RAISE EXCEPTION 'Staff role cannot perform this order status transition'; END IF;

  IF p_new_status='cancelled' AND v_order.payment_status='paid' THEN
    RAISE EXCEPTION 'Paid order requires recorded refund before cancellation';
  END IF;

  IF p_new_status='confirmed' THEN
    IF v_order.status<>'pending' OR v_order.accepted_by_telegram_id IS NOT NULL THEN RAISE EXCEPTION 'Order already accepted by another employee'; END IF;
    UPDATE public.cafe_orders SET status='confirmed',accepted_by_telegram_id=p_actor_telegram_id,accepted_at=now(),confirmed_at=now(),updated_at=now()
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
CREATE OR REPLACE FUNCTION public.create_cafe_order(p_customer_telegram_id bigint, p_items jsonb, p_order_type text, p_location_id uuid DEFAULT NULL::uuid, p_customer_name text DEFAULT NULL::text, p_customer_phone text DEFAULT NULL::text, p_delivery_address text DEFAULT NULL::text, p_payment_method text DEFAULT 'cash'::text, p_customer_note text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_user public.telegram_users%rowtype;
  v_location public.locations%rowtype;
  v_order public.cafe_orders%rowtype;
  v_item jsonb;
  v_product public.products%rowtype;
  v_quantity integer;
  v_subtotal integer := 0;
  v_item_count integer := 0;
begin
  if p_location_id is null then raise exception 'Cafe location is required'; end if;

  if p_customer_telegram_id is null or p_customer_telegram_id <= 0 then
    raise exception 'Invalid customer';
  end if;

  if p_order_type not in ('pickup','delivery','dine_in') then
    raise exception 'Invalid order type';
  end if;

  if p_payment_method not in ('cash','qr','bank_transfer','card') then
    raise exception 'Invalid payment method';
  end if;

  if p_order_type = 'delivery' and nullif(trim(p_delivery_address), '') is null then
    raise exception 'Delivery address is required';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 50 then
    raise exception 'Invalid order items';
  end if;

  select * into v_user
  from public.telegram_users
  where telegram_id = p_customer_telegram_id and is_active = true;

  if not found then
    raise exception 'Customer is not active or registered';
  end if;

  if p_location_id is not null then
    select * into v_location
    from public.locations
    where id = p_location_id and is_active = true
      and location_type in ('cafe','restaurant');

    if not found then
      raise exception 'Cafe location not found or inactive';
    end if;
  end if;

  insert into public.cafe_orders (
    customer_telegram_id, location_id, order_type, payment_method,
    customer_name, customer_phone, delivery_address, customer_note
  ) values (
    p_customer_telegram_id, p_location_id, p_order_type, p_payment_method,
    coalesce(nullif(trim(p_customer_name), ''), nullif(trim(concat_ws(' ', v_user.first_name, v_user.last_name)), '')),
    nullif(trim(p_customer_phone), ''),
    nullif(trim(p_delivery_address), ''),
    nullif(trim(p_customer_note), '')
  )
  returning * into v_order;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    if jsonb_typeof(v_item) <> 'object'
       or not (v_item ? 'productId')
       or not (v_item ? 'quantity') then
      raise exception 'Invalid item';
    end if;

    v_quantity := (v_item->>'quantity')::integer;
    if v_quantity < 1 or v_quantity > 99 then
      raise exception 'Invalid item quantity';
    end if;

    select * into v_product
    from public.products
    where id = (v_item->>'productId')::uuid
      and product_type = 'cafe'
      and is_active = true;

    if not found then
      raise exception 'Product not found or unavailable';
    end if;

    insert into public.cafe_order_items (
      order_id, product_id, product_name_ru, product_name_vi, product_name_en,
      quantity, unit_price_vnd
    ) values (
      v_order.id, v_product.id, v_product.name_ru, v_product.name_vi, v_product.name_en,
      v_quantity, v_product.price_vnd
    );

    v_subtotal := v_subtotal + (v_product.price_vnd * v_quantity);
    v_item_count := v_item_count + 1;
  end loop;

  if v_item_count < 1 then
    raise exception 'Order has no items';
  end if;

  update public.cafe_orders
  set subtotal_vnd = v_subtotal,
      total_vnd = v_subtotal,
      updated_at = now()
  where id = v_order.id
  returning * into v_order;

  insert into public.cafe_order_events (order_id, actor_telegram_id, from_status, to_status, note)
  values (v_order.id, p_customer_telegram_id, null, 'pending', 'Order created');

  return jsonb_build_object(
    'ok', true,
    'order', jsonb_build_object(
      'id', v_order.id,
      'orderNumber', v_order.order_number,
      'status', v_order.status,
      'orderType', v_order.order_type,
      'subtotalVnd', v_order.subtotal_vnd,
      'totalVnd', v_order.total_vnd,
      'currency', v_order.currency,
      'createdAt', v_order.created_at
    )
  );
end;
$function$;
CREATE OR REPLACE FUNCTION public.close_cafe_staff_shift(p_shift_id uuid, p_actor_telegram_id bigint, p_counted_cash_vnd integer, p_note text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_shift public.cafe_staff_shifts%rowtype;
  v_actor_role text;
  v_staff_role text;
  v_cash_sales integer := 0;
  v_handover_in integer := 0;
  v_handover_out integer := 0;
  v_expected integer;
begin
  if p_counted_cash_vnd is null or p_counted_cash_vnd < 0 then
    raise exception 'Фактическая сумма не может быть отрицательной';
  end if;

  select * into v_shift from public.cafe_staff_shifts where id = p_shift_id for update;
  if not found then raise exception 'Смена не найдена'; end if;
  if v_shift.shift_status <> 'open' then raise exception 'Смена уже закрыта'; end if;

  select role into v_actor_role from public.telegram_users
  where telegram_id = p_actor_telegram_id and is_active = true;
  if v_actor_role is null then raise exception 'Доступ запрещён'; end if;

  if p_actor_telegram_id <> v_shift.staff_telegram_id and v_actor_role <> 'super_admin' then
    select staff_role into v_staff_role from public.cafe_staff
    where location_id = v_shift.location_id and telegram_id = p_actor_telegram_id and is_active = true;
    if not found or v_staff_role not in ('manager','cashier') then raise exception 'Нет права закрыть чужую смену'; end if;
  end if;

  select coalesce(sum(amount_vnd),0)::integer into v_cash_sales
  from public.cafe_payment_receipts
  where location_id = v_shift.location_id
    and collected_by_telegram_id = v_shift.staff_telegram_id
    and payment_method = 'cash' and receipt_status = 'confirmed'
    and collected_at >= v_shift.opened_at and collected_at <= now();

  select coalesce(sum(amount_vnd),0)::integer into v_handover_out
  from public.cafe_cash_handovers
  where location_id = v_shift.location_id and from_telegram_id = v_shift.staff_telegram_id
    and handover_status = 'accepted'
    and accepted_at >= v_shift.opened_at and accepted_at <= now();

  select coalesce(sum(amount_vnd),0)::integer into v_handover_in
  from public.cafe_cash_handovers
  where location_id = v_shift.location_id and to_telegram_id = v_shift.staff_telegram_id
    and handover_status = 'accepted'
    and accepted_at >= v_shift.opened_at and accepted_at <= now();

  v_expected := v_shift.opening_cash_vnd + v_cash_sales + v_handover_in - v_handover_out;

  update public.cafe_staff_shifts
  set closed_at = now(), closed_by_telegram_id = p_actor_telegram_id,
      expected_cash_vnd = v_expected, counted_cash_vnd = p_counted_cash_vnd,
      variance_vnd = p_counted_cash_vnd - v_expected,
      shift_status = 'closed', close_note = nullif(left(coalesce(p_note,''),1000),'')
  where id = p_shift_id returning * into v_shift;

  return jsonb_build_object('ok',true,'shift',to_jsonb(v_shift));
end;
$function$;


-- cafe-order-idempotency.sql
-- Proposed schema/API hardening. Never apply to production without owner approval.

ALTER TABLE public.cafe_orders ADD COLUMN IF NOT EXISTS payment_timing text CHECK(payment_timing IN ('now','later','on_delivery'));
CREATE SCHEMA IF NOT EXISTS umma_private;
CREATE TABLE IF NOT EXISTS umma_private.cafe_order_requests (
  actor_telegram_id bigint NOT NULL REFERENCES public.telegram_users(telegram_id),
  request_key uuid NOT NULL,
  action text NOT NULL CHECK (action IN ('customerOrder','staffOrder','addItems')),
  arguments jsonb NOT NULL,
  result jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (actor_telegram_id,request_key)
);
ALTER TABLE umma_private.cafe_order_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON SCHEMA umma_private FROM PUBLIC, anon, authenticated;
REVOKE ALL ON umma_private.cafe_order_requests FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.execute_cafe_order_operation(
  p_actor_telegram_id bigint, p_request_key uuid, p_action text, p_arguments jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $function$
DECLARE
  v_cached umma_private.cafe_order_requests%rowtype;
  v_result jsonb;
  v_user public.telegram_users%rowtype;
  v_location uuid;
  v_staff_role text;
  v_payment_timing text;
BEGIN
  IF p_request_key IS NULL OR p_arguments IS NULL OR p_action IS NULL OR p_action NOT IN ('customerOrder','staffOrder','addItems') OR jsonb_typeof(p_arguments)<>'object' THEN
    RAISE EXCEPTION 'Invalid idempotent order request';
  END IF;
  SELECT * INTO v_user FROM public.telegram_users WHERE telegram_id=p_actor_telegram_id AND is_active=true;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order operation access denied'; END IF;
  -- Re-check authorization even for a replay after a staff assignment is revoked.
  IF p_action IN ('staffOrder','addItems') THEN
    IF v_user.role NOT IN ('super_admin','admin','employee') THEN RAISE EXCEPTION 'Staff access denied'; END IF;
    IF p_action='staffOrder' THEN v_location:=(p_arguments->>'p_location_id')::uuid;
    ELSE SELECT location_id INTO v_location FROM public.cafe_orders WHERE id=(p_arguments->>'p_order_id')::uuid;
    END IF;
    IF v_user.role<>'super_admin' THEN
      SELECT staff_role INTO v_staff_role FROM public.cafe_staff WHERE telegram_id=p_actor_telegram_id AND location_id=v_location AND is_active=true;
      IF NOT FOUND OR v_staff_role NOT IN ('manager','cashier','waiter','kitchen') THEN RAISE EXCEPTION 'Staff operation access denied'; END IF;
    END IF;
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_actor_telegram_id::text||':'||p_request_key::text,0));
  SELECT * INTO v_cached FROM umma_private.cafe_order_requests WHERE actor_telegram_id=p_actor_telegram_id AND request_key=p_request_key;
  IF FOUND THEN
    IF v_cached.action<>p_action OR v_cached.arguments IS DISTINCT FROM p_arguments THEN RAISE EXCEPTION 'Idempotency key reused with different order'; END IF;
    RETURN v_cached.result || jsonb_build_object('replayed',true);
  END IF;
  IF p_action IN ('customerOrder','staffOrder') THEN
    v_payment_timing:=coalesce(p_arguments->>'p_payment_timing','now');
    IF v_payment_timing NOT IN ('now','later','on_delivery') OR (v_payment_timing='later' AND p_arguments->>'p_order_type'<>'dine_in') OR (v_payment_timing='on_delivery' AND (p_arguments->>'p_order_type'<>'delivery' OR p_arguments->>'p_payment_method'<>'cash')) THEN RAISE EXCEPTION 'Invalid payment timing for order'; END IF;
  END IF;
  IF p_action='customerOrder' THEN
    v_result:=public.create_cafe_order(p_actor_telegram_id,p_arguments->'p_items',p_arguments->>'p_order_type',
      (p_arguments->>'p_location_id')::uuid,p_arguments->>'p_customer_name',p_arguments->>'p_customer_phone',
      p_arguments->>'p_delivery_address',p_arguments->>'p_payment_method',p_arguments->>'p_customer_note');
  ELSIF p_action='staffOrder' THEN
    v_result:=public.create_cafe_staff_order(p_actor_telegram_id,(p_arguments->>'p_location_id')::uuid,
      p_arguments->'p_items',p_arguments->>'p_order_type',p_arguments->>'p_customer_name',p_arguments->>'p_customer_phone',
      p_arguments->>'p_delivery_address',p_arguments->>'p_payment_method',p_arguments->>'p_customer_note');
  ELSE
    v_result:=public.add_cafe_staff_order_items(p_actor_telegram_id,(p_arguments->>'p_order_id')::uuid,p_arguments->'p_items');
  END IF;
  IF p_action IN ('customerOrder','staffOrder') THEN
    UPDATE public.cafe_orders SET payment_timing=v_payment_timing WHERE id=(v_result->'order'->>'id')::uuid;
    v_result:=jsonb_set(v_result,'{order,paymentTiming}',to_jsonb(v_payment_timing),true);
  END IF;
  INSERT INTO umma_private.cafe_order_requests(actor_telegram_id,request_key,action,arguments,result)
    VALUES(p_actor_telegram_id,p_request_key,p_action,p_arguments,v_result);
  RETURN v_result || jsonb_build_object('replayed',false);
END;
$function$;
REVOKE ALL ON FUNCTION public.execute_cafe_order_operation(bigint,uuid,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.execute_cafe_order_operation(bigint,uuid,text,jsonb) TO service_role;


-- cafe-cash-summary.sql
-- Server-side totals are independent of the last-100-receipts UI list.

CREATE OR REPLACE FUNCTION public.get_cafe_cash_summary(p_location_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public,pg_temp AS $function$
  SELECT jsonb_build_object(
    'total24hVnd',coalesce(sum(amount_vnd),0),
    'cash24hVnd',coalesce(sum(amount_vnd) FILTER (WHERE payment_method='cash'),0),
    'pendingHandovers',(SELECT count(*) FROM public.cafe_cash_handovers WHERE location_id=p_location_id AND handover_status='pending')
  ) FROM public.cafe_payment_receipts
    WHERE location_id=p_location_id AND receipt_status='confirmed' AND collected_at>=now()-interval '24 hours' AND collected_at<=now();
$function$;
REVOKE ALL ON FUNCTION public.get_cafe_cash_summary(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.get_cafe_cash_summary(uuid) TO service_role;


-- cafe-delivery-hardening.sql
-- Proposal: delivery transitions and assignment are atomic. Not deployed to public.

CREATE OR REPLACE FUNCTION public.update_cafe_delivery_status(p_order_id uuid, p_actor_telegram_id bigint, p_delivery_status text, p_note text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
 v_order public.cafe_orders%rowtype;
 v_user public.telegram_users%rowtype;
 v_staff_role text;
 v_previous text;
 v_allowed boolean := false;
begin
 if p_order_id is null or p_actor_telegram_id is null then raise exception 'Invalid delivery update request'; end if;
 if p_delivery_status not in ('waiting_courier','courier_assigned','picked_up','delivered') then raise exception 'Invalid delivery status'; end if;
 select * into v_user from public.telegram_users where telegram_id=p_actor_telegram_id and is_active=true;
 if not found then raise exception 'Delivery management access denied'; end if;
 select * into v_order from public.cafe_orders where id=p_order_id for update;
 if not found then raise exception 'Order not found'; end if;
 if v_order.order_type <> 'delivery' then raise exception 'Order is not delivery'; end if;
 if v_user.role='super_admin' then v_staff_role:='manager';
 else
   if v_user.role not in ('admin','employee') then raise exception 'Delivery management access denied'; end if;
   select staff_role into v_staff_role from public.cafe_staff where telegram_id=p_actor_telegram_id and location_id=v_order.location_id and is_active=true;
   if not found then raise exception 'No active staff assignment for this cafe'; end if;
 end if;
 if v_staff_role not in ('manager','waiter','cashier','courier') then raise exception 'Staff role cannot update delivery'; end if;
 if v_staff_role='courier' and v_order.courier_telegram_id is distinct from p_actor_telegram_id then
   raise exception 'Delivery assigned to another courier';
 end if;
 if v_order.status in ('completed','cancelled') then raise exception 'Closed order delivery cannot be changed'; end if;
 if p_delivery_status in ('courier_assigned','picked_up','delivered') and v_order.courier_telegram_id is null then raise exception 'Assign a courier first'; end if;
 if p_delivery_status='picked_up' and v_order.status<>'ready' then raise exception 'Order must be ready before pickup'; end if;
 v_previous:=v_order.delivery_status;
 if v_previous=p_delivery_status then
   return jsonb_build_object('ok',true,'replayed',true,'order',jsonb_build_object('id',v_order.id,'orderNumber',v_order.order_number,'deliveryStatus',v_previous));
 end if;
 v_allowed:=case
   when v_staff_role='courier' and v_previous='courier_assigned' and p_delivery_status='picked_up' then true
   when v_staff_role='courier' and v_previous='picked_up' and p_delivery_status='delivered' then true
   when v_staff_role<>'courier' and v_previous='waiting_courier' and p_delivery_status='courier_assigned' then true
   when v_staff_role<>'courier' and v_previous='courier_assigned' and p_delivery_status='picked_up' then true
   when v_staff_role<>'courier' and v_previous='picked_up' and p_delivery_status='delivered' then true
   when v_staff_role<>'courier' and p_delivery_status='waiting_courier' and v_previous='courier_assigned' then true
   else false end;
 if not v_allowed then raise exception 'Invalid delivery status transition'; end if;
 update public.cafe_orders set delivery_status=p_delivery_status,courier_telegram_id=case when p_delivery_status='waiting_courier' then null else courier_telegram_id end,updated_at=now() where id=p_order_id returning * into v_order;
 insert into public.cafe_order_events(order_id,actor_telegram_id,from_status,to_status,note)
 values(v_order.id,p_actor_telegram_id,v_previous,p_delivery_status,coalesce(nullif(trim(p_note),''),'Статус доставки обновлён'));
 return jsonb_build_object('ok',true,'order',jsonb_build_object('id',v_order.id,'orderNumber',v_order.order_number,'deliveryStatus',v_order.delivery_status));
end;
$function$;

CREATE OR REPLACE FUNCTION public.assign_cafe_courier(p_order_id uuid,p_actor_telegram_id bigint,p_courier_telegram_id bigint)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp' AS $$
DECLARE o public.cafe_orders%rowtype; actor_role text; staff text; previous text;
BEGIN
 SELECT role INTO actor_role FROM public.telegram_users WHERE telegram_id=p_actor_telegram_id AND is_active=true;
 IF NOT FOUND THEN RAISE EXCEPTION 'Delivery management access denied'; END IF;
 SELECT * INTO o FROM public.cafe_orders WHERE id=p_order_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
 IF actor_role<>'super_admin' THEN
  SELECT staff_role INTO staff FROM public.cafe_staff WHERE telegram_id=p_actor_telegram_id AND location_id=o.location_id AND is_active=true;
  IF NOT FOUND OR actor_role NOT IN ('admin','employee') OR staff NOT IN ('manager','cashier','waiter') THEN RAISE EXCEPTION 'Delivery management access denied'; END IF;
 END IF;
 IF o.order_type<>'delivery' OR o.status IN ('completed','cancelled') OR o.delivery_status NOT IN ('waiting_courier','courier_assigned') THEN RAISE EXCEPTION 'Order cannot be assigned to courier'; END IF;
 PERFORM 1 FROM public.cafe_staff s JOIN public.telegram_users u USING(telegram_id) WHERE s.telegram_id=p_courier_telegram_id AND s.location_id=o.location_id AND s.staff_role='courier' AND s.is_active=true AND u.is_active=true;
 IF NOT FOUND THEN RAISE EXCEPTION 'Courier inactive or belongs to another cafe'; END IF;
 IF o.delivery_status='courier_assigned' AND o.courier_telegram_id=p_courier_telegram_id THEN RETURN jsonb_build_object('ok',true,'replayed',true,'order',to_jsonb(o)); END IF;
 previous:=o.delivery_status;
 UPDATE public.cafe_orders SET courier_telegram_id=p_courier_telegram_id,delivery_status='courier_assigned',updated_at=now() WHERE id=o.id RETURNING * INTO o;
 INSERT INTO public.cafe_order_events(order_id,actor_telegram_id,from_status,to_status,note) VALUES(o.id,p_actor_telegram_id,previous,'courier_assigned','Курьер назначен');
 RETURN jsonb_build_object('ok',true,'replayed',false,'order',to_jsonb(o));
END $$;
REVOKE ALL ON FUNCTION public.assign_cafe_courier(uuid,bigint,bigint) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.assign_cafe_courier(uuid,bigint,bigint) TO service_role;
REVOKE ALL ON FUNCTION public.update_cafe_delivery_status(uuid,bigint,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.update_cafe_delivery_status(uuid,bigint,text,text) TO service_role;



-- cafe-refunds.sql
-- Full refunds only: immutable receipts, explicit manual payout acknowledgement, no external transfer.

CREATE TABLE public.cafe_order_refunds (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 order_id uuid NOT NULL UNIQUE REFERENCES public.cafe_orders(id),
 receipt_id uuid NOT NULL UNIQUE REFERENCES public.cafe_payment_receipts(id),
 location_id uuid NOT NULL REFERENCES public.locations(id),
 actor_telegram_id bigint NOT NULL REFERENCES public.telegram_users(telegram_id),
 request_key uuid NOT NULL,
 amount_vnd integer NOT NULL CHECK(amount_vnd>0),
 payment_method text NOT NULL,
 reason text NOT NULL CHECK(length(trim(reason)) BETWEEN 3 AND 500),
 cash_shift_id uuid REFERENCES public.cafe_staff_shifts(id),
 refunded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(actor_telegram_id,request_key),
 CHECK((payment_method='cash')=(cash_shift_id IS NOT NULL))
);
CREATE INDEX cafe_refunds_location_time ON public.cafe_order_refunds(location_id,refunded_at);
ALTER TABLE public.cafe_order_refunds ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.cafe_order_refunds FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.cafe_order_refunds TO service_role;
CREATE OR REPLACE FUNCTION public.refund_cafe_order(p_order_id uuid,p_actor_telegram_id bigint,p_request_key uuid,p_reason text,p_payout_confirmed boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE o public.cafe_orders%rowtype; r public.cafe_payment_receipts%rowtype; f public.cafe_order_refunds%rowtype;
 actor_role text; staff text; shift public.cafe_staff_shifts%rowtype; available bigint; receipt_count int;
BEGIN
 IF p_request_key IS NULL OR p_payout_confirmed IS DISTINCT FROM true OR length(trim(coalesce(p_reason,''))) NOT BETWEEN 3 AND 500 THEN RAISE EXCEPTION 'Refund requires reason and confirmation of actual payout'; END IF;
 SELECT role INTO actor_role FROM public.telegram_users WHERE telegram_id=p_actor_telegram_id AND is_active=true;
 IF NOT FOUND THEN RAISE EXCEPTION 'Refund access denied'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('cafe-refund:'||p_actor_telegram_id::text||':'||p_request_key::text,0));
 SELECT * INTO o FROM public.cafe_orders WHERE id=p_order_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
 IF actor_role<>'super_admin' THEN
  SELECT staff_role INTO staff FROM public.cafe_staff WHERE telegram_id=p_actor_telegram_id AND location_id=o.location_id AND is_active=true;
  IF NOT FOUND OR actor_role NOT IN ('admin','employee') OR staff<>'manager' THEN RAISE EXCEPTION 'Refund access denied'; END IF;
 END IF;
 SELECT * INTO f FROM public.cafe_order_refunds WHERE actor_telegram_id=p_actor_telegram_id AND request_key=p_request_key;
 IF FOUND THEN
  IF f.order_id<>p_order_id OR f.reason<>trim(p_reason) THEN RAISE EXCEPTION 'Refund key reused with different payload'; END IF;
  RETURN jsonb_build_object('ok',true,'replayed',true,'refund',to_jsonb(f));
 END IF;
 IF o.payment_status<>'paid' THEN RAISE EXCEPTION 'Order has no refundable payment'; END IF;
 SELECT count(*) INTO receipt_count FROM public.cafe_payment_receipts WHERE order_id=o.id AND receipt_status='confirmed';
 SELECT * INTO r FROM public.cafe_payment_receipts WHERE order_id=o.id AND receipt_status='confirmed';
 IF receipt_count<>1 OR r.amount_vnd<>o.total_vnd THEN RAISE EXCEPTION 'Receipt reconciliation required before refund'; END IF;
 IF r.payment_method='cash' THEN
  SELECT * INTO shift FROM public.cafe_staff_shifts WHERE location_id=o.location_id AND staff_telegram_id=p_actor_telegram_id AND shift_status='open' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Open your cash shift before refund'; END IF;
  SELECT shift.opening_cash_vnd
   +coalesce((SELECT sum(amount_vnd) FROM public.cafe_payment_receipts WHERE location_id=o.location_id AND collected_by_telegram_id=p_actor_telegram_id AND payment_method='cash' AND receipt_status='confirmed' AND collected_at>=shift.opened_at),0)
   +coalesce((SELECT sum(amount_vnd) FROM public.cafe_cash_handovers WHERE location_id=o.location_id AND to_telegram_id=p_actor_telegram_id AND handover_status='accepted' AND accepted_at>=shift.opened_at),0)
   -coalesce((SELECT sum(amount_vnd) FROM public.cafe_cash_handovers WHERE location_id=o.location_id AND from_telegram_id=p_actor_telegram_id AND handover_status='accepted' AND accepted_at>=shift.opened_at),0)
   -coalesce((SELECT sum(amount_vnd) FROM public.cafe_order_refunds WHERE cash_shift_id=shift.id),0) INTO available;
  IF available<r.amount_vnd THEN RAISE EXCEPTION 'Insufficient recorded cash for refund'; END IF;
 END IF;
 INSERT INTO public.cafe_order_refunds(order_id,receipt_id,location_id,actor_telegram_id,request_key,amount_vnd,payment_method,reason,cash_shift_id)
 VALUES(o.id,r.id,o.location_id,p_actor_telegram_id,p_request_key,r.amount_vnd,r.payment_method,trim(p_reason),shift.id) RETURNING * INTO f;
 UPDATE public.cafe_orders SET payment_status='refunded',status='cancelled',updated_at=clock_timestamp() WHERE id=o.id;
 INSERT INTO public.cafe_order_events(order_id,actor_telegram_id,from_status,to_status,note)
 VALUES(o.id,p_actor_telegram_id,o.status,'cancelled','Полный возврат: '||trim(p_reason));
 RETURN jsonb_build_object('ok',true,'replayed',false,'refund',to_jsonb(f));
END $$;
REVOKE ALL ON FUNCTION public.refund_cafe_order(uuid,bigint,uuid,text,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.refund_cafe_order(uuid,bigint,uuid,text,boolean) TO service_role;
CREATE OR REPLACE FUNCTION public.close_cafe_staff_shift(p_shift_id uuid, p_actor_telegram_id bigint, p_counted_cash_vnd integer, p_note text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_shift public.cafe_staff_shifts%rowtype;
  v_actor_role text;
  v_staff_role text;
  v_cash_sales integer := 0;
  v_handover_in integer := 0;
  v_handover_out integer := 0;
  v_expected integer;
  v_cash_refunds integer := 0;
begin
  if p_counted_cash_vnd is null or p_counted_cash_vnd < 0 then
    raise exception 'Фактическая сумма не может быть отрицательной';
  end if;

  select * into v_shift from public.cafe_staff_shifts where id = p_shift_id for update;
  if not found then raise exception 'Смена не найдена'; end if;
  if v_shift.shift_status <> 'open' then raise exception 'Смена уже закрыта'; end if;

  select role into v_actor_role from public.telegram_users
  where telegram_id = p_actor_telegram_id and is_active = true;
  if v_actor_role is null then raise exception 'Доступ запрещён'; end if;

  if p_actor_telegram_id <> v_shift.staff_telegram_id and v_actor_role <> 'super_admin' then
    select staff_role into v_staff_role from public.cafe_staff
    where location_id = v_shift.location_id and telegram_id = p_actor_telegram_id and is_active = true;
    if not found or v_staff_role not in ('manager','cashier') then raise exception 'Нет права закрыть чужую смену'; end if;
  end if;

  select coalesce(sum(amount_vnd),0)::integer into v_cash_sales
  from public.cafe_payment_receipts
  where location_id = v_shift.location_id
    and collected_by_telegram_id = v_shift.staff_telegram_id
    and payment_method = 'cash' and receipt_status = 'confirmed'
    and collected_at >= v_shift.opened_at and collected_at <= now();

  select coalesce(sum(amount_vnd),0)::integer into v_handover_out
  from public.cafe_cash_handovers
  where location_id = v_shift.location_id and from_telegram_id = v_shift.staff_telegram_id
    and handover_status = 'accepted'
    and accepted_at >= v_shift.opened_at and accepted_at <= now();

  select coalesce(sum(amount_vnd),0)::integer into v_handover_in
  from public.cafe_cash_handovers
  where location_id = v_shift.location_id and to_telegram_id = v_shift.staff_telegram_id
    and handover_status = 'accepted'
    and accepted_at >= v_shift.opened_at and accepted_at <= now();

  SELECT coalesce(sum(amount_vnd),0)::integer INTO v_cash_refunds FROM public.cafe_order_refunds
   WHERE cash_shift_id=v_shift.id AND refunded_at<=clock_timestamp();
  v_expected := v_shift.opening_cash_vnd + v_cash_sales + v_handover_in - v_handover_out - v_cash_refunds;

  update public.cafe_staff_shifts
  set closed_at = now(), closed_by_telegram_id = p_actor_telegram_id,
      expected_cash_vnd = v_expected, counted_cash_vnd = p_counted_cash_vnd,
      variance_vnd = p_counted_cash_vnd - v_expected,
      shift_status = 'closed', close_note = nullif(left(coalesce(p_note,''),1000),'')
  where id = p_shift_id returning * into v_shift;

  return jsonb_build_object('ok',true,'shift',to_jsonb(v_shift));
end;
$function$;
CREATE OR REPLACE FUNCTION public.get_cafe_cash_summary(p_location_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public,pg_temp AS $$
WITH payments AS (SELECT coalesce(sum(amount_vnd),0) total,coalesce(sum(amount_vnd) FILTER(WHERE payment_method='cash'),0) cash FROM public.cafe_payment_receipts WHERE location_id=p_location_id AND receipt_status='confirmed' AND collected_at>=now()-interval '24 hours' AND collected_at<=now()),
refunds AS (SELECT coalesce(sum(amount_vnd),0) total,coalesce(sum(amount_vnd) FILTER(WHERE payment_method='cash'),0) cash FROM public.cafe_order_refunds WHERE location_id=p_location_id AND refunded_at>=now()-interval '24 hours' AND refunded_at<=now())
SELECT jsonb_build_object('total24hVnd',payments.total-refunds.total,'cash24hVnd',payments.cash-refunds.cash,'gross24hVnd',payments.total,'refund24hVnd',refunds.total,'pendingHandovers',(SELECT count(*) FROM public.cafe_cash_handovers WHERE location_id=p_location_id AND handover_status='pending')) FROM payments,refunds;
$$;

COMMIT;
