/* The Routes page: the search sits over the map, once, and the page still has it when there is no map. */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const ROOT = new URL('../', import.meta.url);
globalThis.fetch = async (input) => {
  const file = new URL(String(input).slice(1), ROOT);
  return fs.existsSync(file) ? new Response(fs.readFileSync(file)) : new Response('missing', { status: 404 });
};

const Media = await import('../app/media.js');
const ExploreView = await import('../app/views/explore.js');
await Media.loadMedia();
const html = await ExploreView.render({});

test('the one search box is inside the map frame, not in the page header', () => {
  assert.equal((html.match(/id="catalogue-query"/g) || []).length, 1);
  const atlas = html.match(/<section class="atlas"[\s\S]*?<\/section>/)[0];
  assert.match(atlas, /id="catalogue-query"/);
  assert.doesNotMatch(html.match(/<header class="catalogue-hero[\s\S]*?<\/header>/)[0], /id="catalogue-query"/);
});

test('the filters are named so the map frame can link to them', () => {
  assert.match(html, /<aside class="catalogue-filters" id="catalogue-filters"/);
  assert.match(html.match(/<section class="atlas"[\s\S]*?<\/section>/)[0], /href="#catalogue-filters"/);
});
