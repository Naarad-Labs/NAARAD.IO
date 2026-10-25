import test from 'node:test';
import assert from 'node:assert/strict';
import { createEventQueue, cleanProps, EVENT_SCHEMA, MAX_QUEUE } from '../../app/events.js';

function fakeStorage() {
  const data = new Map();
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => { data.set(key, String(value)); },
    removeItem: (key) => { data.delete(key); },
    data,
  };
}

function setup(overrides = {}) {
  const storage = fakeStorage();
  let clock = 1_000;
  let counter = 0;
  const calls = [];
  let online = true;
  let status = 200;
  const queue = createEventQueue({
    storage,
    now: () => (clock += 10),
    newId: () => `sess${++counter}`,
    isOnline: () => online,
    endpoint: 'https://example.invalid/events',
    fetchImpl: async (url, init) => { calls.push({ url, body: JSON.parse(init.body) }); return { ok: status < 400 }; },
    disabled: false,
    ...overrides,
  });
  return { queue, storage, calls, setOnline: (value) => { online = value; }, setStatus: (value) => { status = value; } };
}

test('records nothing until the visitor consents', () => {
  const { queue, storage } = setup();
  assert.equal(queue.track('route_open', { slug: 'hampi-heritage-trail' }), null);
  assert.equal(queue.size, 0);
  assert.equal(storage.data.has('naarad.events.queue.v1'), false);
});

test('an event carries a device timestamp and a stable dedupe key', () => {
  const { queue } = setup();
  queue.setConsent(true);
  const first = queue.track('page_view', { page: 'home' });
  const second = queue.track('route_open', { slug: 'hampi-heritage-trail' });
  assert.equal(first.id, 'sess1-1');
  assert.equal(second.id, 'sess1-2');
  assert.ok(second.ts > first.ts);
});

test('the queue survives a reload with no signal', () => {
  const { queue, storage } = setup();
  queue.setConsent(true);
  queue.track('route_save', { slug: 'a' });
  queue.track('route_save', { slug: 'b' });
  const reloaded = createEventQueue({ storage, disabled: false, endpoint: null });
  assert.equal(reloaded.size, 2);
  assert.deepEqual(reloaded.peek().map((event) => event.props.slug), ['a', 'b']);
});

test('offline: flush sends nothing and keeps every event', async () => {
  const { queue, calls, setOnline } = setup();
  queue.setConsent(true);
  queue.track('page_view', { page: 'home' });
  setOnline(false);
  assert.deepEqual(await queue.flush(), { sent: 0, reason: 'offline' });
  assert.equal(queue.size, 1);
  assert.equal(calls.length, 0);
});

test('online: flush sends the batch once and empties the queue', async () => {
  const { queue, calls } = setup();
  queue.setConsent(true);
  queue.track('page_view', { page: 'home' });
  queue.track('route_open', { slug: 'x' });
  assert.deepEqual(await queue.flush(), { sent: 2, reason: 'ok' });
  assert.equal(queue.size, 0);
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].body.events.map((event) => event.id), ['sess1-1', 'sess1-2']);
});

test('a rejected or failed send keeps events, and a retry sends the same keys', async () => {
  const { queue, calls, setStatus } = setup();
  queue.setConsent(true);
  queue.track('page_view', { page: 'home' });
  setStatus(503);
  assert.equal((await queue.flush()).reason, 'rejected');
  assert.equal(queue.size, 1);
  setStatus(200);
  await queue.flush();
  assert.deepEqual(calls[0].body.events.map((event) => event.id), calls[1].body.events.map((event) => event.id));
});

test('events recorded while a send is in flight are not lost', async () => {
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  const { queue } = setup({ fetchImpl: async () => { await gate; return { ok: true }; } });
  queue.setConsent(true);
  queue.track('page_view', { page: 'home' });
  const pending = queue.flush();
  queue.track('route_open', { slug: 'late' });
  release();
  await pending;
  assert.deepEqual(queue.peek().map((event) => event.name), ['route_open']);
});

test('only one send runs at a time', async () => {
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  const { queue } = setup({ fetchImpl: async () => { await gate; return { ok: true }; } });
  queue.setConsent(true);
  queue.track('page_view', { page: 'home' });
  const first = queue.flush();
  assert.deepEqual(await queue.flush(), { sent: 0, reason: 'busy' });
  release();
  await first;
});

test('a full queue drops the oldest event and says how many', async () => {
  const { queue, calls } = setup();
  queue.setConsent(true);
  for (let i = 0; i < MAX_QUEUE + 3; i += 1) queue.track('stop_select', { slug: 's', stop: i });
  assert.equal(queue.size, MAX_QUEUE);
  assert.equal(queue.dropped, 3);
  assert.equal(queue.peek()[0].props.stop, 3);
  await queue.flush();
  assert.equal(calls[0].body.dropped_before, 3);
  assert.equal(queue.dropped, 0);
});

test('saying no erases the queue and the stored copy', () => {
  const { queue, storage } = setup();
  queue.setConsent(true);
  queue.track('page_view', { page: 'home' });
  queue.setConsent(false);
  assert.equal(queue.size, 0);
  assert.equal(storage.data.has('naarad.events.queue.v1'), false);
  assert.equal(queue.track('page_view', { page: 'home' }), null);
});

test('no identifier outlives a full flush', async () => {
  const { queue } = setup();
  queue.setConsent(true);
  queue.track('page_view', { page: 'home' });
  await queue.flush();
  assert.equal(queue.track('page_view', { page: 'home' }).id, 'sess2-1');
});

test('pre-render mode records nothing even with consent', () => {
  const { queue } = setup({ disabled: true });
  queue.setConsent(true);
  assert.equal(queue.track('page_view', { page: 'home' }), null);
});

test('without an endpoint nothing leaves the device', async () => {
  const { queue, calls } = setup({ endpoint: null });
  queue.setConsent(true);
  queue.track('page_view', { page: 'home' });
  assert.deepEqual(await queue.flush(), { sent: 0, reason: 'no-endpoint' });
  assert.equal(calls.length, 0);
});

test('a broken or missing storage does not break tracking', () => {
  const { queue } = setup({ storage: { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); }, removeItem() {} } });
  queue.setConsent(true);
  assert.ok(queue.track('page_view', { page: 'home' }));
  assert.equal(queue.size, 1);
});

test('the schema refuses unknown events, extra fields and wrong types', () => {
  assert.throws(() => cleanProps('page_load', {}), /not in EVENT_SCHEMA/);
  assert.throws(() => cleanProps('search_submit', { has_query: true, query: 'hampi' }), /not allowed/);
  assert.throws(() => cleanProps('stop_select', { slug: 'x', stop: '3' }), /must be a number/);
  assert.throws(() => cleanProps('stop_select', { slug: 'x', stop: NaN }), /must be a number/);
  assert.throws(() => cleanProps('route_open', {}), /must be a string/);
});

test('no schema field can carry free text from the visitor', () => {
  /* search text, names and places are not in any event; only slugs, counts and flags */
  const names = Object.values(EVENT_SCHEMA).flatMap((fields) => Object.keys(fields));
  for (const banned of ['query', 'q', 'name', 'email', 'phone', 'lat', 'lng', 'location', 'text', 'body']) {
    assert.ok(!names.includes(banned), `${banned} must not be an event field`);
  }
});
