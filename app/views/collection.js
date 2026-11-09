/* Collections: routes grouped under a title, an introduction and a named curator. /collections/ lists them
   and /collections/<slug>/ shows one with its route cards. Written by hand in content/collections.json; a route
   a collection names that does not exist is simply left out. */

import { picture, escapeHtml } from '../media.js';
import { icon } from '../icons.js';
import * as Data from '../data.js';
import { routeCard } from './home.js';
import { routePreview } from '../previews.js';
import { collectionPath } from '../urls.js';
import * as Seo from '../seo.js';

let loading = null;

/** Every collection. A file that cannot be read rejects, and is read again next time. */
export function loadCollections() {
  loading ||= readCollections().catch((error) => { loading = null; throw error; });
  return loading;
}

async function readCollections() {
  const response = await fetch('/content/collections.json', { cache: 'no-cache' });
  if (!response.ok) throw new Error(`/content/collections.json: ${response.status}`);
  try {
    return ((await response.json()).collections || []).map((collection) => ({ intro: [], routes: [], category: '', standfirst: '', curator: 'the Naarad editorial team', ...collection }));
  } catch (error) { throw new Error(`/content/collections.json: ${error.message}`); }
}

export async function getCollection(slug) {
  return (await loadCollections()).find((collection) => collection.slug === slug) || null;
}

/** The routes a collection names, in its order, skipping any that do not exist. */
export async function routesOf(collection) {
  const all = await Data.loadRoutes();
  return (collection.routes || []).map((slug) => all.find((route) => route.slug === slug)).filter(Boolean);
}

/** Collections that include a route, for the route page. Empty when the file cannot be read. */
export async function collectionsWith(slug) {
  try { return (await loadCollections()).filter((collection) => collection.routes.includes(slug)); } catch { return []; }
}

const photoOf = (route) => route?.media?.card || route?.media?.photo || null;
/** The route whose photograph fronts a collection: its named cover, else the first route that has a photograph. */
const coverOf = (collection, routes) => routes.find((route) => route.slug === collection.cover && photoOf(route)) || routes.find((route) => photoOf(route)) || null;
const count = (n) => `${n} ${n === 1 ? 'route' : 'routes'}`;

/** With no photograph, the first mapped route's line is a better picture than a blank. */
function fallbackPicture(routes) {
  const mapped = routes.find((route) => route.geometry?.coordinates?.length);
  return mapped
    ? `<span class="collection-card-map">${routePreview(mapped, { width: 360, height: 240, numbered: false })}</span>`
    : '<span class="photo photo-missing" aria-hidden="true"></span>';
}

function card(collection, routes) {
  const lead = coverOf(collection, routes);
  return `<a class="collection-card" href="${collectionPath(collection.slug)}" data-collection="${escapeHtml(collection.slug)}" aria-labelledby="cc-${escapeHtml(collection.slug)}" aria-describedby="cd-${escapeHtml(collection.slug)}">
    ${lead ? picture(photoOf(lead), { sizes: '(max-width: 760px) 100vw, 360px', alt: '', ratio: '3 / 2' }) : fallbackPicture(routes)}
    <span class="collection-card-copy">
      <span class="eyebrow eyebrow-mark">${escapeHtml(collection.category)} · ${count(routes.length)}</span>
      <strong id="cc-${escapeHtml(collection.slug)}">${escapeHtml(collection.title)}</strong>
      <small id="cd-${escapeHtml(collection.slug)}">${escapeHtml(collection.standfirst)}</small>
      <small class="collection-card-by">Curated by ${escapeHtml(collection.curator)}</small>
    </span>
  </a>`;
}

/** The strip of collection cards the catalogue shows under its theme tiles. Empty if there are none. */
export async function strip(limit = 5) {
  try {
    const all = (await loadCollections()).slice(0, limit);
    if (!all.length) return '';
    const cards = await Promise.all(all.map(async (collection) => card(collection, await routesOf(collection))));
    return `<section class="collection-strip" aria-labelledby="collections-title">
      <div class="section-head"><div><p class="eyebrow eyebrow-mark">Collections</p><h2 class="section-title" id="collections-title">Routes, grouped.</h2></div>
      <div class="section-head-aside"><a class="text-link" href="/collections/" data-view="collections">All collections ${icon('arrow')}</a></div></div>
      <div class="collection-grid">${cards.join('')}</div>
    </section>`;
  } catch { return ''; }
}

