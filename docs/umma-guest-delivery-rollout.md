# UMMA Guest Delivery rollout

Implemented in Supabase project zwzojugspldexyyljwpr:
- `umma_submit_guest_delivery` SQL function: server-only service-role execution, idempotent order creation, product pricing from database, existing courier offer pipeline.
- `umma_guest_checkout_allow` rate limiter: 5 attempts/hour per hashed edge IP (operational limitation if IP header is missing).
- `umma-guest-checkout` public Edge Function: validated guest delivery checkout, returns order number and private tracking token.
- `umma-guest-delivery` public Edge Function: order-scoped, time-limited tracking token with fresh GPS only.
- `umma_guest_delivery_grants`: SHA-256 token hashes, expiry, revocation.

Frontend:
- `public-menu.html`: guest delivery checkout, automatic private tracking link in receipt.
- `delivery-tracking.html`: status and map polling without Telegram.
- Both files are in draft PR #108 and **not published to GitHub Pages until reviewed/merged**.

Current limitations / launch gates:
1. No real order was created in production to avoid accidental kitchen tickets. The SQL functions and Edge Functions have not passed end-to-end live checkout tests.
2. No real device GPS tracking test; run acceptance plan.
3. Delivery fee and geographic delivery eligibility are not calculated/enforced; the page says the cafe will confirm the fee. Review before taking live orders.
4. Payment is cash on delivery only. QR payment confirmation and Web Push are not integrated.
5. Rate limiting uses CF-Connecting-IP where available; confirm proxy headers in deployed environment and add abuse protection.
6. Review inventory reservation and status transitions; guest checkout currently uses base product price and does not reserve stock.
7. Check actual order event constraints and operational notifications in staging before publishing.
8. Draft PR must be reviewed and merged before GitHub Pages link becomes available.
