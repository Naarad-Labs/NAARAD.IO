/* Explore: where a visitor starts when they do not yet know which route they want. Themes, collections and
   a few routes to begin with, and a way into the all-routes map. The searchable catalogue is a different page,
   /routes/; this one has no filters of its own. */

import { escapeHtml, picture } from '../media.js';
import { icon } from '../icons.js';
import * as Data from '../data.js';
import { routeCard } from './home.js';
import { themeTiles } from './explore.js';
import { strip as collectionStrip } from './collection.js';
import { cataloguePath } from '../urls.js';
import * as Seo from '../seo.js';

export const stylesheet = '/app/explore.css';

/** Routes with stories first, then the rest, three of them: somewhere to begin. */
const featured = (routes) => [...routes].sort((a, b) => Number(b.hasStops) - Number(a.hasStops)).slice(0, 3);

export async function render() {
  const routes = await Data.loadRoutes();
  const tiles = themeTiles(routes);
  const collections = await collectionStrip();
  return `<div class="discover">
    <header class="catalogue-hero dither-band" data-dither="sand">
      <div>
        <p class="eyebrow eyebrow-mark">Explore</p>
        <h1 class="display">Find your <br>next walk.</h1>
        <p class="lede">Start from a theme, a collection or the map. ${routes.length} routes across India, and the ones with stories are marked.</p>
      </div>
      <p class="discover-actions">
        <a class="button button-primary" href="/routes/" data-view="routes">Browse all routes ${icon('arrow')}</a>
        <a class="button" href="/routes/#atlas" data-view="routes">${icon('map')} See the map</a>
      </p>
    </header>

    ${tiles.length ? `<section class="explore-tiles" aria-label="Start from a theme">
      ${tiles.map((tile) => `<a class="explore-tile" href="${cataloguePath(tile.theme, '/routes/')}" data-view="routes">
        ${picture(tile.photo, { sizes: '(max-width: 760px) 45vw, 190px', alt: '', ratio: '4 / 3' })}
        <span class="explore-tile-label">${escapeHtml(tile.theme)}<small>${tile.n} ${tile.n === 1 ? 'route' : 'routes'}</small></span>
      </a>`).join('')}
    </section>` : ''}

    ${collections}

    <section class="discover-featured" aria-labelledby="featured-title">
      <div class="section-head"><div><p class="eyebrow eyebrow-mark">Begin here</p><h2 class="section-title" id="featured-title">Routes with a story.</h2></div>
      </div>
      <div class="route-card-grid is-three">${featured(routes).map((route) => routeCard(route)).join('')}</div>
    </section>
  </div>`;
}

export async function meta() {
  const routes = await Data.loadRoutes();
  const lead = featured(routes)[0];
  return {
    title: 'Explore · Naarad',
    description: `Find a heritage walk across India: start from a theme, a hand-picked collection or the map of all ${routes.length} routes.`,
    path: '/explore/',
    card: {
      name: 'explore',
      eyebrow: 'Explore',
      title: 'Find your next walk.',
      facts: [`${routes.length} routes across India`],
      photo: lead?.media?.card || lead?.media?.photo || null,
      route: null,
      alt: `Find your next walk: Naarad's Explore page${lead ? `, set on a photograph from the ${lead.name}` : ''}.`,
    },
    schema: [Seo.breadcrumbs([['Explore', '/explore/']])],
  };
}
