/* A small durable queue for work that must survive a dead network (future
   uploads), and the retry timer that drains it. Backoff is 1 s doubling to
   300 s with +-20% jitter so a crowd of phones does not retry in step.
   Nothing loads this yet. */

const BASE_MS = 1000;
const MAX_MS = 300000;

export function backoffDelay(tries, random = Math.random) {
  return Math.round(Math.min(BASE_MS * 2 ** tries, MAX_MS) * (0.8 + 0.4 * random()));
}

export function createOutbox({ store, key = 'naarad.outbox.v1', cap = 500, now = () => Date.now() }) {
  const read = () => {
    try {
      const saved = JSON.parse(store.getItem(key) || 'null');
      if (saved && Array.isArray(saved.items)) return { items: saved.items, dropped: Number(saved.dropped) || 0 };
    } catch { /* damaged data: start empty */ }
    return { items: [], dropped: 0 };
  };
  const write = (state) => store.setItem(key, JSON.stringify(state));

  return {
    enqueue(kind, payload, dedupeKey) {
      const state = read();
      if (state.items.some((item) => item.key === dedupeKey)) return false;
      state.items.push({ kind, payload, key: dedupeKey, tries: 0, ts: now() });
      while (state.items.length > cap) { state.items.shift(); state.dropped += 1; }
      write(state);
      return true;
    },

    /* sender(items) -> { ok: keys sent, permanent: keys the server will never accept (4xx) }.
       Everything else stays queued with tries + 1. A throwing sender changes nothing. */
    async flush(sender) {
      const batch = read().items;
      if (!batch.length) return { sent: 0, dropped: 0, remaining: 0 };
      const { ok = [], permanent = [] } = await sender(batch.map((item) => ({ ...item })));
      const done = new Set([...ok, ...permanent]);
      const handed = new Set(batch.map((item) => item.key));
      const state = read(); // re-read: enqueues may have happened while the sender ran
      state.items = state.items
        .filter((item) => !done.has(item.key))
        .map((item) => (handed.has(item.key) ? { ...item, tries: item.tries + 1 } : item));
      const dropped = batch.filter((item) => permanent.includes(item.key)).length;
      state.dropped += dropped;
      write(state);
      return { sent: batch.filter((item) => ok.includes(item.key)).length, dropped, remaining: state.items.length };
    },

    size: () => read().items.length,
    droppedCount: () => read().dropped,
  };
}

/* run() -> true when there is nothing left to do, false to try again later.
   Runs on kick(), when the device comes back online and when the page is shown again. */
export function createRetrier(run, { random = Math.random, setTimer = setTimeout, clearTimer = clearTimeout } = {}) {
  let tries = 0;
  let timer = null;
  let running = false;
  let stopped = false;

  async function kick() {
    if (running || stopped) return;
    running = true;
    clearTimer(timer);
    timer = null;
    let done = false;
    try { done = await run(); } catch { done = false; }
    running = false;
    if (stopped) return;
    if (done) { tries = 0; return; }
    timer = setTimer(kick, backoffDelay(tries, random));
    tries += 1;
  }

  const onVisible = () => { if (globalThis.document?.visibilityState === 'visible') kick(); };
  globalThis.addEventListener?.('online', kick);
  globalThis.document?.addEventListener?.('visibilitychange', onVisible);

  return {
    kick,
    stop() {
      stopped = true;
      clearTimer(timer);
      globalThis.removeEventListener?.('online', kick);
      globalThis.document?.removeEventListener?.('visibilitychange', onVisible);
    },
  };
}
