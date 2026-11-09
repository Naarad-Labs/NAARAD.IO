import test from 'node:test';
import assert from 'node:assert/strict';
import { openStore } from '../app/idb.js';
import { createEventQueue, MAX_QUEUE } from '../app/events.js';

const KEY_QUEUE = 'naarad.events.queue.v1';
const settle = () => new Promise((r) => setTimeout(r, 5));
const make = (store, extra = {}) => createEventQueue({ storage: store, disabled: false, newId: () => 'S', ...extra });

test('consent and schema rules are unchanged', async () => {
  const store = openStore({ backend: 'memory' });
  await store.ready();
  const q = make(store);
  assert.equal(q.track('route_open', { slug: 'x' }), null, 'nothing before consent');
  assert.equal(q.size, 0);
  q.setConsent(true);
  assert.throws(() => q.track('route_open', { slug: 'x', name: 'Asha' }), /not allowed/);
  assert.ok(q.track('route_open', { slug: 'x' }));
  q.setConsent(false);
  assert.equal(q.size, 0);
  assert.equal(store.getItem(KEY_QUEUE), null);
});

test('state saved in the store is restored after ready() by a new queue', async () => {
  const store = openStore({ backend: 'memory' });
  await store.ready();
  const a = make(store);
  await a.ready;
  a.setConsent(true);
  a.track('route_open', { slug: 'x' });
  a.track('route_save', { slug: 'x' });
  const b = make(store);
  await b.ready;
  assert.equal(b.consent, true);
  assert.deepEqual(b.peek().map((e) => e.id), ['S-1', 'S-2']);
});

test('an event recorded before ready() follows the persisted ones, with no duplicate keys', async () => {
  const seed = openStore({ backend: 'memory' });
  await seed.ready();
  const a = make(seed);
  await a.ready;
  a.setConsent(true);
  a.track('route_open', { slug: 'x' });
  // a second store whose ready() resolves later, holding the first store's data
  const data = new Map([[KEY_QUEUE, seed.getItem(KEY_QUEUE)], ['naarad.events.consent.v1', 'yes']]);
  const slow = openStore({ adapter: { load: async () => { await settle(); return new Map(data); }, write: async () => {}, remove: async () => {} } });
  let n = 0;
  const q = make(slow, { newId: () => `N${++n}` });
  q.setConsent(true);
  q.track('route_save', { slug: 'y' }); // before ready(): not yet in the store's view of the queue
  assert.equal(q.size, 1);
  await q.ready;
  assert.deepEqual(q.peek().map((e) => e.id), ['S-1', 'N1-1']);
  assert.equal(new Set(q.peek().map((e) => e.id)).size, 2);
  assert.ok(q.size <= MAX_QUEUE);
});

function fakeTimers() {
  const timers = [];
  return { timers, setTimer: (fn, ms) => { const t = { fn, ms, live: true }; timers.push(t); return t; }, clearTimer: (t) => { if (t) t.live = false; } };
}

test('flush is driven by the retrier: failure retries at backoffDelay, an empty queue stops', async () => {
  const clock = fakeTimers();
  let ok = false;
  const fetchImpl = async () => ({ ok });
  // An earlier visit left one event; flushing starts at boot (spec: online, visible, boot), not on each track().
  const store = openStore({ backend: 'memory' });
  await store.ready();
  const earlier = make(store);
  await earlier.ready;
  earlier.setConsent(true);
  earlier.track('route_open', { slug: 'x' });
  const q = make(store, { endpoint: 'https://e.test', fetchImpl, isOnline: () => true, random: () => 0.5, ...clock });
  await q.ready;
  await settle();
  const live = () => clock.timers.filter((t) => t.live);
  assert.equal(live().length, 1);
  assert.equal(live()[0].ms, 1000);
  ok = true;
  const t = live()[0]; t.live = false; t.fn();
  await settle();
  assert.equal(q.size, 0);
  assert.equal(live().length, 0);
});

test('4xx responses drop the event and do NOT retry forever', async () => {
  const clock = fakeTimers();
  // A call that returns 4xx should be treated as permanent failure.
  // The item is removed and dropped count is incremented.
  let responses = [{ status: 400, ok: false }];
  const fetchImpl = async () => responses.shift() || { ok: true };
  const store = openStore({ backend: 'memory' });
  await store.ready();
  const q = make(store, { endpoint: 'https://e.test', fetchImpl, isOnline: () => true, random: () => 0.5, ...clock });
  await q.ready;
  // Track an event (after ready, the retrier stops on empty queue, so flush manually)
  q.setConsent(true);
  const event = q.track('route_open', { slug: 'x' });
  assert.ok(event, 'event should be tracked');
  assert.equal(q.size, 1);
  assert.equal(q.dropped, 0);
  // Flush manually; the retry loop stops when queue was empty at boot.
  // On 4xx, the item is dropped and count incremented, no retry timer.
  const result = await q.flush();
  assert.equal(result.reason, 'permanent-failure', '4xx returns permanent-failure');
  const live = () => clock.timers.filter((t) => t.live);
  assert.equal(live().length, 0, '4xx means no retry timer');
  assert.equal(q.size, 0, 'queue should be empty after 4xx');
  assert.equal(q.dropped, 1, 'dropped count should be 1 for the 4xx event');
});

test('4xx responses during queue fills count dropped items correctly', async () => {
  const clock = fakeTimers();
  // Multiple 4xx should be dropped immediately, no retry scheduled.
  let responses = [
    { status: 400, ok: false },
    { status: 400, ok: false },
    { status: 401, ok: false },
  ];
  const fetchImpl = async () => responses.shift() || { ok: true };
  const store = openStore({ backend: 'memory' });
  await store.ready();
  const q = make(store, { endpoint: 'https://e.test', fetchImpl, isOnline: () => true, random: () => 0.5, ...clock });
  await q.ready;
  q.setConsent(true);
  q.track('route_open', { slug: 'x' });
  q.track('route_save', { slug: 'y' });
  q.track('stop_select', { slug: 'z', stop: 1 });
  assert.equal(q.size, 3);
  // Flush all 3; 4xx means permanent failure, batch dropped, count incremented.
  const result = await q.flush();
  assert.equal(result.reason, 'permanent-failure', '3 4xx items return permanent-failure');
  const live = () => clock.timers.filter((t) => t.live);
  assert.equal(live().length, 0, 'no retry timer after permanent-failure');
  assert.equal(q.size, 0, 'queue should be empty');
  assert.equal(q.dropped, 3, 'dropped count should be 3 (all items dropped due to 4xx)');
});
