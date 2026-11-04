import test from 'node:test';
import assert from 'node:assert/strict';
import { elevationPoint, elevationSamples } from '../app/elevation-model.js';

const route = (samples, coordinates = [[0, 0], [1, 0]]) => ({
  elevation: { samples },
  geometry: { type: 'LineString', coordinates },
});
const longitudeAfterMetres = (distanceM) => distanceM / 6_371_008.8 * 180 / Math.PI;

test('elevationSamples returns a fresh immutable copy of valid increasing samples', () => {
  const source = [{ d: 0, e: -4 }, { d: 10, e: -4 }, { d: 25, e: 3 }];
  const result = elevationSamples(route(source));
  assert.deepEqual(result, source);
  assert.notStrictEqual(result, source);
  assert.notStrictEqual(result[0], source[0]);
  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result[0]), true);
  assert.throws(() => { result[0].e = 99; }, TypeError);
  assert.deepEqual(source, [{ d: 0, e: -4 }, { d: 10, e: -4 }, { d: 25, e: 3 }]);
});

test('elevationSamples rejects malformed, nonfinite, negative-distance, unordered and duplicate data', () => {
  for (const samples of [
    null,
    [{ d: 0, e: 1 }],
    [{ d: 0, e: 1 }, { d: 0, e: 2 }],
    [{ d: 1, e: 1 }, { d: 0, e: 2 }],
    [{ d: -1, e: 1 }, { d: 2, e: 2 }],
    [{ d: 0, e: 1 }, { d: Infinity, e: 2 }],
    [{ d: 0, e: NaN }, { d: 2, e: 2 }],
    [{ d: 0, e: 1 }, null],
    [{ d: '0', e: 1 }, { d: 2, e: 2 }],
  ]) assert.deepEqual(elevationSamples(route(samples)), []);
  assert.deepEqual(elevationSamples(null), []);
});

test('elevationPoint interpolates height and coordinate at endpoints and midpoint', () => {
  const endLongitude = longitudeAfterMetres(100);
  const source = route([{ d: 0, e: 10 }, { d: 100, e: 30 }], [[0, 0], [endLongitude, 0]]);
  const endpoint = elevationPoint(source, 0);
  assert.equal(endpoint.elevationM, 10);
  assert.equal(endpoint.distanceM, 0);
  assert.deepEqual(endpoint.coordinate, [0, 0]);
  const middle = elevationPoint(source, 50);
  assert.equal(middle.elevationM, 20);
  assert.equal(middle.distanceM, 50);
  assert.ok(Math.abs(middle.coordinate[0] - endLongitude / 2) < 1e-8);
  assert.ok(Math.abs(middle.coordinate[1]) < 1e-8);
  const final = elevationPoint(source, 100);
  assert.equal(final.elevationM, 30);
  assert.deepEqual(final.coordinate, [endLongitude, 0]);
});

test('elevationPoint clamps distance while preserving flat and negative elevation', () => {
  const endLongitude = longitudeAfterMetres(20);
  const source = route([{ d: 0, e: -9 }, { d: 20, e: -9 }], [[0, 0], [endLongitude, 0]]);
  assert.deepEqual(elevationPoint(source, -50), { distanceM: 0, elevationM: -9, coordinate: [0, 0] });
  assert.deepEqual(elevationPoint(source, 500), { distanceM: 20, elevationM: -9, coordinate: [endLongitude, 0] });
});

test('elevationPoint rejects nonfinite input and absent valid samples', () => {
  const source = route([{ d: 0, e: 10 }, { d: 10, e: 20 }]);
  for (const distance of [NaN, Infinity, -Infinity, '5', null]) assert.equal(elevationPoint(source, distance), null);
  assert.equal(elevationPoint(route([{ d: 0, e: 1 }]), 0), null);
});

test('elevationPoint reports null coordinate when published geometry is absent or invalid', () => {
  const samples = [{ d: 0, e: 0 }, { d: 100, e: 100 }];
  assert.equal(elevationPoint({ elevation: { samples } }, 50).coordinate, null);
  assert.equal(elevationPoint({ ...route(samples), geometry: { type: 'Point', coordinates: [0, 0] } }, 50).coordinate, null);
  assert.equal(elevationPoint({ ...route(samples), geometry: { type: 'LineString', coordinates: [[0, 0], [181, 0]] } }, 50).coordinate, null);
  assert.equal(elevationPoint({ ...route(samples), geometry: { type: 'LineString', coordinates: [[0, 0]] } }, 50).coordinate, null);
});

test('elevationPoint accepts the published normalized route geometry shape', () => {
  const endLongitude = longitudeAfterMetres(100);
  const source = {
    elevation: { samples: [{ d: 0, e: 10 }, { d: 100, e: 30 }] },
    geometry: { kind: 'connecting-line', coordinates: [[0, 0], [endLongitude, 0]] },
  };
  const result = elevationPoint(source, 50);
  assert.equal(result.elevationM, 20);
  assert.ok(Math.abs(result.coordinate[0] - endLongitude / 2) < 1e-8);
});

test('duplicate geometry vertices do not disturb cumulative interpolation', () => {
  const endLongitude = longitudeAfterMetres(100);
  const source = route([{ d: 0, e: 0 }, { d: 100, e: 10 }], [[0, 0], [0, 0], [endLongitude, 0]]);
  const result = elevationPoint(source, 50);
  assert.equal(result.elevationM, 5);
  assert.ok(Math.abs(result.coordinate[0] - endLongitude / 2) < 1e-8);
});

test('geometry interpolation crosses the antimeridian over the shorter longitude arc', () => {
  const lengthM = 2 * Math.PI / 180 * 6_371_008.8;
  const source = route([{ d: 0, e: 0 }, { d: lengthM, e: 10 }], [[179, 0], [-179, 0]]);
  const result = elevationPoint(source, lengthM / 2);
  assert.ok(Math.abs(Math.abs(result.coordinate[0]) - 180) < 1e-6);
  assert.ok(Math.abs(result.coordinate[1]) < 1e-8);
});
