# Isolated multi-session test proposal

Owner approved isolated test schemas on 2026-10-13. Setup was executed against Supabase; production application objects were not changed.

Target project: `zwzojugspldexyyljwpr`. New, closed schemas: `umma_qa_20261013` and `umma_qa_20261013_private`.

`node scripts/qa/build-isolated-schema.mjs` produces `supabase/proposals/qa-isolated-setup.sql` from the read-only structural fixture and reviewed proposals. It aborts if either QA schema already exists, never drops or overwrites an existing schema, imports no production rows and creates synthetic users/locations/menu/order fixtures only. All references are redirected to QA schemas. RLS is enabled and schema/table/function privileges are denied to PUBLIC, anon, authenticated and service_role. Only the authorized management SQL connection runs these tests.

Owner approval was obtained before adding these objects to the existing project. This does not deploy app code or change public tables, existing payments, staff rights, inventory settings or the production bot.

After approval, execute the setup atomically and inspect privileges. For every entry in `multi-session-cases.mjs`, issue A without awaiting completion, verify `probe` is true while A holds its transaction-scoped lock, then issue B through a separate management call. Await both. A holds its QA transaction for 3 seconds; the test suite uses only QA rows. Fetch `snapshotQuery`, run `verify(snapshot)`, and require different backend PIDs and overlapping timestamps. A sequential or non-overlapping run is a failure, not proof of concurrency.

Cases: replayed create request, two employees opening one table, replayed add-on, two cashiers confirming one payment, add-on before stale payment, payment before add-on, and two employees accepting one order.

Do not automatically retry failed workers with new keys or reset the schema. Inspect failures before rerunning. Cleanup must target these explicitly disposable QA schemas only and must not touch public objects.

## Observed execution

The management connector serialized attempted parallel calls. Different backend PIDs did not have overlapping timestamps. Remote sequential lifecycle/replay cases behaved as expected, but concurrency remains unverified. Do not report the multi-session suite as passed. The temporary dblink helper required connection credentials and was removed without changing authentication privileges. QA schemas remain closed to anon, authenticated and service_role.
