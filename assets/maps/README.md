# Nha Trang routing data

`nha-trang-roads.json.gz` is derived from OpenStreetMap contributors' data retrieved on 2026-11-14. It is available under the [Open Database License 1.0](https://opendatacommons.org/licenses/odbl/1-0/).

The source was the OpenStreetMap API 0.6 map endpoint. Six bounding boxes covered 109.14–109.26 longitude and 12.17–12.335 latitude. To refresh, download the six XML extracts and pass them to `python3 scripts/build-nha-trang-roads.py <extracts...>`, then update the data version in `js/maps/nha-trang-router.js`. Route times use modeled road speeds. The extract does not have real-time traffic or temporary road closure information.
