# App languages

Supported interface languages: Russian (`ru`), English (`en`), Vietnamese (`vi`), Arabic (`ar`), Indonesian (`id`), Thai (`th`), Simplified Chinese (`zh`), Korean (`ko`), French (`fr`), German (`de`), Portuguese (`pt`) and Turkish (`tr`).

`js/core/languages.js` provides native names, locale metadata and built-in additional catalogues. Chinese regional/script tags use Simplified Chinese. Portuguese uses the `pt-PT` formatting locale. Legacy Indonesian `in` tags resolve to `id`. Arabic sets root `dir="rtl"`; maps, QR imagery, coordinates and phone/number inputs remain LTR. The picker scrolls within the viewport and retains native language names.

Resolution order: explicit local preference, Telegram `initDataUnsafe.user.language_code`, device `navigator.languages`, English. Region tags such as `ru-RU` and `vi-VN` resolve to their base language. An unsupported Telegram language uses English. Language is presentation only; signed Telegram initData remains the authentication source.

The header language button opens a keyboard-accessible dialog with an automatic option. The selection is stored under `umma-language`. Switching does not reload the app, submit requests or clear cart/contact data. The visible order history is refreshed when switching to select translated item snapshots and date formats.

`js/core/translations.js` holds reviewed English/Vietnamese equivalents for Russian interface keys. `js/core/i18n.js` exposes `t`, `field`, `locale`, `setLanguage` and a `umma:languagechange` event. A legacy DOM adapter translates existing and newly rendered interface text, placeholders and accessible labels. It tracks original text to support reversible switching. Input values, editable content and `translate="no"` elements are excluded. New components should use explicit `t()` calls and protect user-authored display content with `translate="no"`.

Menu and cart use `name_<language>` and `description_<language>` fields. Missing content falls back to English, Russian, then Vietnamese. Menu search continues to search all three languages. Order history selects localized `product_name_<language>` snapshots; original API enum values, VND currency, QR payloads and payment logic are unchanged.

Scope: static screens and primary customer menu, checkout, QR/receipt, location and tracking copy. Unlisted server errors and some dynamic staff/accounting messages retain their original Russian wording; the adapter does not invent translations or send private content to translation services. Bot messages are separate server-side content and are not translated by this frontend change. Untranslated catalogue entries in the nine additional languages fall back to the existing English interface copy. New languages need catalogue and locale metadata; RTL additions also need a layout pass.

Validation: `node scripts/qa-i18n.mjs` covers all twelve languages, regional tags, Arabic RTL/LTR switching, catalogue completeness, native picker options, unchanged API enum values, dish-name fallback, Telegram priority, region tags, unsupported language and browser fallbacks, persisted preference, dynamic/reversible translations, input preservation, accessibility, the actual header picker, product fields and cart preservation. `npm test` includes this suite. No live bank transaction or real device Telegram test is performed by the suite.
