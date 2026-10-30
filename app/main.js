/* The router and the one place interaction is wired.
 *
 * Every page has its own address (app/urls.js), and PAGES below says which
 * view draws it. Views are ES modules loaded on demand, each with its own
 * stylesheet, so the homepage never pays for the planner's code or the map
 * engine. The map engine itself is imported only when a route page actually
 * mounts a map.
 *
 * Pages are also pre-rendered: scripts/build-site.mjs opens every address with
 * window.__NAARAD_PRERENDER__ set and saves what this module draws. In that
 * mode nothing device-local, animated or interactive is started: no map, no
 * motion, no service worker, no one's saved routes or drafts. When a visitor
 * opens a pre-rendered page, #app-content already holds it (data-prerendered
 * names its address), so boot keeps that markup and does only the wiring
 * markup cannot carry: the map, the scroll watcher, motion below the fold.
 */

import { loadMedia, escapeHtml, preloadHint } from './media.js';
import * as Data from './data.js';
import * as Audio from './audio.js';
import * as Journey from './journey-store.js';
import * as Offline from './offline-bundles.js';
import * as Account from './account.js';
import * as OfflineUI from './offline-ui.js';
import * as Drafts from './studio-store.js';
import * as Motion from './motion.js';
import * as Urls from './urls.js';
import { SITE_NAME, CARD_WIDTH, CARD_HEIGHT, cardPath } from './seo.js';

const PRERENDER = Boolean(window.__NAARAD_PRERENDER__);
const shell = document.querySelector('#app-content');

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

let state = { page: null, route: null, stop: null, story: null };
let map = null;
let generation = 0;
// The path and query of the current history entry. A popstate that leaves them
// as they were is the browser moving to an in-page anchor, which draws nothing.
let here = location.pathname + location.search;
// Settles once the first page is drawn. A pre-rendered page can be used
// before then; the handlers below wait for it rather than drop the input.
let started = null;
// A pre-rendered page arrives with its view's stylesheet already linked.
const loadedStyles = new Set($$('link[rel="stylesheet"]').map((link) => link.getAttribute('href')));
const modules = {};

/* ── Pages ──────────────────────────────────────────────────────── */

const catalogueContext = (url) => ({ query: url.searchParams.get('q') || '' });

/* An entry remembers how far it was scrolled (in history.state), so Back and
   Forward land where the visitor was, not at the top. It is kept current while
   they scroll, and written exactly when they leave by a link. The browser's own
   restoring is switched off: it runs after a page is drawn in place and undoes
   this, so reloads and Back from another site are handled below, in boot(). */
let scrollTimer = null;
function rememberScroll(top = window.scrollY) {
  clearTimeout(scrollTimer);
  try { history.replaceState({ ...history.state, scrollY: Math.round(top) }, ''); } catch { /* the browser limits how often this may be called */ }
}
if (!PRERENDER) {
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  addEventListener('scroll', () => { clearTimeout(scrollTimer); scrollTimer = setTimeout(rememberScroll, 200); }, { passive: true });
}

const pushAddress = (address, leftAt) => {
  rememberScroll(leftAt);
  history.pushState(null, '', address);
  here = location.pathname + location.search;
};
const replaceAddress = (address) => { history.replaceState(history.state, '', address); here = location.pathname + location.search; };

/* A pre-rendered catalogue can be typed into before the script arrives; what
   the visitor already typed or ticked still counts once it has. */
async function syncCatalogue() {
  const explore = await moduleFor('explore');
  const input = $('#catalogue-query');
  explore.setFilters({
    query: input?.value || '',
    region: $('[data-filter-region]')?.value || 'all',
    withStories: Boolean($('[data-filter-stories]')?.checked),
  });
  if (input?.value && state.page?.address) replaceAddress(state.page.address({ query: input.value.trim() }));
}

/* Every page the site has. A page answers one fixed `path`, or a `prefix`
 * under which /<prefix><slug>/ names one item. `view` is the module that
 * draws it (moduleFor) and `nav` the header link it lights. Optional hooks:
 *   context(url)            render context read from the address
 *   load(slug, url, view)   the item as render context, or null if there is none
 *   list(view)              every item's address, for the build
 *   address(context)        the address to show for this state, when not `path`
 *   after(context, gen)     wiring markup cannot carry: a map, a scroll watcher
 * The blog registers here as two entries, /blog/ and the /blog/ prefix, with a
 * views/blog.js and a line in moduleFor. Nothing else has to change: links,
 * the head, pre-rendering and the sitemap all follow from this list.
 */
