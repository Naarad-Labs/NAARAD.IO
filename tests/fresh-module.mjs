/* A fresh copy of an app module and everything it imports, over a fake localStorage holding `stored`. */
import { register } from 'node:module';

register('./fresh-hook.mjs', import.meta.url);

let copy = 0;
export async function load(module, stored = {}) {
  const data = new Map(Object.entries(stored));
  globalThis.localStorage = {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => { data.set(key, String(value)); },
    removeItem: (key) => { data.delete(key); },
    get length() { return data.size; },
    key: (i) => Array.from(data.keys())[i] ?? null,
  };
  const store = await import(`../app/${module}.js?copy=${copy++}`);
  await store.ready();
  return { store, data };
}
