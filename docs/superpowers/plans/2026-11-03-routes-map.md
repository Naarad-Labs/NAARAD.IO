# Routes Map Implementation Plan

**Goal:** Add a filtered catalogue map using published route starts and retain an accessible route list.

**Architecture:** Reuse the locally bundled Leaflet and existing map styling. Mount the map only when requested; share the catalogue's filtered data, and show the complete filtered list below it. Coordinates are not inferred. Tiles come from OpenStreetMap and require a connection.

**Constraints:** No geolocation, location transmission, new backend, or offline tile claim. Preserve existing filters and visual tokens.

**Decisions:** A map plus the complete list was chosen over replacing the list, so routes without coordinates and keyboard users retain access. Markers identify route starts, not route geometry.

**Steps:**
1. Test the map entry point and valid coordinate selection, observe failure, then implement.
2. Connect map updates to filtering and navigation, including loading, empty and tile error states.
3. Rebuild generated pages; run unit and site verification and record results below.

**Review focus:** Missing/invalid coordinates, no matches, unavailable tiles, rapid filter changes, and navigation during loading.

**Verification:** Full five-stage verify gate passed (deterministic build, site consistency, units, practical facts, browser checks). Build regenerates share-card JPEGs consistently with this machine’s renderer; generated assets are included.