const PAGES = [
  {
    name: 'home', path: '/', view: 'home', nav: 'home',
  },
  {
    name: 'routes', path: '/routes/', view: 'explore', nav: 'routes',
    context: catalogueContext,
    address: ({ query }) => Urls.cataloguePath(query, '/routes/'),
    after: () => syncCatalogue(),
  },
  {
    // The same catalogue under its other name; its canonical is /routes/.
    name: 'explore', path: '/explore/', view: 'explore', nav: 'explore',
    context: catalogueContext,
    address: ({ query }) => Urls.cataloguePath(query, '/explore/'),
    after: () => syncCatalogue(),
  },
  {
    name: 'route', prefix: '/routes/', view: 'route', nav: 'routes', body: 'route',
    async load(slug, url) {
      const route = await Data.getRoute(slug);
      if (!route) return null;
      const asked = Number(url.searchParams.get('stop')) || null;
      return { route, stop: Data.getStop(route, asked)?.order || route.stops[0]?.order || null };
    },
    async list() {
      const routes = await Data.loadRoutes();
      return routes.map((route) => Urls.routePath(route.slug));
    },
    address: ({ route, stop }) => Urls.routePath(route.slug, stop !== route.stops[0]?.order ? stop : null),
    after: ({ route }, current) => {
      watchRouteBar();
      if (route.hasGeometry || route.startLat != null) mountMap(route, current);
    },
  },
  {
    name: 'stories', path: '/stories/', view: 'story', nav: 'stories',
    context: () => ({ indexOnly: true }),
  },
  {
    name: 'story', prefix: '/stories/', view: 'story', nav: 'stories', body: 'story',
    async load(slug, url, view) {
      const story = await view.getStory(slug);
      return story ? { story } : null;
    },
    async list(view) {
      return (await view.loadStories()).map((story) => Urls.storyPath(story.slug));
    },
    after: () => watchStoryScroll(),
  },
  { name: 'creators', path: '/creators/', view: 'studio', nav: 'creators' },
  { name: 'journey', path: '/journey/', view: 'journey', nav: 'journey' },
  {
    name: 'about', path: '/about/', view: 'info', nav: 'about',
    context: () => ({ view: 'about' }),
  },
];

/* What an address no page answers shows. 404.html is this page, pre-rendered. */
const NOT_FOUND = { name: 'not-found', view: 'info', nav: null, context: () => ({ view: 'not-found' }) };

/** The page an address belongs to, and the item slug when it names one. */
function resolve(url) {
  const path = Urls.normalPath(url.pathname);
  const fixed = PAGES.find((page) => page.path === path);
  if (fixed) return { page: fixed, slug: null };
  for (const page of PAGES) {
    if (!page.prefix || !path.startsWith(page.prefix)) continue;
    const match = path.slice(page.prefix.length).match(/^([^/]+)\/$/);
    if (!match) continue;
    try { return { page, slug: decodeURIComponent(match[1]) }; } catch { return null; }
  }
  return null;
}

/**
 * Every public address, for scripts/build-site.mjs. The build renders each,
 * then leaves out of the sitemap any page whose head says noindex or names
 * another page as canonical.
 */
export async function publicPages() {
  const pages = [];
  for (const page of PAGES) {
    if (page.path) pages.push(page.path);
    if (page.list) pages.push(...await page.list(await moduleFor(page.view)));
  }
  return pages;
}

/* ── Chrome ─────────────────────────────────────────────────────── */

function loadStylesheet(href) {
  if (!href || loadedStyles.has(href)) return Promise.resolve();
  loadedStyles.add(href);
  return new Promise((resolve) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.addEventListener('load', resolve, { once: true });
    link.addEventListener('error', resolve, { once: true });
    document.head.append(link);
  });
}

/** The page's own head tags, from its view's meta (app/seo.js has the shape). */
function headTags(meta) {
  const tags = [];
  const add = (tag, attrs, text = null) => tags.push({ tag, attrs, text });
  const url = meta.path ? Urls.absoluteUrl(meta.path) : null;
  const image = meta.card ? Urls.absoluteUrl(cardPath(meta.card.name)) : null;

  add('meta', { name: 'description', content: meta.description });
  if (meta.robots) add('meta', { name: 'robots', content: meta.robots });
  if (url) {
    add('link', { rel: 'canonical', href: url });
    add('meta', { property: 'og:type', content: meta.type || 'website' });
    add('meta', { property: 'og:site_name', content: SITE_NAME });
    add('meta', { property: 'og:locale', content: 'en_IN' });
    add('meta', { property: 'og:url', content: url });
    add('meta', { property: 'og:title', content: meta.title });
    add('meta', { property: 'og:description', content: meta.description });
    if (image) {
      add('meta', { property: 'og:image', content: image });
      add('meta', { property: 'og:image:type', content: 'image/jpeg' });
      add('meta', { property: 'og:image:width', content: String(CARD_WIDTH) });
      add('meta', { property: 'og:image:height', content: String(CARD_HEIGHT) });
      add('meta', { property: 'og:image:alt', content: meta.card.alt });
    }
    if (meta.published) add('meta', { property: 'article:published_time', content: meta.published });
    add('meta', { name: 'twitter:card', content: image ? 'summary_large_image' : 'summary' });
    add('meta', { name: 'twitter:title', content: meta.title });
    add('meta', { name: 'twitter:description', content: meta.description });
    if (image) {
      add('meta', { name: 'twitter:image', content: image });
      add('meta', { name: 'twitter:image:alt', content: meta.card.alt });
    }
  }
  const hint = meta.preload ? preloadHint(meta.preload.photo, meta.preload.sizes) : null;
  if (hint) add('link', { rel: 'preload', as: 'image', type: 'image/avif', href: hint.href, imagesrcset: hint.imagesrcset, imagesizes: hint.imagesizes, fetchpriority: 'high' });
  if (meta.schema?.length) {
    // '<' is escaped so no string in the data can close the script element.
    const json = JSON.stringify({ '@context': 'https://schema.org', '@graph': meta.schema }).replace(/</g, '\\u003c');
    add('script', { type: 'application/ld+json' }, json);
  }
  return tags;
}

/**
 * Keep the head in step with the page. Every page-owned tag carries
 * data-page and is rewritten as one block right after <title>, so a
 * pre-rendered head and one written during navigation come out the same and
 * nothing is left over from the page before.
 */
