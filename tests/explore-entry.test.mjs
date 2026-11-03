// node --test tests/
// The Explore entry: theme tiles, and nearest-first ordering by distance.
import test from 'node:test';
import assert from 'node:assert/strict';
import { distanceKm, themeTiles } from '../app/views/explore.js';

test('distanceKm matches a known pair: Chennai to Hampi is about 481 km', () => {
  const km = distanceKm([80.27, 13.08], [76.46, 15.34]);
  assert.ok(Math.abs(km - 481) < 15, `got ${km}`);
  assert.equal(Math.round(distanceKm([77, 12], [77, 12])), 0);
});

test('themeTiles ranks themes by how many routes have them, then by name', () => {
  const tiles = themeTiles([
    { themes: ['Temples', 'History'], photo: 'a' },
    { themes: ['Temples'], cardPhoto: 'b' },
    { themes: ['Coast'] },
  ]);
  assert.deepEqual(tiles.map((tile) => [tile.theme, tile.n]), [['Temples', 2], ['History', 1]]);
  assert.equal(tiles[0].photo, 'a', 'the tile uses the first route\'s photograph');
});

test('themeTiles caps the count and ignores routes without themes', () => {
  const many = Array.from({ length: 10 }, (_, i) => ({ themes: [`T${i}`], photo: 'p' }));
  assert.equal(themeTiles(many, 4).length, 4);
  assert.deepEqual(themeTiles([{}, { themes: [] }]), []);
});

test('themeTiles gives each tile its own photograph when another is available', () => {
  const tiles = themeTiles([
    { themes: ['Temples', 'History'], photo: 'a' },
    { themes: ['Temples', 'History'], photo: 'b' },
  ]);
  assert.equal(new Set(tiles.map((tile) => tile.photo)).size, 2);
});
