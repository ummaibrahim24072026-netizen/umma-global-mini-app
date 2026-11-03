# Web cafe operations

Open `staff.html` for the cashier, kitchen and courier; Telegram is not loaded or required. The owner activates a one-time 48-hour invitation, sets a login/password, and creates staff invitations in **Сотрудники**. Staff sessions expire after 30 days; logout and disabling an account revoke access. Server authorization rechecks account state and active cafe assignments on each request. Internal staff actor IDs share the existing authorization model; new web employees do not need a Telegram account.

## Cashier and customer payment screen

Choose a product (including a single flatbread), then cash or QR. Cash requires the received amount and records exact change. QR creates an unpaid order and uses the server's VietQR account, order reference and total. A cashier confirms only after checking actual bank receipt. Creating a QR never marks the order paid.

In **Экран оплаты для клиента**, create a screen link, open it on the customer-facing tablet, and leave it open. Selected orders update the screen every two seconds. The screen capability is read-only and reveals only order number, total and payment state. It cannot create orders or confirm payment. The QR clears after payment, cancellation or a connection failure. Changing cafe selects a different pairing; **Отключить планшет** revokes the old screen.

Order creation preserves its idempotency key after an uncertain response. After a committed order the cart clears before payment or display updates, so a second sale cannot be created by a failed secondary action. Recovery appears on the POS and orders screens.

## Courier and customer

A courier receives the **Курьер** workspace after web login. Going online, offers, claiming, navigation, cash collection/change, pickup/handover photographs and delivery GPS use the same server authorization and order workflow as the existing courier interface. The public customer menu issues a private tracking link. The receipt survives a browser restart. In-app messages retain preparation/payment/courier status history and refresh while the page is open.

Background Web Push for a fully closed app is not implemented. GPS also depends on an open foreground app and device permission. These constraints are stated in the UI; no background-delivery guarantee is made.

## Validation

- `npm run test:web-operations`: web session hashing/expiry/revocation, account disable, POS cash/change, unpaid QR, double-tap protection, read-only screen and stale QR clearing, persistent in-app updates, full courier flow with no Telegram object.
- `npm run test:public-menu`: all 12 languages, payments, delivery, private tracking, Photon, self-service queue.
- Existing courier, payment, request-recovery and database suites passed, including role/cafe isolation, dispatch acceptance, photo/payment completion, and idempotency.
- `scripts/qa-web-operations.sql` and `scripts/qa-public-delivery.sql` passed against the live database in rolled-back transactions; no test sales retained.
- The deployed Edge endpoint accepted an independent web cashier login, loaded its scoped order board and created one 25,000 VND flatbread order. The unpaid QA order was cancelled; no payment receipt was recorded and the temporary account was disabled.
- A real bank transfer and an actual trip on cashier/customer/courier phones are still required as an operational acceptance test.
