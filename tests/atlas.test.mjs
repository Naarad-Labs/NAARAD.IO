import assert from 'node:assert/strict';
import { test } from 'node:test';

import { distanceKm, formatKm, located, nearest, routeBounds, sliderMarkup } from '../app/atlas.js';

const chennai = { lat: 13.0827, lng: 80.2707 };
const mylapore = { lat: 13.0339, lng: 80.2619 };
const hampi = { lat: 15.335, lng: 76.46 };

const route = (slug, lat, lng, extra = {}) => ({ slug, name: slug, startLat: lat, startLng: lng, ...extra });

test('distance is the great-circle distance', () => {
  assert.equal(distanceKm(chennai, chennai), 0);
  assert.ok(Math.abs(distanceKm(chennai, mylapore) - 5.5) < 0.3);
  assert.ok(Math.abs(distanceKm(chennai, hampi) - 481) < 10);
});

test('routes without a usable start point are left out', () => {
  const routes = [route('a', 13, 80), route('b', null, null), route('c', 'x', 80), route('d', 95, 80), { slug: 'e' }];
  assert.deepEqual(located(routes).map((entry) => entry.route.slug), ['a']);
});

test('nearest sorts by distance and honours the count', () => {
  const routes = [route('far', hampi.lat, hampi.lng), route('near', mylapore.lat, mylapore.lng), route('none', null, null)];
  const out = nearest(routes, chennai, 2);
  assert.deepEqual(out.map((entry) => entry.route.slug), ['near', 'far']);
  assert.ok(out[0].km < out[1].km);
  assert.equal(nearest(routes, chennai, 1).length, 1);
  assert.deepEqual(nearest([], chennai), []);
});

test('distances read the way a walker says them', () => {
  assert.equal(formatKm(0.45), '450 m');
  assert.equal(formatKm(0.004), '10 m');
  assert.equal(formatKm(3.44), '3.4 km');
  assert.equal(formatKm(12.6), '13 km');
});

test('routeBounds frames the whole line when there is one, and a small box round the start when there is not', () => {
  const line = route('hampi', 15.3, 76.4, { geometry: { coordinates: [[76.46, 15.335], [76.47, 15.34], [76.45, 15.33]] } });
  assert.deepEqual(routeBounds(line), [[15.33, 76.45], [15.34, 76.47]]);
  const [[s, w], [n, e]] = routeBounds(route('dot', 13, 80));
  assert.ok(s < 13 && n > 13 && w < 80 && e > 80, 'a box round the start point');
  assert.equal(routeBounds(route('none', null, null)), null);
  assert.equal(routeBounds(route('one', 13, 80, { geometry: { coordinates: [[80, 13]] } })).length, 2, 'one point falls back to the start box');
});

test('the slider has one card per located route, each linking to its page, and none for a route with no start point', () => {
  const routes = [route('a', 13, 80, { name: 'Alpha', location: 'Chennai' }), route('b', null, null), route('c', 15, 76, { name: 'Gamma' })];
  const html = sliderMarkup(routes);
  assert.equal((html.match(/<li /g) || []).length, 2);
  assert.match(html, /href="\/routes\/a\/"/);
  assert.match(html, /data-slug="c"/);
  assert.doesNotMatch(html, /data-slug="b"/);
  assert.match(html, /Alpha/);
  assert.equal(sliderMarkup([route('b', null, null)]), '');
});

test('the search form goes inside the map frame when there is a map, and stays out of it when there is none', async () => {
  const { atlasMarkup } = await import('../app/atlas.js');
  const form = '<form class="catalogue-search"><input id="catalogue-query"></form>';
  const withMap = atlasMarkup([route('a', 13, 80)], { search: form });
  assert.match(withMap, /<div class="atlas-head">[\s\S]*<form class="catalogue-search">[\s\S]*<\/div>\s*<div class="atlas-map/);
  assert.equal((withMap.match(/id="catalogue-query"/g) || []).length, 1);
  assert.equal(atlasMarkup([route('b', null, null)], { search: form }), '', 'no located route, no map: the page keeps its own search');
});
