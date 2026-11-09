/* Explore: the searchable catalogue, at /routes/ and again at /explore/.
   Desktop keeps the filters open beside a grid; the phone composition moves
   them into a scrolling row and a sheet (explore.css). The search is read from
   the address (?q=), so a filtered catalogue can be linked to. */

import { escapeHtml, picture } from '../media.js';
import { icon } from '../icons.js';
import * as Data from '../data.js';
import { routeCard } from './home.js';
import { atlasMarkup } from '../atlas.js';
import { loadPreviewTiles } from '../previews.js';
import * as Seo from '../seo.js';

const SPORTS = [
  { id: 'all', label: 'All routes' },
  { id: 'walk', label: 'Walk' },
  { id: 'hike', label: 'Hike' },
  { id: 'cycle', label: 'Cycle' },
];

let routes = [];
let query = '';
let sport = 'all';
let withStories = false;
let region = 'all';
let distance = 'any';
let time = 'any';
let level = 'any';
let lang = 'any';
let sort = 'default';
let notify = null;          // main.js asks to hear about every change, to keep the address current
let origin = null;          // the visitor's position, kept in this tab only and never sent anywhere
const RECENT_KEY = 'naarad:recent-searches';

const rad = (degrees) => (degrees * Math.PI) / 180;
/** Kilometres between two [lng, lat] points (haversine). */
export function distanceKm(a, b) {
  const dLat = rad(b[1] - a[1]); const dLng = rad(b[0] - a[0]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}
const startOf = (route) => route.geometry?.coordinates?.[0] || null;

/** The most common themes, each with a photograph from the first route that has it. */
export function themeTiles(list, count = 6) {
  const tally = new Map();
  for (const route of list) {
    for (const theme of route.themes || []) {
      const entry = tally.get(theme) || { theme, n: 0, photos: [] };
      entry.n += 1;
      const photo = route.cardPhoto || route.photo || null;
      if (photo && !entry.photos.includes(photo)) entry.photos.push(photo);
      tally.set(theme, entry);
    }
  }
  // A tile without a photograph, or a bookkeeping tag such as "Recorded track", is not an invitation to explore.
  const ranked = [...tally.values()].filter((entry) => entry.photos.length && !/^recorded/i.test(entry.theme))
    .sort((a, b) => b.n - a.n || a.theme.localeCompare(b.theme));
  // Two tiles should not show the same photograph when another is available.
  const used = new Set();
  return ranked.slice(0, count).map((entry) => {
    const photo = entry.photos.find((candidate) => !used.has(candidate)) || entry.photos[0];
    used.add(photo);
    return { theme: entry.theme, n: entry.n, photo };
  });
}

function recentSearches() {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]').filter((item) => typeof item === 'string').slice(0, 5); } catch { return []; }
}
export function rememberSearch(value) {
  const text = String(value || '').trim();
  if (text.length < 3) return;
  try { localStorage.setItem(RECENT_KEY, JSON.stringify([text, ...recentSearches().filter((item) => item !== text)].slice(0, 5))); } catch { /* private mode: no history */ }
}
/** Recent searches are added when the box is focused, not in render(), so a pre-rendered page matches what boot would draw. */
export function addRecentSuggestions() {
  const list = document.querySelector('#catalogue-suggestions');
  if (!list) return;
  const known = new Set([...list.querySelectorAll('option')].map((option) => option.value));
  for (const text of recentSearches()) {
    if (known.has(text)) continue;
    const option = document.createElement('option');
    option.value = text;
    list.prepend(option);
  }
}

/** Languages at least one route has audio in, in a stable order. */
function audioLanguages() {
  const present = new Set(routes.flatMap((route) => route.languages || []));
  return Object.keys(LANGUAGE_NAMES).filter((code) => present.has(code));
}

function suggestions() {
  const names = new Set();
  for (const route of routes) {
    names.add(route.name);
    if (route.location) names.add(route.location);
    for (const theme of route.themes || []) names.add(theme);
  }
  return [...names].slice(0, 60);
}