function setMeta(meta) {
  if (!meta) return;
  if (meta.title) document.title = meta.title;
  const fresh = headTags(meta).map(({ tag, attrs, text }) => {
    const node = document.createElement(tag);
    Object.entries(attrs).forEach(([name, value]) => { if (value != null) node.setAttribute(name, value); });
    node.setAttribute('data-page', '');
    if (text != null) node.textContent = text;
    return node;
  });
  const current = $$('head [data-page]');
  if (current.length === fresh.length && current.every((node, index) => node.isEqualNode(fresh[index]))) return;
  current.forEach((node) => {
    const gap = node.previousSibling;
    if (gap?.nodeType === Node.TEXT_NODE && !gap.textContent.trim()) gap.remove();
    node.remove();
  });
  $('head title').after(...fresh.flatMap((node) => ['\n  ', node]));
}

/* Only the chrome marks the current section. A link inside a page, such as a
   story's breadcrumb back to /stories/, is not the page you are on, and the
   view's markup stays exactly what it drew. */
function setNav(view) {
  $$('.site-header [data-view], .site-footer [data-view]').forEach((link) => {
    const active = link.dataset.view === view;
    link.classList.toggle('is-current', active);
    if (!link.classList.length) link.removeAttribute('class');
    if (active) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
  closeMenu();
}

function closeMenu() {
  $('.site-header')?.classList.remove('nav-open');
  $('.menu-toggle')?.setAttribute('aria-expanded', 'false');
}

export function notify(message) {
  let notice = $('#site-notice');
  if (!notice) {
    notice = document.createElement('div');
    notice.id = 'site-notice';
    notice.className = 'site-notice';
    notice.setAttribute('role', 'status');
    document.body.append(notice);
  }
  notice.textContent = message;
  notice.hidden = false;
  clearTimeout(notify.timer);
  notify.timer = setTimeout(() => { notice.hidden = true; }, 4500);
}

async function moduleFor(name) {
  if (modules[name]) return modules[name];
  const loaders = {
    home: () => import('./views/home.js'),
    explore: () => import('./views/explore.js'),
    route: () => import('./views/route.js'),
    story: () => import('./views/story.js'),
    studio: () => import('./views/studio.js'),
    journey: () => import('./views/journey.js'),
    info: () => import('./views/info.js'),
  };
  modules[name] = await loaders[name]();
  return modules[name];
}

function showError(message) {
  shell.innerHTML = `<section class="load-error">
    <p class="eyebrow eyebrow-mark">The atlas is resting</p>
    <h1 class="display">${escapeHtml(message)}</h1>
    <p class="lede">Check your connection and try again.</p>
    <button class="button button-primary" type="button" id="retry-load">Try again</button>
  </section>`;
  $('#retry-load')?.addEventListener('click', () => location.reload());
}

/* ── Rendering ──────────────────────────────────────────────────── */

/** Whether #app-content already shows exactly this markup. */
function drawn(markup) {
  const probe = shell.cloneNode(false);
  probe.innerHTML = markup;
  return probe.innerHTML === shell.innerHTML;
}

/**
 * Draw a view and its head, in two steps. prepare() does what can take time:
 * the view's stylesheet, its markup and its head. commit() is the one step that
 * touches the page, and it does not wait for anything. The caller asks, between
 * the two, whether it is still the latest navigation: a slow earlier one must
 * not paint over the page the visitor has since moved on to.
 */
async function prepare(view, context = {}) {
  await loadStylesheet(view.stylesheet || view.meta?.stylesheet);
  const markup = context.indexOnly ? await view.renderIndex() : await view.render(context);
  const describe = context.indexOnly ? view.indexMeta : view.meta;
  const meta = await (typeof describe === 'function' ? describe(context) : describe);
  return { markup, meta };
}

/**
 * Put a prepared view on screen. With `keep`, markup that is already there (a
 * pre-rendered page) is left untouched when the view would draw the same thing,
 * so booting on it neither flashes nor shifts; when it would draw something
 * else, such as this visitor's own saved routes, it is replaced. `scrollY` is
 * where the new page opens (null leaves the scroll position alone).
 */
function commit({ markup, meta }, { keep = false, scrollY = 0 } = {}) {
  if (!(keep && drawn(markup))) {
    destroyMap();
    unwatchRouteBar();
    shell.innerHTML = markup;
    delete shell.dataset.prerendered;
    // 'instant': the page is replaced, so it opens in place rather than gliding there.
    if (scrollY != null) window.scrollTo({ top: scrollY, left: 0, behavior: 'instant' });
  }
  setMeta(meta);
  Motion.scan(shell);
  OfflineUI.start();
  OfflineUI.refresh();
}

/** prepare() and commit() for a redraw of the current page. Null when a navigation has taken over meanwhile. */
async function paint(view, context = {}, { current = generation, ...options } = {}) {
  const ready = await prepare(view, context);
  if (current !== generation) return null;
  commit(ready, options);
  return ready.meta;
}

/* ── Focus ──────────────────────────────────────────────────────── */

/** Focus a node that is not a control (a heading, a panel), without moving the page. */
function focusNode(node) {
  if (!node) return;
  if (!node.matches('a[href], button, input, select, textarea, [tabindex]')) node.tabIndex = -1;
  node.focus({ preventScroll: true });
}

const focusHeading = () => focusNode($('h1', shell));

/** A selector that finds, after the page redraws it, the control the keyboard is on. */
function focusMark() {
  const node = document.activeElement;
  if (!node || node === document.body || !shell.contains(node)) return null;
  const data = [...node.attributes].filter((attribute) => attribute.name.startsWith('data-'))
    .map((attribute) => `[${attribute.name}="${CSS.escape(attribute.value)}"]`).join('');
  if (data) return `${node.localName}${data}`;
  return node.id ? `#${CSS.escape(node.id)}` : null;
}

/** Put the keyboard back on the same control after a redraw, or on `fallback` when that control is gone. */
function restoreFocus(mark, fallback) {
  if (!mark) return;
  const target = $(mark, shell);
  focusNode(target && !target.disabled ? target : $(fallback, shell));
}

/** The id a #fragment names; a malformed escape (#100%) is taken as written. */
function anchorId(hash) {
  try { return decodeURIComponent(hash.slice(1)); } catch { return hash.slice(1); }
}

/**
 * Show the page at `url`. `push` adds a history entry; otherwise the address
 * is only tidied in place (a dropped ?stop=1, an added trailing slash).
 * `scrollY` is where the page opens: the top, or where Back left it.
 */
async function show(url, { push = true, boot = false, scrollY = 0 } = {}) {
  const current = ++generation;
  const match = resolve(url);
  let page = match?.page || NOT_FOUND;
  let view = await moduleFor(page.view);
  let context = page.context?.(url) || {};
  if (page.load) {
    // A module or data that cannot be fetched rejects from here, and from
    // prepare() below, before anything on screen is touched; only a source that
    // loaded and has no such item is "not found".
    const item = await page.load(match.slug, url, view);
    if (item) context = { ...context, ...item };
    else if (shell.dataset.prerendered === Urls.normalPath(url.pathname)) {
      // The server sent a page for this address that the data does not know,
      // which is a stale copy of the data, not a missing page: leave it be.
      return;
    } else {
      page = NOT_FOUND;
      view = await moduleFor(page.view);
      context = page.context(url);
    }
  }
  if (current !== generation) return;

  const key = page === NOT_FOUND ? '404' : Urls.normalPath(url.pathname);
  const ready = await prepare(view, context);
  if (current !== generation) return;
  // Nothing below waits, so no other navigation can slip in between these lines.
  state = { page, route: context.route || null, stop: context.stop || null, story: context.story || null };
  document.body.dataset.view = page.body || page.name;
  shell.className = `view-${page.body || page.name}`;
  const { meta } = ready;
  const leftAt = window.scrollY;
  commit(ready, { keep: shell.dataset.prerendered === key, scrollY: boot ? null : scrollY });
  setNav(page.nav);

  const address = page === NOT_FOUND
    ? `${url.pathname}${url.search}`
    : `${page.address?.(context) || page.path || key}`;
  // A link to the address you are already on adds no history entry.
  if (address + url.hash !== location.pathname + location.search + location.hash) {
    if (push) pushAddress(address + url.hash, leftAt);
    else replaceAddress(address + url.hash);
  }
  if (url.hash && !boot) document.getElementById(anchorId(url.hash))?.scrollIntoView();
  // A page drawn in place is a new page: the keyboard and screen readers start at its heading.
  if (!boot && !PRERENDER) focusHeading();

  if (PRERENDER) {
    shell.dataset.prerendered = key;
    window.__NAARAD_META__ = meta;
    return;
  }
  page.after?.(context, current);
}

/**
 * show() for a visitor's own navigation. When this page cannot be drawn here
 * (a view or its data failed to load), the browser loads the address itself,
 * so the link is never left dead; the page it gets handles its own failure.
 */
async function navigate(url, options) {
  const mine = generation + 1;      // the number show() takes first thing
  try {
    await show(url, options);
  } catch (error) {
    // A slower earlier navigation that fails must not pull the browser away
    // from the page the visitor has since moved on to.
    if (generation !== mine) return;
    console.error('Could not draw the page in place; loading it instead', error);
    location.assign(url.href);
  }
}

/* ── Route section bar ──────────────────────────────────────────── */

/* The bar of section links sticks under the header, and how tall it is depends
   on the window and the text size (its links wrap). A jump to a section must
   stop below it, so its height is published as --route-bar-h for route.css. */
let barWatcher = null;

function watchRouteBar() {
  unwatchRouteBar();
  const bar = $('.route-bar');
  if (!bar || !('ResizeObserver' in window)) return;
  const measure = () => {
    // On a phone .route-bar has no box of its own and the links are what sticks.
    const sticky = getComputedStyle(bar).display === 'contents' ? $('.route-tabs', bar) : bar;
    document.documentElement.style.setProperty('--route-bar-h', `${Math.round(sticky.getBoundingClientRect().height)}px`);
  };
  barWatcher = new ResizeObserver(measure);
  barWatcher.observe(bar);
  barWatcher.observe($('.route-tabs', bar));
  measure();
}

function unwatchRouteBar() {
  barWatcher?.disconnect();
  barWatcher = null;
  document.documentElement.style.removeProperty('--route-bar-h');
}

/* ── Map ────────────────────────────────────────────────────────── */

function destroyMap() { map?.destroy?.(); map = null; }

async function mountMap(route, current) {
  destroyMap();
  try {
    const { mountRouteMap } = await import('./map.js');
    const node = $('#map');
    if (!node || current !== generation) return;
    const controller = await mountRouteMap(node, route, {
      initialLayer: 'satellite',
      onSelectStop: (order) => selectStop(order),
    });
    if (current !== generation) controller.destroy();
    // Highlight the opening stop without panning, so the whole route stays framed.
    else { map = controller; map.selectStop?.(state.stop, { pan: false }); }
  } catch (error) {
    console.error('Map unavailable', error);
    const node = $('#map');
    if (node) node.insertAdjacentHTML('beforeend', '<p class="map-unavailable">The interactive map could not load. The route preview and details are still here.</p>');
  }
}

/* ── Stop selection ─────────────────────────────────────────────── */

async function selectStop(order) {
  if (!state.route) return;
  const stop = Data.getStop(state.route, order);
  if (!stop) return;
  state.stop = stop.order;

  const view = await moduleFor('route');
  const panel = $('.stop-panel');
  if (panel) {
    const fresh = document.createElement('div');
    fresh.innerHTML = await view.render({ route: state.route, stop: stop.order });
    const replacement = fresh.querySelector('.stop-panel');
    if (replacement) {
      // A control inside the story (Related stops) is replaced with it; the keyboard follows to the new title.
      const inside = panel.contains(document.activeElement);
      panel.replaceWith(replacement);
      Motion.scan(replacement);
      if (inside) focusNode($('.stop-title', replacement));
    }
  }
  $$('.stop-item').forEach((item) => {
    const active = Number(item.dataset.selectStop) === stop.order;
    item.classList.toggle('is-active', active);
    item.setAttribute('aria-current', String(active));
  });
  map?.selectStop?.(stop.order);
  replaceAddress(state.page.address({ route: state.route, stop: stop.order }));
}

/* ── Listening ──────────────────────────────────────────────────── */

function stopQueue(route, from = 1) {
  return route.stops
    .filter((stop) => stop.order >= from)
    .map((stop) => ({
      id: stop.slug,
      title: stop.name,
      subtitle: route.name,
      photo: stop.photo,
      text: `${stop.name}. ${stop.tagline}. ${stop.summary} ${stop.story}`,
      audioUrl: stop.audio || null,
      lang: 'en-IN',
    }));
}

function listen(order) {
  if (!state.route?.stops?.length) return;
  if (!Audio.readAloudAvailable && !state.route.stops.some((stop) => stop.audio)) {
    notify('No narration is published for this route, and this browser cannot read it aloud.');
    return;
  }
  const queue = stopQueue(state.route);
  const index = Math.max(0, queue.findIndex((item) => item.id === `${state.route.slug}-${String(order).padStart(2, '0')}`));
  Audio.play(queue, index);
  const stop = Data.getStop(state.route, order);
  if (stop) Journey.recordListening(stop.slug, Math.round(stop.story.length / 15));
}

async function listenStory() {
  if (!state.story) return;
  const view = await moduleFor('story');
  Audio.play([{
    id: state.story.slug,
    title: state.story.title,
    subtitle: state.story.location,
    photo: state.story.heroPhoto,
    text: view.storyText(state.story),
    audioUrl: null,
    lang: 'en-IN',
  }]);
}

/* ── Story scroll spy ───────────────────────────────────────────── */

let spy = null;
function watchStoryScroll() {
  spy?.disconnect();
  const sections = $$('.story-section');
  if (!sections.length) return;
  spy = new IntersectionObserver((entries) => {
    entries.filter((entry) => entry.isIntersecting).forEach((entry) => {
      $$('[data-toc]').forEach((link) => link.classList.toggle('is-current', link.dataset.toc === entry.target.id));
    });
  }, { rootMargin: '-25% 0px -65% 0px' });
  sections.forEach((section) => spy.observe(section));
}

/* ── Sharing and journey actions ────────────────────────────────── */

async function share(title) {
  const url = location.href;
  if (navigator.share) {
    try { await navigator.share({ title, url }); return; } catch { /* cancelled */ }
  }
  try { await navigator.clipboard.writeText(url); notify('Link copied.'); }
  catch { notify('Could not copy the link.'); }
}

function toggleSave(button) {
  if (!state.route) return;
  const saved = Journey.toggleSaved(state.route);
  button.classList.toggle('is-saved', saved);
  button.setAttribute('aria-pressed', String(saved));
  const label = button.querySelector('span');
  if (label) label.textContent = saved ? 'Saved' : 'Save';
  notify(saved ? `${state.route.name} saved to My Journey.` : 'Removed from My Journey.');
}

/* Behind the offline-bundles flag. A download keeps nothing if any file fails. */
async function toggleOffline(button) {
  const route = state.route;
  if (!route || !button) return;
  const words = (title, detail) => {
    button.querySelector('b').textContent = title;
    button.querySelector('span span').textContent = detail;
  };
  if (!Offline.supported()) { notify('This browser cannot keep routes for offline use.'); return; }
  if (Journey.isDownloaded(route.slug)) {
    await Offline.remove(route.slug, Journey.getDownloads());
    Journey.removeDownload(route.slug);
    button.dataset.state = 'idle';
    words('Download for offline', 'Page, text and photos. No map tiles or audio.');
    notify('The offline copy was removed from this device.');
    return;
  }
  button.disabled = true;
  words('Downloading…', 'Keep this page open.');
  try {
    const bundle = await Offline.download(route);
    Journey.addDownload({ slug: route.slug, name: route.name, stops: route.stopCount || 0, sizeLabel: bundle.label, urls: bundle.urls, version: bundle.version });
    button.dataset.state = 'saved';
    words('Saved offline', `${bundle.label} · tap to remove`);
    const kept = Offline.persistenceNote(await Offline.requestPersistence());
    notify(`${route.name} is saved for offline use. Map tiles and audio are not included. ${kept}`.trim());
  } catch (error) {
    button.dataset.state = 'idle';
    words('Download for offline', 'Page, text and photos. No map tiles or audio.');
    notify(error && error.name === 'SpaceError' ? error.message : 'Could not save this route for offline use. Nothing was kept.');
  } finally {
    button.disabled = false;
  }
}

function selectJourneyTab(id) {
  $$('[data-journey-tab]').forEach((button) => {
    const active = button.dataset.journeyTab === id;
    button.setAttribute('aria-selected', String(active));
    button.tabIndex = active ? 0 : -1;
  });
  $$('[data-journey-panel]').forEach((panel) => { panel.hidden = panel.dataset.journeyPanel !== id; });
}

/**
 * Draw My Journey again after something in it changed. The visitor stays where
 * they were: same scroll position, same tab, and the keyboard on the control
 * that took the place of the one they used (`selector`, at the same position
 * in the list, or the last one left).
 */
async function repaintJourney({ selector = null, at = 0 } = {}) {
  const current = generation;
  const tab = $('[data-journey-tab][aria-selected="true"]')?.dataset.journeyTab;
  const journey = await moduleFor('journey');
  if (!await paint(journey, {}, { current, scrollY: null })) return;
  if (tab) selectJourneyTab(tab);
  if (!selector) return;
  const left = $$(selector, shell).filter((node) => node.offsetParent);
  focusNode(left[Math.min(at, left.length - 1)] || $('[data-journey-tab][aria-selected="true"]', shell));
}

/* ── Studio ─────────────────────────────────────────────────────── */

async function refreshStudio() {
  const current = generation;
  const mark = focusMark();
  const studio = await moduleFor('studio');
  const markup = await studio.render();
  if (current !== generation) return;
  shell.innerHTML = markup;
  // The keyboard stays on the same control; when a step replaces it (Next on the last step), on the step's heading.
  restoreFocus(mark, '.studio-panel:not([hidden]) h3');
}

async function handleStudio(target) {
  const field = target.dataset.studio;
  if (field === 'next' || field === 'back') {
    const steps = ['upload', 'transcript', 'translate', 'metadata', 'review'];
    const draft = Drafts.current();
    const index = steps.indexOf(draft.step);
    Drafts.update({ step: steps[Math.min(steps.length - 1, Math.max(0, index + (field === 'next' ? 1 : -1)))] });
    await refreshStudio();
    return;
  }
  if (field === 'save') { Drafts.update({}); notify('Draft saved in this browser.'); await refreshStudio(); return; }
  if (field === 'transcribe') { notify('Automatic transcription needs the Naarad backend, which is not part of this build.'); return; }
  if (field === 'submit') {
    if (!Account.signedIn()) { notify('Publishing needs the Naarad backend. Your draft is kept in this browser.'); return; }
    if (await Account.send(Drafts.current(), refreshStudio)) { Drafts.update({ status: 'submitted' }); notify('Sent for review. Nothing is published until a person approves it.'); await refreshStudio(); }
    return;
  }

  const step = target.dataset.studioStep;
  if (step) { Drafts.update({ step }); await refreshStudio(); return; }

  const stopOrder = target.dataset.studioStop;
  if (stopOrder) { Drafts.update({ stopOrder: Number(stopOrder) }); await refreshStudio(); return; }

  const openId = target.dataset.studioOpen;
  if (openId) { Drafts.open(openId); await refreshStudio(); return; }

  const deleteId = target.dataset.studioDelete;
  if (deleteId) { Drafts.remove(deleteId); await refreshStudio(); notify('Draft deleted.'); }
}

/* ── Events ─────────────────────────────────────────────────────── */

/** A plain click on a link to one of the site's pages, which is drawn in place. */
function pageLink(event) {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return null;
  const link = event.target.closest('a[href]');
  if (!link || link.target || link.hasAttribute('download')) return null;
  const url = new URL(link.href, location.href);
  if (url.origin !== location.origin) return null;
  // A jump within this page (the story contents, the skip link) is the browser's.
  if (url.hash && url.pathname === location.pathname && url.search === location.search) return null;
  return resolve(url) ? url : null;
}

document.addEventListener('click', async (event) => {
  const url = pageLink(event);
  if (url) {
    event.preventDefault();
    const dead = OfflineUI.blocks(url);
    if (dead.blocked) { notify(dead.reason); return; }
    await started;
    await navigate(url);
    return;
  }
  await started;

  if (event.target.closest('.menu-toggle')) {
    const open = $('.site-header')?.classList.toggle('nav-open');
    $('.menu-toggle')?.setAttribute('aria-expanded', String(Boolean(open)));
    return;
  }

  const accountButton = event.target.closest('[data-account-mode], [data-account-signout], [data-account-delete], [data-account-delete-confirm], [data-account-delete-cancel]');
  if (accountButton) { event.preventDefault(); await Account.click(accountButton, refreshStudio); return; }

  const stopButton = event.target.closest('[data-select-stop]');
  const listenTarget = event.target.closest('[data-action="listen"]');
  if (listenTarget) { event.preventDefault(); event.stopPropagation(); listen(Number(listenTarget.dataset.stop)); return; }
  if (stopButton) { await selectStop(Number(stopButton.dataset.selectStop)); return; }

  const action = event.target.closest('[data-action]')?.dataset.action;
  if (action === 'listen-all' && state.route) { Audio.play(stopQueue(state.route), 0); return; }
  if (action === 'listen-story') { await listenStory(); return; }
  if (action === 'share') { await share(state.route?.name || state.story?.title || 'Naarad'); return; }
  if (action === 'save') { toggleSave(event.target.closest('[data-action="save"]')); return; }
  if (action === 'offline') { await toggleOffline(event.target.closest('[data-action="offline"]')); return; }
  if (action === 'start' && state.route) {
    Journey.completeWalk(state.route);
    notify(`${state.route.name} added to My Journey. Open the first stop to start listening.`);
    listen(state.route.stops[0]?.order || 1);
    return;
  }
  if (action === 'journal') {
    const title = state.story?.title || state.route?.name;
    Journey.addJournalEntry({ title, place: state.story?.location || state.route?.location, routeSlug: state.story?.route || state.route?.slug, body: '' });
    notify('Added to your journal. Write the note in My Journey.');
    return;
  }

  // The route's section links are plain in-page anchors: the browser does the
  // scrolling (smoothly, unless the visitor asked for reduced motion), and this
  // only says which section the visitor went to.
  const tab = event.target.closest('[data-tab]');
  if (tab) {
    $$('[data-tab]').forEach((link) => {
      if (link === tab) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
    return;
  }

  const stopTab = event.target.closest('[data-stop-tab]');
  if (stopTab) {
    $$('[data-stop-tab]').forEach((button) => button.setAttribute('aria-selected', String(button === stopTab)));
    $$('[data-stop-panel]').forEach((panel) => { panel.hidden = panel.dataset.stopPanel !== stopTab.dataset.stopTab; });
    return;
  }

  const journeyTab = event.target.closest('[data-journey-tab]');
  if (journeyTab) { selectJourneyTab(journeyTab.dataset.journeyTab); return; }

  const unsave = event.target.closest('[data-journey-unsave]');
  if (unsave) {
    const at = $$('[data-journey-unsave]').filter((node) => node.offsetParent).indexOf(unsave);
    const route = await Data.getRoute(unsave.dataset.journeyUnsave);
    if (route) Journey.toggleSaved(route);
    await repaintJourney({ selector: '[data-journey-unsave]', at });
    return;
  }

  const removeDownload = event.target.closest('[data-download-remove]');
  if (removeDownload) {
    const slug = removeDownload.dataset.downloadRemove;
    await Offline.remove(slug, Journey.getDownloads());
    Journey.removeDownload(slug);
    await repaintJourney();
    return;
  }
  const deleteNote = event.target.closest('[data-journal-delete]');
  if (deleteNote) {
    const at = $$('[data-journal-delete]').indexOf(deleteNote);
    Journey.removeJournalEntry(deleteNote.dataset.journalDelete);
    await repaintJourney({ selector: '[data-journal-delete]', at });
    return;
  }

  const filterSport = event.target.closest('[data-filter-sport]');
  if (filterSport) {
    const explore = await moduleFor('explore');
    $$('[data-filter-sport]').forEach((button) => {
      const active = button === filterSport;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    explore.setSport(filterSport.dataset.filterSport);
    return;
  }

  const mapAction = event.target.closest('[data-map]')?.dataset.map;
  if (mapAction === 'in') map?.zoomIn();
  if (mapAction === 'out') map?.zoomOut();
  if (mapAction === 'locate') map?.locate();
  if (mapAction === 'fit') map?.fit();
  if (mapAction === 'layers') {
    const button = event.target.closest('[data-map="layers"]');
    const satellite = button.getAttribute('aria-pressed') !== 'true';
    map?.setLayer(satellite ? 'satellite' : 'street');
    button.setAttribute('aria-pressed', String(satellite));
    const label = button.querySelector('span');
    if (label) label.textContent = satellite ? 'Satellite' : 'Street';
  }

  if (event.target.closest('[data-studio], [data-studio-step], [data-studio-stop], [data-studio-open], [data-studio-delete]')) {
    await handleStudio(event.target.closest('[data-studio], [data-studio-step], [data-studio-stop], [data-studio-open], [data-studio-delete]'));
  }
});

let filterTimer = null;

document.addEventListener('input', async (event) => {
  await started;
  const target = event.target;
  if (target.id === 'catalogue-query') {
    const explore = await moduleFor('explore');
    // The grid redraws once typing pauses, so a screen reader is not read the whole list for every letter.
    clearTimeout(filterTimer);
    filterTimer = setTimeout(() => explore.setQuery(target.value), 150);
    // The search is part of the address, so a filtered catalogue can be shared.
    if (state.page?.address) replaceAddress(state.page.address({ query: target.value.trim() }));
  }
  if (target.dataset.filterRegion !== undefined) {
    const explore = await moduleFor('explore');
    explore.setRegion(target.value);
  }
  if (target.dataset.filterStories !== undefined) {
    const explore = await moduleFor('explore');
    explore.setWithStories(target.checked);
  }
  if (target.dataset.studio === 'transcript') Drafts.update({ transcript: target.value });
  if (target.dataset.studio === 'title') Drafts.update({ title: target.value });
  if (target.dataset.studio === 'summary') Drafts.update({ summary: target.value });
});

document.addEventListener('change', async (event) => {
  await started;
  const target = event.target;
  if (target.dataset.studio === 'route') {
    const route = await Data.getRoute(target.value);
    Drafts.update({ routeSlug: route?.slug || null, routeName: route?.name || null, stopOrder: route?.stops?.[0]?.order || null });
    await refreshStudio();
  }
  if (target.dataset.studio === 'stop') { Drafts.update({ stopOrder: Number(target.value) }); await refreshStudio(); }
  if (target.dataset.studio === 'language') Drafts.update({ language: target.value });
  if (target.dataset.studio === 'audio') {
    const file = target.files?.[0];
    if (file) { Drafts.update({ audioName: file.name }); notify(`${file.name} attached to this draft.`); await refreshStudio(); }
  }
  if (target.dataset.studioLanguage) {
    const draft = Drafts.current();
    const code = target.dataset.studioLanguage;
    const languages = new Set(draft.targetLanguages);
    if (target.checked) languages.add(code); else languages.delete(code);
    Drafts.update({ targetLanguages: [...languages] });
  }
});

document.addEventListener('submit', async (event) => {
  if (event.target.matches('.header-search')) {
    // Without script the form sends ?q= to /routes/; with it, the same address.
    event.preventDefault();
    await started;
    const value = ($('#route-search')?.value || '').trim();
    await navigate(new URL(Urls.cataloguePath(value), location.origin));
    $('#catalogue-query')?.focus();
    return;
  }
  if (event.target.matches('[data-account-form]')) {
    event.preventDefault();
    await started;
    await Account.submit(event.target, refreshStudio);
    return;
  }
  if (event.target.matches('[data-journal-form]')) {
    event.preventDefault();
    await started;
    const form = new FormData(event.target);
    const title = String(form.get('title') || '').trim();
    if (!title) return;
    Journey.addJournalEntry({
      title,
      place: String(form.get('place') || '').trim(),
      body: String(form.get('body') || '').trim(),
    });
    await repaintJourney();
    focusNode($('[data-journal-form] input[name="title"]'));
    notify('Journal entry saved on this device.');
  }
});

document.addEventListener('keydown', async (event) => {
  // Escape closes the phone menu and hands the keyboard back to its button.
  if (event.key === 'Escape' && $('.site-header')?.classList.contains('nav-open')) {
    closeMenu();
    $('.menu-toggle')?.focus();
    return;
  }
  // The journey's tabs are a real tab list: one stop in the tab order, arrows move within it.
  const tab = event.target.closest?.('[data-journey-tab]');
  if (tab && ['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
    event.preventDefault();
    const id = tab.dataset.journeyTab;
    await started;
    const tabs = $$('[data-journey-tab]');
    const from = tabs.findIndex((button) => button.dataset.journeyTab === id);
    const to = { Home: 0, End: tabs.length - 1 }[event.key] ?? (from + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
    selectJourneyTab(tabs[to].dataset.journeyTab);
    tabs[to].focus();
  }
});

window.addEventListener('popstate', () => {
  clearTimeout(scrollTimer);      // what is pending belongs to the entry just left
  const at = location.pathname + location.search;
  const moved = at !== here;
  here = at;
  // Back and Forward return to where that entry was left (see pushAddress).
  const saved = history.state?.scrollY;
  if (moved) {
    navigate(new URL(location.href), { push: false, scrollY: Number.isFinite(saved) ? saved : 0 });
  } else if (Number.isFinite(saved)) {
    window.scrollTo({ top: saved, left: 0, behavior: 'instant' });       // only the #fragment changed
  } else if (location.hash) {
    document.getElementById(anchorId(location.hash))?.scrollIntoView();
  } else {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }
});

/* ── Boot ───────────────────────────────────────────────────────── */

async function boot() {
  // An address from the single-document site becomes the page that replaced it.
  const old = Urls.legacyTarget(new URL(location.href));
  if (old) replaceAddress(old);
  // Whatever was pre-rendered is on screen now, so motion must not replay it.
  const settle = Boolean(shell.dataset.prerendered);
  await loadMedia();
  await Data.loadRoutes();
  await show(new URL(location.href), { push: false, boot: true });
  if (!PRERENDER) {
    Motion.start({ settle });
    // A reload, or Back from another site, opens the page unscrolled: return to where this entry was left.
    const opened = performance.getEntriesByType?.('navigation')[0]?.type;
    const saved = history.state?.scrollY;
    if (!location.hash && (opened === 'reload' || opened === 'back_forward') && saved > 0) {
      window.scrollTo({ top: saved, left: 0, behavior: 'instant' });
    }
  }
}

started = boot().catch((error) => {
  console.error('Naarad could not start', error);
  // A pre-rendered page that is still on screen is a good page; only what
  // needed script is missing. Keep it, and let the visitor retry.
  if (shell.dataset.prerendered) notify('Part of this page could not load. Reload to try again.');
  else showError('Routes could not be loaded.');
});
await started;

Audio.subscribe((player) => {
  $$('[data-action="listen"]').forEach((button) => {
    button.classList.toggle('is-playing', player.playing && button.dataset.stop
      && `${state.route?.slug}-${String(button.dataset.stop).padStart(2, '0')}` === player.item?.id);
  });
});

export { show };
