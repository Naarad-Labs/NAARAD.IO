import vm from 'node:vm';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const source = await readFile('app/enhancements/index.jsx', 'utf8');
async function harness({ headingPresent = true, hold = false, fail = false } = {}) {
  const observers = [];
  let imports = 0, mounts = 0, unmounts = 0, reduced = false, release;
  const gate = hold ? new Promise((resolve) => { release = resolve; }) : Promise.resolve();
  const heading = { isConnected: true, getBoundingClientRect: () => ({ top: 1500 }) };
  const page = { isConnected: true, matches: () => false, querySelectorAll: (selectors) => selectors.includes('h2') && headingPresent ? [heading] : [] };
  const context = vm.createContext({ innerHeight: 800,
    IntersectionObserver: class {
      constructor(fn) { this.fn = fn; observers.push(this); }
      observe() {} disconnect() { this.disconnected = true; }
    },
    matchMedia: () => ({ matches: reduced }),
    window: { removeEventListener() {} }, document: { removeEventListener() {} },
  });
  const deps = new Map();
  for (const [name, exports] of [['gsap', { gsap: {} }], ['lenis', { default: class {} }], ['lenis/dist/lenis.css', { default: '' }]]) {
    const mod = new vm.SyntheticModule(Object.keys(exports), function () { for (const [key,value] of Object.entries(exports)) this.setExport(key,value); }, { context });
    await mod.link(() => {}); await mod.evaluate(); deps.set(name, mod);
  }
  const accent = new vm.SyntheticModule(['mountAccent'], function () {
    this.setExport('mountAccent', (target) => { assert.equal(target, heading); mounts++; return () => { unmounts++; }; });
  }, { context });
  await accent.link(() => {}); await accent.evaluate();
  const mod = new vm.SourceTextModule(source, { context, importModuleDynamically: async () => {
    imports++; await gate; if (fail) throw Error('optional chunk missing'); return accent;
  } });
  await mod.link((name) => deps.get(name)); await mod.evaluate();
  const cleanup = mod.namespace.mount(page);
  return { cleanup, observers, release, heading, page, setReduced: (value) => { reduced = value; },
    near: () => observers[1]?.fn([{ isIntersecting: true }]),
    stats: () => ({ imports, mounts, unmounts }),
  };
}
{
 const h = await harness(); assert.equal(h.stats().imports, 0);
 await h.near(); assert.deepEqual(h.stats(), { imports: 1, mounts: 1, unmounts: 0 });
 h.cleanup(); assert.equal(h.stats().unmounts, 1); assert.ok(h.observers.every((x) => x.disconnected));
}
{
 const h = await harness({ headingPresent: false }); assert.equal(h.observers.length, 1);
 assert.equal(h.stats().imports, 0); h.cleanup();
}
for (const mode of ['destroy', 'reduced', 'detached']) {
 const h = await harness({ hold: true }); const pending = h.near();
 if (mode === 'destroy') h.cleanup();
 if (mode === 'reduced') h.setReduced(true);
 if (mode === 'detached') h.heading.isConnected = false;
 h.release(); await pending; assert.equal(h.stats().mounts, 0);
 if (mode !== 'destroy') h.cleanup();
}
{
 const h = await harness({ fail: true }); await h.near(); assert.equal(h.stats().mounts, 0); h.cleanup();
}
console.log('PASS: deferred accent (no early import, no-target no-import, near-viewport mount, unmount, stale/reduced/detached cancellation, failed chunk fallback)');
