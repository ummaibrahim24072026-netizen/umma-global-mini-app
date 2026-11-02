# UMMA Delivery — real device acceptance (not yet executed)

## Blocking implementation work
- Add guest web checkout endpoint that creates delivery orders and securely binds the browser session to the order; never expose kiosk device tokens.
- Issue a guest tracking grant to the same browser session as checkout, then render a link to `delivery-tracking.html#token=<grant>` on its receipt.
- Publish via reviewed GitHub Pages deployment after test automation and security review.
- Background Web Push requires a service worker, opt-in subscription and server-side sender; the current page only supports foreground/visible-session polling and best-effort local notifications.

## Device test
1. Open public menu in a fresh incognito browser on customer phone, with no Telegram installed or signed in.
2. Place a real delivery order and confirm its order number appears in staff POS and kitchen.
3. Open the receipt tracking link on the same phone; verify status without exposing address or private staff fields.
4. On courier phone, accept the offer, enable precise location and pick up the order.
5. Confirm the customer map updates while courier GPS sharing is enabled and fresh.
6. Stop GPS sharing, lock courier phone and check that the customer sees stale/no location, never a fabricated live position.
7. Mark delivered and verify the location disappears; test cancelled and expired grant.
8. Try a wrong token, guessed order ID, and a different cafe's order: all must fail.
9. Test Android Chrome and iPhone Safari separately; note background location and push limitations.
10. Record timestamps, order number, screenshots and pass/fail. Do not create a test order on live POS without staff coordination.

## Current result
Not passed. The kiosk supports pickup and dine-in, not public guest delivery checkout. No real phones have been accessed through these tools.
