/* The service worker (sw.js), run in a sandbox with a fake cache and a fake
   network: what it asks the server for, and what it keeps. */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
const ORIGIN = 'https://naarad.io';

/** A service worker global with its caches and network faked. */
function sandbox(network) {
  const handlers = {};
  const stores = new Map();
  const asked = [];                                  // every request the worker made to the network
  const added = [];                                  // every request handed to cache.add

  class Req extends Request {                        // relative URLs resolve against the site, as in a worker
    constructor(input, init) { super(typeof input === 'string' ? new URL(input, ORIGIN).href : input, init); }
  }
  const store = (name) => {
    if (!stores.has(name)) stores.set(name, new Map());
    return stores.get(name);
  };
  const keyOf = (request) => (typeof request === 'string' ? new URL(request, ORIGIN).href : request.url);
  const open = async (name) => {
    const entries = store(name);
    return {
      add: async (request) => { added.push(request); entries.set(keyOf(request), await network(request)); },
      put: async (request, response) => { entries.set(keyOf(request), response); },
      match: async (request) => entries.get(keyOf(request))?.clone(),
      keys: async () => [...entries.keys()].map((url) => new Req(url)),
      delete: async (request) => entries.delete(keyOf(request)),
    };
  };
  const context = {
    self: {
      addEventListener: (type, handler) => { handlers[type] = handler; },
      skipWaiting: async () => {},
      clients: { claim: async () => {} },
    },
    location: new URL(`${ORIGIN}/sw.js`),
    caches: {
      open,
      keys: async () => [...stores.keys()],
      delete: async (name) => stores.delete(name),
      match: async (request) => {
        for (const entries of stores.values()) if (entries.has(keyOf(request))) return entries.get(keyOf(request)).clone();
        return undefined;
      },
    },
    fetch: async (request) => { asked.push(request); return network(request); },
    Request: Req, Response, URL, Promise,
  };
  vm.runInNewContext(source, context);

  const run = async (type) => {
    let pending;
    await handlers[type]({ waitUntil: (promise) => { pending = promise; } });
    await pending;
  };
  const get = async (url, { navigate = false } = {}) => {
    const request = new Req(url);
    if (navigate) Object.defineProperty(request, 'mode', { value: 'navigate' });
    let responded;
    handlers.fetch({ request, respondWith: (promise) => { responded = promise; } });
    return responded ? { response: await responded, request } : { response: null, request };
  };
  return { stores, asked, added, run, get, handlers };
}

const ok = (body = 'x') => new Response(body, { status: 200 });

test('the version has moved on from the workers already in the field', () => {
  const version = source.match(/const VERSION = 'v(\d+)'/)[1];
  assert.ok(Number(version) >= 12, `VERSION is v${version}; v10 and v11 workers exist`);
});

test('install fetches the shell past the HTTP cache', async () => {
  const worker = sandbox(async () => ok());
  await worker.run('install');
  assert.ok(worker.added.length > 15);
  for (const request of worker.added) {
    assert.equal(request.cache, 'reload', request.url);
    assert.equal(new URL(request.url).origin, ORIGIN);
  }
  const urls = worker.added.map((request) => new URL(request.url).pathname);
  assert.ok(urls.includes('/app/main.js') && urls.includes('/app/urls.js') && urls.includes('/app/shell.html'));
});

test('one file that cannot be fetched does not fail the install', async () => {
  const worker = sandbox(async (request) => { if (request.url.endsWith('/app/audio.js')) throw new Error('offline'); return ok(); });
  await assert.doesNotReject(worker.run('install'));
});

test('activate removes the caches of every other version', async () => {
  const worker = sandbox(async () => ok());
  const version = source.match(/const VERSION = '(v\d+)'/)[1];
  for (const name of ['naarad-shell-v10', 'naarad-content-v10', 'naarad-shell-v11', 'naarad-pages-v11', `naarad-shell-${version}`]) worker.stores.set(name, new Map());
  await worker.run('activate');
  assert.deepEqual([...worker.stores.keys()], [`naarad-shell-${version}`]);
});

test('app code is cache-first and is fetched past the HTTP cache once', async () => {
  const worker = sandbox(async () => ok('code'));
  const first = await worker.get('/app/main.js');
  assert.equal(await first.response.text(), 'code');
  assert.equal(worker.asked.length, 1);
  assert.equal(worker.asked[0].cache, 'reload');
  const second = await worker.get('/app/main.js');
  assert.equal(await second.response.text(), 'code');
  assert.equal(worker.asked.length, 1, 'the second read came from the cache');
});

test('photographs are cache-first and are fetched past the HTTP cache too', async () => {
  const worker = sandbox(async () => ok('image'));
  await worker.get('/Images/photos/hampi-landscape-800.webp');
  assert.equal(worker.asked[0].cache, 'reload');
});

test('content is network-first and revalidated, so a deploy shows at once', async () => {
  const worker = sandbox(async () => ok('{"v":2}'));
  for (const path of ['/content/routes.json', '/content/stories.json', '/discover/seed-tours.json', '/routes/geo-tracks.json']) {
    const { response } = await worker.get(path);
    assert.equal(await response.text(), '{"v":2}', path);
  }
  assert.equal(worker.asked.length, 4);
  for (const request of worker.asked) assert.equal(request.cache, 'no-cache', request.url);
});

test('content that cannot be fetched is served from the last copy, and an unknown one fails', async () => {
  let online = true;
  const worker = sandbox(async () => { if (!online) throw new TypeError('offline'); return ok('{"v":1}'); });
  await worker.get('/content/routes.json');
  online = false;
  const { response } = await worker.get('/content/routes.json');
  assert.equal(await response.text(), '{"v":1}');
  await assert.rejects(async () => (await worker.get('/content/stories.json')).response, /offline/);
});

test('a page is network-first and revalidated; offline it is the copy from the last visit, else the shell', async () => {
  let online = true;
  const worker = sandbox(async (request) => {
    if (!online) throw new TypeError('offline');
    return ok(request.url.endsWith('/app/shell.html') ? 'shell' : `page ${new URL(request.url).pathname}`);
  });
  await worker.run('install');
  worker.asked.length = 0;

  const visited = await worker.get('/routes/hampi-heritage-trail/?stop=3', { navigate: true });
  assert.equal(await visited.response.text(), 'page /routes/hampi-heritage-trail/');
  assert.equal(worker.asked[0].cache, 'no-cache');

  online = false;
  // The same page under another query is the same document.
  assert.equal(await (await worker.get('/routes/hampi-heritage-trail/', { navigate: true })).response.text(), 'page /routes/hampi-heritage-trail/');
  assert.equal(await (await worker.get('/stories/never-visited/', { navigate: true })).response.text(), 'shell');
});

test('map tiles and other sites are not rewritten, and a POST is left alone', async () => {
  const worker = sandbox(async () => ok('tile'));
  const tile = await worker.get('https://tile.openstreetmap.org/12/2/3.png');
  assert.equal(await tile.response.text(), 'tile');
  assert.equal(worker.asked[0].cache, 'default');

  const elsewhere = await worker.get('https://example.org/app/main.js');
  assert.equal(elsewhere.response, null);

  const post = new Request(`${ORIGIN}/content/routes.json`, { method: 'POST', body: '{}' });
  let responded = false;
  worker.handlers.fetch({ request: post, respondWith: () => { responded = true; } });
  assert.equal(responded, false);
});
