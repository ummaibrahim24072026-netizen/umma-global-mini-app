# Kitchen next batches and permanent message access

The guest message button is now a normal control in the sticky menu header beside Search. It has no fixed/floating positioning and keeps unread counts, history, sound and permission controls. On a phone, the menu heading and action row stack so the full message label remains readable.

Work → Kitchen → Dishes and kitchen plan now has two views:

- Ready dishes / revision: the default operation is actual physical count, including already reserved portions. Only filled dishes are changed. A separate add operation handles newly ready food outside a plan.
- Cooking plan: enter the next batch quantity and readiness date/time, explicitly in Nha Trang time (UTC+7). Existing ready food remains saleable. Future food is not added to available quantities or reserved by customers. Reaching the planned time never publishes portions automatically.

Each dish currently has one next batch. Its planned count, absolute readiness time and revision are persisted independently of current inventory and reservations. A late plan is marked as awaiting kitchen confirmation. Staff can edit or cancel a plan. To receive a batch, adjust the actual yield if necessary and choose Batch ready; the server atomically adds the actual quantity and clears that plan. An idempotent operation receipt handles lost responses, while a revision check prevents another employee or a stale screen from receiving the same batch again or overwriting a newer plan.

The same kitchen/manager/owner permissions apply; couriers and cashier-only accounts cannot change plans. New fields inherit inventory RLS; the new RPC is service-only and checks the active actor and cafe assignment. No future batches are exposed as purchasable stock in the public catalogue.

Validation: isolated PostgreSQL/PGlite and the native PostgreSQL CI path exercise planning, preserved ready stock, explicit timezone, future time validation, actual yield, repeat finish, stale edit, cancellation and role boundaries. UI tests cover revision/add, plan entry, +07:00 serialization, existing availability and receipt of actual yield; inbox tests check header placement, unread/read and dialog behavior. Browser previews use synthetic counts. The deployed database check ends in ROLLBACK; no sample batch or physical quantity is retained.
