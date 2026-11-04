# Ready portions and clean Cafe launch — 2026-11-04

The public menu, web cashier, kiosk and Cafe menu now share server-enforced ready-portion reservations. Kitchen/manager/owner users edit quantities in Work → Kitchen → Ready dishes availability. Couriers cannot edit stock; cashiers can read availability.

At the beginning of a shift, choose the actual-count operation, enter physical on-hand quantities (including any portions already reserved), and accept availability. Blank dishes stay unchanged. During the shift, the add operation records a new prepared batch. Preparing and Pause hide a dish until it is explicitly made available again. Zero/unconfirmed quantities are hidden from the customer menu. A new cafe starts in controlled mode; no fictional opening quantities are assumed.

Inventory stores physical quantity and reserved quantity. Creation locks the order and stock row, validates availability and reserves portions inside the order transaction. Failed checkout rolls back all reservations. Every sale channel hits the same insert trigger. Completion consumes portions once; cancellation releases uncollected portions. Cancellation after courier pickup consumes the portions rather than putting handed-out food back on sale. Refund of an already completed order does not restock sold lines. Reserved lines cannot be edited/deleted behind the stock ledger.

Kitchen adjustments use an opaque request UUID, a private operation receipt and row locks. Repeating a lost-response request cannot add a batch twice. Actual count cannot be below reservations. New code retains the existing global accounting setting and separate Market behavior; ready portions use the per-location flag. Legacy order lines and committed reservations are handled explicitly during activation.

Unpaid, unaccepted, unassigned orders reserve for 15 minutes. A one-minute cron cancels expired orders and releases stock; receipts show the reservation deadline. Paid/accepted/assigned deliveries are not auto-cancelled by this job. A cancelled QR order hides its QR and warns against paying; a late bank transfer still needs staff reconciliation. The app does not automatically refund a bank transfer.

## Owner-authorized cleanup

The owner identified all Cafe sales as test data and requested removal. A transaction backed up 33 tables into `umma_private.cafe_reset_backups`, under deny-all RLS and no public grants, then deleted the Cafe order/payment/delivery/shift history. The snapshot contains 26 orders and 11 receipts. The live tables were verified empty. Catalogue, employee accounts, sessions, kiosk devices, paired screens and notification keys were retained. Inventory quantities/reservations were reset to zero for Cafe products. Other modules' transactions were not included. Private evidence files remain available for backup recovery; they are no longer referenced by the live application.

`cafe_reset_epoch` lets updated clients clear old Cafe receipt/message/pending-operation data without logging employees out or clearing language preferences. The worker's cached message history and outstanding app notifications are cleared too. Refresh the installed app after deployment.

## Screen awake

All product entry pages load `screen-awake.js`. It requests a screen wake lock by default, keeps one outstanding request, releases it on page hide and reacquires it on visibility/focus/pageshow. A small control is available in the Work account menu and the guest-menu footer. System power-saving decisions, browser support and manual screen lock remain outside a website's control. No hidden video or simulated user input is used.

## Verification

- Full pre-existing npm suite passed after the main stock/UI changes; affected public menu, web operations, order alerts and new ready-stock tests rechecked after final edits.
- `test:ready-stock`: real PostgreSQL engine in PGlite covers existing commitments, zero/unconfirmed stock, add/set, role guards, replay/mismatched keys, reserve/cancel/consume, pause/resume, expiry, immutable lines and restricted RPCs. PGlite serializes execution; the new native PostgreSQL CI case additionally runs two independent sessions against the last portion and checks that exactly one succeeds.
- Kitchen UI test: batch add, persistent retry key, no duplicate add, role/tab visibility; phone/tablet preview uses only synthetic portions.
- Wake-lock test: one lock, hide/release, resume/reacquire, opt-out, unsupported fallback. Epoch test: Cafe history removed while session/language/unrelated data are retained.
- Live database stock test used ROLLBACK: add 10, replay the add, reserve 2, cancel and restore availability; no test sale or stock remained.
- Security/performance advisors: no new warnings. Private backup/operation tables intentionally have RLS without public policies. New indexes have not yet accumulated production usage.
- No physical phone power-saving test or actual bank transfer was performed.
