# UMMA Market / Stock & Scan

Release date: 2026-10-17. This module extends the existing UMMA GLOBAL application and its signed Telegram identity, purchasing, stock ledger, payments and courier workflow.

## What is included

- Public RU/EN/VI catalogue, categories, photos/descriptions, location prices, pieces, prepacked sets, fixed-weight and individually weighed packages. Exact package selection and final quote before payment.
- Receiving plans, partial acceptance, active suppliers, batch expiry/storage and quality evidence. Meat requires provenance, halal-document reference and measured temperature; otherwise the batch enters quarantine.
- Integer grams and integer VND. Packing balance, explicit approved losses, stable package UUIDs and historical batch/unit cost. Different package sizes can share one stock item.
- Camera scanner (vendored ZXing) and manual fallback for manufacturer barcodes and UMMA QR. Server-side validation and operation replay protection.
- 60 × 40 mm labels, configurable sizes, preview, batch printing and reprint history. System printing and a short-lived signed browser-print link for Telegram. Reprints keep original IDs and do not change stock.
- Warehouse transfers, quarantine/release, approved writeoffs, correction documents, supplier/customer returns, shortage/surplus valuation and stocktake. A count freezes warehouse movements and cannot start with active reservations.
- Exact-unit or FEFO reservations, stock expiry blocking and unpaid reservation expiry. Shared Cafe order/payment tables, existing VietQR/UMMA Pay matching, confirmed cash receipts, cash shifts, actual partial/full refund records.
- Mandatory picking scans, wrong-package rejection, quantity checks, customer consent for same-price package substitutions, missing-position resolution, all-lines-complete gate and courier handover. Existing courier proof, chat, tracking and completion remain in use.
- Warehouse/date financial reports, historical COGS, returns/refunds, writeoff/shortage/surplus costs, loss thresholds, expiry alerts, employee audit and multi-role administration.

Shared canonical tables remain `products`, `categories`, `suppliers`, `purchase_documents`, `stock_items`, `stock_balances`, `stock_movements`, `telegram_users`, `cafe_orders` and their existing extensions. Market-specific tables add package, batch, document, reservation and control details. Cafe products and stock are not converted into Market inventory.

## Deployment

Apply `supabase/release/market-launch.sql` once through a versioned migration. It atomically assembles the three module proposals and `market-launch-setup.sql`. Deploy the `market-stock` Edge Function with `index.ts`, `auth.ts`, `labels.ts`; gateway JWT checking is disabled because signed Telegram initData is verified by the handler. Existing server-only Supabase keys and `TELEGRAM_BOT_TOKEN` are reused. No credentials belong in browser code.

Setup creates the 14 catalogue categories, a Market warehouse under the existing HALAL UMMA Nha Trang payment/delivery location, private evidence/public catalogue image buckets and minute maintenance for reservation expiry/notifications. Existing active location managers receive Market admin scope; cashiers retain cash scope. Super administrators can assign other roles in Market settings. No inventory, prices, suppliers, payments or customer orders are fabricated.

After database and Edge health checks, publish frontend from the same commit. Public entry: UMMA Market. Employee entry: the warehouse button in Market. Add suppliers/products, receive actual stock, pack where appropriate, set location offers and prices, then place an identified acceptance order.

## Security and accounting

New tables have RLS and no anonymous/authenticated direct grants. RPC execution is service-role only; transaction-level role/location checks are repeated even on idempotent replay. The Edge Function derives actor ID from verified Telegram data. Catalogue JSON explicitly excludes internal purchase cost and private quality evidence. Evidence links require role checks; browser label links expire and recheck permission.

Location/warehouse advisory locks and row locks coordinate stock and order transitions. Negative stock, duplicate sale, duplicate payment and repeated approval are blocked. Posted documents and immutable scan/operation ledgers are corrected by new documents. Legacy stock writes cannot bypass Market balances. Market order guards prevent generic Cafe status controls from skipping picking.

Cost method: actual batch acquisition cost, proportional integer-VND allocation with rounding remainder retained, historical package/reservation cost, and FEFO physical allocation. Surplus requires explicit valuation. Financial losses are cost-based; cash refunds are reported separately from recognized sales credits. Refund entry records an actual confirmed payout; it does not initiate a bank transfer.

## Validation

`npm test` includes existing Cafe/payment/delivery regressions and `npm run test:market`. Market tests cover receiving 10 kg, weight/cost conservation, 100 factory-coded drinks, three exact meat weights, selected-unit reservation/quote/payment, wrong/right scan, stock control, returns, substitutions, quality evidence, expiry and privacy. jsdom tests cover customer/staff interactions and uncertain-response retries. Edge and label tests check signatures, expiry, permissions and label contents.

GitHub Actions also uses PostgreSQL 17 with independent sessions and observed lock waits: competing buyers, duplicate payment and concurrent writeoff approvals. The isolated database is dumped/restored and restored order counts compared. This is a recovery drill with synthetic data; it does not establish the production provider's backup retention or PITR subscription.

## Operational acceptance still requiring real equipment/data

- Test camera decoding on the actual Telegram phones and print/scan a 60 × 40 mm label on the selected printer. Browser `sent` means handed to the system print dialogue, not confirmed physical output.
- Wi-Fi/Bluetooth device-specific printer adapters and automatic electronic-scale input require selected compatible hardware. Current release uses system printing and manually entered measured weight.
- Sets are prepacked stock units with recorded composition; automatic component/BOM assembly is not included.
- Reports currently filter by warehouse/date; combined product/category/supplier drilldowns and configurable sub-admin approval-value limits are further enhancements. All writeoffs currently require an administrator.
- Catalogue currently supports one main photo and multilingual descriptions per product; dedicated brand fields and photo galleries are further enhancements.
- Validate real bank-notification ingestion, staff roles, courier handover and production backup/restore procedures with the operator before unrestricted retail operation. Never treat a payment screenshot as evidence of receipt.

These operational checks are not claimed as passed by automated tests.
