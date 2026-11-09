/* How quickly the maps start: what the Routes page and a route page ask the browser to fetch ahead of the map,
   and where the Routes page gets its tiles. (The behaviour itself is timed by hand; these pin the wiring.) */

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
const ExploreView = await import('../app/views/explore.js');
const RouteView = await import('../app/views/route.js');
await Media.loadMedia();
const routes = await Data.loadRoutes();

const has = (hints, want) => hints.some((hint) => Object.entries(want).every(([key, value]) => hint[key] === value));

test('the Routes page asks for the map code, Leaflet and the tile host before the script needs them', () => {
  const { hints } = ExploreView.meta();
  assert.ok(has(hints, { rel: 'modulepreload', href: '/app/atlas.js' }));
  assert.ok(has(hints, { rel: 'modulepreload', href: '/app/map.js' }));
  assert.ok(has(hints, { rel: 'preload', as: 'script', href: '/app/vendor/leaflet/leaflet.js' }));
  assert.ok(has(hints, { rel: 'preload', as: 'style', href: '/app/vendor/leaflet/leaflet.css' }));
  assert.ok(has(hints, { rel: 'preload', as: 'style', href: '/app/map.css' }));
  assert.ok(hints.some((hint) => hint.rel === 'preconnect' && /tile\.openstreetmap\.org/.test(hint.href)));
});

test('a route page asks for the same, minus the atlas', async () => {
  const route = routes.find((candidate) => candidate.slug === 'hampi-heritage-trail');
  const { hints } = await RouteView.meta({ route });
  assert.ok(has(hints, { rel: 'modulepreload', href: '/app/map.js' }));
  assert.ok(has(hints, { rel: 'preload', as: 'script', href: '/app/vendor/leaflet/leaflet.js' }));
  assert.equal(has(hints, { href: '/app/atlas.js' }), false);
});

test('the saved Routes page carries the hints in its head, so the browser sees them before any script runs', () => {
  const html = fs.readFileSync(new URL('routes/index.html', ROOT), 'utf8');
  assert.match(html, /<link[^>]*rel="modulepreload"[^>]*href="\/app\/map\.js"/);
  assert.match(html, /<link[^>]*rel="preload"[^>]*href="\/app\/vendor\/leaflet\/leaflet\.js"/);
});

test('both maps draw their street tiles from one keyless source; CARTO light_all needs an API key and answers with a watermark', () => {
  const map = fs.readFileSync(new URL('app/map.js', ROOT), 'utf8');
  assert.match(map, /export const STREET_URL = 'https:\/\/tile\.openstreetmap\.org\/\{z\}\/\{x\}\/\{y\}\.png'/);
  for (const file of ['app/map.js', 'app/atlas.js', 'app/seo.js', 'sw.js']) {
    assert.doesNotMatch(fs.readFileSync(new URL(file, ROOT), 'utf8'), /cartocdn/, file);
  }
  assert.doesNotMatch(fs.readFileSync(new URL('app/atlas.js', ROOT), 'utf8'), /tile\.openstreetmap\.org/, 'the atlas takes its source from map.js');
  assert.match(fs.readFileSync(new URL('sw.js', ROOT), 'utf8'), /const isTile = [^\n]*tile\\\.openstreetmap\\\.org/);
});
