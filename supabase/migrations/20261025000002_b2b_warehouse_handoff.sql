-- Atomic warehouse handoff for B2B. Invoke only from a trusted authenticated backend.
begin;
create or replace function public.b2b_reserve_order(p_order_id uuid, p_actor_telegram_id bigint)
returns void language plpgsql security invoker set search_path = '' as $$
declare v_order public.b2b_orders%rowtype; v_line record; v_changed int; v_count int := 0;
begin
 select * into v_order from public.b2b_orders where id=p_order_id for update;
 if not found or v_order.status <> 'draft' then raise exception 'Order must be draft'; end if;
 if not exists(select 1 from public.b2b_organizations where id=v_order.organization_id and status='approved') then raise exception 'Organization not approved'; end if;
 for v_line in
  select l.id, l.quantity, c.stock_item_id, c.location_id, c.active, c.price_vnd
  from public.b2b_order_lines l join public.b2b_catalog c on c.id=l.catalog_id
  where l.order_id=p_order_id order by c.stock_item_id,c.location_id,l.id
 loop
  v_count:=v_count+1;
  if not v_line.active or v_line.stock_item_id is null or v_line.location_id is null or v_line.price_vnd is null
  then raise exception 'Catalog item not configured'; end if;
  update public.stock_balances set quantity_reserved=quantity_reserved+v_line.quantity,updated_at=now()
  where stock_item_id=v_line.stock_item_id and location_id=v_line.location_id
    and quantity_on_hand-quantity_reserved >= v_line.quantity;
  get diagnostics v_changed = row_count;
  if v_changed<>1 then raise exception 'Insufficient available stock'; end if;
  insert into public.b2b_stock_reservations(order_line_id,stock_item_id,location_id,quantity)
  values(v_line.id,v_line.stock_item_id,v_line.location_id,v_line.quantity);
 end loop;
 if v_count=0 then raise exception 'Order has no lines'; end if;
 update public.b2b_orders set status='reserved' where id=p_order_id;
 insert into public.b2b_order_events(order_id,actor_telegram_id,event_type)
 values(p_order_id,p_actor_telegram_id,'reserved_for_warehouse');
end $$;
create or replace function public.b2b_release_order(p_order_id uuid,p_actor_telegram_id bigint)
returns void language plpgsql security invoker set search_path = '' as $$
declare v_order public.b2b_orders%rowtype; v_r record; v_changed int;
begin
 select * into v_order from public.b2b_orders where id=p_order_id for update;
 if not found or v_order.status not in ('reserved','picking') then raise exception 'Order cannot be cancelled'; end if;
 for v_r in select r.* from public.b2b_stock_reservations r join public.b2b_order_lines l on l.id=r.order_line_id where l.order_id=p_order_id and r.status='active' order by r.stock_item_id,r.location_id for update of r loop
  update public.stock_balances set quantity_reserved=quantity_reserved-v_r.quantity,updated_at=now()
   where stock_item_id=v_r.stock_item_id and location_id=v_r.location_id and quantity_reserved>=v_r.quantity;
  get diagnostics v_changed=row_count;
  if v_changed<>1 then raise exception 'Stock reservation mismatch'; end if;
  update public.b2b_stock_reservations set status='released' where id=v_r.id;
 end loop;
 update public.b2b_orders set status='cancelled' where id=p_order_id;
 insert into public.b2b_order_events(order_id,actor_telegram_id,event_type) values(p_order_id,p_actor_telegram_id,'cancelled_released');
end $$;
create or replace function public.b2b_dispatch_order(p_order_id uuid,p_actor_telegram_id bigint)
returns void language plpgsql security invoker set search_path = '' as $$
declare v_order public.b2b_orders%rowtype; v_r record; v_changed int; v_count int:=0;
begin
 select * into v_order from public.b2b_orders where id=p_order_id for update;
 if not found or v_order.status not in ('reserved','picking') then raise exception 'Order not ready for dispatch'; end if;
 for v_r in select r.* from public.b2b_stock_reservations r join public.b2b_order_lines l on l.id=r.order_line_id where l.order_id=p_order_id and r.status='active' order by r.stock_item_id,r.location_id for update of r loop
  v_count:=v_count+1;
  update public.stock_balances set quantity_reserved=quantity_reserved-v_r.quantity,quantity_on_hand=quantity_on_hand-v_r.quantity,updated_at=now()
  where stock_item_id=v_r.stock_item_id and location_id=v_r.location_id and quantity_reserved>=v_r.quantity and quantity_on_hand>=v_r.quantity;
  get diagnostics v_changed=row_count;
  if v_changed<>1 then raise exception 'Stock balance mismatch'; end if;
  update public.b2b_stock_reservations set status='fulfilled' where id=v_r.id;
 end loop;
 if v_count=0 then raise exception 'No active reservations'; end if;
 update public.b2b_orders set status='dispatched' where id=p_order_id;
 insert into public.b2b_order_events(order_id,actor_telegram_id,event_type) values(p_order_id,p_actor_telegram_id,'dispatched_stock_deducted');
end $$;
revoke all on function public.b2b_reserve_order(uuid,bigint) from public,anon,authenticated;
revoke all on function public.b2b_release_order(uuid,bigint) from public,anon,authenticated;
revoke all on function public.b2b_dispatch_order(uuid,bigint) from public,anon,authenticated;
grant execute on function public.b2b_reserve_order(uuid,bigint) to service_role;
grant execute on function public.b2b_release_order(uuid,bigint) to service_role;
grant execute on function public.b2b_dispatch_order(uuid,bigint) to service_role;
commit;