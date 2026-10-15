# Umma Maps delivery MVP

The existing UMMA Global application now shares one map renderer for confirmed customer destinations, courier destinations and customer live tracking. Cartography is MapLibre GL JS + OpenFreeMap (OpenStreetMap data), with a standard OSM raster fallback on devices without WebGL. Attribution remains visible. No paid API key is added.

Customer: checkout → delivery → choose a point → explicitly request GPS or move the marker → confirm. Coordinates remain embedded in the order address for compatibility with existing orders and courier links. GPS never silently selects a delivery address.

Courier: route → **Построить маршрут от меня** explicitly requests current GPS and fetches a road route from the public FOSSGIS OSRM car endpoint. Distance and estimated driving time exclude traffic. Recalculation is manual, duplicate taps are disabled, requests time out, and closing the view aborts the fetch and ignores late GPS callbacks. Failed routes are not replaced with misleading straight lines. Text-only legacy destinations keep external Google/Apple navigation links.

Customer tracking: the existing authenticated deliveryTracking API is polled every five seconds; a courier marker and accuracy circle move on the same map without reloading an iframe. Unchecking follow preserves the viewport while still updating the marker. Stale/inactive positions are hidden. The existing server scopes access to the ordering customer and ends sharing on handover. No tracking schema, permissions or Edge Function changes were needed.

## Operating limits

- OpenFreeMap currently offers free commercial map display without registration or API keys, but provides no SLA: https://openfreemap.org/ . OSM data completeness varies; this does not create missing houses or guarantee every address.
- FOSSGIS routing is a public best-effort service, maximum one request per second, no heavy usage: https://routing.openstreetmap.de/about.html . This MVP makes a single on-demand request per courier action and throttles repeated taps locally. This is not a global quota mechanism. Before scaling concurrent couriers, use a centrally rate-limited service or an owned OSRM instance; owned hosting has operating costs.
- OSRM/FOSSGIS attribution and a map-correction link are shown in the route screen. Requests contain only origin/destination coordinates, no order or customer identity.
- This is a car route overview, not turn-by-turn or motorcycle-specific navigation. Google/Apple navigation remains available.
- Courier sharing requires GPS permission, connectivity and the Telegram app remaining open. Background/locked-screen reliability requires a separate mobile solution. The existing backend and its free-plan limits still apply.
- Address search, reverse geocoding, traffic, offline regional maps and a proprietary worldwide address database are not included in this MVP.

## Verification

`npm test` covers existing isolated cafe workflows plus map selection and tracking; `scripts/qa-umma-maps.mjs` adds geometry/ETA, explicit GPS, duplicate taps, denied GPS, service failures and late callbacks after close. Sensors and route responses in these tests are simulated. Real GPS movement on two Telegram devices and rendering across device WebViews remain field checks.
