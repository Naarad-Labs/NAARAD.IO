/* Explore: the searchable catalogue, at /routes/ and again at /explore/.
   Desktop keeps the filters open beside a grid; the phone composition moves
   them into a scrolling row and a sheet (explore.css). The search is read from
   the address (?q=), so a filtered catalogue can be linked to. */

import { escapeHtml } from '../media.js';
import { icon } from '../icons.js';
import * as Data from '../data.js';
import { routeCard } from './home.js';
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
  const target = document.querySelector('#catalogue-grid');
  if (target) target.innerHTML = grid(list);
  const count = document.querySelector('#catalogue-count');
  if (count) count.textContent = `${list.length} ${list.length === 1 ? 'route' : 'routes'}`;
}

export function setQuery(value) { query = value; applyFilters(); }
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
        <h1 class="display">Go where<br>stories live.</h1>
        <p class="lede">Search places and browse published routes across India. ${withStops} ${withStops === 1 ? 'route has' : 'routes have'} ordered stops with stories; the rest carry their route facts while stops are written.</p>
      </div>
      <form class="catalogue-search" role="search" aria-label="Search routes" onsubmit="return false">
        <label class="sr-only" for="catalogue-query">Search routes and places</label>
        ${icon('search')}
        <input id="catalogue-query" type="search" placeholder="Search a place, route or theme" autocomplete="off" value="${escapeHtml(query)}">
      </form>
    </header>

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
