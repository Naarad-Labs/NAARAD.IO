/* Funnel events, queued on the device and sent when there is signal.
 *
 * Most of Naarad's visitors will be on a phone with no reliable network, so an
 * event sent at the moment it happens would simply be lost and the funnel would
 * undercount exactly the people it most needs to see. Each event is written to
 * a queue on the device with the time it happened and a key that never changes
 * (session id + a counter), and goes out in a batch when the device is online.
 * The server drops any key it has already seen, so a retry cannot double count.
 *
 * Three rules, from docs/event-schema.md:
 *   - Nothing is recorded until the visitor has said yes (setConsent(true)), and
 *     saying no empties the queue.
 *   - Only the events and fields in EVENT_SCHEMA are accepted. No names, no
 *     search text, no coordinates: a field that is not listed is refused.
 *   - If the queue is full the oldest event is dropped and counted, and the
 *     count travels with the next batch, so an undercount is visible.
 *
 * Nothing loads this yet. Wiring it into a page is a privacy change that waits
 * for the founder's approval (ops/guardrails.json: wire_analytics_into_pages).
 * With no endpoint set, flush() sends nothing and says so.
 */

export const SCHEMA_VERSION = 1;

/* event name -> field name -> the type its value must have */
export const EVENT_SCHEMA = {
  page_view: { page: 'string' },
  route_open: { slug: 'string' },
  stop_select: { slug: 'string', stop: 'number' },
  route_save: { slug: 'string' },
  walk_complete: { slug: 'string', stops: 'number' },
  search_submit: { has_query: 'boolean' },
};

const KEY_QUEUE = 'naarad.events.queue.v1';
const KEY_CONSENT = 'naarad.events.consent.v1';
export const MAX_QUEUE = 500;

/* A pre-rendered page is the same for everyone, so the build records nothing
   (main.js explains the mode). */
const PRERENDER = Boolean(globalThis.__NAARAD_PRERENDER__);

function defaultStorage() {
  try { return globalThis.localStorage || null; } catch { return null; }
}

function randomId() {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi && cryptoApi.randomUUID) return cryptoApi.randomUUID();
  return `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

/* Check one event against the schema. Returns the cleaned props, or throws
   with the reason, so a wrong call is found in a test, not in the funnel. */
export function cleanProps(name, props = {}) {
  const fields = EVENT_SCHEMA[name];
  if (!fields) throw new Error(`event "${name}" is not in EVENT_SCHEMA`);
  const clean = {};
  Object.keys(props).forEach((key) => {
    if (!(key in fields)) throw new Error(`${name}: field "${key}" is not allowed`);
  });
  Object.entries(fields).forEach(([key, type]) => {
    if (typeof props[key] !== type || (type === 'number' && !Number.isFinite(props[key]))) {
      throw new Error(`${name}: field "${key}" must be a ${type}`);
    }
    clean[key] = props[key];
  });
  return clean;
}

export function createEventQueue({
  storage = defaultStorage(),
  fetchImpl = globalThis.fetch && globalThis.fetch.bind(globalThis),
  now = () => Date.now(),
  newId = randomId,
  isOnline = () => globalThis.navigator ? globalThis.navigator.onLine !== false : true,
  endpoint = null,
  disabled = PRERENDER,
} = {}) {
  let memory = { queue: [], dropped: 0, consent: false, session: null, seq: 0 };
  let flushing = false;

  function load() {
    if (!storage) return;
    try {
      const saved = JSON.parse(storage.getItem(KEY_QUEUE) || 'null');
      if (saved) memory = { ...memory, ...saved };
      memory.consent = storage.getItem(KEY_CONSENT) === 'yes';
    } catch { /* private mode or damaged data: start empty */ }
  }

  function save() {
    if (!storage) return;
    try {
      storage.setItem(KEY_QUEUE, JSON.stringify({
        queue: memory.queue, dropped: memory.dropped, session: memory.session, seq: memory.seq,
      }));
    } catch { /* storage full or blocked: the queue still works in memory */ }
  }

  load();

  const api = {
    get consent() { return memory.consent; },
    get size() { return memory.queue.length; },
    get dropped() { return memory.dropped; },
    peek() { return memory.queue.map((event) => ({ ...event })); },

    setConsent(yes) {
      memory.consent = Boolean(yes);
      try { if (storage) storage.setItem(KEY_CONSENT, memory.consent ? 'yes' : 'no'); } catch { /* ignore */ }
      if (!memory.consent) {
        /* Saying no is erasure: nothing recorded about this visitor stays. */
        memory = { ...memory, queue: [], dropped: 0, session: null, seq: 0 };
        try { if (storage) storage.removeItem(KEY_QUEUE); } catch { /* ignore */ }
      }
    },

    track(name, props) {
      const clean = cleanProps(name, props);
      if (disabled || !memory.consent) return null;
      if (!memory.session) { memory.session = newId(); memory.seq = 0; }
      memory.seq += 1;
      const event = {
        id: `${memory.session}-${memory.seq}`,   // the dedupe key: never changes, even on retry
        name,
        ts: now(),                                // when it happened on the device, not when it is sent
        props: clean,
      };
      memory.queue.push(event);
      while (memory.queue.length > MAX_QUEUE) { memory.queue.shift(); memory.dropped += 1; }
      save();
      return event;
    },

    /* Send what is queued. Only events the server accepted are removed. */
    async flush() {
      if (!endpoint) return { sent: 0, reason: 'no-endpoint' };
      if (!memory.consent) return { sent: 0, reason: 'no-consent' };
      if (!memory.queue.length) return { sent: 0, reason: 'empty' };
      if (!isOnline()) return { sent: 0, reason: 'offline' };
      if (flushing) return { sent: 0, reason: 'busy' };
      if (!fetchImpl) return { sent: 0, reason: 'no-fetch' };

      flushing = true;
      const batch = memory.queue.slice(0, 50);
      const dropped = memory.dropped;
      try {
        const response = await fetchImpl(endpoint, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          keepalive: true,
          body: JSON.stringify({ v: SCHEMA_VERSION, sent_at: now(), dropped_before: dropped, events: batch }),
        });
        if (!response || !response.ok) return { sent: 0, reason: 'rejected' };
        const sent = new Set(batch.map((event) => event.id));
        memory.queue = memory.queue.filter((event) => !sent.has(event.id));
        memory.dropped -= dropped;                // reported once, then cleared
        if (!memory.queue.length) memory.session = null;   // no identifier outlives a full flush
        save();
        return { sent: batch.length, reason: 'ok' };
      } catch {
        return { sent: 0, reason: 'network' };    // keep everything; try again when online
      } finally {
        flushing = false;
      }
    },
  };
  return api;
}

/* The one queue the app would share. No endpoint until the backend exists. */
export const events = createEventQueue();
