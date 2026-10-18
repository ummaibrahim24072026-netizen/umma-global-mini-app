# GrabExpress onboarding — 19 October 2026

## Current status

The official application form at https://developer.grab.com/contact-us is prepared in the browser for **UMMA Cafe / UMMA GLOBAL**, **Vietnam**, **Express**. It requests sandbox and production access for **Nha Trang / Khanh Hoa (`KHA`)**, delivery quotes, coordinates, item details, pickup instructions, status webhooks, tracking URLs and recipient-paid delivery. **The form has not been submitted and Grab access has not been issued.**

The form requires full contact name, phone, company email and acceptance of Grab's developer terms. A reCAPTCHA Enterprise quota error is visible on Grab's form. Do not claim that an application was submitted. No marketing consent was selected.

## Prepared server code

`supabase/functions/_shared/grabexpress.mjs` is a server-only, sandbox-only module. It is not imported by the browser or exposed as an Edge Function. It has no production dispatch implementation. Existing customer-arranged delivery remains active.

- Builds a delivery draft from a prepaid, non-terminal order, measured parcel, contacts and explicit coordinates. One measured packed parcel contains the item list and quantities.
- Uses `INSTANT` / `BIKE`, `CASH` / `RECIPIENT`; does not request COD collection for already-paid goods.
- Supports sandbox quotes, booking and delivery lookup; caches OAuth tokens and coalesces concurrent token refreshes.
- Never auto-retries a booking after transport/5xx/invalid-response failure. Such failures leave the outcome unknown.
- Drops contact details from the quote payload and redacts upstream error bodies.
- Rejects production configuration. All tests use synthetic data and mock HTTP; no Grab request or courier booking has occurred.

Validation: `node scripts/qa-grabexpress.mjs` (included in `npm test`).

## Access and next implementation steps

1. Submit the partner application with the owner's chosen contact details and terms acceptance. If Grab's CAPTCHA quota remains broken, use Grab Vietnam's business sales channel rather than bypassing it.
2. Register a developer project and obtain sandbox OAuth credentials. Set `GRAB_EXPRESS_SANDBOX_CLIENT_ID` and `GRAB_EXPRESS_SANDBOX_CLIENT_SECRET` only as backend secrets; never put them in Git, frontend configuration or chat.
3. Ask Grab to confirm `KHA`, actual pickup/drop-off coverage, hot-food eligibility, service/vehicle type, `CASH` / `RECIPIENT`, pricing and company-document requirements. A listed city code does not itself activate an account.
4. Build an authenticated server endpoint using Telegram identity verification and order ownership checks. Read paid status, selected carrier, location, items and coordinates from the database; obtain actual parcel measurements. Do not trust browser payment status or customer-supplied pickup details.
5. Add a durable shipment ledger with an order/provider uniqueness constraint and a booking lease. Persist intent before dispatch; reconcile unknown outcomes before retries. Obtain confirmation of merchant-order-ID reconciliation semantics from Grab. Coordinate cancellation, refund and kitchen state with booking; provider failures must not mark food orders delivered or paid.
6. Add an expiring quote and explicit customer confirmation, authenticated status callbacks, tracking and cancellation. Use production only after sandbox acceptance, Grab's production grant, payment-model activation and those protections are verified.

## Official references checked

- API reference: https://developer.grab.com/docs/grab-express/
- City codes: https://developer.grab.com/docs/grab-express-city-codes (`VN`, `Khanh Hoa`, `KHA`)
- Vietnam terms explicitly mention GrabExpress API Partners: https://www.grab.com/vn/en/terms-policies/transport-delivery-logistics/
- Business contact: https://forbusiness.grab.com/vn/en/services/express

The API reference specifies OAuth client credentials, the sandbox path `/grab-express-sandbox`, the production path `/grab-express`, and access enabled by country/city. `sender.instruction` is displayed to the courier at pickup; `recipient.instruction` is documented as unused. `payer=RECIPIENT` is incompatible with `paymentMethod=CASHLESS`.
