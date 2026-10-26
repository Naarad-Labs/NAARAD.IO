import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSrcset, selectUrls, sizeLabel, download, remove, BUNDLE_CACHE, MAX_PHOTO_WIDTH } from '../../app/offline-bundles.js';

const origin = 'https://naarad.io';

test('parseSrcset reads urls and widths', () => {
  assert.deepEqual(parseSrcset('/a-320.avif 320w, /a-640.avif 640w'), [{ url: '/a-320.avif', width: 320 }, { url: '/a-640.avif', width: 640 }]);
  assert.deepEqual(parseSrcset(''), []);
});

test('the bundle holds the page, the site\'s own files and phone-width photos, and never a map tile', () => {
  const urls = selectUrls({
    origin,
    slug: 'hampi-heritage-trail',
    resources: [
      `${origin}/app/views/route.js`, `${origin}/app/route.css`, `${origin}/content/routes.json`,
      `${origin}/sw.js`, 'https://tile.openstreetmap.org/12/2/3.png', 'https://server.arcgisonline.com/x/1/2/3',
      `${origin}/app/route.css`, 'https://example.com/app/evil.js',
    ],
    srcsets: [`/Images/photos/h-320.avif 320w, /Images/photos/h-960.avif 960w, /Images/photos/h-1280.avif 1280w`],
    images: ['/Images/photos/h-640.webp'],
  });
  assert.ok(urls.includes('/routes/hampi-heritage-trail/'));
  assert.ok(urls.includes('/app/views/route.js') && urls.includes('/content/routes.json'));
  assert.ok(urls.includes('/Images/photos/h-960.avif'));
  assert.ok(!urls.includes('/Images/photos/h-1280.avif'), `wider than ${MAX_PHOTO_WIDTH}px`);
  assert.ok(!urls.includes('/sw.js'));
  assert.equal(urls.filter((url) => url === '/app/route.css').length, 1);
  assert.ok(urls.every((url) => url.startsWith('/')), 'same-origin paths only: no tiles, no third parties');
  assert.deepEqual(urls, [...urls].sort());
});

test('sizeLabel is honest at both scales', () => {
  assert.equal(sizeLabel(2_621_440), '2.5 MB');
  assert.equal(sizeLabel(10_240), '10 KB');
  assert.equal(sizeLabel(10), '1 KB');
});

function fakeEnv({ failOn = null } = {}) {
  const store = new Map();
  const cache = {
    put: async (path, response) => { store.set(path, response); },
    delete: async (path) => store.delete(path),
  };
  return {
    store,
    env: {
      origin,
      fetchImpl: async (path) => (path === failOn
        ? { ok: false, status: 503 }
        : { ok: true, status: 200, clone() { return this; }, arrayBuffer: async () => new ArrayBuffer(1000) }),
      cacheStorage: { open: async (name) => { assert.equal(name, BUNDLE_CACHE); return cache; } },
      doc: { querySelectorAll: () => [] },
      perf: { getEntriesByType: () => [{ name: `${origin}/app/views/route.js` }, { name: `${origin}/content/routes.json` }] },
    },
  };
}

test('download keeps all of it or none of it', async () => {
  const good = fakeEnv();
  const bundle = await download({ slug: 'x' }, good.env);
  assert.deepEqual([...good.store.keys()].sort(), bundle.urls);
  assert.equal(bundle.bytes, bundle.urls.length * 1000, 'every file is counted');
  assert.equal(bundle.label, `${bundle.urls.length} KB`);

  const bad = fakeEnv({ failOn: '/content/routes.json' });
  await assert.rejects(download({ slug: 'x' }, bad.env), /503/);
  assert.equal(bad.store.size, 0, 'nothing is written when one file fails');
});

test('removing one route leaves files another downloaded route still needs', async () => {
  const { store, env } = fakeEnv();
  ['/a', '/shared', '/b'].forEach((path) => store.set(path, {}));
  const downloads = [{ slug: 'one', urls: ['/a', '/shared'] }, { slug: 'two', urls: ['/shared', '/b'] }];
  assert.equal(await remove('one', downloads, { cacheStorage: env.cacheStorage }), 1);
  assert.deepEqual([...store.keys()].sort(), ['/b', '/shared']);
  assert.equal(await remove('nobody', downloads, { cacheStorage: env.cacheStorage }), 0);
});

/* ---- offline bundles v2, part A: the kit, space, and all-or-nothing writes ---- */

test('every bundle carries the offline kit, so My Journey opens with no network', () => {
  const urls = selectUrls({ origin, slug: 'x', resources: [], srcsets: [], images: [] });
  for (const path of ['/journey/', '/app/views/journey.js', '/app/journey.css']) assert.ok(urls.includes(path), path);
});

function spaceEnv({ estimate, failPutAt = null, putError = null } = {}) {
  const store = new Map();
  let puts = 0;
  const cache = {
    put: async (path, response) => {
      puts += 1;
      if (failPutAt === puts) throw putError || new Error('disk');
      store.set(path, response);
    },
    delete: async (path) => store.delete(path),
  };
  return {
    store,
    env: {
      origin,
      fetchImpl: async () => ({ ok: true, status: 200, clone() { return this; }, arrayBuffer: async () => new ArrayBuffer(1_000_000) }),
      cacheStorage: { open: async () => cache },
      doc: { querySelectorAll: () => [] },
      perf: { getEntriesByType: () => [] },
      estimate,
    },
  };
}

test('a download that will not fit is refused before anything is written, in words about space', async () => {
  const { store, env } = spaceEnv({ estimate: async () => ({ usage: 4_000_000, quota: 5_000_000 }) });
  await assert.rejects(download({ slug: 'x' }, env), (error) => error.name === 'SpaceError' && /space/i.test(error.message));
  assert.equal(store.size, 0);
});

test('when the browser reports the store full part-way, nothing is left behind', async () => {
  const full = Object.assign(new Error('full'), { name: 'QuotaExceededError' });
  const { store, env } = spaceEnv({ estimate: async () => ({ usage: 0, quota: 1e12 }), failPutAt: 3, putError: full });
  await assert.rejects(download({ slug: 'x' }, env), (error) => error.name === 'SpaceError');
  assert.equal(store.size, 0, 'the files already written are removed again');
});

test('any other write failure also leaves nothing behind, and is not mistaken for a space problem', async () => {
  const { store, env } = spaceEnv({ estimate: async () => ({ usage: 0, quota: 1e12 }), failPutAt: 2 });
  await assert.rejects(download({ slug: 'x' }, env), (error) => error.name !== 'SpaceError' && /disk/.test(error.message));
  assert.equal(store.size, 0);
});

test('an unknown estimate does not block a download', async () => {
  const { store, env } = spaceEnv({ estimate: async () => undefined });
  const bundle = await download({ slug: 'x' }, env);
  assert.equal(store.size, bundle.urls.length);
});
