# UMMA B2B

Business supply enquiries for cafés, restaurants, hotels, shops and other organizations. Home and More open the catalogue; Market managers see a business inbox in B2B, and the super administrator also has an entry in Administration.

The catalogue reuses listed Market products and photographs. Wholesale prices, minimum quantities, stock availability, delivery coverage and lead times are agreed through the enquiry. Buyers can select products and quantities or describe supplies that are not yet in the catalogue. This module creates enquiries, with no retail orders, reservations, payments or delivery dispatches.

Buyers see their own requests and manager replies. Active Market administrators manage requests for their assigned location; super administrators manage all locations. Other Market roles have no business inbox access. Submitted requests can be reviewed, receive a proposal, be closed by the manager, or be cancelled by their buyer. Closed/cancelled requests cannot be reopened. Updates require the displayed version; request IDs make retries idempotent, and a per-buyer lock enforces the daily submission limit. The buyer view refreshes every 15 seconds while visible; the manager refreshes explicitly to preserve editing.

Deploy `supabase/proposals/b2b.sql` once after the existing Market release, then deploy the `market-stock` Edge Function with `index.ts`, `auth.ts` and `labels.ts`. The function retains custom signed Telegram authentication and `verify_jwt=false`. Only catalogue reads are public. All B2B database tables/functions are restricted to `service_role`; actor identities come from the verified Telegram signature. Publish the matching frontend after the backend.

Run `npm run test:b2b` for isolated SQL and actual DOM workflows. `npm test` includes the B2B tests and the existing regression suites. Native PostgreSQL CI additionally checks simultaneous duplicate submissions and competing manager responses. Tests create no live enquiries or outbound messages.