const DISTANCES = { short: ['Under 3 km', 0, 3000], mid: ['3 to 10 km', 3000, 10000], long: ['Over 10 km', 10000, Infinity] };
const TIMES = { short: ['Under 1 hour', 0, 60], mid: ['1 to 3 hours', 60, 180], long: ['Over 3 hours', 180, Infinity] };
const LEVELS = { easy: 'Easy', moderate: 'Moderate', hard: 'Hard' };
const SORTS = { default: 'Suggested', short: 'Shortest first', long: 'Longest first', stories: 'Most stories' };
const LANGUAGE_NAMES = { en: 'English', hi: 'Hindi', ta: 'Tamil', te: 'Telugu', kn: 'Kannada', ml: 'Malayalam', mr: 'Marathi', bn: 'Bengali', gu: 'Gujarati' };
const inBand = (value, [, low, high]) => value != null && value >= low && value < high;

/** Filters the visitor has set, as labelled chips: [key, label]. */
export function activeFilters() {
  const out = [];
  if (query) out.push(['query', `Search: ${query}`]);
  if (sport !== 'all') out.push(['sport', SPORTS.find((item) => item.id === sport)?.label || sport]);
  if (region !== 'all') out.push(['region', `Region: ${region}`]);
  if (withStories) out.push(['stories', 'Has story stops']);
  if (distance !== 'any') out.push(['distance', DISTANCES[distance][0]]);
  if (time !== 'any') out.push(['time', TIMES[time][0]]);
  if (level !== 'any') out.push(['level', LEVELS[level]]);
  if (lang !== 'any') out.push(['lang', `Audio in ${LANGUAGE_NAMES[lang] || lang}`]);
  return out;
}

/** The new filters as address parameters, so a filtered view can be shared. */
export function filterParams() {
  const params = {};
  if (sport !== 'all') params.sport = sport;
  if (region !== 'all') params.region = region;
  if (withStories) params.stories = '1';
  if (distance !== 'any') params.d = distance;
  if (time !== 'any') params.t = time;
  if (level !== 'any') params.lv = level;
  if (lang !== 'any') params.lang = lang;
  if (sort !== 'default') params.sort = sort;
  return params;
}

function matches(route) {
  if (distance !== 'any' && !inBand(route.distanceM, DISTANCES[distance])) return false;
  if (time !== 'any' && !inBand(route.durationMin, TIMES[time])) return false;
  if (level !== 'any' && route.difficulty !== level) return false;
  if (lang !== 'any' && !(route.languages || []).includes(lang)) return false;
  if (sport !== 'all' && route.sport !== sport) return false;
  if (withStories && !route.hasStops) return false;
  if (region !== 'all' && route.region !== region) return false;
  if (!query) return true;
  const haystack = `${route.name} ${route.location || ''} ${(route.themes || []).join(' ')}`.toLocaleLowerCase();
  return haystack.includes(query.toLocaleLowerCase());
}

function grid(list) {
  if (!list.length) {
    return `<p class="catalogue-empty">No routes match yet. ${activeFilters().length ? '<button type="button" class="text-link" data-clear-all>Clear all filters</button> to see every route, or try' : 'Try'} another place.</p>`;
  }
  return list.map((route) => routeCard(route)).join('');
}

