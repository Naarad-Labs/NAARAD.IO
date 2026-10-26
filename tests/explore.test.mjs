/* The catalogue's lede counts the routes with stops, and says "1 route has"
   when it is one. (Its own process: the data is read once, so a data set with
   exactly one route with stops needs a test file to itself.) */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const ROOT = new URL('../', import.meta.url);
const editorial = JSON.parse(fs.readFileSync(new URL('content/routes.json', ROOT), 'utf8'));

/** The real content files, except that only the first editorial route has stops. */
const routes = editorial.routes.map((route, index) => (index === 0 ? route : { ...route, stops: [] }));
globalThis.fetch = async (input) => {
  const path = String(input);
  if (path === '/content/routes.json') return new Response(JSON.stringify({ ...editorial, routes }));
  if (path === '/discover/seed-tours.json') return new Response(JSON.stringify({ tours: [] }));
  if (path === '/routes/geo-tracks.json') return new Response(JSON.stringify({ tracks: [] }));
  const file = new URL(path.slice(1), ROOT);
  return fs.existsSync(file) ? new Response(fs.readFileSync(file)) : new Response('missing', { status: 404 });
};

const Media = await import('../app/media.js');
const ExploreView = await import('../app/views/explore.js');
await Media.loadMedia();

test('exactly one route with stops: "1 route has", in the lede and in the description', async () => {
  assert.ok(routes[0].stops.length);
  const html = await ExploreView.render();
  assert.match(html.match(/<p class="lede">([\s\S]*?)<\/p>/)[1], /\b1 route has ordered stops/);
  assert.match(ExploreView.meta().description, /\b1 has ordered stops/);
});
