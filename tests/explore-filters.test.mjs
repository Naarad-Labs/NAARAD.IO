/* The catalogue's range, level, language and sort filters, their chips and their address parameters. Run against the
   real content files, in a process of its own because the data is read once. */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const ROOT = new URL('../', import.meta.url);
globalThis.fetch = async (input) => {
  const file = new URL(String(input).slice(1), ROOT);
  return fs.existsSync(file) ? new Response(fs.readFileSync(file)) : new Response('missing', { status: 404 });
};

const Media = await import('../app/media.js');
const Explore = await import('../app/views/explore.js');
await Media.loadMedia();
const html = await Explore.render();

test('the controls are on the page: distance, time, difficulty, language, sort', () => {
  for (const hook of ['data-filter="distance"', 'data-filter="time"', 'data-filter-level="easy"', 'data-filter="sort"']) {
    assert.ok(html.includes(hook), hook);
  }
  assert.match(html, /<div id="active-filters" class="active-filters"[^>]* hidden>/, 'no chips until a filter is set');
});

test('with nothing set there are no chips and no address parameters', () => {
  assert.deepEqual(Explore.activeFilters(), []);
  assert.deepEqual(Explore.filterParams(), {});
});

test('each filter becomes a labelled chip and an address parameter, and clears again', () => {
  Explore.setFilter('distance', 'short');
  Explore.setFilter('time', 'mid');
  Explore.setFilter('level', 'easy');
  Explore.setFilter('sort', 'long');
  assert.deepEqual(Explore.activeFilters().map(([key]) => key), ['distance', 'time', 'level']);
  assert.deepEqual(Explore.activeFilters().map(([, label]) => label), ['Under 3 km', '1 to 3 hours', 'Easy']);
  assert.deepEqual(Explore.filterParams(), { d: 'short', t: 'mid', lv: 'easy', sort: 'long' });

  Explore.clearFilter('distance');
  assert.equal(Explore.filterParams().d, undefined);
  Explore.clearAll();
  assert.deepEqual(Explore.activeFilters(), []);
  assert.equal(Explore.filterParams().sort, 'long', 'sorting is not a filter, so clearing filters leaves it');
  Explore.setFilter('sort', 'default');
});

test('an unknown value is ignored rather than stored', () => {
  Explore.setFilter('distance', 'nonsense');
  Explore.setFilter('lang', 'xx');
  assert.deepEqual(Explore.filterParams(), {});
});

test('render() takes its filters from the navigation, ignoring unknown values', async () => {
  await Explore.render({ params: new URLSearchParams('d=short&lv=easy&lang=xx&region=Nowhere&sort=nonsense') });
  assert.deepEqual(Explore.filterParams(), { d: 'short', lv: 'easy' });
  await Explore.render({ params: new URLSearchParams('') });
  assert.deepEqual(Explore.filterParams(), {}, 'a plain address starts clean');
});

test('choosing the same difficulty again turns it off', () => {
  Explore.setFilter('level', 'moderate');
  assert.equal(Explore.filterParams().lv, 'moderate');
  Explore.setFilter('level', 'moderate');
  assert.equal(Explore.filterParams().lv, undefined);
});
