# Nha Trang routing data

`nha-trang-roads.json.gz` is derived from OpenStreetMap contributors' data retrieved on 2026-11-14. It is available under the [Open Database License 1.0](https://opendatacommons.org/licenses/odbl/1-0/).

The source was the OpenStreetMap API 0.6 map endpoint. Six bounding boxes covered 109.14–109.26 longitude and 12.17–12.335 latitude. To refresh, download the six XML extracts and pass them to `python3 scripts/build-nha-trang-roads.py <extracts...>`, then update the data version in `js/maps/nha-trang-router.js`. Route times use modeled road speeds. The extract does not have real-time traffic or temporary road closure information.


## Nha Trang delivery basemap

`nha-trang-v1.pmtiles` contains roads and street names, buildings, land use, and water for the Nha Trang delivery area. The delivery tracking screen uses the same OpenFreeMap Liberty style as courier navigation. While it loads, or when it is unavailable, tracking draws tiles from this archive using same-origin HTTP Range requests and a Leaflet Canvas layer. The archive is a Produced Work distributed under ODbL 1.0. It comes from the [Protomaps basemap builds](https://maps.protomaps.com/builds/) with [OpenStreetMap attribution](https://www.openstreetmap.org/copyright).

Rebuild the archive with the same geographic coverage and change its version in `js/cafe/public-tracking.js` when replacing the published file:

```sh
pmtiles extract https://build.protomaps.com/20261122.pmtiles nha-trang-v1.pmtiles \
  --bbox=109.10,12.12,109.30,12.39 --minzoom=10 --maxzoom=15
pmtiles verify nha-trang-v1.pmtiles
```

The vendored Leaflet renderer is the browser bundle from `protomaps-leaflet@5.1.0`. Its source-map reference was removed because source maps are omitted from the release.

The browser bundles for MapLibre GL JS 5.24.0 and its Leaflet adapter 0.1.4 are vendored for the tracking screen. Their source-map references were removed because source maps are omitted from the release.
