# Naarad

The production static site for [naarad.io](https://naarad.io), served from the repository root by GitHub Pages. No build step: `index.html` is the shell, and everything under `app/` is loaded by the browser as written.

## How it is put together

```
index.html          the shell: header, footer, and the homepage hero inline so the
                    largest image starts loading before any script runs
app/
  main.js           router; loads a view module and its stylesheet on demand
  base.css          design tokens, shell, and the primitives every page shares
  data.js           the route model (editorial routes, recorded tracks, catalogue)
  media.js          responsive <picture> markup with the licence attached
  previews.js       static route maps and elevation profiles drawn from real data
  audio.js          the listening bar, which survives navigation between views
  icons.js          inline line icons
  map.js/map.css    the interactive Leaflet map, imported only by a route page
  journey-store.js  My Journey, kept in this browser
  studio-store.js   Creator Studio drafts, kept in this browser
  views/            home, explore, route, story, studio, journey, info
content/
  routes.source.json  the routes as written, with stop coordinates and text
  routes.json         the runtime file: adds the route line, distances, elevation
  stories.json        long-form stories
  photo-sources.json  every photograph's author and licence
Images/photos/      AVIF and WebP at the widths the layouts ask for
scripts/            the three build scripts that produce the files above
e2e/                Playwright checks (cd e2e && npm install && npm test)
```

Desktop and phone share one route model and one map. Where only width changes, a
component reflows; where the interaction model differs, the composition does. On a
phone the route page leads with the map and raises the story in a sheet, with the
walk actions fixed in reach — it is not the desktop spread made narrow.

Breakpoints: 1240px (tablet/compact desktop), 1023px (tablet), 639px (phone).

## The data, and what is not there

Nothing on the site fills a gap with a plausible-looking number.

- **Route lines.** An editorial route's line is interpolated between the real
  coordinates of its stops; the data records it as a connecting line and the page
  says so. The Chennai routes in `routes/geo-tracks.json` are real recorded tracks
  and are marked as such.
- **Elevation.** Sampled from NASA SRTM 30 m through OpenTopoData along the route
  line, at about 90 m spacing. Ascent and descent are computed from those samples
  with a 3 m threshold. A route without samples shows an empty state, not a curve.
- **Photographs.** Found through the Openverse API under CC0, Public Domain Mark,
  CC BY or CC BY-SA only. Author and licence are recorded per file in
  `content/photo-sources.json` and shown on the page.
- **Narration.** No creator has recorded any yet. The listening bar reads the
  published text aloud with the device's own speech synthesis and labels it as
  such; it switches to a recording as soon as a stop carries one.
- **Creator publishing, transcription, translation, offline bundles and accounts**
  need the Naarad backend. The interface says so where you meet them.

## Rebuilding the generated files

```bash
python3 scripts/build-photos.py     # fetch and encode the photography
python3 scripts/build-routes.py     # route lines, distances, elevation profiles
python3 scripts/build-fonts.py      # subset the fonts to woff2
```

`scripts/build-photos.py` takes ids as arguments to refresh a single photograph.
Originals are cached in `.cache/photos` and are not committed.

## Development

Serve the repository root with any static server:

```bash
python3 -m http.server 4173
```

Browser checks live in `e2e` and cover both compositions:

```bash
cd e2e && npm install && npm test
```

`sw.js` serves the shell and app code cache-first, content network-first, and
photographs and map tiles as they are used. **Bump `VERSION` in `sw.js` whenever
the shell, a view module or a stylesheet changes**, or visitors keep the old one.

## Licences

Playfair Display, DM Sans and Caveat are self-hosted under the SIL Open Font
License; the licence text sits beside each font in `app/fonts`. Leaflet is
vendored under its BSD-2-Clause licence in `app/vendor/leaflet`. Map tiles come
from OpenStreetMap and Esri, attributed on the map. Photograph credits are in
`content/photo-sources.json` and on the pages themselves.
