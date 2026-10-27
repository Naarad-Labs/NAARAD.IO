/* The photographs the site ships: the manifest, the files and the pages agree.
   A photograph taken out of use leaves no entry and no file behind, and no page
   asks for one the manifest does not have (it would draw a grey gap). */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const ROOT = new URL('../', import.meta.url);
const read = (path) => fs.readFileSync(new URL(path, ROOT), 'utf8');
const manifest = JSON.parse(read('content/photo-sources.json')).photos;
const ADAPTABLE = /^(CC0|Public Domain Mark|PDM|CC BY \d\.\d|CC BY-SA \d\.\d)/;

test('every photograph has both encodings at every width it lists, and every file belongs to one', () => {
  const expected = new Set();
  for (const [id, photo] of Object.entries(manifest)) {
    assert.ok(photo.widths.length, id);
    assert.ok(photo.aspect > 0, id);
    for (const width of photo.widths) {
      for (const extension of ['avif', 'webp']) {
        const name = `${id}-${width}.${extension}`;
        expected.add(name);
        assert.ok(fs.existsSync(new URL(`Images/photos/${name}`, ROOT)), `${name} is listed but missing`);
      }
    }
  }
  const stray = fs.readdirSync(new URL('Images/photos/', ROOT)).filter((name) => !expected.has(name));
  assert.deepEqual(stray, [], 'files no photograph lists');
});

test('every photograph names its author and licence, and the licence allows it to be cropped and credited', () => {
  for (const [id, photo] of Object.entries(manifest)) {
    assert.ok(photo.author, `${id}: author`);
    assert.match(photo.licence, ADAPTABLE, `${id}: licence`);
    assert.match(photo.sourcePage, /^https:\/\//, `${id}: source page`);
  }
});

test('every photograph a story, a route or a page asks for is in the manifest', () => {
  const asked = new Map();
  const note = (id, where) => { if (id) asked.set(id, [...(asked.get(id) || []), where]); };
  for (const story of JSON.parse(read('content/stories.json')).stories) {
    note(story.heroPhoto, `story ${story.slug}`);
    for (const section of story.sections) note(section.photo, `story ${story.slug}, ${section.id}`);
  }
  for (const route of JSON.parse(read('content/routes.source.json')).routes) {
    note(route.photo, `route ${route.slug}`);
    note(route.cardPhoto, `route ${route.slug} card`);
    for (const stop of route.stops) note(stop.photo, `route ${route.slug}, stop ${stop.order}`);
  }
  // The pages' own: photo: 'id' and picture('id', ...) in the views and the share-card settings.
  for (const file of ['app/views/info.js', 'app/views/home.js', 'app/views/journey.js', 'app/views/studio.js', 'app/seo.js']) {
    for (const [, id] of read(file).matchAll(/(?:photo: |picture\()'([a-z]+-[a-z0-9-]+)'/g)) note(id, file);
  }
  assert.ok(asked.size > 15);
  for (const [id, where] of asked) assert.ok(manifest[id], `${id} is asked for by ${where.join(', ')} and is not in the manifest`);
});
