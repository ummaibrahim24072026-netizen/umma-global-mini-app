create table umma_private.cafe_connect_staff_call_push (
  session_hash text primary key references public.cafe_web_sessions(token_hash) on delete cascade,
  subscription jsonb not null,
  updated_at timestamptz not null default now()
);
alter table umma_private.cafe_connect_staff_call_push enable row level security;
revoke all on umma_private.cafe_connect_staff_call_push from public, anon, authenticated;
grant select, insert, update, delete on umma_private.cafe_connect_staff_call_push to service_role;
grant select (language, subscription) on umma_private.cafe_connect_clients to service_role;

create function public.cafe_connect_staff_call_subscription(
  p_actor bigint, p_session_hash text, p_subscription jsonb
) returns void language plpgsql security invoker set search_path = pg_catalog, pg_temp as $$
begin
  if not exists (
    select from public.cafe_web_sessions s
    join public.cafe_web_accounts a using (actor_id)
    join public.telegram_users u on u.telegram_id = s.actor_id
    where s.token_hash = p_session_hash and s.actor_id = p_actor
      and s.revoked_at is null and s.expires_at > now()
      and a.active and u.is_active and u.role = 'super_admin'
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

create function public.cafe_connect_call_push_targets(p_call uuid, p_device uuid)
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
      and u.is_active and u.role = 'super_admin'
    order by p.subscription->>'endpoint', p.updated_at desc
    limit 20
  ) d
  where not c.caller_staff;
$$;

revoke execute on function public.cafe_connect_staff_call_subscription(bigint, text, jsonb),
  public.cafe_connect_call_push_targets(uuid, uuid) from public, anon, authenticated;
grant execute on function public.cafe_connect_staff_call_subscription(bigint, text, jsonb),
  public.cafe_connect_call_push_targets(uuid, uuid) to service_role;
