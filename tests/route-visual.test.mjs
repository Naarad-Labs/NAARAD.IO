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
