/* What the device-local stores do with what the browser's storage holds. The
   storage is the visitor's to edit and older versions have written to it, so
   valid JSON of the wrong shape must fall back field by field, never crash a
   page (a journey page that says "Routes could not be loaded"). */

import test from 'node:test';
import assert from 'node:assert/strict';

/** A localStorage that holds `stored`, and a fresh copy of the module that reads it. */
let copy = 0;
async function load(module, stored = {}) {
  const data = new Map(Object.entries(stored));
  globalThis.localStorage = {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => { data.set(key, String(value)); },
  };
  return { store: await import(`../app/${module}.js?copy=${copy++}`), data };
}

const JOURNEY = 'naarad.journey.v1';
const STUDIO = 'naarad.studio.v1';
const route = { slug: 'x-trail', name: 'X Trail', stopCount: 2 };

test('a journey of the wrong shape falls back field by field and the page-facing calls still work', async () => {
  const wrong = [
    '{"saved":"x"}', '{"journal":null}', '{"walks":{"a":1},"listened":[1,2]}', 'null', '[]', '"text"', '5', '{{{',
    '{"saved":[1,"a",null,{"name":"no slug"}],"journal":[{"title":"no id"}],"listened":{"a":"bad","b":null}}',
  ];
  for (const raw of wrong) {
    const { store } = await load('journey-store', { [JOURNEY]: raw });
    const all = store.all();
    for (const key of ['saved', 'walks', 'journal', 'downloads']) assert.deepEqual(all[key], [], `${raw}: ${key}`);
    assert.deepEqual(all.listened, {}, raw);
    assert.equal(store.isSaved('x-trail'), false, raw);
    assert.equal(store.stats().walksCompleted, 0, raw);
    assert.equal(store.badges().length, 4, raw);
    assert.equal(store.toggleSaved(route), true, raw);
    assert.equal(store.isSaved('x-trail'), true, raw);
  }
});

test('what is valid in a journey is kept, and only what is not is dropped', async () => {
  const stored = {
    saved: [{ slug: 'a', name: 'A' }, 'junk', { name: 'no slug' }],
    walks: [{ slug: 'w', distanceM: 'far' }, { slug: 'v', distanceM: 2500 }],
    journal: [{ id: 'j1', title: 'Kept' }, { title: 'no id' }],
    listened: { good: 30, bad: 'x' },
  };
  const { store } = await load('journey-store', { [JOURNEY]: JSON.stringify(stored) });
  const all = store.all();
  assert.deepEqual(all.saved.map((entry) => entry.slug), ['a']);
  assert.deepEqual(all.walks.map((entry) => entry.slug), ['w', 'v']);
  assert.deepEqual(all.journal.map((entry) => entry.id), ['j1']);
  assert.deepEqual(all.listened, { good: 30 });
  assert.equal(store.stats().kilometres, 2.5, 'a distance that is not a number counts for nothing');
});

test('clearing a journey leaves it empty: the arrays are not shared between records', async () => {
  const { store } = await load('journey-store');
  store.toggleSaved(route);
  store.completeWalk(route);
  assert.equal(store.isSaved('x-trail'), true);
  store.clearAll();
  assert.equal(store.isSaved('x-trail'), false);
  assert.equal(store.isWalked('x-trail'), false);
  const again = await load('journey-store');
  assert.equal(again.store.isSaved('x-trail'), false, 'and the next record starts empty too');
});

test('drafts of the wrong shape fall back, and the studio can still start a draft', async () => {
  const wrong = ['null', '[]', '"x"', '7', '{"drafts":"x"}', '{"drafts":{"a":1}}', '{"drafts":[null,5,"x",{}],"currentId":7}', '{{{'];
  for (const raw of wrong) {
    const { store } = await load('studio-store', { [STUDIO]: raw });
    assert.deepEqual(store.list(), [], raw);
    const draft = store.current({ slug: 'x-trail', name: 'X Trail', stops: [{ order: 1 }] });
    assert.equal(draft.routeSlug, 'x-trail', raw);
    assert.equal(store.list().length, 1, raw);
  }
});

test('a stored draft keeps the fields that are right and takes the blank draft\'s for the rest', async () => {
  const stored = {
    drafts: [{ id: 'a', title: 'Kept', stopOrder: 'three', targetLanguages: 'en', transcript: 5, routeSlug: 'x-trail', status: 'ready' }],
    currentId: 'a',
  };
  const { store } = await load('studio-store', { [STUDIO]: JSON.stringify(stored) });
  const [draft] = store.list();
  assert.equal(draft.id, 'a');
  assert.equal(draft.title, 'Kept');
  assert.equal(draft.routeSlug, 'x-trail');
  assert.equal(draft.status, 'ready');
  assert.equal(draft.stopOrder, null);
  assert.deepEqual(draft.targetLanguages, ['en']);
  assert.equal(draft.transcript, '');
  assert.equal(store.current().id, 'a', 'the stored draft is still the current one');
});
