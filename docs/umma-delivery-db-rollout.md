# UMMA Delivery database rollout

Applied to Supabase project `zwzojugspldexyyljwpr`:

```sql
alter table public.locations
  add column if not exists shared_dispatch_enabled boolean not null default false;
```

Verified: zero locations have opted in. This flag alone does not enable cross-cafe dispatch; server-side authenticated authorization and explicit partner courier opt-in are still required. Existing delivery tracking and courier dispatch Edge Functions remain unchanged. Never treat client-side policy helpers as authorization.
