create table public.cafe_web_device_codes (
  source_hash text primary key references public.cafe_web_sessions(token_hash) on delete cascade,
  code_hash text unique not null,
  expires_at timestamptz not null
);

create index cafe_web_device_codes_expiry_idx on public.cafe_web_device_codes(expires_at);
alter table public.cafe_web_device_codes enable row level security;
revoke all on public.cafe_web_device_codes from public, anon, authenticated;
grant select, insert, update, delete on public.cafe_web_device_codes to service_role;

create function public.cafe_web_device_source(p_source_hash text)
returns setof public.cafe_web_sessions
language sql
stable
set search_path = ''
as $$
  select s.*
  from public.cafe_web_sessions s
  join public.cafe_web_accounts a on a.actor_id = s.actor_id and a.active
  join public.telegram_users u on u.telegram_id = s.actor_id and u.is_active
  where s.token_hash = p_source_hash
    and s.revoked_at is null and s.expires_at > statement_timestamp()
    and (
      u.role = 'super_admin'
      or (u.role in ('employee', 'admin') and exists (
        select 1 from public.cafe_staff f
        join public.locations l on l.id = f.location_id and l.is_active and l.location_type = 'cafe'
        where f.telegram_id = u.telegram_id and f.is_active
      ))
    );
$$;

create function public.cafe_web_issue_device_code(p_source_hash text, p_code_hash text)
returns boolean
language plpgsql
set search_path = ''
as $$
begin
  if not exists (select 1 from public.cafe_web_device_source(p_source_hash)) then
    return false;
  end if;

  delete from public.cafe_web_device_codes where expires_at <= statement_timestamp();
  insert into public.cafe_web_device_codes (source_hash, code_hash, expires_at)
    values (p_source_hash, p_code_hash, clock_timestamp() + interval '60 seconds')
    on conflict (source_hash) do update
      set code_hash = excluded.code_hash, expires_at = excluded.expires_at;
  return true;
end;
$$;

create function public.cafe_web_redeem_device_code(p_code_hash text, p_session_hash text)
returns boolean
language plpgsql
set search_path = ''
as $$
declare
  source text;
begin
  delete from public.cafe_web_device_codes
    where code_hash = p_code_hash and expires_at > clock_timestamp()
    returning source_hash into source;
  if not found then
    return false;
  end if;

  insert into public.cafe_web_sessions (token_hash, actor_id, expires_at)
    select p_session_hash, s.actor_id, least(s.expires_at, clock_timestamp() + interval '12 hours')
    from public.cafe_web_device_source(source) s;
  return found;
end;
$$;

revoke all on function public.cafe_web_device_source(text), public.cafe_web_issue_device_code(text, text),
  public.cafe_web_redeem_device_code(text, text) from public, anon, authenticated;
grant execute on function public.cafe_web_device_source(text), public.cafe_web_issue_device_code(text, text),
  public.cafe_web_redeem_device_code(text, text) to service_role;
