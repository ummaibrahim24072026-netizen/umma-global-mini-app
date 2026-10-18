# UMMA GLOBAL application design

The approved home, illustrated directions and five-tab navigation define the application’s visual language. `css/design-system.css` applies it to the existing customer, employee and management screens. It loads after module styles; module-owned interaction and data remain unchanged.

## Foundations

- Palette: existing `brand.css` turquoise, light surfaces, `app.css` gold. Error, warning and destructive states keep their semantic colours.
- Cards: 24px corners, fine turquoise border, subtle shadow. Gold identifies an emphasis, rather than every surface.
- Controls: 44px minimum action target, 48px text fields, visible keyboard focus, full translated labels.
- Typography: existing interface fonts. Quran Arabic, translations, reading sizes and line heights remain owned by `quran.css`.
- Images: approved illustration atlases, cropped through the single `directionArtwork` renderer. Decorative images have empty alt text and SVG fallbacks. No new image assets or APIs.

## Screen coverage

| Area | Presentation |
| --- | --- |
| Home | Approved composition preserved; home and notification app-bar icons match the navigation sculptures. |
| Cafe | Original UMMA wordmark and halal composition preserved; forms and order actions follow shared controls. |
| My orders | Light illustrated heading, legible back/refresh controls and white status cards. |
| About / catalogue | Approved copy and illustrations preserved; common sheet and control treatment. |
| Planned directions | Individual existing direction illustration, explicit development status, planned capabilities and return action. |
| Quran | Shared light reader controls and sheet border; original emblem, Arabic type and sacred text preserved. |
| Market / B2B | Individual illustrated headings, turquoise selected tabs, light catalogue, enquiry and checkout surfaces. Existing development labels remain unchanged. |
| Warehouse | Shared receiving, packing, stock, import, documents, reports and cash controls/cards. Printed QR labels are unchanged. |
| Staff / kitchen / courier | Illustrated workspace headings, readable operational cards, prominent actions, distinct error/destructive states. |
| Administration | Illustrated workspace cards, consistent forms, brand icons and user/role modal surfaces. |
| Notifications / tracking / chat / payment / maps / language | Shared light sheets, borders, surfaces and focus treatment. Map controls, QR codes and payment behaviour remain module-owned. |

`decoratePages()` only adds decorative heading artwork. Its observer responds to inserted headings, rather than every status update, and does not request data or change navigation.

## Validation

- `npm test`: existing integration, UI, database, localization, Market, B2B and Quran suites.
- `scripts/qa-home-browser.mjs`: approved home/catalogue, navigation and reader regression checks.
- `scripts/qa-design-browser.mjs`: all 15 screens at 320, 360, 375, 390, 414, 430, 768 and 1024px in Russian, English and Vietnamese; isolated read-only fixtures for dynamic Market/B2B views. No live account or writes.
- Browser captures are local previews. Physical Android/iOS Telegram validation requires real devices.

## Menu and role detail pass

`cafe-cards.css` owns the Cafe product-card layout: original square photographs, title then weight, collapsible descriptions, turquoise add/quantity controls, a neutral cloche fallback for absent/failed images and a single column below 360px. Product prices, stock limits and delegated cart handlers are unchanged. Market and B2B product cards share the same surfaces while preserving their distinct actions and development statuses.

The shared stylesheet also covers staff dish selectors, table/service selectors, nested kitchen actions, staff/product/location forms, accounting tables and purchase/production rows, courier detail surfaces, cash handling and the isolated superadmin sandbox. Legacy inline cash/sandbox colours reference existing brand tokens; error and destructive states keep their distinct colours. All privileged actions retain existing access checks.

`qa-menu-design-browser.mjs` uses an intercepted HTTPS origin and read-only fixture responses to exercise real product renderers and menu interactions, staff quantities, cash change calculation without confirming payment, accounting tabs, and all five sandbox role menus. Fixtures never contact a live backend. The all-screen browser suite also includes populated Market/B2B cards. Physical Telegram device testing remains separate.
