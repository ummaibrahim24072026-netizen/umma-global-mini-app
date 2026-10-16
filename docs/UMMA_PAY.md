# UMMA Pay

Android notification relay for the owner's Vietcombank account. This confirms payments from a trusted enrolled phone's notifications; it is not a direct bank API or bank-side settlement verification.

## Components

- `android/umma-pay`: Android 8+ app, `global.umma.pay`, only listens to `com.VCB` notifications containing UMMA; ignores OTP and group summaries.
- `supabase/functions/umma-pay`: service-authenticated receiver; no bank password is required.
- `supabase/proposals/umma-pay.sql`: private device/event tables and service-only RPCs. Migration must be tested before deployment.
- Customer orders display payment status; the QR sheet polls the existing signed orders endpoint every 3 seconds while open. Private inbox refreshes every 2 seconds while visible. Telegram delivery uses the existing durable queue.

## Enrollment

Generate a cryptographically random 16-byte activation code, insert ONLY its SHA-256 hash with the cafe ID, bank account and short expiration into `umma_private.pay_devices`. Deliver the activation code privately. Never commit codes, phone bearer tokens or signing keys. The app generates a random 32-byte bearer token, encrypts it with Android Keystore and pairs by HTTPS. Enrollment is retryable only with the same token, single-device, and expires. Revoke a phone by setting `enabled=false`; issue a new device/code after reinstalling.

No `service_role` key exists in the APK or website. RPC execution is revoked from PUBLIC, anon and authenticated. The receiver verifies the device before parsing. Bank-notification receipts have a separate `payment_source` and do not pretend a staff member collected the payment.

## Matching and audit

Only one full matching recipient account, one explicitly positive VND amount and one UMMA order number are accepted. Wrong/masked/unknown formats, wrong amount, cancelled/closed/already-paid orders, old/future notifications and wrong payment method remain `review`, with a reason. There is no amount-only fallback. Device and order locks serialize delivery; unique notification IDs/text hashes make retries idempotent. Receipt, status, history and private inbox commit atomically. Only messages from the Android `com.VCB` package are relayed; a compromised phone remains a trust boundary.

Review queue (authorized operator only):

```sql
select id, received_at, state, reason, order_id
from umma_private.pay_events order by received_at desc limit 50;
```

Raw notifications are private and must not be copied into public diagnostics. The parser is deliberately conservative: validate its match against a real incoming push on the owner's phone before considering the integration operational. Add additional formats only after inspecting real redacted notification samples and tests. Review events never mark orders paid.

## Phone setup and acceptance

1. Install the signed APK; enter the private activation code.
2. Enable notification access for UMMA Pay. For sideloaded apps Android may require the owner to allow restricted settings in the app's system info first.
3. Samsung battery settings: allow unrestricted battery, exclude UMMA Pay from sleeping/deep-sleep apps. Keep bank transaction pushes enabled.
4. Tap connection check. Make a real order, pay its QR retaining the UMMA reference, and verify one receipt plus customer paid status.
5. Check duplicate push, wrong amount, offline/reconnect, screen locked, phone restart and revoked device. No emulator/device test has been performed by the repository tests.

Pending messages are stored in the app's private SQLite database. Immediate delivery is attempted, with JobScheduler retry when connectivity returns. Android power management and bank push availability can delay delivery; the customer should retain the screenshot/manual verification path.

## Checks

`node scripts/qa-umma-pay.mjs` tests real isolated PostgreSQL matching/idempotency/security and strict parser rejection cases. `node scripts/qa-umma-pay-ui.mjs` tests the actual payment sheet. `npm test` includes these and existing workflows.

## Build

Use JDK 17, Android SDK platform/build-tools 35. The Gradle project pins AGP 8.7.3. A manual SDK build script is included for environments without Gradle. Protect and persist the release signing key: future APK updates must use the same certificate. Do not upload it to the public repository.

## Customer bank routing

Vietcombank has no autofill support in the VietQR deeplink registry. Selecting it shows the order-specific QR immediately, a save action and gallery-scanner instructions. No empty transfer deeplink is offered. The other listed banks keep the autofilled payment link with a QR fallback. Bank selection is remembered. QR rendering stays local; amount and UMMA reference come from the signed owner-scoped endpoint.

A QR pre-fills fields but cannot prevent edits inside the payer's bank. Only an exact incoming amount and UMMA reference confirm an order. A wrong amount stays in private review. A transfer without UMMA may never reach this relay, because the phone filters notifications by UMMA; it cannot be attributed automatically. The support disclosure explains both cases, prohibits repeat payment and offers a screenshot for staff reconciliation. Screenshots themselves never confirm payment. Do not automatically request a top-up or refund from an unverified screenshot.

## QR image download

QR save controls use Telegram 8+ `downloadFile` with an HTTPS PNG attachment, not a data URL. The initial `paymentDetails` request validates the signed Telegram session and order ownership; its five-minute HMAC ticket signs the exact QR payload and safe filename using a domain-separated server secret. GET/HEAD validate the ticket before rendering PNG and do not change payment state. Old clients receive an HTTPS browser download fallback. No QR files are stored, no third-party image service receives recipient details, and no Telegram initData or service key appears in download URLs. The native method is called synchronously during the physical tap using the prepared URL; links older than four minutes are refreshed and the UI requests a new tap. A missing native callback never locks the button, and a direct HTTPS download link appears as a fallback. A cancelled or accepted native prompt is reported accurately; acceptance does not prove that a download completed. The OS/Telegram controls whether the image appears in Gallery or Downloads, so direct gallery placement cannot be promised. `qa-qr-download.mjs` decodes the actual PNG and exercises native callbacks, errors and retry guards.
