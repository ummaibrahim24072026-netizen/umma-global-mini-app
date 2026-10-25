# UMMA B2B — manager/warehouse integration contract

Status: implementation branch only. Do not enable ordering before authenticated API, deployment and integration tests.

## Field manager workflow
1. Authenticate the manager with verified Telegram initData on the server; check active staff permission.
2. Search approved organizations. Create or select one, and verify legal details and supply agreement.
3. Load active catalog from b2b_catalog, joining stock_balances on stock_item_id + location_id. Show available = quantity_on_hand - quantity_reserved. Never trust a client-supplied balance or price.
4. Add lines and delivery address/date, choose payment: online, cash on delivery or manager cash. Save order and lines in one server-side transaction, using catalog price snapshots.
5. Invoke b2b_reserve_order within the same trusted transaction. A failed reservation must roll back the entire new order.
6. Warehouse screen lists reserved orders; staff pick and verify quantities, then invoke b2b_dispatch_order. Dispatch deducts on-hand and releases reserved units.
7. For cancelled orders invoke b2b_release_order. For changes after reservation, cancel and recreate or implement a controlled adjustment workflow.
8. Record cash received as a separate b2b_payments row with verified manager identity and receipt. Do not set paid based on payment method alone. Online payments require bank/provider confirmation.
9. Restrict organization buyers to their own approved organization, and warehouse workers to authorized locations. Do not rely on Telegram client role labels.
10. Attach signed contract and order specification before activating production orders.

## Warehouse screen
Columns: order ID, organization, address, requested date, SKU, requested quantity, reserved quantity, stock location, payment state.
Actions: start picking, confirm dispatch, report shortage, cancel. Never allow direct stock balance edits from UI.

## Before production
- Create API with server-side authorization for all manager, organization, and warehouse operations.
- Ensure every new table has RLS enabled, no broad public grants, and explicitly controlled service access.
- Add tests for concurrent reservations, double clicks, cancellations, dispatch retries, insufficient stock, unapproved organization, invalid manager, and cash payment authorization.
- Verify inventory units (pieces versus kg), storage locations, expiration dates, and product batch traceability.
- Obtain actual prices, minimum quantities, organization records, and original UMMA product photographs. Do not insert stock images.
- Confirm signed contract handling and local invoicing requirements with a qualified Vietnamese professional.

## Important limitations
The schema migration and reserve/release/dispatch functions are not deployed. The current migration only provides a backend foundation; it does not yet add a clickable screen to the production Telegram Mini App.
