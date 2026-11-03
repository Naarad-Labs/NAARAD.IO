/* The hand-written collections stay valid: every field present, every route real, no collection empty, and the
   catalogue strip and collection pages actually render. Run against the real content in a process of its own. */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const ROOT = new URL('../', import.meta.url);
globalThis.fetch = async (input) => {
  const file = new URL(String(input).slice(1), ROOT);
  return fs.existsSync(file) ? new Response(fs.readFileSync(file)) : new Response('missing', { status: 404 });
};

const Media = await import('../app/media.js');
const Data = await import('../app/data.js');
const Collection = await import('../app/views/collection.js');
await Media.loadMedia();
const collections = await Collection.loadCollections();
const routes = await Data.loadRoutes();

test('there are collections, each with a slug, title, standfirst, intro, category and curator', () => {
  assert.ok(collections.length >= 1);
  const slugs = new Set();
  for (const collection of collections) {
    assert.match(collection.slug, /^[a-z0-9-]+$/);
    assert.ok(!slugs.has(collection.slug), `${collection.slug} is unique`);
    slugs.add(collection.slug);
    for (const field of ['title', 'standfirst', 'category', 'curator']) assert.ok(collection[field], `${collection.slug} has ${field}`);
    assert.ok(collection.intro.length >= 1, `${collection.slug} has an introduction`);
  }
});

test('every route a collection names exists, and none is named twice', () => {
  const known = new Set(routes.map((route) => route.slug));
  for (const collection of collections) {
    assert.ok(collection.routes.length >= 1, `${collection.slug} is not empty`);
    assert.equal(new Set(collection.routes).size, collection.routes.length, `${collection.slug} names no route twice`);
    for (const slug of collection.routes) assert.ok(known.has(slug), `${collection.slug}: ${slug} is a real route`);
    if (collection.cover) assert.ok(collection.routes.includes(collection.cover), `${collection.slug}: the cover is one of its routes`);
  }
});

test('the index, each page and the catalogue strip render with their titles', async () => {
  const index = await Collection.renderIndex();
  const strip = await Collection.strip();
  for (const collection of collections) {
    assert.ok(index.includes(collection.title.replace(/&/g, '&amp;')), `index lists ${collection.slug}`);
    const page = await Collection.render({ collection });
    assert.match(page, /<h1 class="display">/);
    assert.ok(page.includes('route-card'), `${collection.slug} shows route cards`);
  }
  assert.match(strip, /class="collection-strip"/);
  assert.equal((await Collection.indexMeta()).path, '/collections/');
});

test('a collection with a missing field is filled with safe defaults, not a crash', async () => {
  const page = await Collection.render({ collection: { slug: 'x', title: 'Bare', routes: [] } });
  assert.match(page, /None of this collection/);
});