export function applyFilters() {
  // Before render() has loaded the routes (someone typing into a pre-rendered
  // catalogue while the script arrives) there is nothing to filter yet.
  if (!routes.length) return;
  const list = routes.filter(matches);
  if (sort === 'short') list.sort((a, b) => (a.distanceM ?? Infinity) - (b.distanceM ?? Infinity));
  else if (sort === 'long') list.sort((a, b) => (b.distanceM ?? -1) - (a.distanceM ?? -1));
  else if (sort === 'stories') list.sort((a, b) => (b.stopCount || 0) - (a.stopCount || 0));
  else if (origin) list.sort((a, b) => (startOf(a) ? distanceKm(origin, startOf(a)) : 1e9) - (startOf(b) ? distanceKm(origin, startOf(b)) : 1e9));
  if (typeof document === 'undefined') return;   // pre-render and unit tests have no page to redraw
  const target = document.querySelector('#catalogue-grid');
  if (target) { target.innerHTML = grid(list); loadPreviewTiles(target); }
  document.dispatchEvent(new CustomEvent('catalogue:filtered', { detail: { slugs: list.map((route) => route.slug) } }));
  const count = document.querySelector('#catalogue-count');
  if (count) count.textContent = `${list.length} ${list.length === 1 ? 'route' : 'routes'}${origin && sort === 'default' ? ' · nearest first' : ''}`;
  syncControls();
  notify?.();
}

/** Keep the controls and the chip bar in step with the filters, whichever way they were changed. */
function syncControls() {
  const set = (selector, value) => { const node = document.querySelector(selector); if (node && node.value !== value) node.value = value; };
  set('[data-filter="distance"]', distance); set('[data-filter="time"]', time); set('[data-filter="lang"]', lang);
  set('[data-filter="sort"]', sort); set('[data-filter-region]', region);
  document.querySelectorAll('[data-filter-level]').forEach((button) => {
    const on = button.dataset.filterLevel === level;
    button.classList.toggle('is-active', on); button.setAttribute('aria-pressed', String(on));
  });
  document.querySelectorAll('[data-filter-sport]').forEach((button) => {
    const on = button.dataset.filterSport === sport;
    button.classList.toggle('is-active', on); button.setAttribute('aria-pressed', String(on));
  });
  const stories = document.querySelector('[data-filter-stories]');
  if (stories) stories.checked = withStories;
  const bar = document.querySelector('#active-filters');
  if (bar) {
    const chips = activeFilters();
    bar.hidden = !chips.length;
    bar.innerHTML = chips.map(([key, label]) => `<button type="button" class="filter-pill" data-clear-filter="${escapeHtml(key)}" aria-label="Remove ${escapeHtml(label)}">${escapeHtml(label)} <span aria-hidden="true">×</span></button>`).join('')
      + (chips.length ? '<button type="button" class="text-link" data-clear-all>Clear all filters</button>' : '');
  }
}

/** Set one of the range, level, language or sort filters by name. */
export function setFilter(name, value) {
  if (name === 'distance') distance = Object.hasOwn(DISTANCES, value) ? value : 'any';
  if (name === 'time') time = Object.hasOwn(TIMES, value) ? value : 'any';
  if (name === 'level') level = Object.hasOwn(LEVELS, value) && value !== level ? value : 'any';
  if (name === 'lang') lang = value === 'any' || (LANGUAGE_NAMES[value] && routes.some((route) => (route.languages || []).includes(value))) ? value : 'any';
  if (name === 'sort') sort = Object.hasOwn(SORTS, value) ? value : 'default';
  applyFilters();
}

function reset(name) {
  if (name === 'query') { query = ''; const input = document.querySelector('#catalogue-query'); if (input) input.value = ''; }
  if (name === 'sport') sport = 'all';
  if (name === 'region') region = 'all';
  if (name === 'stories') withStories = false;
  if (name === 'distance') distance = 'any';
  if (name === 'time') time = 'any';
  if (name === 'level') level = 'any';
  if (name === 'lang') lang = 'any';
}

export function clearFilter(name) { reset(name); applyFilters(); }

export function clearAll() {
  for (const [key] of activeFilters()) reset(key);
  applyFilters();
}

/** main.js passes a function to call after every change (it rewrites the address). */
export function onChange(fn) { notify = fn; }
export const currentQuery = () => query;

export function setQuery(value) { query = value; applyFilters(); }
/** Sort by distance from a position ([lng, lat]) or, with null, back to the catalogue order. */
export function setOrigin(value) {
  origin = value;
  applyFilters();
}
export function setSport(value) { sport = value; applyFilters(); }
export function setRegion(value) { region = value; applyFilters(); }
export function setWithStories(value) { withStories = value; applyFilters(); }

