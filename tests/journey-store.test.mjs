import test from 'node:test';
import assert from 'node:assert/strict';
import { load } from './fresh-module.mjs';

const KEY = 'naarad.journey.v1';
const saved = { saved: [{ slug: 'x-trail', name: 'X Trail' }] };

test('ready() brings in a journey stored by an earlier version, and the journey sees it', async () => {
  const { store } = await load('journey-store', { [KEY]: JSON.stringify(saved) });
  assert.equal(store.isSaved('x-trail'), true);
  assert.equal(store.persistence(), 'localstorage'); // Node has no IndexedDB: the fake localStorage is the backend and keeps the key
});

test('a legacy value of the wrong shape leaves an empty journey, without throwing', async () => {
  const { store } = await load('journey-store', { [KEY]: '{"saved":"x"}' });
  assert.deepEqual(store.all().saved, []);
});

test('the cache is reset by ready(): a read before it does not stick', async () => {
  const { store } = await load('journey-store', { [KEY]: JSON.stringify(saved) }, { wait: false });
  assert.equal(store.isSaved('x-trail'), false, 'before ready() the store holds nothing yet');
  await store.ready();
  assert.equal(store.isSaved('x-trail'), true);
});

test('drafts expose ready() too', async () => {
  const { store } = await load('studio-store');
  assert.equal(typeof store.ready, 'function');
});
