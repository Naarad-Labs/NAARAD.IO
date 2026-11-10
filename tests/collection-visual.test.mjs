/* A collection page opens on a mosaic: its cover route's photograph large, up to four more beside it, each a link. */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const ROOT = new URL('../', import.meta.url);
globalThis.fetch = async (input) => {
  const file = new URL(String(input).slice(1), ROOT);
  return fs.existsSync(file) ? new Response(fs.readFileSync(file)) : new Response('missing', { status: 404 });
};

const Media = await import('../app/media.js');
const CollectionView = await import('../app/views/collection.js');
await Media.loadMedia();
const collections = await CollectionView.loadCollections();

const photoOf = (route) => route.media?.card || route.media?.photo || null;

test('each collection page shows up to five of its routes as photographs, the cover route first, before the heading', async () => {
  assert.ok(collections.length >= 3);
  let seen = 0;
  for (const collection of collections) {
    const routes = await CollectionView.routesOf(collection);
    // The cover route first; two routes can share a photograph, and the mosaic shows each photograph once.
    const eligible = routes.filter((route) => photoOf(route) && Media.getPhoto(photoOf(route)));
    const cover = eligible.find((route) => route.slug === collection.cover) || eligible[0];
    const seenPhotos = new Set();
    const withPhoto = (cover ? [cover, ...eligible.filter((route) => route !== cover)] : []).filter((route) => !seenPhotos.has(photoOf(route)) && seenPhotos.add(photoOf(route)));
    const html = await CollectionView.render({ collection });
    const tiles = [...html.matchAll(/<a class="collection-mosaic-tile( is-lead)?" href="(\/routes\/[^"]+\/)"[^>]*>/g)];
    assert.equal(tiles.length, Math.min(5, withPhoto.length), collection.slug);
    if (!tiles.length) { assert.doesNotMatch(html, /class="collection-mosaic/, collection.slug); continue; }
    seen++;
    assert.ok(tiles[0][1], `${collection.slug}: the first tile is the lead`);
    assert.equal(tiles.filter((tile) => tile[1]).length, 1, `${collection.slug}: one lead tile`);
    assert.equal(tiles[0][2], `/routes/${cover.slug}/`, `${collection.slug}: the cover route leads`);
    assert.equal(new Set(tiles.map((tile) => tile[2])).size, tiles.length, `${collection.slug}: no route twice`);
    assert.ok(html.indexOf('collection-mosaic') < html.indexOf('<header class="catalogue-hero'), `${collection.slug}: before the heading`);
    assert.match(html, new RegExp(`class="collection-mosaic is-${tiles.length}"`), collection.slug);
  }
  assert.ok(seen >= 3, 'at least three collections have a mosaic');
});

test('every tile names its route and place, and its photograph is decorative', async () => {
  const html = await CollectionView.render({ collection: collections[0] });
  const block = html.match(/<nav class="collection-mosaic[\s\S]*?<\/nav>/)[0];
  for (const [tag] of block.matchAll(/<a class="collection-mosaic-tile[^>]*>/g)) assert.match(tag, /aria-label="[^"]+, [^"]+"/);
  for (const [img] of block.matchAll(/<img [^>]*>/g)) assert.match(img, /alt=""/);
});

test('a collection with no photographed route has no mosaic and still renders', async () => {
  const bare = { slug: 'bare', category: 'Test', title: 'Bare', standfirst: 's', curator: 'c', intro: [], routes: [] };
  const html = await CollectionView.render({ collection: bare });
  assert.doesNotMatch(html, /collection-mosaic/);
  assert.match(html, /<h1 class="display">Bare<\/h1>/);
});
