import assert from 'node:assert/strict';
import { test } from 'node:test';

import { distanceKm, formatKm, located, nearest } from '../app/atlas.js';

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
