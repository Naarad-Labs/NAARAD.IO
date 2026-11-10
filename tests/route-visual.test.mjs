/* The route page's visual layer: the drawn route line, the photo mosaic and the stop-photo scrubber.
   What the views draw is checked here; how it behaves in a browser is in e2e/. */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const ROOT = new URL('../', import.meta.url);
globalThis.fetch = async (input) => {
  const file = new URL(String(input).slice(1), ROOT);
  return fs.existsSync(file) ? new Response(fs.readFileSync(file)) : new Response('missing', { status: 404 });
};

const Data = await import('../app/data.js');
const Media = await import('../app/media.js');
const RouteView = await import('../app/views/route.js');
const { routeDrawPath } = await import('../app/route-draw.js');
await Media.loadMedia();
const routes = await Data.loadRoutes();

const numbers = (d) => [...d.matchAll(/-?\d+(?:\.\d+)?/g)].map((m) => Number(m[0]));

test('routeDrawPath draws nothing for fewer than two distinct points', () => {
  assert.equal(routeDrawPath([]), null);
  assert.equal(routeDrawPath([[77, 12]]), null);
  assert.equal(routeDrawPath([[77, 12], [77, 12]]), null);
});

test('routeDrawPath fits the padded box with north up', () => {
  const d = routeDrawPath([[77, 12], [78, 13]], { width: 100, height: 60, pad: 4 });
  assert.match(d, /^M/);
  const n = numbers(d);
  for (let i = 0; i < n.length; i += 2) {
    assert.ok(n[i] >= 4 && n[i] <= 96, `x ${n[i]}`);
    assert.ok(n[i + 1] >= 4 && n[i + 1] <= 56, `y ${n[i + 1]}`);
  }
  assert.ok(n[1] > n[3], 'the point further north (second) has the smaller y');
});

test('routeDrawPath keeps the aspect ratio and centres the shorter side', () => {
  const n = numbers(routeDrawPath([[77, 12], [77.01, 13]], { width: 100, height: 60, pad: 4 }));
  const xs = [n[0], n[2]];
  assert.ok(Math.abs(xs[1] - xs[0]) < 5, 'a tall thin line stays thin');
  assert.ok(Math.abs((xs[0] + xs[1]) / 2 - 50) < 1, 'and is centred');
});

test('every route with geometry draws one decorative line; the others draw none', async () => {
  assert.ok(routes.length > 15);
  for (const route of routes) {
    const html = await RouteView.render({ route, stop: route.stops[0]?.order });
    const lines = html.match(/<svg class="route-draw"[^>]*>/g) || [];
    if (!route.hasGeometry) { assert.equal(lines.length, 0, `${route.slug}: no geometry, no line`); continue; }
    assert.equal(lines.length, 1, route.slug);
    assert.match(lines[0], /aria-hidden="true"/, route.slug);
    assert.match(html, /<path d="M[^"]+" pathLength="1"/, route.slug);
  }
});

