# UMMA Market / Stock & Scan — implementation audit and first increment

Date: 2026-10-17. Specification: approved 29-section UMMA Market brief supplied by Ibrahim.
Status: **development branch; not deployed; not ready for retail launch**.

## Audit evidence

Repository baseline: `e53dde98eb85d72f079237ab18dde9fad99d16ed`, default branch `main`.
Read-only inspection of Supabase project `zwzojugspldexyyljwpr` found existing RLS-enabled entities:

| Area | Existing entities | Decision |
|---|---|---|
| Catalogue | `categories`, `products`, `inventory` | Reuse `products`; retain Cafe inventory semantics. Market packaging is an extension. |
| Purchasing | `suppliers`, `purchase_documents`, `purchase_items` | Reuse supplier identities and purchase documents. |
| Stock | `stock_items`, `stock_balances`, `stock_movements` | Reuse base item identities, aggregate balances and movement ledger. |
| Identity | `telegram_users`, `cafe_staff` | Reuse signed Telegram identity. Market permissions are scoped by location and may be combined. |
| Fulfilment | `cafe_orders`, items, events, courier assignments/tracking/proofs | Preserve; integration remains to be implemented and tested. |
| Payments | Cafe payment receipts, refunds, transfer proofs, UMMA Pay Edge Function | Preserve; Market payment/order integration remains to be implemented. |

At inspection there were no Market-specific tables. The Market route displayed a service placeholder.

The existing `validate_stock_item_product_link` trigger restricts linked Cafe finished goods to pieces/portions. Market therefore links a canonical `products` row to a canonical `stock_items` row through `market_product_variants`, without changing that Cafe trigger. Existing Cafe stock items and quantities are not adopted or converted implicitly.

## This increment

- Additive SQL proposal: `supabase/proposals/market-stock-scan.sql`.
- Service-only transactional RPC `market_operation`. Signed Telegram authentication at `market-stock` Edge Function. No actor ID supplied by clients is trusted.
- Product creation, barcode linking and supplier creation; RU/EN/VI product names, four sale-mode metadata values. Selling bundles/BOM and per-location pricing are not implemented yet.
- Receipt with active supplier, planned/accepted quantities, exact total purchase cost, batch, storage place, expiry, quality flag and retained raw payload. Multi-line receipt supported by the RPC; initial UI submits one line at a time.
- Failed/unreviewed quality defaults to quarantine.
- Individual packaging using integer grams/pieces and integer VND cost allocation. Every VND is conserved across packs and remainder.
- QR content `UMMA:<unit UUID>`, with database lookup. QR exposes no purchase costs.
- Label selection, preview, default 60 × 40 mm, configurable dimensions, system print dialog, job history, retry/reprint without changing identities or stock.
- Vendored ZXing Browser 0.1.5 plus upstream licenses; no scanner CDN dependency. Camera and manual entry use the same server scan validation.
- Batch quarantine/release, writeoff requests with administrator approval, shortage and surplus counts. Surplus requires explicit valuation and is reported separately from shortage.
- Stocktake freezes movements in the selected warehouse. Location and warehouse transaction locks coordinate stock mutations and aggregate balances.
- New tables have RLS and no anon/authenticated grants. RPCs use SECURITY INVOKER and are service-role only. Warehouse/location permissions are checked again inside the transaction, including on request replay.
- Confirmed Market documents, scan events and idempotency ledger entries cannot be modified/deleted through ordinary SQL operations. Corrections require additional documents.
- Reuses `stock_balances` as a derived aggregate. A guard rejects legacy balance mutations for Market-managed items, preventing divergence through Cafe accounting endpoints.
- Existing native navigation/back stack and home/Cafe layout preserved. Warehouse pages are staff-only; there is no public Market checkout yet.

Cost model for this increment: each receipt line defines batch cost; packing allocates remaining batch cost proportionally in integer VND, carrying rounding remainder forward. Individual units retain their allocated historical cost. Shortages/writeoffs consume that cost. Surplus cost is explicitly provided. This is a proposed historical batch/unit method; a complete financial accounting method and reconciliation with future sales remain open.

