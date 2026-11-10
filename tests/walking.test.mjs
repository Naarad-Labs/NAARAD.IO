/* Walking mode: which stop a walker has reached, and where the Walk button shows. The position never leaves the device. */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const ROOT = new URL('../', import.meta.url);
globalThis.fetch = async (input) => {
  const file = new URL(String(input).slice(1), ROOT);
  return fs.existsSync(file) ? new Response(fs.readFileSync(file)) : new Response('missing', { status: 404 });
};

const { arrivedStop, WALK_RADIUS_M, MAX_ACCURACY_M } = await import('../app/walking.js');
const Data = await import('../app/data.js');
const Media = await import('../app/media.js');
const RouteView = await import('../app/views/route.js');
await Media.loadMedia();
const routes = await Data.loadRoutes();

// a stop is a point; 0.001 degree of latitude is about 111 m
const stops = [
  { order: 1, name: 'One', lat: 12.0, lng: 80.0 },
  { order: 2, name: 'Two', lat: 12.002, lng: 80.0 },
  { order: 3, name: 'Three', lat: 12.004, lng: 80.0 },
  { order: 4, name: 'No point', lat: null, lng: null },
];
const at = (lat, lng, accuracy = 10) => ({ lat, lng, accuracy });

test('a walker within the radius of a stop has reached it', () => {
  assert.equal(arrivedStop(at(12.0001, 80.0), stops).order, 1);
  assert.equal(arrivedStop(at(12.002, 80.0001), stops).order, 2);
});

test('outside the radius, or on a stop with no point, nothing has been reached', () => {
  assert.equal(arrivedStop(at(12.001, 80.0), stops), null, 'between stops, about 111 m from each');
  assert.equal(arrivedStop(at(13, 81), stops), null);
  assert.equal(arrivedStop(at(12.0, 80.0), [stops[3]]), null);
  assert.equal(arrivedStop(at(12.0, 80.0), []), null);
});

test('a stop that has already played is not reached again', () => {
  assert.equal(arrivedStop(at(12.0, 80.0), stops, new Set([1])), null);
  assert.equal(arrivedStop(at(12.002, 80.0), stops, new Set([1])).order, 2);
});

test('a vague fix is ignored, and so is a fix with no usable position', () => {
  assert.equal(arrivedStop(at(12.0, 80.0, MAX_ACCURACY_M + 1), stops), null);
  assert.equal(arrivedStop(at(12.0, 80.0, MAX_ACCURACY_M), stops).order, 1);
  assert.equal(arrivedStop({ lat: NaN, lng: 80, accuracy: 5 }, stops), null);
  assert.equal(arrivedStop(null, stops), null);
});

test('when two stops are both in range, the nearer is reached', () => {
  const close = [{ order: 1, lat: 12.0, lng: 80.0 }, { order: 2, lat: 12.0003, lng: 80.0 }];
  assert.equal(arrivedStop(at(12.0002, 80.0), close).order, 2);
  assert.ok(WALK_RADIUS_M > 20 && WALK_RADIUS_M <= 60);
});

test('the Walk button is on the map of a route with two or more stops that have points, and nowhere else', async () => {
  let withButton = 0;
  for (const route of routes) {
    const html = await RouteView.render({ route, stop: route.stops[0]?.order });
    const located = route.stops.filter((stop) => Number.isFinite(stop.lat) && Number.isFinite(stop.lng)).length;
    const buttons = html.match(/<button[^>]*data-map="walk"[^>]*>/g) || [];
    assert.equal(buttons.length, located >= 2 ? 1 : 0, route.slug);
    if (buttons.length) { withButton++; assert.match(buttons[0], /aria-pressed="false"/); }
    assert.equal((html.match(/data-walk-status/g) || []).length, located >= 2 ? 1 : 0, `${route.slug}: its status line`);
  }
  assert.ok(withButton > 0);
});