const extras = (route) => RouteView.routePhotos(route).filter((photo) => photo.id !== route.media?.photo);
const mosaicOf = (html) => (html.match(/<div class="route-mosaic[\s\S]*?<\/div>\s*<\/div>/) || [''])[0];

test('the mosaic shows up to four photographs beside the hero photograph, and nothing when there are none', async () => {
  let withMosaic = 0;
  for (const route of routes) {
    const html = await RouteView.render({ route, stop: route.stops[0]?.order });
    const tiles = [...html.matchAll(/<button type="button" class="mosaic-tile"[^>]*data-photo-open="([^"]+)"[^>]*>/g)];
    const want = Math.min(4, extras(route).length);
    assert.equal(tiles.length, want, `${route.slug}: tiles`);
    assert.equal(new Set(tiles.map((t) => t[1])).size, tiles.length, `${route.slug}: unique photographs`);
    assert.equal(html.includes('class="route-mosaic'), want > 0, `${route.slug}: wrapper only when there are tiles`);
    if (want) withMosaic++;
    for (const [tag] of tiles) {
      assert.match(tag, /data-photo-caption="[^"]+"/, route.slug);
      assert.match(tag, /aria-label="Open photograph[^"]+"/, route.slug);
    }
    if (route.media?.photo) assert.match(html, /class="[^"]*route-hero-photo/, `${route.slug}: the hero photograph stays`);
  }
  assert.ok(withMosaic > 0, 'at least one route has a mosaic');
});

test('every mosaic photograph has alternative text', async () => {
  for (const route of routes) {
    const html = await RouteView.render({ route, stop: route.stops[0]?.order });
    const block = html.match(/<div class="route-mosaic[\s\S]*?<\/div>\s*<\/div>/);
    if (!block) continue;
    for (const [img] of block[0].matchAll(/<img [^>]*>/g)) assert.match(img, /alt="[^"]+"/, `${route.slug}: ${img}`);
  }
});

const photoStops = (route) => route.stops.filter((stop) => stop.photo && Media.getPhoto(stop.photo));

test('the scrubber has one frame per stop with a photograph, and its range maps to those stops in order', async () => {
  let drawn = 0;
  for (const route of routes) {
    const stops = photoStops(route);
    const html = await RouteView.render({ route, stop: route.stops[0]?.order });
    const sections = html.match(/<section class="route-scrubber"/g) || [];
    if (stops.length < 2) { assert.equal(sections.length, 0, `${route.slug}: fewer than two photographs, no scrubber`); continue; }
    drawn++;
    assert.equal(sections.length, 1, route.slug);
    assert.equal((html.match(/<figure class="scrubber-frame"/g) || []).length, stops.length, `${route.slug}: frames`);
    const range = html.match(/<input type="range"[^>]*data-scrubber[^>]*>/)[0];
    assert.match(range, new RegExp(`min="1"[^>]*max="${stops.length}"|max="${stops.length}"[^>]*min="1"`), `${route.slug}: range bounds`);
    assert.match(range, /aria-label="[^"]+"/, route.slug);
    assert.match(range, /aria-valuetext="Stop \d+ of \d+: [^"]+"/, route.slug);
    const orders = JSON.parse(range.match(/data-scrubber-orders="([^"]+)"/)[1].replace(/&quot;/g, '"'));
    assert.deepEqual(orders, stops.map((stop) => stop.order), `${route.slug}: orders`);
    assert.equal((html.match(/<figure class="scrubber-frame"(?![^>]*hidden)/g) || []).length, 1, `${route.slug}: one frame showing`);
  }
  assert.ok(drawn > 0, 'at least one route has a scrubber');
});

test('the scrubber opens on the selected stop when it has a photograph, and is not a tab widget', async () => {
  const route = routes.find((r) => photoStops(r).length >= 3);
  const chosen = photoStops(route)[2];
  const html = await RouteView.render({ route, stop: chosen.order });
  const range = html.match(/<input type="range"[^>]*data-scrubber[^>]*>/)[0];
  assert.match(range, /value="3"/);
  assert.doesNotMatch(html.match(/<section class="route-scrubber"[\s\S]*?<\/section>/)[0], /role=|aria-selected|aria-controls/);
});

test('the mosaic is a lightbox set of its own, so a tile opens', async () => {
  for (const route of routes) {
    if (!extras(route).length) continue;
    const html = await RouteView.render({ route, stop: route.stops[0]?.order });
    assert.match(html, /<div class="route-mosaic[^"]*" data-photo-set>/, route.slug);
    const labels = [...html.matchAll(/aria-label="Open photograph (\d+) of (\d+): /g)].filter((m) => m[0]);
    assert.ok(labels.length >= 1);
  }
});

test('the note and the place chip sit over the hero photograph, not over the mosaic column', async () => {
  for (const route of routes.filter((r) => extras(r).length && r.subtitle)) {
    const html = await RouteView.render({ route, stop: route.stops[0]?.order });
    const main = html.slice(html.indexOf('class="route-hero-main"'), html.indexOf('class="route-mosaic'));
    assert.match(main, /route-hero-note/, `${route.slug}: note`);
    assert.match(main, /route-hero-place/, `${route.slug}: chip`);
  }
});

test('the scrubber names the real stop number and the real stop count when some stops have no photograph', async () => {
  const hampi = routes.find((r) => r.slug === 'hampi-heritage-trail');
  const route = { ...hampi, stops: hampi.stops.map((stop, index) => (index === 0 ? { ...stop, photo: null } : stop)) };
  const html = await RouteView.render({ route, stop: route.stops[0].order });
  const range = html.match(/<input type="range"[^>]*data-scrubber[^>]*>/)[0];
  const second = route.stops[1];
  assert.match(range, new RegExp(`aria-valuetext="Stop ${second.order} of ${route.stops.length}: ${second.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`));
});

test('the scrubber photographs do not compete with the hero photograph for loading priority', async () => {
  const hampi = routes.find((r) => r.slug === 'hampi-heritage-trail');
  const html = await RouteView.render({ route: hampi, stop: hampi.stops[0].order });
  const scrubber = html.match(/<section class="route-scrubber"[\s\S]*?<\/section>/)[0];
  assert.doesNotMatch(scrubber, /fetchpriority="high"/);
  assert.match(html.slice(0, html.indexOf('<section class="route-scrubber"')), /fetchpriority="high"/, 'the hero photograph keeps its priority');
});