/** Several filters at once, redrawing the grid only if one of them changed. */
export function setFilters(next) {
  const before = [query, region, withStories].join('|');
  if (next.query != null) query = next.query;
  if (next.region != null) region = next.region;
  if (next.withStories != null) withStories = next.withStories;
  if ([query, region, withStories].join('|') !== before) applyFilters();
}

export async function render(context = {}) {
  routes = await Data.loadRoutes();
  query = context.query || '';
  origin = null;      // a fresh page starts with the Near me button off
  distance = 'any'; time = 'any'; level = 'any'; lang = 'any'; sort = 'default';
  sport = 'all'; region = 'all'; withStories = false;
  if (context.params) {
    const params = context.params;
    const pick = (key, allowed) => (allowed.includes(params.get(key)) ? params.get(key) : null);
    sport = pick('sport', SPORTS.map((item) => item.id)) || 'all';
    distance = pick('d', Object.keys(DISTANCES)) || 'any';
    time = pick('t', Object.keys(TIMES)) || 'any';
    level = pick('lv', Object.keys(LEVELS)) || 'any';
    sort = pick('sort', Object.keys(SORTS)) || 'default';
    withStories = params.get('stories') === '1';
    region = routes.some((route) => route.region === params.get('region')) ? params.get('region') : 'all';
    lang = audioLanguages().includes(params.get('lang')) ? params.get('lang') : 'any';
  }
  const shown = routes.filter(matches);
  const regions = [...new Set(routes.map((route) => route.region).filter(Boolean))].sort();
  const withStops = routes.filter((route) => route.hasStops).length;

  return `<div class="catalogue">
    <header class="catalogue-hero dither-band" data-dither="sand">
      <div>
        <p class="eyebrow eyebrow-mark">The Naarad atlas · ${routes.length} routes</p>
        <h1 class="display">Go where <br>stories live.</h1>
        <p class="lede">Search places and browse published routes across India. ${withStops} ${withStops === 1 ? 'route has' : 'routes have'} ordered stops with stories; the rest carry their route facts while stops are written.</p>
      </div>
      <form class="catalogue-search" role="search" aria-label="Search routes" onsubmit="return false">
        <label class="sr-only" for="catalogue-query">Search routes and places</label>
        ${icon('search')}
        <input id="catalogue-query" type="search" placeholder="Search a place, route or theme" autocomplete="off" list="catalogue-suggestions" value="${escapeHtml(query)}">
        <datalist id="catalogue-suggestions">${suggestions().map((name) => `<option value="${escapeHtml(name)}"></option>`).join('')}</datalist>
      </form>
    </header>

    ${atlasMarkup(routes)}

    <div class="catalogue-body">
      <aside class="catalogue-filters" aria-label="Filters">
        <h2 class="eyebrow">Filter</h2>
        <fieldset>
          <legend>Activity</legend>
          <div class="filter-chips" role="group">
            ${SPORTS.map((item) => `<button type="button" data-filter-sport="${item.id}" class="${item.id === sport ? 'is-active' : ''}" aria-pressed="${item.id === sport}">${item.label}</button>`).join('')}
          </div>
        </fieldset>
        <fieldset>
          <legend>Region</legend>
          <label class="sr-only" for="filter-region">Region</label>
          <select id="filter-region" data-filter-region>
            <option value="all">All regions</option>
            ${regions.map((name) => `<option value="${escapeHtml(name)}" ${name === region ? 'selected' : ''}>${escapeHtml(name)}</option>`).join('')}
          </select>
        </fieldset>
        <fieldset>
          <legend>Distance</legend>
          <label class="sr-only" for="filter-distance">Distance</label>
          <select id="filter-distance" data-filter="distance">
            <option value="any">Any distance</option>
            ${Object.entries(DISTANCES).map(([key, band]) => `<option value="${key}" ${key === distance ? 'selected' : ''}>${band[0]}</option>`).join('')}
          </select>
        </fieldset>
        <fieldset>
          <legend>Time</legend>
          <label class="sr-only" for="filter-time">Time</label>
          <select id="filter-time" data-filter="time">
            <option value="any">Any time</option>
            ${Object.entries(TIMES).map(([key, band]) => `<option value="${key}" ${key === time ? 'selected' : ''}>${band[0]}</option>`).join('')}
          </select>
        </fieldset>
        <fieldset>
          <legend>Difficulty</legend>
          <div class="filter-chips">
            ${Object.entries(LEVELS).map(([key, label]) => `<button type="button" data-filter-level="${key}" class="${key === level ? 'is-active' : ''}" aria-pressed="${key === level}">${label}</button>`).join('')}
          </div>
        </fieldset>
        ${audioLanguages().length ? `<fieldset>
          <legend>Audio language</legend>
          <label class="sr-only" for="filter-lang">Audio language</label>
          <select id="filter-lang" data-filter="lang">
            <option value="any">Any language</option>
            ${audioLanguages().map((code) => `<option value="${code}" ${code === lang ? 'selected' : ''}>${LANGUAGE_NAMES[code]}</option>`).join('')}
          </select>
        </fieldset>` : ''}
        <fieldset>
          <legend>Content</legend>
          <label class="filter-check">
            <input type="checkbox" data-filter-stories ${withStories ? 'checked' : ''}>
            <span>Has story stops</span>
          </label>
        </fieldset>
        <p class="data-note">Route lines are shown only where a track or a published stop sequence exists.</p>
      </aside>

      <section class="catalogue-results">
        <div class="section-head">
          <div>
            <p class="eyebrow eyebrow-mark">Curated and community routes</p>
            <h2 class="section-title"><span id="catalogue-count" role="status">${shown.length} ${shown.length === 1 ? 'route' : 'routes'}</span></h2>
          </div>
          <div class="section-head-aside">
            <label class="sr-only" for="filter-sort">Sort routes</label>
            <select id="filter-sort" data-filter="sort">
              ${Object.entries(SORTS).map(([key, label]) => `<option value="${key}" ${key === sort ? 'selected' : ''}>${label}</option>`).join('')}
            </select>
          </div>
        </div>
        <div id="active-filters" class="active-filters" aria-label="Active filters" ${activeFilters().length ? '' : 'hidden'}>${activeFilters().map(([key, label]) => `<button type="button" class="filter-pill" data-clear-filter="${escapeHtml(key)}" aria-label="Remove ${escapeHtml(label)}">${escapeHtml(label)} <span aria-hidden="true">×</span></button>`).join('')}${activeFilters().length ? '<button type="button" class="text-link" data-clear-all>Clear all filters</button>' : ''}</div>
        <div id="catalogue-grid" class="route-card-grid">${grid(shown)}</div>
      </section>
    </div>
  </div>`;
}

export const stylesheet = '/app/explore.css';

/** Both addresses are one catalogue, so both name /routes/ as canonical. */
export function meta() {
  // render() has just loaded the routes; the card shows the first one's photograph.
  const lead = routes[0];
  const withStops = routes.filter((route) => route.hasStops).length;
  return {
    title: 'All routes · Naarad',
    description: `Search ${routes.length} heritage walking routes across India. ${withStops} ${withStops === 1 ? 'has' : 'have'} ordered stops with a written story at each; the rest are listed with the facts known so far.`,
    path: '/routes/',
    hints: Seo.mapHints({ atlas: true }),
    card: {
      name: 'routes',
      eyebrow: 'The Naarad atlas',
      title: 'Go where stories live.',
      facts: [`${routes.length} routes across India`],
      photo: lead?.media?.card || lead?.media?.photo || null,
      route: null,
      alt: `Go where stories live: the Naarad route catalogue${lead ? `, set on a photograph from the ${lead.name}` : ''}.`,
    },
    schema: [Seo.breadcrumbs([['Routes', '/routes/']])],
  };
}
