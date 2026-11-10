/* The home page's hero: the Hampi photograph plus up to four featured routes' photographs beside it, before any text. */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const ROOT = new URL('../', import.meta.url);
globalThis.fetch = async (input) => {
  const file = new URL(String(input).slice(1), ROOT);
  return fs.existsSync(file) ? new Response(fs.readFileSync(file)) : new Response('missing', { status: 404 });
};

const Data = await import('../app/data.js');
const Media = await import('../app/media.js');
const HomeView = await import('../app/views/home.js');
await Media.loadMedia();
const featured = await Data.featuredRoutes(4);
const html = await HomeView.render();
const hero = html.match(/<section class="home-hero dither-band"[\s\S]*?<\/section>/)[0];

test('the hero keeps its dithered band, headline and main photograph', () => {
  assert.match(hero, /data-dither="sand"/);
  assert.match(hero, /<h1 id="home-title"/);
  assert.match(hero, /class="[^"]*home-hero-photo/);
});

test('beside the main photograph, one link per featured route that has a photograph, up to four', () => {
  const withPhoto = featured.filter((route) => (route.media?.card || route.media?.photo) && Media.getPhoto(route.media.card || route.media.photo));
  const tiles = [...hero.matchAll(/<a class="home-mosaic-tile" href="(\/routes\/[^"]+\/)"[^>]*>/g)];
  assert.equal(tiles.length, Math.min(4, withPhoto.length));
  assert.ok(tiles.length > 0, 'the fixture has featured routes with photographs');
  assert.deepEqual(tiles.map((tile) => tile[1]), withPhoto.slice(0, 4).map((route) => `/routes/${route.slug}/`));
  assert.equal(hero.includes('class="home-mosaic'), tiles.length > 0);
  for (const [tag] of tiles) assert.match(tag, /aria-label="[^"]+, [^"]+"/, 'each tile names its route and place');
});

test('every mosaic photograph has alternative text, and the note and place chip sit over the main photograph', () => {
  const block = hero.match(/<nav class="home-mosaic[\s\S]*?<\/nav>/)[0];
  for (const [img] of block.matchAll(/<img [^>]*>/g)) assert.match(img, /alt="[^"]*"/);
  const main = hero.slice(hero.indexOf('class="home-hero-main"'), hero.indexOf('class="home-mosaic'));
  assert.match(main, /home-hero-note/);
  assert.match(main, /home-hero-place/);
});
