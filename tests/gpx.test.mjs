// node --test tests/
// The GPX export: the line becomes a track, the stops become waypoints, and nothing unsafe reaches the XML.
import test from 'node:test';
import assert from 'node:assert/strict';
import { routeGpx } from '../app/gpx.js';

const route = {
  slug: 'demo-walk',
  name: 'Demo & <Walk>',
  geometry: { coordinates: [[77.59, 12.97], [77.6, 12.98]] },
  stops: [{ order: 1, name: 'The "Gate"', lat: 12.97, lng: 77.59 }],
};

test('a route becomes one track with its points, and a waypoint per stop', () => {
  const gpx = routeGpx(route);
  assert.match(gpx, /^<\?xml version="1\.0" encoding="UTF-8"\?>/);
  assert.equal((gpx.match(/<trkpt /g) || []).length, 2);
  assert.match(gpx, /<trkpt lat="12\.970000" lon="77\.590000">/);
  assert.equal((gpx.match(/<wpt /g) || []).length, 1);
});

test('names are escaped so the file stays valid XML', () => {
  const gpx = routeGpx(route);
  assert.match(gpx, /Demo &amp; &lt;Walk&gt;/);
  assert.match(gpx, /1\. The &quot;Gate&quot;/);
  assert.doesNotMatch(gpx, /<Walk>/);
});

test('a route with no line exports nothing', () => {
  assert.equal(routeGpx({ slug: 'x', name: 'x', geometry: { coordinates: [] } }), '');
  assert.equal(routeGpx({ slug: 'x', name: 'x' }), '');
});
