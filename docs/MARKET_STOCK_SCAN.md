# UMMA Market / Stock & Scan

Release date: 2026-10-17. Existing repository, Supabase, Telegram identity, Cafe payment and courier infrastructure are reused.

## Implemented flows

- Customer RU/EN/VI catalogue with categories, search, images, descriptions and verified-halal badge; location-specific prices and availability. Only received, unexpired, released stock is sellable.
- Piece/set quantities, fixed-weight packs and individually weighed packages. Exact package identity, weight and final amount are agreed before payment. Weight is integer grams and prices/costs are integer VND.
- Active supplier records, receiving plans, partial receiving, documented rejected remainder, batches, provenance/temperature/halal evidence and private JPEG/PNG/WEBP/PDF uploads. Meat/Poultry categories require quality evidence at product creation. Missing evidence causes quarantine.
- Packing with exact input/output reconciliation, historical cost allocation preserving every VND, separately approved packing losses, immutable internal QR identities and reuse of manufacturer barcodes.
- Label preview/system printing, browser fallback through expiring signed links, print history/reprint without inventory mutation; manual scanner fallback alongside vendored ZXing.
- Quarantine/release, administrator-approved spoilage writeoffs, correction documents, inventory count freeze, separately valued shortage/surplus, traced warehouse transfers and supplier returns.
- Transactional exact-unit reservations, FEFO raw stock allocation, cancellation/expiry and bank/cash payment. Existing UMMA Pay confirms the same shared order; receipt replay is idempotent. Expired unpaid reservations cannot be marked paid.
- Picking requires the reserved package QR or manufacturer/internal code plus quantities. Wrong package attempts are logged and block completion. Customer consent is required for an equal-price same-SKU substitution; differing amounts/SKUs require a refund and a new customer-approved order.
- Verified pick completion gates handover. Named courier, bag count, existing required pickup/handover photos, live courier tracking and delivery chat are reused. Pickup requires payment and completed scans.
- Partial/full refund records require actual payout confirmation/reference. Physical customer returns create a new quarantined identity; they are separate from money refunds. Legacy Cafe refund controls reject Market orders to prevent double payouts across modules.
- Cash shifts include Market refunds, warehouse financial report shows sales, COGS, gross profit, refunds, returned COGS, stock valuation, writeoffs, shortages, surplus, supplier returns and picking errors. Per-actor audit is available.
- Location-scoped roles: admin, receiver, packer, warehouse, picker, cashier and courier; only the super administrator assigns Market roles. Existing active managers/cashiers retain matching scope during setup. Couriers use the existing UMMA courier module.
- Scheduled reservation release and expiry reminders run every minute; loss thresholds raise warehouse alerts.

## Access and integrity

Every new table has RLS; anon/authenticated have no direct access to Market data or RPCs. The Edge handler verifies Telegram HMAC and selects actor identity from signed initData. Service-only RPCs check active users, location scope, action roles and idempotency payloads again inside the transaction. Procurement costs/evidence are excluded from public catalogue/customer order data. Catalogue images are public; evidence access uses short signed links. Storage restrictive policy prevents broad legacy policies from exposing private uploads.

Shared advisory locks serialize stock mutations by location, including reservation, receiving, packing and stocktake. Order transitions hold shared order locks. Repeated requests with changed payload are rejected. Confirmed documents, scan events, picking events and refund records are immutable.

## Verification

`npm test` covers existing Cafe, payment, courier, tracking, maps, delivery-zone, chat and UI regressions plus `npm run test:market`:

| Scenario group | Evidence |
| --- | --- |
| 10 kg receipt and 13 packs, remainder and exact 150001 VND cost | `qa-market-stock.mjs`, `qa-market-commerce.mjs` |
| Manufacturer code, 100 drinks, QR lookup/print/reprint | `qa-market-stock.mjs`, `qa-market-ui.mjs`, `qa-market-labels.mjs` |
| Three exact meat pieces, selected-piece reserve, payment and wrong-piece rejection | `qa-market-commerce.mjs`, `qa-market-shop.mjs` |
| Writeoff/loss, count freeze, shortage/surplus, expiry/quarantine | `qa-market-stock.mjs`, `qa-market-commerce.mjs` |
| Returns, partial/full refunds, cashier scope and Cafe cash compatibility | `qa-market-commerce.mjs` |
| FEFO allocations, shared courier photo handover and zone enforcement | `qa-market-commerce.mjs` |
| HMAC, actor tampering, restricted roles, no public costs | `qa-market-edge.mjs`, database suites |
| Independent concurrent buyers/payment/writeoff | `qa-market-native.mjs` in native PostgreSQL CI |
| Atomic SQL, source consistency, initial setup, private evidence and rollback | `qa-market-release.mjs` |
| Native database backup and restore | `postgres-concurrency` CI job |

PGlite checks are isolated engine tests, not proof of native session concurrency. Native concurrency runs use three independent PostgreSQL clients and require observed lock waits. CI only connects to a disposable loopback database named `umma_qa`.

## Release procedure

Generate the bundle with `node scripts/build-market-release.mjs`. Apply `supabase/release/market-launch.sql` once through a versioned Supabase migration. It is atomic, has a lock timeout, patches existing Cafe bridges with compatibility checks, creates initial categories and the Nha Trang warehouse, prepares storage and schedules maintenance. It creates no stock, prices, orders, payments or invented product photos.

Deploy the three files in `supabase/functions/market-stock/` together, with gateway JWT verification disabled because Telegram HMAC is verified by the handler. Existing server environment supplies TELEGRAM_BOT_TOKEN, SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY. Publish the matching frontend only after database/API checks. Cache versions in index.html must match the release.

## Operational limits to validate on equipment

Actual stock, sale prices, photos and supplier documents must be entered from the shop. No camera/printer/scale hardware is available to automated tests. The browser print dialog does not confirm that a physical label was printed. Physical camera decoding, label readability and the shop printer require an on-device check. Weights are entered manually in grams; direct electronic scale and proprietary printer adapters are not included. A set currently sells a configured quantity of the same underlying stock item; mixed-product BOM kits need a separate assembly workflow. Very large warehouses need narrower server pagination than the current 50000-row safety cap. Telegram is the deployed interface; Zalo and native Android/iOS remain separate platform work.
