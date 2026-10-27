/* Loading the data (app/data.js, app/media.js, app/views/story.js): "the data
   is not there right now" must never look like "there is no such thing", and a
   failed load is never remembered. Each test imports its own copy of a module
   so that what one loads does not leak into the next. */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const ROOT = new URL('../', import.meta.url);
let copies = 0;
const fresh = (path) => import(`../${path}?copy=${copies++}`);

/** A fetch that serves the repository's files, with some of them failing. */
function serve({ fail = {} } = {}) {
  const calls = [];
  globalThis.fetch = async (input, init = {}) => {
    const path = String(input);
    calls.push({ path, cache: init.cache });
    const failure = fail[path];
    if (failure === 'network') throw new TypeError('Failed to fetch');
    if (failure) return new Response('error', { status: failure });
    const file = new URL(path.slice(1), ROOT);
    if (!fs.existsSync(file)) return new Response('missing', { status: 404 });
    return new Response(fs.readFileSync(file), { status: 200 });
  };
  return calls;
}

const SOURCES = ['/content/routes.json', '/discover/seed-tours.json', '/routes/geo-tracks.json'];

test('the routes load from all three sources, each revalidated', async () => {
  const calls = serve();
  const Data = await fresh('app/data.js');
  const routes = await Data.loadRoutes();
  assert.ok(routes.length >= 15);
  assert.deepEqual(calls.map((call) => call.path).sort(), [...SOURCES].sort());
  for (const call of calls) assert.equal(call.cache, 'no-cache', call.path);
  assert.deepEqual(routes.filter((route) => route.source === 'editorial').map((route) => route.slug).sort(), [
    'auroville-explorer', 'hampi-heritage-trail', 'thanjavur-living-heritage',
  ]);
});

test('a second read does not fetch again, and two at once share one load', async () => {
  const calls = serve();
  const Data = await fresh('app/data.js');
  const [one, two] = await Promise.all([Data.loadRoutes(), Data.loadRoutes()]);
  assert.equal(one, two);
  assert.equal(calls.length, 3);
  await Data.getRoute('hampi-heritage-trail');
  assert.equal(calls.length, 3);
});

for (const source of SOURCES) {
  for (const failure of ['network', 500, 404]) {
    test(`routes: ${source} failing (${failure}) rejects, and is not remembered`, async () => {
      serve({ fail: { [source]: failure } });
      const Data = await fresh('app/data.js');
      await assert.rejects(Data.loadRoutes());
      await assert.rejects(Data.getRoute('hampi-heritage-trail'), 'a failed load is an error, not "no such route"');
      serve();                                           // the network comes back
      const route = await Data.getRoute('hampi-heritage-trail');
      assert.equal(route.name, 'Hampi Heritage Trail');
    });
  }
}

test('a route that is not there is null once the data has loaded', async () => {
  serve();
  const Data = await fresh('app/data.js');
  assert.equal(await Data.getRoute('no-such-route'), null);
});

test('the photograph manifest rejects when it cannot be read, and is read again later', async () => {
  for (const failure of ['network', 500]) {
    serve({ fail: { '/content/photo-sources.json': failure } });
    const Media = await fresh('app/media.js');
    await assert.rejects(Media.loadMedia());
    assert.equal(Media.getPhoto('hampi-landscape'), null);
    const calls = serve();
    const photos = await Media.loadMedia();
    assert.ok(photos['hampi-landscape']);
    assert.equal(calls[0].cache, 'no-cache');
    await Media.loadMedia();
    assert.equal(calls.length, 1, 'remembered once it has loaded');
  }
});

test('a photograph with no layout ratio reserves its own shape; one with a ratio keeps that', async () => {
  serve();
  const Media = await fresh('app/media.js');
  await Media.loadMedia();
  const photos = JSON.parse(fs.readFileSync(new URL('content/photo-sources.json', ROOT), 'utf8')).photos;
  for (const [id, photo] of Object.entries(photos)) {
    assert.match(Media.picture(id, { alt: '' }), new RegExp(`<img [^>]*style="aspect-ratio:${photo.aspect}"`), id);
  }
  assert.match(Media.picture('hampi-landscape', { ratio: '4 / 5' }), /style="aspect-ratio:4 \/ 5"/);
  // No manifest entry, no shape to reserve.
  assert.doesNotMatch(Media.picture('no-such-photo'), /aspect-ratio/);
});

test('stories reject when the file cannot be read, and are read again later', async () => {
  for (const failure of ['network', 500, 404]) {
    serve({ fail: { '/content/stories.json': failure } });
    const Story = await fresh('app/views/story.js');
    await assert.rejects(Story.loadStories());
    await assert.rejects(Story.getStory('stone-chariot-of-hampi'), 'a failed load is an error, not "no such story"');
    const calls = serve();
    assert.equal((await Story.getStory('stone-chariot-of-hampi')).title, 'The Stone Chariot of Hampi');
    assert.equal(calls[0].cache, 'no-cache');
    assert.equal(await Story.getStory('no-such-story'), null);
  }
});
