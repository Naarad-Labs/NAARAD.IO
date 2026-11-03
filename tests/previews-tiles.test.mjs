// node --test tests/
// Route previews draw map tiles under the line, named but not fetched until the card nears the screen.
import test from 'node:test';
import assert from 'node:assert/strict';
import { routePreview } from '../app/previews.js';

const route = {
  name: 'Demo walk',
  geometry: { coordinates: [[77.59, 12.97], [77.60, 12.98], [77.61, 12.975]] },
  stops: [{ order: 1, lng: 77.59, lat: 12.97 }, { order: 2, lng: 77.61, lat: 12.975 }],
};

const tilesOf = (svg) => [...svg.matchAll(/data-src="([^"]+)"/g)].map((m) => m[1]);

test('a preview names OpenStreetMap tiles but sets no href, so nothing is fetched until it is near the screen', () => {
  const svg = routePreview(route, { width: 320, height: 220 });
  const tiles = tilesOf(svg);
  assert.ok(tiles.length >= 1 && tiles.length <= 20, `tile count ${tiles.length}`);
  for (const url of tiles) assert.match(url, /^https:\/\/tile\.openstreetmap\.org\/\d+\/\d+\/\d+\.png$/);
  assert.doesNotMatch(svg, /<image[^>]* href=/);
  assert.match(svg, /© OpenStreetMap/);
});

test('tiles can be turned off and the grid and line are then the whole map', () => {
  const svg = routePreview(route, { tiles: false });
  assert.equal(tilesOf(svg).length, 0);
  assert.doesNotMatch(svg, /OpenStreetMap/);
  assert.match(svg, /class="rp-line"/);
});

test('the markup is the same on every call, so pre-rendered pages are byte-stable', () => {
  const strip = (s) => s.replace(/rp\d+/g, 'rpN');
  assert.equal(strip(routePreview(route)), strip(routePreview(route)));
});

test('a route with many stops drops the numbers and keeps the line', () => {
  const many = { ...route, stops: Array.from({ length: 15 }, (_, i) => ({ order: i + 1, lng: 77.59 + i * 0.001, lat: 12.97 })) };
  assert.doesNotMatch(routePreview(many), /class="rp-num"/);
});

test('a route with no geometry draws nothing', () => {
  assert.equal(routePreview({ name: 'x', geometry: { coordinates: [] } }), '');
});
