# Delivery coverage

Delivery is checked against the destination, rather than the customer's IP address or the device language. Customers can order for a recipient in the service area without granting GPS permission. Browsing, pickup and dine-in do not require a delivery destination.

The initial service polygon covers urban mainland Nha Trang. It is an operational service footprint, not a legal municipal boundary. It excludes Cam Ranh, Bai Dai, surrounding settlements and offshore islands. The exact active boundary is displayed in the delivery picker. The initial coordinates are in `supabase/proposals/cafe-delivery-zone.sql`.

## Branch administration

In **Локации и карта**, open an existing cafe. Its saved delivery area appears on the map. Use **Нарисовать зону**, click boundary points in order, then **Завершить рисование** and **Сохранить зону доставки**. **Отменить точку** removes the last draft point. Self-intersections, invalid coordinates and fewer than three points are rejected by the server. Saving the location's address and saving the delivery zone are separate actions. **Отключить доставку** takes effect when the zone is saved. Only the super administrator can change zones.

Each branch has an independent `locations.delivery_zone` polygon represented as `[latitude, longitude]` pairs, without a repeated closing vertex. New branches start with no delivery service until their own zone is explicitly configured. Disabling a zone does not cancel existing orders.

## Enforcement and release

`cafe_orders_delivery_zone` checks all delivery inserts and changes to the branch, order type or destination. It locks the branch row for the transaction, requires one canonical trailing coordinate line and rejects missing coordinates or out-of-area destinations before any order is committed. It covers both customer and staff orders and cached clients. Existing order status and payment updates continue normally. Coordinates are part of the existing courier address format; no IP geolocation or continuous customer tracking is added.

`cafe-menu` supplies each branch's current polygon for the frontend check. The database is authoritative if the client has stale zone data. The map picker is shared with staff without overwriting the customer's destination. Permission denial leaves manual map placement available. Missing map/zone data does not permit delivery via free text.

Deployment: apply `cafe-delivery-zone.sql`, then deploy `cafe-menu`, `create-cafe-order` (with its existing shared imports), and `cafe-location-admin`. Preserve their Telegram HMAC checks and existing `verify_jwt=false` setting. Publish the frontend with the new asset versions. Zone errors are returned as client errors with readable explanations. No real order needs to be submitted for verification.

Verification: `npm test`, including `qa-delivery-zone.mjs` (actual in-memory PostgreSQL trigger, permissions, malformed geometry, direct writes, future branches, deterministic SQL/JS geometry parity) and `qa-delivery-location.mjs` (customer/staff picker, missing permission/library, outside destinations, draft cancellation and checkout payloads).
