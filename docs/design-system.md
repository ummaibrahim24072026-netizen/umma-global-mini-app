# UMMA GLOBAL application design

The approved home, illustrated directions and five-tab navigation define the application’s visual language. `css/design-system.css` applies it to the existing customer, employee and management screens. It loads after module styles; module-owned interaction and data remain unchanged.

## Foundations

- Palette: existing `brand.css` turquoise, light surfaces, `app.css` gold. Error, warning and destructive states keep their semantic colours.
- Cards: 24px corners, fine turquoise border, subtle shadow. Gold identifies an emphasis, rather than every surface.
- Controls: 44px minimum action target, 48px text fields, visible keyboard focus, full translated labels.
- Typography: existing interface fonts. Quran Arabic, translations, reading sizes and line heights remain owned by `quran.css`.
- Images: approved illustration atlases, cropped through the single `directionArtwork` renderer. Decorative images have empty alt text and SVG fallbacks. No new image downloads or APIs.

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
| Administration | Light workspace cards, consistent forms, brand icons and user/role modal surfaces. |
| Notifications / tracking / chat / payment / maps / language | Shared light sheets, borders, surfaces and focus treatment. Map controls, QR codes and payment behaviour remain module-owned. |

`decoratePages()` only adds decorative heading artwork. Its observer responds to inserted headings, rather than every status update, and does not request data or change navigation.

## Validation

- `npm test`: existing integration, UI, database, localization, Market, B2B and Quran suites.
- `scripts/qa-home-browser.mjs`: approved home/catalogue, navigation and reader regression checks.
- `scripts/qa-design-browser.mjs`: all 15 screens at 320, 360, 375, 390, 414, 430, 768 and 1024px in Russian, English and Vietnamese; isolated read-only fixtures for dynamic Market/B2B views. No live account or writes.
- Browser captures are local previews. Physical Android/iOS Telegram validation requires real devices.
