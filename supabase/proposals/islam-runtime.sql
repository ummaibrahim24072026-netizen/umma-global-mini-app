-- Verified Telegram gateway, editorial assignments and opt-in reminder queue.
begin;
create schema if not exists umma_islam_internal;
revoke all on schema umma_islam_internal from public,anon,authenticated;
create table public.islam_telegram_preferences (
 telegram_id bigint primary key check(telegram_id>0), config jsonb not null default '{}',
 enabled boolean not null default false, consent_at timestamptz,
 language text not null default 'ru' check(language in ('ru','en','vi')),
 before_minutes integer not null default 10 check(before_minutes between 0 and 120),
 at_time boolean not null default true, prayers text[] not null default array['fajr','dhuhr','asr','maghrib','isha'],
 silent boolean not null default false, version integer not null default 1,
 updated_at timestamptz not null default now(), last_error text,
 check(not enabled or consent_at is not null),check(prayers <@ array['fajr','dhuhr','asr','maghrib','isha'])
);
create table public.islam_telegram_bookmarks (
 telegram_id bigint not null, kind text not null check(kind in ('lesson','hadith')), content_id uuid not null,
 created_at timestamptz not null default now(), primary key(telegram_id,kind,content_id)
);
create table public.islam_content_editors (
 telegram_id bigint primary key, can_edit boolean not null default false, can_review boolean not null default false,
 name text not null, qualification text, identity_source_url text,
 is_active boolean not null default true,
 check(not can_review or (length(trim(qualification))>0 and identity_source_url ~ '^https://'))
);
create table public.islam_notification_jobs (
 id uuid primary key default gen_random_uuid(), telegram_id bigint not null references public.islam_telegram_preferences(telegram_id),
 local_date date not null, prayer text not null check(prayer in ('fajr','dhuhr','asr','maghrib','isha')),
 kind text not null check(kind in ('before','at_time')), due_at timestamptz not null, prayer_at timestamptz not null,
 config_version integer not null, status text not null default 'pending' check(status in ('pending','sending','retry','sent','cancelled','failed','uncertain')),
 lease_id uuid, lease_until timestamptz, attempts integer not null default 0, last_error text, sent_at timestamptz,
 unique(telegram_id,local_date,prayer,kind,config_version)
);
create index islam_jobs_due on public.islam_notification_jobs(due_at) where status in ('pending','retry');
create index islam_jobs_owner on public.islam_notification_jobs(telegram_id,config_version);
create table umma_islam_internal.worker_control (id boolean primary key default true check(id),secret bytea not null default extensions.gen_random_bytes(32));
insert into umma_islam_internal.worker_control(id) values(true);
create table umma_islam_internal.worker_nonces (nonce uuid primary key,expires_at timestamptz not null);
alter table umma_islam_internal.worker_control enable row level security;
alter table umma_islam_internal.worker_nonces enable row level security;
alter table public.hadith_records add column editor_telegram_id bigint;
alter table public.prayer_lessons add column editor_telegram_id bigint;
alter table public.religious_content_reviews add column reviewer_telegram_id bigint;
-- Adding these NULL fields changes fingerprints: no content existed when this migration was prepared.
do $$ declare t text;begin
 foreach t in array array['islam_telegram_preferences','islam_telegram_bookmarks','islam_content_editors','islam_notification_jobs'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated',t);
  execute format('grant all on public.%I to service_role',t);
 end loop;
end $$;
create function public.islam_save_preferences(p_actor bigint,p_config jsonb,p_options jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare item public.islam_telegram_preferences; enabled_value boolean; chosen text[];
begin
 if p_actor<=0 then raise exception 'Invalid actor';end if;
 perform pg_advisory_xact_lock(p_actor);
 enabled_value:=coalesce((p_options->>'enabled')::boolean,false);
 select array_agg(x) into chosen from jsonb_array_elements_text(coalesce(p_options->'prayers','["fajr","dhuhr","asr","maghrib","isha"]')) x;
 chosen:=coalesce(chosen,'{}');
 if not chosen <@ array['fajr','dhuhr','asr','maghrib','isha'] then raise exception 'Invalid prayer';end if;
 if enabled_value and (p_options->>'consent') is distinct from 'true' then raise exception 'Consent required';end if;
 if enabled_value and (not exists(select 1 from pg_timezone_names where name=p_config->>'zone')
  or coalesce(p_config->>'method','') not in ('MuslimWorldLeague','Karachi','Egyptian','NorthAmerica','Singapore')
  or coalesce((p_config->>'asr')::integer,0) not in (1,2)
  or p_config->>'lat' is null or p_config->>'lon' is null
  or abs((p_config->>'lat')::numeric)>90 or abs((p_config->>'lon')::numeric)>180) then raise exception 'Invalid calculation settings';end if;
 if enabled_value and cardinality(chosen)=0 then raise exception 'Choose at least one prayer';end if;
 insert into public.islam_telegram_preferences(telegram_id,config,enabled,consent_at,language,before_minutes,at_time,prayers,silent)
 values(p_actor,case when enabled_value then p_config else '{}' end,enabled_value,case when enabled_value then now() end,
 coalesce(p_options->>'language','ru'),coalesce((p_options->>'before_minutes')::integer,10),coalesce((p_options->>'at_time')::boolean,true),chosen,coalesce((p_options->>'silent')::boolean,false))
 on conflict(telegram_id) do update set config=excluded.config,enabled=excluded.enabled,consent_at=excluded.consent_at,language=excluded.language,
 before_minutes=excluded.before_minutes,at_time=excluded.at_time,prayers=excluded.prayers,silent=excluded.silent,
 version=islam_telegram_preferences.version+1,updated_at=now(),last_error=null returning * into item;
 update public.islam_notification_jobs set status='cancelled',lease_id=null,lease_until=null where telegram_id=p_actor and status in ('pending','retry','sending');
 return to_jsonb(item);
end $$;
create function public.islam_claim_notifications() returns setof public.islam_notification_jobs
language plpgsql security invoker set search_path='' as $$
begin
 -- Telegram offers no sendMessage idempotency key. A stale in-flight delivery is
 -- uncertain, never blindly retried; this prevents duplicate prayer reminders.
 update public.islam_notification_jobs set status='uncertain',last_error='Delivery lease expired; result unknown' where status='sending' and lease_until<now();
 update public.islam_notification_jobs set status='cancelled' where status in ('pending','retry') and due_at<now()-interval '10 minutes';
 return query with due as (
  select j.id from public.islam_notification_jobs j join public.islam_telegram_preferences p on p.telegram_id=j.telegram_id
  where j.status in ('pending','retry') and j.due_at<=now() and j.due_at>=now()-interval '10 minutes' and p.enabled and p.consent_at is not null
   and p.version=j.config_version order by j.due_at for update of j skip locked limit 40
 ) update public.islam_notification_jobs j set status='sending',lease_id=gen_random_uuid(),lease_until=now()+interval '2 minutes',attempts=attempts+1 from due where j.id=due.id returning j.*;
end $$;
create function umma_islam_internal.issue_worker_token() returns text
language plpgsql security definer set search_path='' as $$
declare message text;key bytea;begin
 message:=(floor(extract(epoch from clock_timestamp()))::bigint+90)::text||'.'||gen_random_uuid()::text;
 select secret into key from umma_islam_internal.worker_control where id=true;
 return message||'.'||encode(extensions.hmac(convert_to(message,'UTF8'),key,'sha256'),'hex');
end $$;
create function public.islam_authorize_worker(p_token text) returns boolean
language plpgsql security definer set search_path='' as $$
declare parts text[];key bytea;expiry timestamptz;begin
 if p_token !~ '^[0-9]{10,12}\.[a-f0-9-]{36}\.[a-f0-9]{64}$' then return false;end if;
 parts:=string_to_array(p_token,'.');expiry:=to_timestamp(parts[1]::bigint);
 if expiry<now() or expiry>now()+interval '2 minutes' then return false;end if;
 select secret into key from umma_islam_internal.worker_control where id=true;
 if encode(extensions.hmac(convert_to(parts[1]||'.'||parts[2],'UTF8'),key,'sha256'),'hex')<>parts[3] then return false;end if;
 delete from umma_islam_internal.worker_nonces where expires_at<now();
 insert into umma_islam_internal.worker_nonces values(parts[2]::uuid,expiry) on conflict do nothing;
 return found;
exception when invalid_text_representation or numeric_value_out_of_range then return false;
end $$;
-- Withdrawal of a source returns dependent lessons to draft as well.
create function public.islam_withdraw_dependents() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if OLD.status='published' and NEW.status<>'published' then
  update public.prayer_lessons set status='draft' where id in(select lesson_id from public.lesson_evidences where hadith_id=NEW.id) and status in ('approved','published');
 end if;return NEW;
end $$;
create trigger islam_withdraw_source after update of status on public.hadith_records for each row execute function public.islam_withdraw_dependents();
revoke all on function public.islam_save_preferences(bigint,jsonb,jsonb),public.islam_claim_notifications(),public.islam_authorize_worker(text),public.islam_withdraw_dependents() from public,anon,authenticated;
grant execute on function public.islam_save_preferences(bigint,jsonb,jsonb),public.islam_claim_notifications(),public.islam_authorize_worker(text) to service_role;
revoke all on function umma_islam_internal.issue_worker_token() from public,anon,authenticated,service_role;
commit;
