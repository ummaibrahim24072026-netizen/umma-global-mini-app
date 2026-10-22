# UMMA Rent launch

Entry: More → Transport and delivery → Vehicle rental (UMMA Rent).

The catalogue intentionally starts empty. No real vehicles, registration numbers, photos or customer records are seeded.

## Prepare inventory

1. As super admin, open Manage bikes → Add bike.
2. Enter model, specifications, pickup/return location and accessories. Registration can remain empty in a draft, but must be entered before publication. Save as draft.
3. Upload up to 15 JPEG/PNG/WebP photos (10 MB each), choose a cover.
4. Enable Publish and save. Maintenance and retired bikes remain unavailable for new bookings.
5. To delegate, open Staff and grant the employee's Telegram ID rental access. The user must have opened the app previously. Café permissions do not grant rental permissions.

## Rental workflow

- Price is fixed on the server: 400,000 VND per started 24-hour period, maximum 90 days.
- Deposit is independently 5,000,000 VND or 200 USD. It is not rent revenue.
- Dates use Vietnam time (UTC+7). A booking holds the vehicle for 30 minutes pending staff confirmation. Availability includes a one-hour turnaround buffer; overlapping reservations, confirmed rentals and overdue active rentals block availability. Returned vehicles remain blocked until settlement closes.
- Staff confirms booking, records actual rent/deposit receipts, uploads at least four photos and one walk-around video, and saves pickup report (odometer, full tank, equipment, document check, damage notes).
- Customer reviews and accepts the report in their own Telegram account. Staff cannot accept for the customer.
- Staff issues the bike after all gates pass. Paid days begin at actual handover; issuance rechecks availability for the resulting period.
- On return, repeat photo/video inspection and odometer/equipment/fuel recording. Customer accepts return report. Staff records actual return, then prepares settlement.
- Missing fuel: upload receipt and enter actual VND cost. USD deposits require an explicit VND/USD rate, shown with deduction/refund for customer acceptance. No automatic damage charges or late fees.
- After acceptance, actually refund the balance, then record cash/transfer confirmation. This closes the rental and releases the vehicle.
- Paid bookings can be cancelled before issue only with a recorded full refund of all received rent and deposit. Unpaid bookings can be cancelled by the customer.
- Unaccepted reports can be reopened for correction before handover/return; report revisions remain in the event history. Accepted reports are locked.
- Extensions recheck availability and recalculate total rent; additional payments have separate ledger events. Any outstanding rent can also be recorded during return settlement.

## Media and retries

Catalogue images are public; inspection videos/photos and fuel receipts use a private bucket with authorized five-minute download URLs. Videos: MP4/WebM/QuickTime, maximum 50 MB. The video input offers native camera capture where supported and file selection otherwise. Actual camera behavior depends on Telegram WebView/device permissions and needs a real-phone acceptance check.

Selected files are stored in IndexedDB per Telegram account and inspection on the device. Form drafts and retry operation IDs use sessionStorage. Successful files are removed from the local queue. Failed files can be retried without duplicating bookings or payments. Closing the app before IndexedDB writes finish, clearing browser data, or storage quota denial can lose local drafts; retain source media until upload completes.

## Notifications and payment limits

Open booking/detail screens refresh every 15 seconds while visible and not being edited. Due/overdue return warnings and all status/payment events are visible in the section. This release does not send proactive Telegram messages when the app is closed, debit a bank account, automatically detect transfers or move/refund money. Staff records actual payments and refunds.

Damage disputes must be settled with the customer before accepting settlement; no arbitrary automated deductions. This operational flow is not a claim about legal enforceability or a complete local rental contract.

## Deployment

- Database: `supabase/proposals/rent-launch.sql`, applied as `umma_rent_launch`.
- Edge: `supabase/functions/rent-service`, `verify_jwt=false` because all private actions independently validate Telegram HMAC, auth_date and active-account/role/ownership in SQL.
- Server requires existing `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `TELEGRAM_BOT_TOKEN`. No secret keys in frontend.
- Rental tables/RPCs are denied to anon/authenticated; service-role-only functions are SECURITY INVOKER. RLS is enabled with intentionally no direct-client policies.
- Tests: `npm run test:rent` (database, UI, Edge); full regression suite: `npm test`.

Before adding inventory: verify camera/photo selection, a video upload and customer/staff report acceptance on the actual phones. Production booking/payment data must not be populated with synthetic fixtures.
