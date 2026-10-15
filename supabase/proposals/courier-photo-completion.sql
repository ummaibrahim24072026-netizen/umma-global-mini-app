-- A verified photo commits its delivery step in the same database transaction.
CREATE OR REPLACE FUNCTION public.confirm_cafe_delivery_proof(p_id uuid, p_actor bigint)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp'
AS $function$
DECLARE f public.cafe_delivery_proofs%rowtype; o public.cafe_orders%rowtype; target text;
BEGIN
 SELECT * INTO f FROM public.cafe_delivery_proofs WHERE id=p_id AND courier_telegram_id=p_actor;
 IF NOT FOUND THEN RAISE EXCEPTION 'Proof not found'; END IF;
 SELECT * INTO o FROM public.cafe_orders WHERE id=f.order_id FOR UPDATE;
 IF o.courier_telegram_id IS DISTINCT FROM p_actor OR NOT public.cafe_active_courier(p_actor,o.location_id) THEN RAISE EXCEPTION 'Proof courier access denied'; END IF;
 IF f.verified_at IS NULL THEN
  IF o.status IN ('completed','cancelled') OR (f.kind='pickup' AND (o.status<>'ready' OR o.delivery_status<>'courier_assigned')) OR (f.kind='handover' AND o.delivery_status<>'picked_up') THEN RAISE EXCEPTION 'Proof not allowed at this delivery stage'; END IF;
  UPDATE public.cafe_delivery_proofs SET verified_at=clock_timestamp() WHERE id=f.id RETURNING * INTO f;
 END IF;
 target:=CASE WHEN f.kind='pickup' THEN 'picked_up' ELSE 'delivered' END;
 IF o.status NOT IN ('completed','cancelled') AND ((f.kind='pickup' AND o.delivery_status='courier_assigned') OR (f.kind='handover' AND o.delivery_status='picked_up')) THEN
  PERFORM public.update_cafe_delivery_status(o.id,p_actor,target);
  SELECT * INTO o FROM public.cafe_orders WHERE id=f.order_id;
 END IF;
 RETURN jsonb_build_object('ok',true,'proof',to_jsonb(f),'order',jsonb_build_object('id',o.id,'status',o.status,'deliveryStatus',o.delivery_status,'paymentStatus',o.payment_status));
END $function$;

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
 if p_delivery_status in ('picked_up','delivered') and v_order.delivery_status<>p_delivery_status and not exists(select 1 from public.cafe_delivery_proofs where order_id=v_order.id and courier_telegram_id=v_order.courier_telegram_id and kind=case when p_delivery_status='picked_up' then 'pickup' else 'handover' end and verified_at is not null) then raise exception 'Verified delivery photo required'; end if;
 update public.cafe_orders set delivery_status=p_delivery_status,courier_telegram_id=case when p_delivery_status='waiting_courier' then null else courier_telegram_id end,updated_at=now() where id=p_order_id returning * into v_order;
 insert into public.cafe_order_events(order_id,actor_telegram_id,from_status,to_status,note)
 values(v_order.id,p_actor_telegram_id,v_previous,p_delivery_status,coalesce(nullif(trim(p_note),''),'Статус доставки обновлён'));
 if v_order.status='ready' and v_order.delivery_status='delivered' and v_order.payment_status='paid' then
   perform public.update_cafe_order_status(v_order.id,p_actor_telegram_id,'completed','Доставка вручена и оплачена');
   select * into v_order from public.cafe_orders where id=p_order_id;
 end if;
 return jsonb_build_object('ok',true,'order',jsonb_build_object('id',v_order.id,'orderNumber',v_order.order_number,'deliveryStatus',v_order.delivery_status,'status',v_order.status,'paymentStatus',v_order.payment_status));
end;
$function$
;

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
  select * into v_order from public.cafe_orders where id=p_order_id;
  if v_order.order_type='delivery' and v_order.status='ready' and v_order.delivery_status='delivered' and v_order.payment_status='paid' then
    perform public.update_cafe_order_status(v_order.id,p_actor_telegram_id,'completed','Доставка вручена и оплачена');
    select * into v_order from public.cafe_orders where id=p_order_id;
  end if;
  return v_result || jsonb_build_object('order',coalesce(v_result->'order','{}'::jsonb)||jsonb_build_object('status',v_order.status,'deliveryStatus',v_order.delivery_status));
end;
$function$
;

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
$function$
;

