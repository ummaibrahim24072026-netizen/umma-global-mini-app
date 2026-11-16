# Green SM integration plan — UMMA CAFE web app

Scope: standalone web menu and staff operations. **Do not modify Telegram Mini App.**

## Current verified repository behavior
- `scripts/qa-delivery-providers.mjs` enforces UMMA-only delivery and no external courier checkout options.
- Keep that behavior unchanged until the operator has verified Green SM commercial and technical access.
- GitHub Pages is a static frontend. Never store API keys or perform privileged dispatch from client-side JavaScript.

## Release 1: manual dispatch (after confirming supported opening method)
1. Add a staff-only 'Call Green SM' action to delivery order details, not customer checkout.
2. Display pickup location, destination, phone, notes, and order number for easy copy.
3. Open Green SM through an **official, tested** Android intent/deep link if one exists. Otherwise show a neutral 'Open Green SM app manually' instruction; do not invent a deep link.
4. Operator confirms that a courier was actually booked; only then set `delivery_dispatch_status=booked_manual`.
5. Keep existing UMMA courier workflow as fallback.
6. Do not advertise live tracking, pricing, or auto-dispatch without a verified provider integration.

## Release 2: automatic dispatch (blocked on Green SM approval)
Prerequisites: written confirmation of foreign individual merchant eligibility; approved API credentials; partner docs; service coverage in Nha Trang; pickup/dropoff address format; price quotation and payer rules; webhook authentication and event schemas; cancellation/refund policy; sandbox test account.

Backend: Supabase Edge Function authenticates staff/server event, checks paid/authorized order and kitchen ready state, creates delivery job using a server-side credential, and persists provider job ID with an idempotency key unique to the UMMA order. Repeated kitchen events must not create duplicate couriers. Handle errors, retries, webhook signatures, cancellation, and redaction of customer PII. Trigger dispatch on ready-for-pickup, not on order submission, unless preparation-time scheduling is contractually supported.

Data: delivery_provider, dispatch_mode, dispatch_status, external_job_id, quoted_fee_vnd, payer, dispatched_at, last_provider_event_at, courier_eta, error_code. Use server-authoritative state and a secure audit trail.

Client: display price only when quoted; show tracking only if coordinates/status are actually provided. On API failure, alert staff and offer manual dispatch without automatically switching to a different paid provider.

## Tests before enabling
- pickup/non-delivery orders never dispatch
- no dispatch before kitchen ready
- duplicate ready events yield one job
- missing phone/address stops dispatch
- no credentials in public files
- API error results in visible staff action
- webhook signature and event ordering validated
- foreign individual account and coverage verified

## Current status
Preparation only. No live Green SM dispatch, deep link, or production integration is claimed.
