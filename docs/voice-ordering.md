# Voice ordering

The public menu (`menu/`) and Telegram cafe share `js/cafe/voice-order.js` with small adapters to their existing carts. No new order endpoint, API key or payment path is introduced.

- Tap **Order by voice**, allow the microphone and name dishes and quantities. Speech recognition uses the selected app language (12 languages). Recognition and synthesis depend on the browser/device; text entry remains available. A browser can use its own remote recognition service.
- Names are matched against the live catalogue, translated display names and dish aliases. This is a menu command assistant, not a general-purpose LLM. Recommendations filter actual available menu descriptions; they are not dietary or allergen guarantees.
- Multiple matching drinks or recipes require an explicit variant. Upcoming batches show readiness time. Recommendations are not added until selected. Quantities default to one and are shown for review.
- The assistant reads and displays the order and current fulfilment/payment selection. Speech mode resumes listening after a spoken clarification/review. Silence, microphone denial, closing, backgrounding and language changes stop capture. Welcome audio pauses during the interaction.
- Only an exact confirmation command after review can submit. Changes to items, prices, fulfilment, address/map point or payment invalidate review. Existing checkout validation, server stock checks and guest request-key retry protection remain authoritative. The assistant never marks an order paid.
- Required delivery details must be completed in normal checkout; use **Voice review** there to confirm. A pending request with an uncertain response is retried through the existing checkout button with the same key.

## Validation

`npm run test:voice-order` covers parsing, variants, quantities, multilingual commands, recommendations, stale/duplicate speech events, microphone failures, review invalidation, real public-menu checkout with fixture responses, delivery guards, lost-response retries, and the Telegram cafe adapter with selected-location stock. No live orders are created. The full repository test suite passed locally during development; phone microphone and speaker testing remains a device check.
