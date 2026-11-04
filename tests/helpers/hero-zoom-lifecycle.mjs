import vm from 'node:vm';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const source = await readFile('app/enhancements/index.jsx', 'utf8');
async function harness(mode = 'photo', motion = 'running') {
 let reduced = false, hidden = false, resumes = 0, pauses = 0, reverts = 0;
 const listeners = new Map();
 const photo = { closest: () => hidden ? {} : null };
 const hero = { dataset: { heroMode: mode, heroMotion: motion }, querySelector: () => photo,
  addEventListener: (name, fn) => listeners.set(name, fn), removeEventListener: (name) => listeners.delete(name) };
 const page = { matches: () => true, querySelector: () => hero, querySelectorAll: () => [] };
 const gsap = {
  context(fn, scope) { assert.equal(scope, hero); fn(); return { revert() { reverts++; } }; },
  fromTo(target, from, to) { assert.equal(target, photo); assert.deepEqual({...from},{scale:1});
   assert.deepEqual({...to},{scale:1.075,duration:16,repeat:-1,yoyo:true,ease:'sine.inOut',paused:true});
   return { resume() { resumes++; }, pause() { pauses++; } }; },
 };
 const context = vm.createContext({
  IntersectionObserver: class { observe() {} disconnect() {} },
  matchMedia: () => ({ matches: reduced }),
  window: { removeEventListener() {} }, document: { removeEventListener() {} },
 });
 const deps = new Map();
 for (const [name, exports] of [['gsap', { gsap }], ['lenis', { default: class {} }], ['lenis/dist/lenis.css', { default: '' }]]) {
  const mod = new vm.SyntheticModule(Object.keys(exports), function () { for (const [key,value] of Object.entries(exports)) this.setExport(key,value); }, { context });
  await mod.link(() => {}); await mod.evaluate(); deps.set(name, mod);
 }
 const mod = new vm.SourceTextModule(source,{context}); await mod.link((name)=>deps.get(name)); await mod.evaluate();
 const cleanup = mod.namespace.mount(page);
 return {cleanup,listeners,hero,setReduced:(v)=>{reduced=v;},setHidden:(v)=>{hidden=v;},sync:()=>listeners.get('hero:motion')(), stats:()=>({resumes,pauses,reverts})};
}
{
 const h=await harness(); assert.equal(h.stats().resumes,1);
 h.hero.dataset.heroMode='map'; h.sync(); assert.equal(h.stats().pauses,1);
 h.hero.dataset.heroMode='photo'; h.hero.dataset.heroMotion='paused'; h.sync(); assert.equal(h.stats().pauses,2);
 h.hero.dataset.heroMotion='running'; h.sync(); assert.equal(h.stats().resumes,2);
 h.setReduced(true);h.sync();assert.equal(h.stats().pauses,3);
 h.setReduced(false);h.setHidden(true);h.sync();assert.equal(h.stats().pauses,4);
 h.cleanup();assert.equal(h.stats().reverts,1);assert.equal(h.listeners.size,0);
}
{
 const h=await harness('map');assert.equal(h.stats().resumes,0);assert.equal(h.stats().pauses,1);h.cleanup();
}
console.log('PASS: hero photo zoom (initial state, map/pause/reduced/hidden gates, resume, scoped context cleanup and listener removal)');
