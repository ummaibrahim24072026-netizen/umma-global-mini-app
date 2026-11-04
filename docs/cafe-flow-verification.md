# Cafe workflow verification — 2026-11-04

Verified against frontend fixtures, isolated PostgreSQL (PGlite), and the deployed database using transactions that end in ROLLBACK. No synthetic orders, receipts, staff assignments, subscriptions or outbound notification jobs were retained by the live transaction checks. Database sequences may have harmless gaps.

## Checked workflows

- Guest cash and QR checkout, authoritative menu prices, stable retry keys and duplicate submission protection.
- Unpaid counter orders blocked from preparation; cashier payment releases the order to the kitchen atomically. One receipt on retries; cash tender and change recorded.
- Kitchen preparation, ready, pickup completion and guest receipt synchronization.
- New Sale POS: cash/change, amount-bound VietQR, explicit payment confirmation, read-only paired client display and stale QR removal.
- Courier offers, exclusive acceptance, pickup/handover photos, cash/change and completion. Simulated GPS/camera in UI tests; live rollback checks use synthetic photo metadata, not a physical trip or Storage upload.
- Staff invitation/activation, email and username login, one-use invitations, live session revocation and role boundaries.
- Phone/tablet layouts through existing workspace fixtures and cart/filters/invitation controls.

## Defect found and fixed

A newly invited web courier had `can_accept_payments=false`. The deployed payment function consequently rejected delivery cash collection. New courier invitations now receive this capability; existing active web courier accounts were repaired. The payment function still rejects collection on another courier’s order, pickup orders and deliveries not yet collected. Courier role still cannot create POS sales. `cafe-web-courier-cash.sql` is the follow-up migration; the original historical proposal remains unchanged.

## Client alerts added

`order-alerts.js` adds an explicit Enable sound and notifications control in the receipt and message inbox. Permission is requested only after a tap. A two-note chime works in an active, unlocked audio context. Browser/system notification settings control background sound.

`cafe-push` binds each Web Push subscription to an existing guest receipt capability. The public configuration response contains only the VAPID public key. Private keys and dispatcher credentials stay in a private, RLS-protected table behind service-only RPCs. The sender accepts only approved HTTPS push provider hosts. No order capability or address is included in notification URLs or text.

Order, payment and delivery transitions enqueue durable jobs inside the same transaction. A committed pg_net wake starts sending immediately; a 30-second cron retries temporary failures. Leases prevent overlapping workers, stale acknowledgments are ignored, and 404/410 subscriptions are removed. A daily job removes expired subscriptions and old job history.

The service worker shows a visible notification, preserves recent events outside the shell cache, updates supported app badges and opens the message inbox on tap. Retried events retain the same tag and do not increment counts or repeat sound. Inbox history uses server event timestamps and preserves newer state when events arrive out of order. Reading clears unread counts and closes the app’s outstanding notifications.

While open, the guest receipt fallback now refreshes every 3 seconds (previously 7); duplicate in-flight requests and hidden-tab polling remain blocked.

## Evidence

- Full existing `npm test`: exit 0, 138 PASS groups; then affected public-menu, web-operations and new order-alerts suites rechecked after final changes.
- New `npm run test:order-alerts`: consent and receipt binding, sound, unread/read badges, background event history, duplicate/out-of-order events, click target, actual encrypted Web Push request/VAPID signature, capability isolation, sender authentication/SSRF prevention, 410 handling, PostgreSQL trigger/no-op/rollback/leases/RLS and new courier capability.
- Deployed `scripts/qa-web-operations.sql` and `scripts/qa-cafe-live-rollback.sql`: passed after courier fix, all synthetic work rolled back.
- Live `cafe-push` config returned HTTP 200 without private material; unauthenticated dispatch returned 403; authenticated empty dispatch returned HTTP 200 `{ok:true,sent:0}`. Retry cron succeeded. No real customer subscription was available during verification.
- New push tables deny anonymous/authenticated access. Security advisor only reports intended deny-all RLS without public policies for these private tables. New job subscription FK index added after performance advisory.

## Physical-device acceptance still required

A real bank transfer, a real courier trip and audible notification delivery on a physical phone were not performed. On Android, the launcher decides whether the installed-app badge is a dot or number. On iPhone, Web Push requires a supported iOS version and launching the app from the Home Screen. User notification permission, sound settings, Focus/Do Not Disturb and browser suspension can affect delivery and sound. The app cannot override those settings.

To check the actual phone: refresh/open the installed menu app, place a test order, tap Enable sound and notifications, grant permission, then change its status from the staff workspace while the client app is in the background. Confirm a notification, sound and icon badge; tap it and confirm message history and clearing the unread indicator. No claim of physical-device verification is made until that check is performed.
