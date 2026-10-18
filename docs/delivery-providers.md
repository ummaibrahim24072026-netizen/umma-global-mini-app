# Delivery providers — first stage, 18 October 2026

Customer choices in Cafe and Market: UMMA courier, GrabExpress, Maxim. Lalamove is visible but disabled pending confirmation of local on-demand service in Nha Trang.

## Implemented workflow

UMMA courier uses the existing delivery order, service polygon, dispatch, tracking and cash-on-delivery rules.

External delivery is customer-arranged carrier pickup: goods are prepaid to UMMA; the customer separately books and pays the carrier. The order is stored as `pickup`, with the carrier marker at the start of `customer_note` and destination in `delivery_address`. New orders use a confirmed map pin in the canonical trailing coordinate line; an apartment/floor/landmark is optional. GPS is requested only on an explicit click, followed by pin confirmation. External carrier pins are not constrained by the UMMA courier polygon; the carrier must confirm its own route coverage and fare. This deliberately uses the existing paid pickup workflow rather than enrolling the order in UMMA delivery dispatch. No database migration or third-party credentials are needed for this stage.

The kitchen sees “Выдача курьеру GrabExpress/Maxim” and the destination. Customer order history identifies the provider. After server-confirmed goods payment, history shows courier details and an official service launch link. Opening the link never asserts a booking or changes a delivery status. No external coordinates, invented price or fictional driver appear in UMMA. Cancelled/refunded orders cannot start a booking; completed pickup orders only retain an app link.

The route/contact text is copied on an explicit click; no personal data is stored in browser storage by this module. Grab and Maxim launch links do not claim address prefill. Carrier selection and address remain inside the existing idempotent request, preserving response-loss retries. Market sums exclude its UMMA delivery fee for external carrier pickup. Stores without a configured prepayment method cannot offer external checkout.

## Remaining integration work

- Test app opening and clipboard behavior inside Telegram on Android and iOS, including return to UMMA. Automated tests verify link generation and UI behavior; no real delivery has been booked.
- Confirm GrabExpress food service for the actual pickup/drop-off in its application. Grab's official merchant page lists Nha Trang; route availability and current fare still come from Grab.
- Obtain Grab and Maxim partner documentation/access for programmatic address transfer, booking and provider callbacks. Public launch links are not APIs. Do not advertise automatic dispatch until a real sandbox-to-production integration is verified.
- Confirm Lalamove motorcycle pickup and food delivery within Nha Trang. Nationwide/intercity truck coverage does not establish local hot-food delivery. Its documented Web App address-prefill helper is implemented but not selectable in checkout.
- Lalamove API registration provides sandbox keys. Production needs a funded account. This merchant-funded model must be reconciled with the agreed customer-pays-carrier-separately model before enabling API booking; it cannot silently replace that arrangement.
- Full carrier API integration should use a dedicated shipment model with unique provider booking IDs, idempotency, callback authentication, cancellation reconciliation and independently tracked UMMA order/payment status. Store secrets only on the server.

## Official sources checked

- GrabExpress cities and food service: https://www.grab.com/vn/express-merchant-partner/
- Grab's merchant launch link: https://grab.onelink.me/2695613898/GESMS
- Maxim customer-arranged deliveries and shared tracking: https://delivery.taximaxim.com/en-US/
- Maxim Vietnam: https://taximaxim.vn/
- Lalamove prefill parameters and limitations: https://developers.lalamove.com/web-app/
- Lalamove API registration, sandbox, production funding and webhooks: https://www.lalamove.com/en-vn/business/api-solutions

## Validation

`qa-delivery-providers.mjs` covers the payment gate, external pickup payload, response-loss retry, preserved destination, own-courier zone rules, disabled Lalamove, escaped personal data and URL encoding. `qa-market-shop.mjs` covers Market carrier selection, preserved address and goods-only total. `qa-cafe-database.mjs` exercises durable metadata, replay, zero UMMA delivery fee and no courier assignment in an isolated PostgreSQL engine.
