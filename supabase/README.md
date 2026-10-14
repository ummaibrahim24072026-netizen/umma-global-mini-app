# Cafe QA proposals

These files are **not deployed**. There is no automatic Supabase deployment in this repository.

`proposals/` contains reviewable SQL to apply to an isolated staging database first:

1. `cafe-lifecycle-hardening.sql`: payment terminal-state guards, authorized payment reversal with a reason, payment retry safety, paid cancellation guard, ready → preparing for a new add-on, required cafe routing, and foreign-shift access guards.
2. `cafe-order-idempotency.sql`: private operation ledger and a service-only atomic order/add-on RPC with per-actor operation keys and transaction-scoped locking.
3. `cafe-cash-summary.sql`: complete 24-hour receipt totals, independent of the 100-row UI history limit.

`functions/create-cafe-order` was exported from deployed version 6 and `functions/cafe-kitchen` from version 28, then patched locally. Include the `_shared` imports when deploying to staging. Preserve each function's deployed `verify_jwt=false`: these endpoints verify Telegram HMAC themselves. No production bot token or service-role key is committed. Use a separate test bot/fixtures in staging; never send staging notifications through the production bot.

The new frontend requires these staged SQL proposals and Edge Functions together. Old clients without `requestKey` will be rejected by the new order endpoints; new clients against old endpoints do not receive server-side idempotency. Do not deploy only one part. Test the coordinated rollout and rollback before requesting production approval.

Run `npm ci --ignore-scripts && npm test` with Node 22.18+ or Node 24. Tests create a PostgreSQL engine in memory, import `tests/fixtures/supabase-public-schema.sql`, seed synthetic rows and apply the proposals. The schema fixture contains structural DDL only; it is not a production backup and does not reproduce all Supabase grants/RLS settings.

PGlite serializes queries. Parallel queued calls validate repeated-operation results but do **not** verify transaction interleavings across separate PostgreSQL connections. Staging must test two independent sessions against the same numbered table, overlapping payment/add-on requests, disconnections after commit, and receipt/event consistency.

Never apply the offline schema fixture to an existing remote project. Production SQL changes, publication, financial data changes and inventory activation require explicit owner approval.

Delivery release also requires proposals/cafe-delivery-hardening.sql before the updated cafe-kitchen handler, which calls assign_cafe_courier. QA-only application does not update public RPCs.

Full refunds require cafe-refunds.sql after the other proposals. Use the atomic supabase/release/cafe-launch.sql bundle and docs/CAFE_RELEASE_PLAN.md. Do not restore legacy cash summaries after any refund has been recorded. Maintenance handlers are prepared but not deployed.
