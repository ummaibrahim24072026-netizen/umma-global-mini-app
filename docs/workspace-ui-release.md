# Unified web workspaces

The staff page now uses normal document scrolling and a single sticky navigation bar. The inherited mini-app absolute positioning and hidden body scroll no longer cover staff navigation. `brand.css` supplies the shared UMMA palette; `workspace-layout.css` scopes layout and control styles to the standalone staff app.

- Cashier: consistent product cards, contained cart, cash/change summary, full-width payment action, collapsible customer-screen setup and a mobile cart shortcut. The shortcut hides when the cart is visible. The cart remains in memory when switching workspaces.
- Kitchen: payment/preparation/ready totals and filters, completed-order history, large order numbers and distinct next actions. Payment rules and kitchen visibility restrictions stay enforced by the existing renderer/backend.
- Courier: shift, offers/work/history, current task, address/cash guidance and action grid. Secondary courier tabs do not compete with main sticky navigation. Duplicate address/payment text is suppressed in this view; route/payment/handover actions precede item details.
- Account/install controls live in the header menu. Cash/shift settings are accessible under board tools. Forms, expanded controls and long labels wrap to available space.

Validation: independent email/login, cash and QR, self-service, full courier photo/cash/navigation flow, dispatch desk, kitchen responsiveness and existing app checks passed. The synthetic fixture builder exercises the real components, new filters/counts and mobile cart/back shortcuts. Cloud browser inspections at 320, 390, 768 and 1280 px found no controls outside the viewport, clipped button labels or intersecting action buttons in the tested POS, kitchen, active courier and available-offer states, including expanded secondary actions. These are rendered test orders, not real sales or physical-device acceptance tests.
