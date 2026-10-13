/* Explore: the searchable catalogue.
   Desktop keeps the filters open beside a grid; the phone composition moves
   them into a scrolling row and a sheet (explore.css). */

import { escapeHtml } from '../media.js';
import { icon } from '../icons.js';
import * as Data from '../data.js';
import { routeCard } from './home.js';

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

export async function render() {
  routes = await Data.loadRoutes();
  const regions = [...new Set(routes.map((route) => route.region).filter(Boolean))].sort();
  const withStops = routes.filter((route) => route.hasStops).length;

  return `<div class="catalogue">
    <header class="catalogue-hero">
      <div>
        <p class="eyebrow eyebrow-mark">The Naarad atlas · ${routes.length} routes</p>
        <h1 class="display">Go where<br>stories live.</h1>
        <p class="lede">Search places and browse published routes across India. ${withStops} ${withStories === 1 ? 'route has' : 'routes have'} ordered stops with stories; the rest carry their route facts while stops are written.</p>
      </div>
      <form class="catalogue-search" role="search" onsubmit="return false">
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

      <section class="catalogue-results" aria-live="polite">
        <div class="section-head">
          <div>
            <p class="eyebrow eyebrow-mark">Curated and community routes</p>
            <h2 id="catalogue-count" class="section-title">${routes.length} routes</h2>
          </div>
        </div>
        <div id="catalogue-grid" class="route-card-grid">${grid(routes)}</div>
      </section>
    </div>
  </div>`;
}

export const stylesheet = '/app/explore.css';
export const meta = {
  title: 'Explore routes · Naarad',
  description: 'Search heritage walking routes across India: distance, duration, stops and terrain for every published route.',
};
