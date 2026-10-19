-- Islam foundation. Additive only; does not change cafe, market, Quran or Telegram auth.
-- No religious content is seeded. Content writes and reviews are server-only.
begin;
create table public.hadith_collections (
 id text primary key, title text not null, source_url text not null check(source_url ~ '^https://'),
 license_note text not null, created_at timestamptz not null default now()
);
create table public.hadith_records (
 id uuid primary key default gen_random_uuid(), collection_id text not null references public.hadith_collections(id),
 number text not null, book text not null, edition text not null, arabic text not null check(length(arabic)>0),
 narrator text not null, grade text not null, source_url text not null check(source_url ~ '^https://'),
 license_note text not null, commentary text not null default '', categories text[] not null default '{}',
 content_revision integer not null default 1 check(content_revision>0),
 status text not null default 'draft' check(status in ('draft','review','approved','published')),
 created_at timestamptz not null default now(), unique(collection_id,edition,number)
);
create table public.hadith_translations (
 id uuid primary key default gen_random_uuid(), hadith_id uuid not null references public.hadith_records(id),
 language text not null, text text not null, translator text not null, source_url text not null check(source_url ~ '^https://'),
 license_note text not null, unique(hadith_id,language)
);
create table public.hadith_verifications (
 id uuid primary key default gen_random_uuid(), hadith_id uuid not null references public.hadith_records(id),
 scholar text not null, grade text not null, source_url text not null check(source_url ~ '^https://'), note text not null default ''
);
create table public.prayer_lessons (
 id uuid primary key default gen_random_uuid(), slug text not null unique, category text not null,
 title text not null, language text not null default 'ru', introduction text not null default '',
 source_url text not null check(source_url ~ '^https://'), license_note text not null,
 content_revision integer not null default 1 check(content_revision>0),
 status text not null default 'draft' check(status in ('draft','review','approved','published')),
 created_at timestamptz not null default now()
);
create table public.prayer_lesson_steps (
 id uuid primary key default gen_random_uuid(), lesson_id uuid not null references public.prayer_lessons(id),
 position integer not null check(position>0), variant text not null default 'main', title text not null,
 arabic text not null default '', transliteration text not null default '', translation text not null default '',
 movement text not null default '', explanation text not null, unique(lesson_id,variant,position)
);
create table public.lesson_evidences (
 id uuid primary key default gen_random_uuid(), lesson_id uuid not null references public.prayer_lessons(id),
 step_id uuid references public.prayer_lesson_steps(id), hadith_id uuid references public.hadith_records(id),
 quran_surah integer check(quran_surah between 1 and 114), quran_ayah integer check(quran_ayah>0),
 citation text not null, source_url text not null check(source_url ~ '^https://'),
 check(hadith_id is not null or (quran_surah is not null and quran_ayah is not null))
);
create table public.fiqh_topics (
 id uuid primary key default gen_random_uuid(), lesson_id uuid not null references public.prayer_lessons(id), title text not null
);
create table public.fiqh_opinions (
 id uuid primary key default gen_random_uuid(), topic_id uuid not null references public.fiqh_topics(id),
 scholar_or_school text not null, explanation text not null, evidence text not null,
 source_url text not null check(source_url ~ '^https://')
);
create table public.religious_content_reviews (
 id uuid primary key default gen_random_uuid(), content_kind text not null check(content_kind in ('lesson','hadith')),
 content_id uuid not null, content_hash text not null, reviewer text not null check(length(trim(reviewer))>0),
 reviewer_qualification text not null check(length(trim(reviewer_qualification))>0),
 checks jsonb not null, decision text not null check(decision in ('approved','rejected')),
 reviewed_at timestamptz not null default now(), notes text not null default ''
);
create index religious_reviews_content on public.religious_content_reviews(content_kind,content_id,reviewed_at desc);
-- Public clients cannot assert Telegram identity. These future settings use Supabase Auth;
-- a verified server adapter must be added before connecting Telegram accounts.
create table public.prayer_calculation_settings (
 user_id uuid primary key references auth.users(id), method text not null default 'MuslimWorldLeague',
 asr_shadow integer not null default 1 check(asr_shadow in (1,2)), timezone text not null default 'Asia/Ho_Chi_Minh',
 city_id text not null default 'nha', offsets jsonb not null default '{}'
);
create table public.qibla_preferences (
 user_id uuid primary key references auth.users(id), city_id text not null default 'nha'
);
create table public.prayer_notification_preferences (
 user_id uuid primary key references auth.users(id), consent_at timestamptz,
 enabled boolean not null default false, prayers text[] not null default array['fajr','dhuhr','asr','maghrib','isha'],
 before_minutes integer not null default 0 check(before_minutes between 0 and 120),
 silent boolean not null default false, check(not enabled or consent_at is not null)
);
create table public.user_bookmarks (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id),
 hadith_id uuid references public.hadith_records(id), lesson_id uuid references public.prayer_lessons(id),
 check((hadith_id is not null)::integer+(lesson_id is not null)::integer=1), created_at timestamptz not null default now()
);
create index islam_bookmarks_owner on public.user_bookmarks(user_id);
-- Pure fingerprint function. Reviews apply to the exact revision, not only to an ID.
create function public.islam_content_hash(record jsonb) returns text
language sql immutable strict security invoker set search_path='' as $$
 select encode(sha256(convert_to((record-'status')::text,'UTF8')),'hex')
