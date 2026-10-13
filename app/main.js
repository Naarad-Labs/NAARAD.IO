/* The router and the one place interaction is wired.
 *
 * Views are ES modules loaded on demand, each with its own stylesheet, so the
 * homepage never pays for the planner's code or the map engine. The map engine
 * itself is imported only when a route page actually mounts a map.
 */

import { loadMedia, escapeHtml } from './media.js';
import { icon } from './icons.js';
import * as Data from './data.js';
import * as Audio from './audio.js';
import * as Journey from './journey-store.js';
import * as Drafts from './studio-store.js';

const shell = document.querySelector('#app-content');
const VIEWS = ['home', 'explore', 'routes', 'stories', 'creators', 'journey', 'about'];
const DEFAULT_ROUTE = 'hampi-heritage-trail';

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

let state = { view: 'home', route: null, stop: null, story: null };
let map = null;
let generation = 0;
const loadedStyles = new Set();
const modules = {};

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

function setMeta({ title, description }) {
  if (title) document.title = title;
  if (description) {
    const tag = $('meta[name="description"]');
    if (tag) tag.content = description;
  }
}

function setNav(view) {
  $$('[data-view]').forEach((link) => {
    const active = link.dataset.view === view;
    link.classList.toggle('is-current', active);
    if (active) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
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

async function paint(name, context, meta) {
  const view = await moduleFor(name);
  await loadStylesheet(view.stylesheet || view.meta?.stylesheet);
  const markup = context?.indexOnly ? await view.renderIndex() : await view.render(context);
  shell.innerHTML = markup;
  setMeta(meta || (typeof view.meta === 'function' ? view.meta(context?.route || context?.story) : view.meta));
  window.scrollTo(0, 0);
}

async function showRoute(slug, { push = true, stop = null } = {}) {
  const current = ++generation;
  destroyMap();
  const route = await Data.getRoute(slug) || await Data.getRoute(DEFAULT_ROUTE);
  if (!route || current !== generation) return;

  state = { view: 'routes', route, stop: stop || route.stops[0]?.order || null, story: null };
  document.body.dataset.view = 'route';
  shell.className = 'view-route';
  const view = await moduleFor('route');
  await paint('route', { route, stop: state.stop }, view.meta(route));
  setNav('routes');
  if (push) history.pushState({ route: slug, stop: state.stop }, '', routeHref(route, state.stop));

  if (route.hasGeometry || route.startLat != null) mountMap(route, current);
}

function routeHref(route, stop) {
  return `/?route=${encodeURIComponent(route.slug)}${stop ? `&stop=${stop}` : ''}`;
}

async function showStory(slug, push = true) {
  ++generation;
  destroyMap();
  const view = await moduleFor('story');
  const story = await view.getStory(slug);
  if (!story) { showView('stories'); return; }
  state = { view: 'stories', route: null, stop: null, story };
  document.body.dataset.view = 'story';
  shell.className = 'view-story';
  await paint('story', { story }, view.meta(story));
  setNav('stories');
  if (push) history.pushState({ story: slug }, '', `/?story=${encodeURIComponent(slug)}`);
  watchStoryScroll();
}

async function showView(view, push = true) {
  ++generation;
  destroyMap();
  state = { view, route: null, stop: null, story: null };
  document.body.dataset.view = view;
  shell.className = `view-${view}`;

  if (view === 'home') await paint('home');
  else if (view === 'explore' || view === 'routes') await paint('explore');
  else if (view === 'stories') {
    const story = await moduleFor('story');
    await paint('story', { indexOnly: true }, story.indexMeta);
  } else if (view === 'creators') await paint('studio');
  else if (view === 'journey') await paint('journey');
  else await paint('info', { view });

  setNav(view);
  if (push) history.pushState({ view }, '', view === 'home' ? '/' : `/?view=${encodeURIComponent(view)}`);
}

/* ── Map ────────────────────────────────────────────────────────── */

function destroyMap() { map?.destroy?.(); map = null; }

async function mountMap(route, current) {
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
    if (replacement) panel.replaceWith(replacement);
  }
  $$('.stop-item').forEach((item) => {
    const active = Number(item.dataset.selectStop) === stop.order;
    item.classList.toggle('is-active', active);
    item.setAttribute('aria-current', String(active));
  });
  map?.selectStop?.(stop.order);
  history.replaceState({ route: state.route.slug, stop: stop.order }, '', routeHref(state.route, stop.order));
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

/* ── Studio ─────────────────────────────────────────────────────── */

async function refreshStudio() {
  const studio = await moduleFor('studio');
  shell.innerHTML = await studio.render();
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
  if (field === 'submit') { notify('Publishing needs the Naarad backend. Your draft is kept in this browser.'); return; }

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

document.addEventListener('click', async (event) => {
  const link = event.target.closest('a[data-route], a[data-view], a[data-story]');
  if (link && event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
    event.preventDefault();
    if (link.dataset.route) await showRoute(link.dataset.route, { stop: Number(link.dataset.stop) || null });
    else if (link.dataset.story) await showStory(link.dataset.story);
    else await showView(link.dataset.view);
    return;
  }

  if (event.target.closest('.menu-toggle')) {
    const header = $('.site-header');
    const open = header?.classList.toggle('nav-open');
    $('.menu-toggle')?.setAttribute('aria-expanded', String(Boolean(open)));
    return;
  }

  const stopButton = event.target.closest('[data-select-stop]');
  const listenTarget = event.target.closest('[data-action="listen"]');
  if (listenTarget) { event.preventDefault(); event.stopPropagation(); listen(Number(listenTarget.dataset.stop)); return; }
  if (stopButton) { await selectStop(Number(stopButton.dataset.selectStop)); return; }

  const action = event.target.closest('[data-action]')?.dataset.action;
  if (action === 'listen-all' && state.route) { Audio.play(stopQueue(state.route), 0); return; }
  if (action === 'listen-story') { await listenStory(); return; }
  if (action === 'share') { await share(state.route?.name || state.story?.title || 'Naarad'); return; }
  if (action === 'save') { toggleSave(event.target.closest('[data-action="save"]')); return; }
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

  const tab = event.target.closest('[data-tab]');
  if (tab) {
    $$('[data-tab]').forEach((button) => {
      const active = button === tab;
      button.setAttribute('aria-selected', String(active));
      button.tabIndex = active ? 0 : -1;
    });
    const target = { overview: '.route-overview', stops: '.stop-rail', stories: '.stop-panel', terrain: '.route-glance', map: '.map-panel' }[tab.dataset.tab];
    $(target)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }

  const stopTab = event.target.closest('[data-stop-tab]');
  if (stopTab) {
    $$('[data-stop-tab]').forEach((button) => button.setAttribute('aria-selected', String(button === stopTab)));
    $$('[data-stop-panel]').forEach((panel) => { panel.hidden = panel.dataset.stopPanel !== stopTab.dataset.stopTab; });
    return;
  }

  const journeyTab = event.target.closest('[data-journey-tab]');
  if (journeyTab) {
    $$('[data-journey-tab]').forEach((button) => {
      const active = button === journeyTab;
      button.setAttribute('aria-selected', String(active));
      button.tabIndex = active ? 0 : -1;
    });
    $$('[data-journey-panel]').forEach((panel) => { panel.hidden = panel.dataset.journeyPanel !== journeyTab.dataset.journeyTab; });
    return;
  }

  const unsave = event.target.closest('[data-journey-unsave]');
  if (unsave) {
    const slug = unsave.dataset.journeyUnsave;
    const route = await Data.getRoute(slug);
    if (route) Journey.toggleSaved(route);
    await paint('journey');
    return;
  }

  const deleteNote = event.target.closest('[data-journal-delete]');
  if (deleteNote) { Journey.removeJournalEntry(deleteNote.dataset.journalDelete); await paint('journey'); return; }

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

document.addEventListener('input', async (event) => {
  const target = event.target;
  if (target.id === 'catalogue-query') {
    const explore = await moduleFor('explore');
    explore.setQuery(target.value);
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
    event.preventDefault();
    const value = $('#route-search')?.value || '';
    await showView('explore');
    const input = $('#catalogue-query');
    const explore = await moduleFor('explore');
    if (input) { input.value = value; input.focus(); }
    explore.setQuery(value);
    return;
  }
  if (event.target.matches('[data-journal-form]')) {
    event.preventDefault();
    const form = new FormData(event.target);
    const title = String(form.get('title') || '').trim();
    if (!title) return;
    Journey.addJournalEntry({
      title,
      place: String(form.get('place') || '').trim(),
      body: String(form.get('body') || '').trim(),
    });
    await paint('journey');
    const panel = $('[data-journey-panel="journal"]');
    $$('[data-journey-panel]').forEach((node) => { node.hidden = node !== panel; });
    $$('[data-journey-tab]').forEach((button) => button.setAttribute('aria-selected', String(button.dataset.journeyTab === 'journal')));
    notify('Journal entry saved on this device.');
  }
});

window.addEventListener('popstate', () => navigate(false));

/* ── Boot ───────────────────────────────────────────────────────── */

async function navigate(push = false) {
  const params = new URLSearchParams(location.search);
  const route = params.get('route');
  const story = params.get('story');
  const view = params.get('view');
  if (route) return showRoute(route, { push, stop: Number(params.get('stop')) || null });
  if (story) return showStory(story, push);
  if (view && VIEWS.includes(view)) return showView(view, push);
  return showView('home', push);
}

try {
  await loadMedia();
  await Data.loadRoutes();
  await navigate(false);
} catch (error) {
  console.error('Naarad could not start', error);
  showError('Routes could not be loaded.');
}

Audio.subscribe((player) => {
  $$('[data-action="listen"]').forEach((button) => {
    button.classList.toggle('is-playing', player.playing && button.dataset.stop
      && `${state.route?.slug}-${String(button.dataset.stop).padStart(2, '0')}` === player.item?.id);
  });
});

export { showRoute, showView, showStory, icon };
