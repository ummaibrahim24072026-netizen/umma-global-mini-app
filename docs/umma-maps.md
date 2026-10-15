# Umma Maps delivery MVP

The existing UMMA Global application now shares one map renderer for confirmed customer destinations, courier destinations and customer live tracking. Cartography is MapLibre GL JS + OpenFreeMap (OpenStreetMap data), with a standard OSM raster fallback on devices without WebGL. Attribution remains visible. No paid API key is added.

Customer: no Google/Apple navigation links in checkout or tracking. Checkout → delivery → choose a point → explicitly request GPS or move the marker → confirm. Coordinates remain embedded in the order address for compatibility with existing orders and courier links. GPS never silently selects a delivery address.

Courier: choose **Google Maps** or **Карты Apple** in the delivery order. Each opens its native directions URL directly from the tap, with the confirmed destination and no fixed origin. Google handles the current location and available navigation features. Telegram openLink is preferred; ordinary browsers use a normal HTTPS link. If the WebView API throws, an optional destination preview keeps the navigation link accessible. The internal OSRM route request has been removed.

Customer tracking: the existing authenticated deliveryTracking API is polled every five seconds; a courier marker and accuracy circle move on the same map, with a separate destination marker where coordinates are available without reloading an iframe. Unchecking follow preserves the viewport while still updating the marker. Stale/inactive positions are hidden. The existing server scopes access to the ordering customer and ends sharing on handover. No tracking schema, permissions or Edge Function changes were needed.

## Operating limits

- OpenFreeMap currently offers free commercial map display without registration or API keys, but provides no SLA: https://openfreemap.org/ . OSM data completeness varies; this does not create missing houses or guarantee every address.
- Google Maps links need no API key. Native navigation and voice depend on the installed Google Maps application, device location and its settings. Opening Google Maps does not send its GPS updates back to UMMA.
- Courier sharing requires GPS permission, connectivity and the Telegram app remaining open. Background/locked-screen reliability requires a separate mobile solution. The existing backend and its free-plan limits still apply.
- Address search, reverse geocoding, traffic, offline regional maps and a proprietary worldwide address database are not included in this MVP.

## Verification

`npm test` covers existing isolated cafe workflows plus map selection and tracking; `scripts/qa-umma-maps.mjs` verifies direct Google navigation, exact coordinates, text addresses, current-device origin, WebView failure fallback and absence of internal routing requests. Sensors and route responses in these tests are simulated. Real GPS movement on two Telegram devices and rendering across device WebViews remain field checks.
