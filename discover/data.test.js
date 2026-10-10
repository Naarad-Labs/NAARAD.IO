/* Holds discover/data.js to the same behaviour as replica/schema.test.sql.
 * The fixtures and most assertions are the SQL ones, ported.
 *
 *     node --test discover/data.test.js
 */
const test = require('node:test');
const assert = require('node:assert/strict');

// Same four tours as schema.test.sql (start points and attributes). The draft is hidden from everyone here.
const FIXTURE = { tours: [
  { id: 'a', slug: 'marina-loop', name: 'Marina Loop', sport: 'hike', theme: 'heritage-walk', difficulty: 'easy', route_type: 'loop', surface: 'mixed',
    distance_m: 2000, duration_min: 40, ascent_m: 10, rating_avg: 4.5, start_lat: 12.9826, start_lng: 80.2383, path_preview: { type: 'LineString', coordinates: [[80.2383, 12.9826], [80.252, 12.995]] } },
  { id: 'b', slug: 'far-hills', name: 'Far Hills', sport: 'hike', theme: 'nature-hike', difficulty: 'hard', route_type: 'out_and_back', surface: 'mixed',
    distance_m: 1500, duration_min: 300, ascent_m: 900, rating_avg: 4.9, start_lat: 12.97, start_lng: 77.59, path_preview: null },
  { id: 'c', slug: 'ecr-ride', name: 'ECR Ride', sport: 'cycle', theme: null, difficulty: 'moderate', route_type: 'point_to_point', surface: 'mixed',
    distance_m: 24700, duration_min: 90, ascent_m: 40, rating_avg: 4.0, start_lat: 13.0, start_lng: 80.25, path_preview: null },
  { id: 'd', slug: 'draft-trail', name: 'Draft Trail', sport: 'walk', theme: null, difficulty: 'easy', route_type: 'loop', surface: 'mixed',
    distance_m: 100, duration_min: 30, ascent_m: 0, rating_avg: null, start_lat: 12.983, start_lng: 80.24, status: 'draft' },
] };

let calls = 0;
globalThis.fetch = async () => { calls++; return { ok: true, status: 200, json: async () => FIXTURE }; };
const D = require('./data.js');

const slugs = (rows) => rows.map((r) => r.slug);
const CHENNAI = { p_lat: 12.9826, p_lng: 80.2383 };

test('default search near Chennai finds the 2 published tours, nearest first, hiding the draft', async () => {
  const rows = await D.searchTours(CHENNAI);
  assert.deepEqual(slugs(rows), ['marina-loop', 'ecr-ride']);
  assert.equal(rows[0].centre_distance_m, 0);
  assert.equal(rows[0].total_count, 2);
});

test('every filter, as in the SQL tests', async () => {
  assert.deepEqual(slugs(await D.searchTours({ ...CHENNAI, p_sport: 'cycle' })), ['ecr-ride']);
  assert.deepEqual(slugs(await D.searchTours({ ...CHENNAI, p_difficulty: ['easy'] })), ['marina-loop']);
  assert.deepEqual(slugs(await D.searchTours({ ...CHENNAI, p_max_distance_m: 5000 })), ['marina-loop']);
  assert.deepEqual(slugs(await D.searchTours({ ...CHENNAI, p_min_distance_m: 5000 })), ['ecr-ride']);
  assert.deepEqual(slugs(await D.searchTours({ ...CHENNAI, p_radius_m: 1000 })), ['marina-loop']);
  assert.deepEqual(slugs(await D.searchTours({ ...CHENNAI, p_route_type: 'loop' })), ['marina-loop']);
  assert.deepEqual(slugs(await D.searchTours({ ...CHENNAI, p_surface: 'paved' })), []);
  assert.deepEqual(slugs(await D.searchTours({ ...CHENNAI, p_max_duration_min: 60 })), ['marina-loop']);
  assert.deepEqual(slugs(await D.searchTours({ ...CHENNAI, p_min_ascent_m: 20 })), ['ecr-ride']);
  assert.deepEqual(slugs(await D.searchTours({ ...CHENNAI, p_themes: ['heritage-walk'] })), ['marina-loop']);
  assert.deepEqual(slugs(await D.searchTours({ ...CHENNAI, p_themes: ['nature-hike'] })), []);
});

test('a filter on a field the tour does not have excludes it (SQL NULL semantics)', async () => {
  // the ride has no theme, so any theme filter drops it, even when it is nearby
  assert.deepEqual(slugs(await D.searchTours({ ...CHENNAI, p_themes: ['heritage-walk', 'nature-hike'] })), ['marina-loop']);
  assert.deepEqual(slugs(await D.searchTours({ p_difficulty: [] })), [], 'an empty list matches nothing');
});

test('search near Bengaluru finds only the Bengaluru tour', async () => {
  assert.deepEqual(slugs(await D.searchTours({ p_lat: 12.9716, p_lng: 77.5946 })), ['far-hills']);
});

test('paging: total_count is the whole match, pages do not overlap, past the end is empty', async () => {
  const p1 = await D.searchTours({ ...CHENNAI, p_limit: 1 });
  assert.equal(p1[0].total_count, 2);
  assert.deepEqual(slugs(await D.searchTours({ ...CHENNAI, p_limit: 1, p_offset: 1 })), ['ecr-ride']);
  assert.deepEqual(await D.searchTours({ ...CHENNAI, p_limit: 1, p_offset: 5 }), []);
});

test('anywhere: no centre means no distance filter, best rated first, no distance column', async () => {
  const rows = await D.searchTours();
  assert.deepEqual(slugs(rows), ['far-hills', 'marina-loop', 'ecr-ride']);
  assert.equal(rows[0].centre_distance_m, null);
  assert.deepEqual(slugs(await D.searchTours({ p_sport: 'cycle' })), ['ecr-ride']);
  assert.equal((await D.searchTours({ p_radius_m: 1 })).length, 3, 'radius is ignored without a centre');
  assert.deepEqual(slugs(await D.searchTours({ p_themes: ['heritage-walk', 'nature-hike'] })), ['far-hills', 'marina-loop']);
});

test('bad input is an error with the same code the SQL raises', async () => {
  for (const args of [{ p_lat: 95, p_lng: 0 }, { p_lat: 12.98 }, { p_lng: 80.2 }, { p_lat: 0, p_lng: 181 }]) {
    await assert.rejects(D.searchTours(args), (e) => e.code === '22023', JSON.stringify(args));
  }
});

test('limits are capped: 50 rows, 200 km', async () => {
  assert.equal((await D.searchTours({ ...CHENNAI, p_limit: 9999 })).length, 2);
  // a radius over the cap is clamped to 200 km, which still excludes Bengaluru (about 290 km away)
  assert.deepEqual(slugs(await D.searchTours({ ...CHENNAI, p_radius_m: 5000000 })), ['marina-loop', 'ecr-ride']);
});

test('the map line is GeoJSON, or null where a tour has no real track', async () => {
  const rows = await D.searchTours(CHENNAI);
  assert.equal(rows[0].path_preview.type, 'LineString');
  assert.equal(rows[1].path_preview, null);
});

test('getTour: found, not found, and drafts stay hidden', async () => {
  assert.equal((await D.getTour('marina-loop')).name, 'Marina Loop');
  assert.deepEqual((await D.getTour('marina-loop')).stops, []);
  assert.equal(await D.getTour('nope'), null);
  assert.equal(await D.getTour('draft-trail'), null);
});

test('the seed is fetched once and shared', () => {
  assert.equal(calls, 1);
});