$$;
create function public.islam_publication_gate() returns trigger
language plpgsql security invoker set search_path='' as $$
declare kind text; required_checks jsonb;
begin
 kind:=case when TG_TABLE_NAME='prayer_lessons' then 'lesson' else 'hadith' end;
 required_checks:='{"sources":true,"arabic":true,"translation":true,"authenticity_context":true,"explanation":true,"differences":true,"final":true}'::jsonb;
 if NEW.status in ('approved','published') then
  if not exists(select 1 from public.religious_content_reviews r where r.content_kind=kind and r.content_id=NEW.id
    and r.content_hash=public.islam_content_hash(to_jsonb(NEW)) and r.decision='approved' and r.checks @> required_checks
    and r.reviewed_at<=now()) then raise exception 'Exact revision requires a qualified seven-check approval';end if;
  if kind='lesson' and (not exists(select 1 from public.prayer_lesson_steps s where s.lesson_id=NEW.id)
   or exists(select 1 from public.prayer_lesson_steps s where s.lesson_id=NEW.id and not exists(
     select 1 from public.lesson_evidences e where e.lesson_id=NEW.id and e.step_id=s.id))) then
    raise exception 'Each lesson step requires evidence';end if;
  if kind='lesson' and exists(select 1 from public.lesson_evidences e join public.hadith_records h on h.id=e.hadith_id where e.lesson_id=NEW.id and h.status<>'published') then raise exception 'Referenced hadith must be published';end if;
  if kind='hadith' and not exists(select 1 from public.hadith_translations t where t.hadith_id=NEW.id and t.language='ru') then
    raise exception 'Hadith requires a reviewed Russian translation';end if;
 end if;
 return NEW;
end $$;
create trigger islam_lesson_gate before insert or update on public.prayer_lessons for each row execute function public.islam_publication_gate();
create trigger islam_hadith_gate before insert or update on public.hadith_records for each row execute function public.islam_publication_gate();
-- Child edits increment the reviewed revision; approved/published parents must be
-- explicitly returned to draft first. Reparenting children is prohibited.
create function public.islam_child_revision() returns trigger
language plpgsql security invoker set search_path='' as $$
declare parent_id uuid; parent_status text; parent_table text; topic uuid;
begin
 if TG_OP='UPDATE' and ((TG_ARGV[0]='lesson' and to_jsonb(OLD)->>'lesson_id' is distinct from to_jsonb(NEW)->>'lesson_id')
   or (TG_ARGV[0]='hadith' and to_jsonb(OLD)->>'hadith_id' is distinct from to_jsonb(NEW)->>'hadith_id')
   or (TG_ARGV[0]='opinion' and to_jsonb(OLD)->>'topic_id' is distinct from to_jsonb(NEW)->>'topic_id')) then raise exception 'Reparenting prohibited';end if;
 if TG_ARGV[0]='opinion' then
  topic:=coalesce(to_jsonb(NEW)->>'topic_id',to_jsonb(OLD)->>'topic_id')::uuid;
  select lesson_id into parent_id from public.fiqh_topics where id=topic;parent_table:='prayer_lessons';
 else
  parent_table:=case when TG_ARGV[0]='hadith' then 'hadith_records' else 'prayer_lessons' end;
  parent_id:=coalesce(to_jsonb(NEW)->>(case when TG_ARGV[0]='hadith' then 'hadith_id' else 'lesson_id' end),to_jsonb(OLD)->>(case when TG_ARGV[0]='hadith' then 'hadith_id' else 'lesson_id' end))::uuid;
 end if;
 execute format('select status from public.%I where id=$1 for update',parent_table) into parent_status using parent_id;
 if parent_status is distinct from 'draft' then raise exception 'Return parent content to draft before editing children';end if;
 execute format('update public.%I set content_revision=content_revision+1 where id=$1',parent_table) using parent_id;
 if TG_TABLE_NAME='lesson_evidences' and TG_OP<>'DELETE' then
  if NEW.step_id is not null and not exists(select 1 from public.prayer_lesson_steps s where s.id=NEW.step_id and s.lesson_id=NEW.lesson_id) then raise exception 'Evidence step must belong to lesson';end if;
 end if;
 return coalesce(NEW,OLD);
