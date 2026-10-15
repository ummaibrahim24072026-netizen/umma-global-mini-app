# Courier work desk

Three views: available deliveries, current delivery, history. Shift presence is separate from cafe role/capability and from customer-visible delivery tracking. Going offline stops new assignments and dispatch GPS; it does not abandon an accepted delivery or stop its customer tracking.

New customer and staff orders prefer the nearest idle courier with an online heartbeat no older than two minutes and GPS no older than 90 seconds. Distances shown are straight-line estimates to the pickup cafe. A personal offer is reserved for 60 seconds. A decline or expiry opens it to the shared pool. Missing/stale GPS also falls back to the pool. Manual manager offers stay reserved.

Only active couriers for that cafe may see or claim its deliveries. Offer cards omit customer names and phone numbers. Customer cash collection is labeled separately from the delivery fee; no earnings estimates are invented. Ready orders lead the available list. One unfinished delivery per courier is enforced by a locked presence row; an order row lock gives competing couriers only one winner.

Heartbeat and dispatch GPS run while the mini app is open and online. They are private dispatch data, independent from the GPS session started by a pickup photo. The platform may suspend updates when Telegram is backgrounded. Existing paused Telegram courier-notification dispatch is unchanged; in-app offers advance through the authenticated courier board.

Deployment requires `supabase/proposals/courier-dispatch-desk.sql`, the `cafe-kitchen` and `create-cafe-order` Edge Functions, and the new frontend assets. The SQL grants RPC execution only to `service_role`. No existing courier is silently switched online.

Tests cover nearest reservation, expiry/pool, stale GPS, offline, scope, one active delivery, duplicate claims, current photo/cash workflow and UI tabs. Native PostgreSQL CI observes lock waits for two couriers claiming one order and one courier claiming two orders.

Patterns reviewed: [Uber Trip Radar and Exclusive Requests](https://www.uber.com/us/en/blog/trip-radar/) and [DoorDash offer details](https://help.doordash.com/en-au/dashers/article/redesigned-accept-modal). UMMA uses its own matching rules described above.
