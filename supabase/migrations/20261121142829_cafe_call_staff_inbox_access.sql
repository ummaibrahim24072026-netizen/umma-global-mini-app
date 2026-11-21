-- Calls follow the same branch and assignment permissions as the staff inbox.
grant execute on function umma_private.connect_owner(bigint),
  umma_private.connect_role(bigint, uuid, text[]), umma_private.connect_can_read(bigint, uuid),
  umma_private.connect_cafe(uuid) to service_role;
grant select (inbox_assignee) on umma_private.cafe_connect_clients to service_role;
grant select (id, token_hash) on umma_private.cafe_menu_visitors to service_role;
grant select (id, visitor_id) on umma_private.cafe_menu_visits to service_role;
grant select (visit_id, order_id) on umma_private.cafe_menu_visit_orders to service_role;

create function umma_private.connect_call_staff(p_actor bigint) returns boolean
language sql stable security invoker set search_path = pg_catalog, pg_temp as $$
  select umma_private.connect_owner(p_actor) or exists (
    select from public.cafe_staff s
    where s.telegram_id = p_actor and s.is_active
      and s.staff_role in ('manager', 'cashier', 'waiter')
      and umma_private.connect_role(p_actor, s.location_id, array['manager', 'cashier', 'waiter'])
  );
$$;

revoke execute on function umma_private.connect_call_staff(bigint) from public, anon, authenticated;
grant execute on function umma_private.connect_call_staff(bigint) to service_role;

create or replace function public.cafe_connect_call(
  p_action text, p_device uuid, p_hash text default null, p_actor bigint default null,
  p_client uuid default null, p_call uuid default null, p_mode text default null,
  p_sdp text default null
) returns jsonb language plpgsql security invoker set search_path = pg_catalog, pg_temp as $$
declare
  target uuid;
  call_row umma_private.cafe_connect_calls;
  caller boolean;
  is_staff boolean := p_actor is not null;
begin
  if is_staff then
    if not umma_private.connect_call_staff(p_actor) then raise exception 'Access denied'; end if;
    target := p_client;
  else
    select id into target from umma_private.cafe_connect_clients where token_hash = p_hash;
    if target is null then raise exception 'Access denied'; end if;
  end if;

  if p_action = 'poll' and p_call is null then
    select c.* into call_row from umma_private.cafe_connect_calls c
    where c.expires_at > now() and c.callee_device is null
      and ((is_staff and not c.caller_staff and umma_private.connect_can_read(p_actor, c.client_id))
        or (not is_staff and c.caller_staff and c.client_id = target))
    order by c.expires_at limit 1;
  elsif p_action = 'start' then
    if not exists (select from umma_private.cafe_connect_clients where id = target)
      or (is_staff and not umma_private.connect_can_read(p_actor, target))
      then raise exception 'Access denied'; end if;
    if not public.cafe_web_rate_allow('call:' || target::text || ':' || is_staff::text)
      then raise exception 'Please wait'; end if;
    delete from umma_private.cafe_connect_calls where client_id = target and expires_at <= now();
    insert into umma_private.cafe_connect_calls (id, client_id, staff_actor, mode, caller_staff, caller_device, offer)
      values (p_call, target, p_actor, p_mode, is_staff, p_device, p_sdp)
      on conflict (client_id) do nothing returning * into call_row;
    if not found then return jsonb_build_object('ok', true, 'busy', true); end if;
  else
    select c.* into call_row from umma_private.cafe_connect_calls c
    where c.id = p_call and c.expires_at > now()
      and ((is_staff and (c.staff_actor = p_actor or c.staff_actor is null)
        and umma_private.connect_can_read(p_actor, c.client_id))
        or (not is_staff and c.client_id = target))
    for update;
    if not found then return jsonb_build_object('ok', true, 'call', null); end if;

    caller := is_staff = call_row.caller_staff;
    if p_action = 'answer' then
      if caller or call_row.callee_device is not null
        then return jsonb_build_object('ok', true, 'call', null); end if;
      update umma_private.cafe_connect_calls set
        callee_device = p_device, staff_actor = coalesce(staff_actor, p_actor), answer = p_sdp,
        caller_until = now() + interval '60 seconds', callee_until = now() + interval '60 seconds',
        expires_at = now() + interval '60 seconds'
      where id = p_call returning * into call_row;
    elsif p_action in ('poll', 'end') then
      if (caller and call_row.caller_device <> p_device) or
         (not caller and call_row.callee_device is not null and call_row.callee_device <> p_device)
        then return jsonb_build_object('ok', true, 'call', null); end if;
      if p_action = 'end' then
        delete from umma_private.cafe_connect_calls where id = p_call;
        return jsonb_build_object('ok', true, 'call', null);
      elsif call_row.callee_device is not null then
        update umma_private.cafe_connect_calls set
          caller_until = case when caller then now() + interval '60 seconds' else caller_until end,
          callee_until = case when not caller then now() + interval '60 seconds' else callee_until end,
          expires_at = least(
            case when caller then now() + interval '60 seconds' else caller_until end,
            case when not caller then now() + interval '60 seconds' else callee_until end
          )
        where id = p_call;
      end if;
    else
      raise exception 'Invalid call action';
    end if;
  end if;

  return jsonb_build_object('ok', true, 'call', case when call_row.id is not null then
    jsonb_build_object('id', call_row.id, 'mode', call_row.mode,
      'incoming', is_staff <> call_row.caller_staff,
      'name', case when is_staff then (select name from umma_private.cafe_connect_clients where id = call_row.client_id) end,
      'offer', case when is_staff <> call_row.caller_staff and call_row.callee_device is null then call_row.offer end,
      'answer', case when is_staff = call_row.caller_staff then call_row.answer end)
    end);
