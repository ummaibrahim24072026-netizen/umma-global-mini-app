-- Server-only B2B order creation. Caller must be the authenticated service backend.
begin;
alter table public.b2b_orders add column if not exists request_id uuid unique;
create table if not exists public.b2b_staff (
 telegram_id bigint primary key references public.telegram_users(telegram_id),
 role text not null check(role in ('manager','warehouse','admin')),
 is_active boolean not null default true
);
alter table public.b2b_staff enable row level security;
revoke all on public.b2b_staff from anon,authenticated;
grant select,insert,update,delete on public.b2b_staff to service_role;
create or replace function public.b2b_place_order(
 p_actor bigint,p_request uuid,p_org uuid,p_items jsonb,p_source text,p_payment text,
 p_address text default null,p_date date default null
) returns uuid language plpgsql security invoker set search_path='' as $$
declare v_order uuid; v_item record; v_row record; v_count integer; v_qty numeric; v_changed integer; v_manager boolean;
begin
 if p_request is null then raise exception 'Request ID required'; end if;
 select id into v_order from public.b2b_orders where request_id=p_request;
 if found then return v_order; end if;
 select exists(select 1 from public.telegram_users where telegram_id=p_actor and is_active and role='super_admin')
 or exists(select 1 from public.b2b_staff where telegram_id=p_actor and is_active and role in ('manager','admin')) into v_manager;
 if p_source not in ('buyer','field_manager') or p_payment not in ('online','cash_on_delivery','manager_cash')
 or (p_source='field_manager' and not v_manager)
 or (p_source='buyer' and not exists(select 1 from public.b2b_memberships where organization_id=p_org and telegram_id=p_actor and role='buyer'))
 or (p_payment='manager_cash' and not v_manager)
 then raise exception 'B2B_ACCESS_DENIED'; end if;
 if not exists(select 1 from public.b2b_organizations where id=p_org and status='approved') then raise exception 'B2B_ORGANIZATION_NOT_APPROVED'; end if;
 if jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items) not between 1 and 100 then raise exception 'Invalid order lines'; end if;
 if exists(select 1 from jsonb_array_elements(p_items) x where x->>'id' is null or x->>'quantity' is null)
 then raise exception 'Invalid order line'; end if;
 if (select count(*) from jsonb_array_elements(p_items)) <> (select count(distinct x->>'id') from jsonb_array_elements(p_items) x)
 then raise exception 'Duplicate order item'; end if;
 -- Acquire locks in stable order to prevent overselling and deadlocks.
 for v_item in select (x->>'id')::uuid as id,(x->>'quantity')::numeric as qty from jsonb_array_elements(p_items) x order by (x->>'id')::uuid
 loop
  if v_item.qty<=0 or v_item.qty>100000 then raise exception 'Invalid quantity'; end if;
  select c.*,b.quantity_on_hand,b.quantity_reserved into v_row from public.b2b_catalog c
  join public.stock_balances b on b.stock_item_id=c.stock_item_id and b.location_id=c.location_id
  where c.id=v_item.id and c.active=true and c.price_vnd is not null
  for update of b;
  if not found or v_item.qty<v_row.minimum_quantity or (v_row.unit='pcs' and v_item.qty<>trunc(v_item.qty))
    or v_row.quantity_on_hand-v_row.quantity_reserved<v_item.qty then raise exception 'B2B_INSUFFICIENT_STOCK_OR_INACTIVE_ITEM'; end if;
 end loop;
 insert into public.b2b_orders(organization_id,created_by_telegram_id,request_id,source,payment_method,delivery_address,delivery_date,status)
 values(p_org,p_actor,p_request,p_source,p_payment,left(p_address,500),p_date,'reserved') returning id into v_order;
 for v_item in select (x->>'id')::uuid as id,(x->>'quantity')::numeric as qty from jsonb_array_elements(p_items) x order by (x->>'id')::uuid
 loop
  select * into v_row from public.b2b_catalog where id=v_item.id;
  insert into public.b2b_order_lines(order_id,catalog_id,quantity,price_vnd)
   values(v_order,v_row.id,v_item.qty,v_row.price_vnd) returning id into v_item.id;
  update public.stock_balances set quantity_reserved=quantity_reserved+v_item.qty,updated_at=now()
   where stock_item_id=v_row.stock_item_id and location_id=v_row.location_id;
  insert into public.b2b_stock_reservations(order_line_id,stock_item_id,location_id,quantity)
   values(v_item.id,v_row.stock_item_id,v_row.location_id,v_item.qty);
 end loop;
 insert into public.b2b_order_events(order_id,actor_telegram_id,event_type) values(v_order,p_actor,'reserved_for_warehouse');
 return v_order;
end $$;
revoke all on function public.b2b_place_order(bigint,uuid,uuid,jsonb,text,text,text,date) from public,anon,authenticated;
grant execute on function public.b2b_place_order(bigint,uuid,uuid,jsonb,text,text,text,date) to service_role;
commit;