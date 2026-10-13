-- Proposal: delivery transitions and assignment are atomic. Not deployed to public.
BEGIN;
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

COMMIT;
