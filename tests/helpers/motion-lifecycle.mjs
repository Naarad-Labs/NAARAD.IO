import vm from 'node:vm';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const source = await readFile('app/motion.js', 'utf8');
async function harness({ reduced = false, page = true, hold = false } = {}) {
  const media = new Map();
  const frames = new Map();
  let index = 0, loads = 0, mounts = 0, disposals = 0, release;
  const gate = hold ? new Promise((resolve) => { release = resolve; }) : Promise.resolve();
  const element = { isConnected: true };
  const document = { querySelector: () => page ? element : null };
  const context = vm.createContext({
    matchMedia: (query) => {
      const listeners = new Set();
      const m = { matches: query.includes('reduced') ? reduced : true,
        addEventListener: (_, fn) => listeners.add(fn),
        removeEventListener: (_, fn) => listeners.delete(fn),
        change(value) { m.matches = value; [...listeners].forEach((fn) => fn({ matches: value })); },
        listeners };
      media.set(query, m); return m;
    }, document,
    requestAnimationFrame: (fn) => { frames.set(++index, fn); return index; },
    cancelAnimationFrame: (id) => frames.delete(id),
  });
  const bundle = new vm.SyntheticModule(['mount'], function () {
    this.setExport('mount', () => { mounts++; return () => { disposals++; }; });
  }, { context });
  await bundle.link(() => {}); await bundle.evaluate();
  const mod = new vm.SourceTextModule(source, { context, importModuleDynamically: async () => {
    loads++; await gate; return bundle;
  } });
  await mod.link(() => {}); await mod.evaluate();
  const api = mod.namespace;
  return { api, media, frames, document, release,
    stats: () => ({ loads, mounts, disposals }),
    flush: async () => {
      const pending = [...frames.values()]; frames.clear();
      await Promise.all(pending.map((fn) => fn()));
    },
  };
}
{
 const h = await harness(); h.api.start({ settle: true }); await h.flush();
 assert.deepEqual(h.stats(), { loads: 1, mounts: 1, disposals: 0 });
 h.api.scan(h.document); h.api.scan(h.document); assert.equal(h.frames.size, 1);
 await h.flush(); assert.deepEqual(h.stats(), { loads: 1, mounts: 2, disposals: 1 });
 h.api.destroy(); assert.equal(h.stats().disposals, 2);
 assert.ok([...h.media.values()].every((m) => m.listeners.size === 0));
 h.api.scan(h.document); await h.flush(); assert.equal(h.stats().mounts, 3);
 h.api.destroy();
}
{
 const h = await harness({ reduced: true }); h.api.start(); await h.flush(); assert.equal(h.stats().loads, 0);
 [...h.media.values()][0].change(false); await h.flush(); assert.equal(h.stats().mounts, 1);
 [...h.media.values()][0].change(true); assert.equal(h.stats().disposals, 1);
 h.api.destroy();
}
{
 const h = await harness({ page: false }); h.api.start(); await h.flush(); assert.equal(h.stats().loads, 0); h.api.destroy();
}
{
 const h = await harness({ hold: true }); h.api.start();
 const pending = h.flush(); await Promise.resolve(); h.api.destroy(); h.release(); await pending;
 assert.equal(h.stats().mounts, 0);
}
console.log('PASS: motion lifecycle (deduplicated scan, destroy/restart, reduced-motion toggle, non-editorial no-load, stale import cancellation)');