end;
$$;

create or replace function public.cafe_connect_staff_call_subscription(
  p_actor bigint, p_session_hash text, p_subscription jsonb
) returns void language plpgsql security invoker set search_path = pg_catalog, pg_temp as $$
begin
  if not exists (
    select from public.cafe_web_sessions s
    join public.cafe_web_accounts a using (actor_id)
    join public.telegram_users u on u.telegram_id = s.actor_id
    where s.token_hash = p_session_hash and s.actor_id = p_actor
      and s.revoked_at is null and s.expires_at > now()
      and a.active and u.is_active and umma_private.connect_call_staff(p_actor)
  ) then raise exception 'Access denied'; end if;

  if p_subscription is null then
    delete from umma_private.cafe_connect_staff_call_push where session_hash = p_session_hash;
  else
    insert into umma_private.cafe_connect_staff_call_push (session_hash, subscription)
    values (p_session_hash, p_subscription)
    on conflict (session_hash) do update set subscription = excluded.subscription, updated_at = now();
  end if;
end;
$$;

create or replace function public.cafe_connect_call_push_targets(p_call uuid, p_device uuid)
returns table (subscription jsonb, language text, staff boolean, mode text, expires_at timestamptz)
language sql stable security invoker set search_path = pg_catalog, pg_temp as $$
  with ringing as (
    select c.* from umma_private.cafe_connect_calls c
    where c.id = p_call and c.caller_device = p_device
      and c.callee_device is null and c.expires_at > now()
  )
  select cl.subscription, cl.language, false, c.mode, c.expires_at
  from ringing c join umma_private.cafe_connect_clients cl on cl.id = c.client_id
  where c.caller_staff and cl.subscription is not null
  union all
  select d.subscription, 'ru', true, c.mode, c.expires_at
  from ringing c
  cross join lateral (
    select distinct on (p.subscription->>'endpoint') p.subscription
    from umma_private.cafe_connect_staff_call_push p
    join public.cafe_web_sessions s on s.token_hash = p.session_hash
    join public.cafe_web_accounts a on a.actor_id = s.actor_id
    join public.telegram_users u on u.telegram_id = s.actor_id
    where s.revoked_at is null and s.expires_at > now() and a.active
      and u.is_active and umma_private.connect_can_read(s.actor_id, c.client_id)
    order by p.subscription->>'endpoint', p.updated_at desc
    limit 20
  ) d
  where not c.caller_staff;
$$;
