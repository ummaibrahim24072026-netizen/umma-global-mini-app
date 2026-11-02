# UMMA Delivery — implementation foundation

## Goal
A shared delivery network for UMMA-owned cafes, partner cafes and independent shared couriers, starting with one UMMA courier.

## Roles
- Customer: guest order tracking via a high-entropy, order-scoped tracking token.
- Cafe operator: can dispatch own orders to eligible couriers.
- Courier: authenticated worker, explicitly accepts a job and shares GPS only during an active delivery.
- Network dispatcher: can offer orders to shared couriers subject to each cafe's opt-in.
- Administrator: manages organizations, permissions and audit logs.

## Dispatch
1. Cafe creates order and chooses delivery.
2. Dispatch prioritizes eligible available couriers assigned to the cafe.
3. If cafe enables shared dispatch, network couriers can be offered the order.
4. Partner couriers are never offered another cafe's order without explicit partner opt-in.
5. Courier accepts; pickup and dropoff states are recorded as audited transitions.
6. Customer sees status, courier location and ETA only while their own delivery is active.

## Privacy and security
- Supabase RLS for tenant isolation; never trust cafe_id, courier_id or status supplied by the client.
- Only authorized staff may assign a courier; only assigned courier may update GPS.
- Use signed short-lived tracking grants and server-side authorization for guest tracking.
- GPS sharing starts on pickup and ends at delivery/cancellation, with short retention.
- Rate-limit GPS updates and notification endpoints; validate coordinates and state transitions.
- Push subscriptions are opt-in and scoped to order/device; never put service credentials in GitHub Pages.
- Push sound and app-icon badges are platform-dependent; do not promise guaranteed behavior.
- Browser courier GPS cannot be relied upon while backgrounded or phone locked; consider a native courier client for reliable background tracking.

## Integration sequence
1. Inventory existing orders, cafe permissions, courier schema and realtime channels.
2. Add compatible database migrations and policies, with tests for cross-tenant isolation.
3. Integrate staff dispatch and courier accept/pickup/dropoff UI.
4. Add customer order-scoped realtime tracking and route map.
5. Add notification subscriptions and server-side Web Push.
6. Test end-to-end on Android and iOS before rollout.

## Deployment
Keep GitHub Pages for static PWA. Use Supabase database, Realtime and Edge Functions for authenticated actions and push dispatch. Do not ship secrets in the frontend.
