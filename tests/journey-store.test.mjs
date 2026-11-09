import test from 'node:test';
import assert from 'node:assert/strict';
import { load } from './fresh-module.mjs';

const KEY = 'naarad.journey.v1';
const saved = { saved: [{ slug: 'x-trail', name: 'X Trail' }] };

test('ready() brings in a journey stored by an earlier version, and the journey sees it', async () => {
  const { store } = await load('journey-store', { [KEY]: JSON.stringify(saved) });
  assert.equal(store.isSaved('x-trail'), true);
  assert.match(store.persistence(), /^(indexeddb|localstorage|memory)$/);
});

test('a legacy value of the wrong shape leaves an empty journey, without throwing', async () => {
  const { store } = await load('journey-store', { [KEY]: '{"saved":"x"}' });
  assert.deepEqual(store.all().saved, []);
});

test('the cache is reset by ready(): reads before it do not stick', async () => {
  const { store } = await load('journey-store', { [KEY]: JSON.stringify(saved) });
  assert.equal(typeof store.ready, 'function');
  await store.ready();
  assert.equal(store.isSaved('x-trail'), true);
});

test('drafts expose ready() too', async () => {
  const { store } = await load('studio-store');
  assert.equal(typeof store.ready, 'function');
});
