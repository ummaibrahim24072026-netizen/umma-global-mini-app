# Supabase Data API grants — October 30, 2026

## Rule for all future SQL migrations

New tables in exposed schemas (such as `public`) must explicitly receive only the Data API privileges they need. PostgreSQL `GRANT` and RLS policies are independent requirements.

### Server-only table example
```sql
create table public.example_internal (
  id bigint generated always as identity primary key
);
alter table public.example_internal enable row level security;
-- No grants to anon or authenticated. Access only through trusted server code.
```

### Client-readable public catalog example (adapt before use)
```sql
create table public.example_catalog (
  id bigint generated always as identity primary key,
  title text not null
);
alter table public.example_catalog enable row level security;
grant select on table public.example_catalog to anon, authenticated;
create policy "Read catalog"
  on public.example_catalog for select
  to anon, authenticated
  using (true);
```

### Client-owned private rows example (adapt before use)
```sql
create table public.example_private_items (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id),
  note text not null
);
alter table public.example_private_items enable row level security;
grant select, insert, update on table public.example_private_items to authenticated;
create policy "Read own items" on public.example_private_items
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Insert own items" on public.example_private_items
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Update own items" on public.example_private_items
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
```

These are templates, not production migrations. Replace names and review actual app flows, role ownership, and sequence privileges before deployment. Never place the service-role key in browser or Telegram Mini App code.

## Deployment checklist
1. Identify each new table and whether access is direct from `supabase-js` or server-only.
2. Enable RLS before any client grant.
3. Add explicit minimal GRANT statements and matching RLS policies in the same migration.
4. Avoid `GRANT ALL`, unrestricted write policies, and blanket default privileges.
5. Test reads/writes as `anon` and `authenticated`, including denied cross-user access.
6. Run Supabase security advisors and smoke-test Cafe, Market, courier and rental workflows.
7. Roll out only after verification.

## Audit snapshot — 2026-10-25
- Supabase project: Umma Global
- 99 public tables; 99 RLS enabled; 85 without RLS policies.
- 25 public tables grant SELECT to anon; 29 grant SELECT to authenticated. These counts alone do not establish accessible rows.
- No production database permissions changed in this preparation.
- Review actual migrations and Data API settings before claiming end-to-end compatibility.

Official documentation: https://supabase.com/docs/guides/api/securing-your-api
