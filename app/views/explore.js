/* Explore: the searchable catalogue, at /routes/ and again at /explore/.
   Desktop keeps the filters open beside a grid; the phone composition moves
   them into a scrolling row and a sheet (explore.css). The search is read from
   the address (?q=), so a filtered catalogue can be linked to. */

import { escapeHtml, picture } from '../media.js';
import { icon } from '../icons.js';
import * as Data from '../data.js';
import { routeCard } from './home.js';
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
      const entry = tally.get(theme) || { theme, n: 0, photo: null };
      entry.n += 1;
      entry.photo ||= route.cardPhoto || route.photo || null;
      tally.set(theme, entry);
    }
  }
  return [...tally.values()].sort((a, b) => b.n - a.n || a.theme.localeCompare(b.theme)).slice(0, count);
}

function recentSearches() {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]').filter((item) => typeof item === 'string').slice(0, 5); } catch { return []; }
}
export function rememberSearch(value) {
  const text = String(value || '').trim();
  if (text.length < 2) return;
  try { localStorage.setItem(RECENT_KEY, JSON.stringify([text, ...recentSearches().filter((item) => item !== text)].slice(0, 5))); } catch { /* private mode: no history */ }
}
function suggestions() {
  const names = new Set(recentSearches());
  for (const route of routes) {
    names.add(route.name);
    if (route.location) names.add(route.location);
    for (const theme of route.themes || []) names.add(theme);
  }
  return [...names].slice(0, 60);
}

function matches(route) {
  if (sport !== 'all' && route.sport !== sport) return false;
  if (withStories && !route.hasStops) return false;
  if (region !== 'all' && route.region !== region) return false;
  if (!query) return true;
  const haystack = `${route.name} ${route.location || ''} ${(route.themes || []).join(' ')}`.toLocaleLowerCase();
  return haystack.includes(query.toLocaleLowerCase());
}

function grid(list) {
  if (!list.length) {
    return `<p class="catalogue-empty">No routes match that search yet. Try another place, or clear the filters.</p>`;
  }
  return list.map((route) => routeCard(route)).join('');
}

export function applyFilters() {
  // Before render() has loaded the routes (someone typing into a pre-rendered
  // catalogue while the script arrives) there is nothing to filter yet.
  if (!routes.length) return;
  const list = routes.filter(matches);
  if (origin) list.sort((a, b) => (startOf(a) ? distanceKm(origin, startOf(a)) : 1e9) - (startOf(b) ? distanceKm(origin, startOf(b)) : 1e9));
  const target = document.querySelector('#catalogue-grid');
  if (target) { target.innerHTML = grid(list); loadPreviewTiles(target); }
  const count = document.querySelector('#catalogue-count');
  if (count) count.textContent = `${list.length} ${list.length === 1 ? 'route' : 'routes'}${origin ? ' · nearest first' : ''}`;
}

export function setQuery(value) { query = value; applyFilters(); }
/** Sort by distance from a position ([lng, lat]) or, with null, back to the catalogue order. */
export function setOrigin(value) {
  origin = value;
  applyFilters();
  const note = document.querySelector('#near-note');
  if (note) note.textContent = value ? 'Sorted by distance from you. Your position stays on this phone.' : '';
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
  const shown = routes.filter(matches);
  const regions = [...new Set(routes.map((route) => route.region).filter(Boolean))].sort();
  const withStops = routes.filter((route) => route.hasStops).length;

  return `<div class="catalogue">
    <header class="catalogue-hero">
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

    <section class="explore-tiles" aria-label="Start from a theme">
      ${themeTiles(routes).map((tile) => `<button type="button" class="explore-tile" data-explore-theme="${escapeHtml(tile.theme)}">
        ${tile.photo ? picture(tile.photo, { sizes: '(max-width: 760px) 45vw, 190px', alt: '', ratio: '4 / 3' }) : ''}
        <span class="explore-tile-label">${escapeHtml(tile.theme)}<small>${tile.n} ${tile.n === 1 ? 'route' : 'routes'}</small></span>
      </button>`).join('')}
      <button type="button" class="explore-tile is-near" data-explore-near aria-pressed="false">
        <span class="explore-tile-label">${icon('locate')} Near me<small>Asks for your location only when tapped</small></span>
      </button>
    </section>
    <p id="near-note" class="data-note"></p>

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
        </div>
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
    title: 'Explore routes · Naarad',
    description: `Search ${routes.length} heritage walking routes across India. ${withStops} ${withStops === 1 ? 'has' : 'have'} ordered stops with a written story at each; the rest are listed with the facts known so far.`,
    path: '/routes/',
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
