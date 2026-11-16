create table umma_private.cafe_connect_calls (
  id uuid primary key,
  client_id uuid not null unique references umma_private.cafe_connect_clients(id) on delete cascade,
  staff_actor bigint,
  mode text not null check (mode in ('audio', 'video')),
  caller_staff boolean not null,
  caller_device uuid not null,
  callee_device uuid,
  offer text not null check (length(offer) between 1 and 48000),
  answer text check (length(answer) between 1 and 48000),
  caller_until timestamptz not null default now() + interval '45 seconds',
  callee_until timestamptz not null default now() + interval '45 seconds',
  expires_at timestamptz not null default now() + interval '45 seconds',
  check (not caller_staff or staff_actor is not null)
);
create index cafe_connect_calls_expiry on umma_private.cafe_connect_calls (expires_at);
alter table umma_private.cafe_connect_calls enable row level security;
revoke all on umma_private.cafe_connect_calls from public, anon, authenticated;
grant select, insert, update, delete on umma_private.cafe_connect_calls to service_role;
grant select (id, name, token_hash) on umma_private.cafe_connect_clients to service_role;

create function public.cafe_connect_call(
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
    if not exists (
      select 1 from public.telegram_users where telegram_id = p_actor and is_active and role = 'super_admin'
    ) then raise exception 'Access denied'; end if;
    target := p_client;
  else
    select id into target from umma_private.cafe_connect_clients where token_hash = p_hash;
    if target is null then raise exception 'Access denied'; end if;
  end if;

  if p_action = 'poll' and p_call is null then
    select c.* into call_row from umma_private.cafe_connect_calls c
    where c.expires_at > now() and c.callee_device is null
      and ((is_staff and not c.caller_staff) or (not is_staff and c.caller_staff and c.client_id = target))
    order by c.expires_at limit 1;
  elsif p_action = 'start' then
    if not exists (select from umma_private.cafe_connect_clients where id = target)
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
      and ((is_staff and (c.staff_actor = p_actor or c.staff_actor is null)) or (not is_staff and c.client_id = target))
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

revoke execute on function public.cafe_connect_call(text, uuid, text, bigint, uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.cafe_connect_call(text, uuid, text, bigint, uuid, uuid, text, text) to service_role;

select cron.schedule('cafe-connect-calls-expiry', '*/5 * * * *',
  $$delete from umma_private.cafe_connect_calls where expires_at <= now()$$);