`sent` print status means handed to the browser/system dialog. Browsers cannot confirm physical output. No claim is made that a specific Bluetooth printer, Wi-Fi printer or phone has passed acceptance.

## Validation

`npm run test:market` runs isolated PostgreSQL-engine (PGlite) checks and jsdom UI checks. Synthetic data only; no production purchases, orders, stock counts or payments were created.

Database coverage: 10 kg receipt; 13 packs with 500 g remainder; exact 150001 VND cost conservation; balance rejection; idempotent receipt; changed-payload replay rejection; print/reprint invariance; QR lookup; 100 branded items using the manufacturer code; unknown barcode; quarantine/release; expired batch; administrator-only approval; repeated writeoff protection; immutable confirmed documents; stocktake freeze; shortage; explicit-cost surplus; RLS and RPC denial for anonymous access; legacy balance mutation guard.

UI coverage: escaped product names; product and receiving forms; retained operation ID after uncertain network response; manual scanner fallback; label preview generating QR SVG without prematurely creating a print job.

Existing `npm test` Cafe/payment/courier checks passed after routing changes. The prior placeholder test now targets Travel explicitly; Market has separate tests.

PGlite tests are not a real two-session concurrency test. Live Edge Function, real camera decode, physical labels, screen layout on target phones and hardware compatibility have not been accepted. TypeScript syntax has been checked; a live Deno deployment has not been tested.

## Outstanding work before the full specification is complete

| Specification area | Remaining implementation |
|---|---|
| Catalogue | Category administration, existing-product variant management, product photos, descriptions/composition, confirmed halal evidence workflow, location-specific prices and customer availability. |
| Receiving | Draft/partial deliveries, explicit rejected quantities, supplier return documents, mandatory meat temperature/provenance/document checks, evidence uploads. |
| Packing | Integrated approved loss document in the packing flow; scale adapters; stronger sale-mode validation and packaging metadata. |
| Labels and scan | Hardware compatibility testing, target-phone camera tests, printer adapters where required, visual print QA at every supported size. |
| Inventory/control | Approval limits, unit quarantine controls, guided unknown-item resolution, transfers between warehouses/locations, corrective documents, user-visible gross-loss/surplus reports. |
| Orders and reserve | Customer catalogue/checkout, exact `unit_id` selection, FEFO, transactional reservations and release rules, reservation expiry, concurrent-buyer tests. |
| Payments/returns | Reuse payment infrastructure via a tested Market adapter; reliable payment confirmation, cash workflow, cancellation, partial/full refund, sale-return and supplier-return accounting. |
| Picking/delivery | Mandatory scan matching and quantities; wrong-meat rejection; substitution consent; completed-pick gate; existing courier integration and handover checks. |
| Analytics | Period/location/item/supplier/staff filters, actual revenue/gross profit, loss thresholds, expiry reminders, audit and financial reconciliation. |
| Operations | Staff-role management UI, pagination/large data sets, backup/restore drill, live advisors and full multi-session regression acceptance. |

The 27 mandatory launch scenarios in the specification are the final acceptance gate; the passing foundation tests do not replace them. Do not label this branch as the complete Market system.

## Deployment sequence for this increment

1. Review SQL, verify current schema compatibility, confirm a restorable backup and test on a disposable development database.
2. Apply the reviewed SQL proposal through the normal versioned release procedure; never rerun it blindly against production.
3. Deploy `supabase/functions/market-stock/index.ts` together with `auth.ts`, with JWT gateway verification disabled because the handler validates signed Telegram initData. Existing `TELEGRAM_BOT_TOKEN`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` are server-side only.
4. Run database advisors and signed/unsigned live endpoint checks. Create the first warehouse as super administrator; assign location-scoped Market roles.
5. Publish frontend only with the matching database/function release. Run target-phone and printer acceptance using synthetic or explicitly identified test stock.
6. Keep public Market ordering unavailable until reservation/payment/picking/delivery acceptance is complete.
