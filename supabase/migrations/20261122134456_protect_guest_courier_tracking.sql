-- Keep grants inaccessible through PostgREST reads, including old public GPS broadcasts.
grant insert on public.umma_guest_delivery_grants to service_role;

create function public.umma_resolve_guest_tracking(p_order uuid, p_request_key uuid, p_token_hash text)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_order uuid;
  v_grant text;
begin
  if p_order is not null and p_request_key is not null
     and public.umma_verify_guest_delivery_request(p_order, p_request_key) then
    v_order := p_order;
    select g.token_hash into v_grant from public.umma_guest_delivery_grants g
     where g.order_id = v_order and g.revoked_at is null and g.expires_at > now()
     order by g.created_at desc limit 1;
  elsif p_token_hash is not null then
    select g.order_id, g.token_hash into v_order, v_grant from public.umma_guest_delivery_grants g
     where g.token_hash = p_token_hash and g.revoked_at is null and g.expires_at > now()
       and (p_order is null or g.order_id = p_order);
  end if;

  if v_order is null then return null; end if;
  return jsonb_build_object('orderId', v_order, 'channel', 'umma-guest-gps:' || v_grant);
end;
$$;
revoke all on function public.umma_resolve_guest_tracking(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.umma_resolve_guest_tracking(uuid, uuid, text) to service_role;

-- A private topic is a capability issued by the tracking API after order verification.
-- Broadcast only invalidates the current snapshot. GPS is always read via the Edge API.
create function umma_private.can_receive_guest_gps(p_topic text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select p_topic ~ '^umma-guest-gps:[0-9a-f]{64}$' and exists (
    select 1 from public.umma_guest_delivery_grants g
    join public.cafe_orders o on o.id = g.order_id
    where g.token_hash = substr(p_topic, 16) and g.revoked_at is null and g.expires_at > now()
      and o.order_type = 'delivery' and o.green_sm_stage is null
      and o.status not in ('completed', 'cancelled') and o.delivery_status = 'picked_up'
  )
$$;
revoke all on function umma_private.can_receive_guest_gps(text) from public, anon, authenticated;
grant execute on function umma_private.can_receive_guest_gps(text) to anon;

create policy umma_guest_gps_receive
on realtime.messages for select to anon
using (extension = 'broadcast' and umma_private.can_receive_guest_gps((select realtime.topic())));

create function umma_private.broadcast_guest_gps_change()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_grant text;
begin
  if new.enabled and new.position_at is not null
     and new.position_at is distinct from old.position_at then
    for v_grant in
      select g.token_hash from public.umma_guest_delivery_grants g
      join public.cafe_orders o on o.id = g.order_id
      where g.order_id = new.order_id and g.revoked_at is null and g.expires_at > now()
        and o.green_sm_stage is null and o.courier_telegram_id = new.courier_telegram_id
        and o.status not in ('completed', 'cancelled') and o.delivery_status = 'picked_up'
    loop
      perform realtime.send('{}'::jsonb, 'position', 'umma-guest-gps:' || v_grant, true);
    end loop;
  end if;
  return new;
exception when others then
  raise warning 'Guest GPS notification skipped, SQLSTATE %', SQLSTATE;
  return new;
end
$$;
revoke all on function umma_private.broadcast_guest_gps_change() from public, anon, authenticated;

create trigger umma_guest_gps_change after update of position_at on public.cafe_delivery_tracking
for each row execute function umma_private.broadcast_guest_gps_change();
