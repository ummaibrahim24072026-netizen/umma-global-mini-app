# Guest delivery release — 2026-11-03

The existing `/menu/` checkout now supports pickup, tables and delivery using one cart. Delivery requires an address and an explicitly selected in-zone map/GPS point. Name and phone are not required. Cash and the existing server-generated VietQR are supported. The cafe confirms the delivery fee before dispatch; the displayed QR pays for food.

`cafe-guest-order` uses the service-role-only `submit_cafe_guest_delivery_v4` RPC. Prices, inventory reservation, zone enforcement, order, events, dispatch offers and tracking grant commit together. A request-key HMAC supplies a stable 48-hour tracking token after creation, including replay after a lost response. The client stores the pending request before sending and restores it after reload. Pickup keeps the existing v3 RPC.

`delivery-tracking.html` uses token-scoped `umma-guest-delivery`. Terminal order status overrides delivery status. Old, missing and terminal GPS positions are not displayed. A network error clears the previous marker. Browsers without Notification support remain usable. Notifications apply to an open page; Web Push while the app is closed is not implemented.

Verification:
- Existing full npm suite passed before integration; final release suite is recorded in the GitHub check.
- `qa-public-menu-delivery.mjs`: cash/QR, optional identity, explicit GPS, missing/outside point, lost response/replay, private link, server handler and tracking map cleanup.
- `qa-public-delivery.sql`: production SQL/triggers tested in a transaction with rollback, for cash/QR, matching totals, kitchen items, one tracking grant, idempotency, receipt scope and denied public RPC access. No test kitchen ticket is committed.
- Actual courier/client phones and a real bank transfer require physical-device acceptance. Automated tests do not claim those checks.

Production: https://ummaibrahim24072026-netizen.github.io/umma-global-mini-app/menu/
