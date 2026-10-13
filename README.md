# Naarad heritage atlas

This is the production static site for [naarad.io](https://naarad.io), served from the repository root by GitHub Pages. `index.html` is the responsive editorial shell. `app/main.js` renders the home, catalogue, stories, creator, about, and route views from `discover/seed-tours.json`. `app/map.js` mounts the interactive Leaflet map only when a route opens; Leaflet is bundled in `app/vendor/leaflet` under its MIT license. The Playfair Display and DM Sans fonts are self-hosted under the OFL licenses in `app/fonts`. Map imagery comes from Esri and OpenStreetMap, with attribution shown on the map.

The default URL opens the Hampi route detail shown in the visual reference. Use `/?view=home` for the home page, `/?view=explore` for the searchable route catalogue, and `/?route=<slug>` for a route deep link. The layout changes at 800 px from a desktop sidebar to a mobile map and route sheet.

Route metadata is normalized in `app/data.js`. Hampi currently has a published start point, distance, duration, and ascent, but no GPS line, ordered story stops, audio, or sampled elevation profile. The interface shows those fields only when source data exists. Routes with published GeoJSON geometry display a path on the map. Creator publishing and audio playback require a future content and service backend.

For local development, serve the repository root with any static server, such as `python3 -m http.server 4173`. Browser checks live in `e2e` and run with `cd e2e && npm install && npm test`. The former Discover tests remain in that folder as an archive; `playwright.config.js` selects the current revamp suite.

The `Images` directory contains inherited site photography. Rights metadata for several inherited images has not been recorded; `app/media.js` labels those entries unverified. Confirm licenses or replace them before any broader asset syndication.