end $$;
create trigger islam_translation_revision before insert or update or delete on public.hadith_translations for each row execute function public.islam_child_revision('hadith');
create trigger islam_verification_revision before insert or update or delete on public.hadith_verifications for each row execute function public.islam_child_revision('hadith');
create trigger islam_step_revision before insert or update or delete on public.prayer_lesson_steps for each row execute function public.islam_child_revision('lesson');
create trigger islam_evidence_revision before insert or update or delete on public.lesson_evidences for each row execute function public.islam_child_revision('lesson');
create trigger islam_topic_revision before insert or update or delete on public.fiqh_topics for each row execute function public.islam_child_revision('lesson');
create trigger islam_opinion_revision before insert or update or delete on public.fiqh_opinions for each row execute function public.islam_child_revision('opinion');
-- Explicit grants, no browser writes to religious content or approvals.
do $$ declare t text;begin
 foreach t in array array['hadith_collections','hadith_records','hadith_translations','hadith_verifications','prayer_lessons','prayer_lesson_steps','lesson_evidences','fiqh_topics','fiqh_opinions','religious_content_reviews','prayer_calculation_settings','qibla_preferences','prayer_notification_preferences','user_bookmarks'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from anon,authenticated',t);
  execute format('grant all on public.%I to service_role',t);
 end loop;
 foreach t in array array['hadith_collections','hadith_records','hadith_translations','hadith_verifications','prayer_lessons','prayer_lesson_steps','lesson_evidences','fiqh_topics','fiqh_opinions'] loop
  execute format('grant select on public.%I to anon,authenticated',t);
 end loop;
 foreach t in array array['prayer_calculation_settings','qibla_preferences','prayer_notification_preferences','user_bookmarks'] loop
  execute format('grant select,insert,update,delete on public.%I to authenticated',t);
  execute format('create policy islam_owner on public.%I for all to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id)',t);
 end loop;
end $$;
create policy islam_public_hadith on public.hadith_records for select to anon,authenticated using(status='published');
create policy islam_public_collection on public.hadith_collections for select to anon,authenticated using(exists(select 1 from public.hadith_records h where h.collection_id=hadith_collections.id and h.status='published'));
create policy islam_public_translation on public.hadith_translations for select to anon,authenticated using(exists(select 1 from public.hadith_records h where h.id=hadith_id and h.status='published'));
create policy islam_public_verification on public.hadith_verifications for select to anon,authenticated using(exists(select 1 from public.hadith_records h where h.id=hadith_id and h.status='published'));
create policy islam_public_lesson on public.prayer_lessons for select to anon,authenticated using(status='published');
create policy islam_public_step on public.prayer_lesson_steps for select to anon,authenticated using(exists(select 1 from public.prayer_lessons l where l.id=lesson_id and l.status='published'));
create policy islam_public_evidence on public.lesson_evidences for select to anon,authenticated using(exists(select 1 from public.prayer_lessons l where l.id=lesson_id and l.status='published'));
create policy islam_public_topic on public.fiqh_topics for select to anon,authenticated using(exists(select 1 from public.prayer_lessons l where l.id=lesson_id and l.status='published'));
create policy islam_public_opinion on public.fiqh_opinions for select to anon,authenticated using(exists(select 1 from public.fiqh_topics t where t.id=topic_id));
-- Trigger functions are never RPC endpoints.
revoke all on function public.islam_publication_gate(),public.islam_child_revision() from public,anon,authenticated;
commit;
