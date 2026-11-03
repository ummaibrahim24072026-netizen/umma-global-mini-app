# Cafe self-service prepayment

For new cafe pickup/dine-in orders at locations with `self_service_enabled`, the cashier receives an unpaid order. The main action is “Принять наличные · Оплачено”, with amount received and change. Confirmed payment atomically starts preparation. Kitchen staff without payment permission see the order only after payment. The remaining flow is preparing → ready → issued. Public checkout does not select a table; configured staff checkout hides the table picker. Customer cash receipts direct the guest to the cashier until payment.

Database protection is enforced by triggers, including direct status updates. The payment requirement cannot be cleared on an existing order. Existing orders, other cafes, Market orders and cash-on-delivery retain their current flow. Payment retry retains the original receipt/collector and creates one preparation event.

Rollout order:
1. Apply `supabase/proposals/cafe-self-service-prepayment.sql`.
2. Verify with `scripts/qa-self-service.sql` inside a transaction and roll back. This is a synthetic cashier/payment scenario and does not commit kitchen tickets or receipts.
3. Deploy `cafe-kitchen`, including the updated order-list projection. Preserve the existing deployed shared helpers when assembling the function bundle.
4. Merge/publish frontend changes and verify GitHub Pages.

Verification completed locally: full `npm test`, real PostgreSQL engine via PGlite with authorization, cash/change, retry, preparation/issue, QR, cancellation and legacy/delivery checks; browser-DOM cashier → paid → ready → issued flow; existing courier/payment/public-menu regressions.

Production verification: the migration was applied successfully, the rollback cash/order test passed against the production schema without committed QA orders or receipts, and cafe-kitchen version 36 was deployed. Publish the reviewed frontend next.