export const stylesheet = '/app/explore.css';

export async function renderIndex() {
  let all;
  try { all = await loadCollections(); } catch { all = null; }
  if (!all?.length) {
    return `<div class="collection-index"><header class="catalogue-hero dither-band" data-dither="sand"><div><p class="eyebrow eyebrow-mark">Collections</p><h1 class="display">Routes, grouped.</h1>
      <p class="lede">${all ? 'No collections are published yet.' : 'Collections could not load right now.'} <a class="text-link" href="/routes/" data-view="routes">Browse every route</a>.</p></div></header></div>`;
  }
  const cards = await Promise.all(all.map(async (collection) => card(collection, await routesOf(collection))));
  return `<div class="collection-index">
    <nav class="breadcrumb" aria-label="Breadcrumb"><a href="/routes/" data-view="routes">Routes</a>${icon('chevron')}<b aria-current="page">Collections</b></nav>
    <header class="catalogue-hero dither-band" data-dither="sand"><div>
      <p class="eyebrow eyebrow-mark">Collections</p>
      <h1 class="display">Routes, grouped.</h1>
      <p class="lede">Hand-picked sets of routes, each with a short introduction. ${all.length} ${all.length === 1 ? 'collection' : 'collections'} so far.</p>
    </div></header>
    <div class="collection-grid">${cards.join('')}</div>
  </div>`;
}

export async function indexMeta() {
  const all = await loadCollections();
  const first = all[0] ? coverOf(all[0], await routesOf(all[0])) : null;
  return {
    title: 'Collections · Naarad',
    description: 'Hand-picked sets of Naarad’s heritage walking routes across India, each with a short introduction.',
    path: '/collections/',
    card: {
      name: 'collections',
      eyebrow: 'Collections',
      title: 'Routes, grouped.',
      facts: [`${all.length} collections from Naarad editorial`],
      photo: photoOf(first),
      route: null,
      alt: 'Routes, grouped: the Naarad collections.',
    },
    schema: [Seo.breadcrumbs([['Routes', '/routes/'], ['Collections', '/collections/']])],
  };
}

export async function render({ collection }) {
  const routes = await routesOf(collection);
  const [first, ...more] = collection.intro || [];
  return `<article class="collection-page" data-collection="${escapeHtml(collection.slug)}">
    <nav class="breadcrumb" aria-label="Breadcrumb"><a href="/routes/" data-view="routes">Routes</a>${icon('chevron')}<a href="/collections/" data-view="collections">Collections</a>${icon('chevron')}<b aria-current="page">${escapeHtml(collection.title)}</b></nav>
    <header class="catalogue-hero dither-band" data-dither="sand"><div>
      <p class="eyebrow eyebrow-mark">${escapeHtml(collection.category)} collection · ${count(routes.length)}</p>
      <h1 class="display">${escapeHtml(collection.title)}</h1>
      <p class="lede">${escapeHtml(collection.standfirst)}</p>
      <p class="data-note">Curated by ${escapeHtml(collection.curator)}</p>
    </div></header>
    <div class="collection-intro">
      <p>${escapeHtml(first || '')}</p>
      ${more.length ? `<details><summary class="text-link">Read more</summary>${more.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join('')}</details>` : ''}
    </div>
    <section aria-label="Routes in this collection">${routes.length ? `<div class="route-card-grid">${routes.map((route) => routeCard(route)).join('')}</div>` : '<p class="catalogue-empty">None of this collection\'s routes are published yet.</p>'}</section>
  </article>`;
}

export async function meta({ collection }) {
  const routes = await routesOf(collection);
  const lead = coverOf(collection, routes);
  const path = collectionPath(collection.slug);
  return {
    title: `${collection.title} · Naarad`,
    description: collection.standfirst,
    path,
    card: {
      name: `collection-${collection.slug}`,
      eyebrow: `${collection.category} collection`,
      title: collection.title,
      facts: [count(routes.length), 'Naarad editorial'],
      photo: photoOf(lead),
      route: null,
      alt: `${collection.title}: a Naarad collection of ${count(routes.length)}.`,
    },
    schema: [Seo.breadcrumbs([['Routes', '/routes/'], ['Collections', '/collections/'], [collection.title, path]])],
  };
}
