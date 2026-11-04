/* Route discovery starts with real-data previews; the catalogue owns its interactive map. */

import { picture, escapeHtml } from '../media.js';
import { icon } from '../icons.js';
import * as Data from '../data.js';
import { routePreview, terrainSparkline } from '../previews.js';
import { routePath, sectionPath } from '../urls.js';
import * as Seo from '../seo.js';

const HERO_SIZES = '(max-width: 1023px) 100vw, 62vw';

const QUICK_LINKS = [
  { icon: 'temple', title: 'Explore', sub: 'Places', view: 'explore' },
  { icon: 'headphones', title: 'Listen', sub: 'Stories', view: 'stories' },
  { icon: 'footprints', title: 'Walk', sub: 'Routes', view: 'routes' },
  { icon: 'users', title: 'Connect', sub: 'People', view: 'creators' },
];

const LANGUAGES = [
  { label: 'हिंदी', code: 'hi' }, { label: 'தமிழ்', code: 'ta' }, { label: 'తెలుగు', code: 'te' },
  { label: 'ಕನ್ನಡ', code: 'kn' }, { label: 'മലയാളം', code: 'ml' }, { label: 'मराठी', code: 'mr' },
  { label: 'বাংলা', code: 'bn' }, { label: 'ગુજરાતી', code: 'gu' },
];

const EXPERIENCE = [
  { icon: 'book', title: 'Immersive storytelling', copy: 'Places, people, history and culture.' },
  { icon: 'map', title: 'Interactive routes', copy: 'Walk at your own pace.' },
  { icon: 'headphones', title: 'Read aloud', copy: 'Your phone reads each story as you walk.' },
  { icon: 'leaf', title: 'Deeper connections', copy: 'Understand. Appreciate. Preserve.' },
];

/** One featured route card: photograph, generated map preview and real facts. */
export function routeCard(route, options = {}) {
  const { compact = false } = options;
  const distance = Data.formatDistance(route.distanceM);
  const duration = Data.formatDuration(route.durationMin);
  const unmeasured = Data.isUnmeasured(route, route.distanceM) && Data.isUnmeasured(route, route.durationMin);
  const terrain = Data.terrainLabel(route);
  const preview = routePreview(route, { width: 150, height: 210, numbered: route.hasStops });
  const spark = terrainSparkline(route);
  const photo = route.media?.card || route.media?.photo;

  return `<a class="route-card ${compact ? 'is-compact' : ''}" href="${routePath(route.slug)}" data-route="${escapeHtml(route.slug)}">
    <span class="route-card-media">
      ${route.difficulty ? `<span class="route-card-level">${escapeHtml(Data.formatDifficulty(route.difficulty))}</span>` : ''}
      ${photo ? picture(photo, { sizes: '(max-width: 760px) 100vw, 300px', alt: `${route.name}, ${route.location || ''}`, ratio: '4 / 5', className: 'route-card-photo' })
        : '<span class="route-card-photo photo photo-missing"></span>'}
      ${preview ? `<span class="route-card-map">${preview}</span>` : '<span class="route-card-map is-empty"><span>No mapped line yet</span></span>'}
    </span>
    <span class="route-card-body">
      <strong class="route-card-title">${escapeHtml(route.name)}</strong>
      <span class="route-card-place">${escapeHtml(route.location || route.region || 'India')}</span>
      <span class="route-card-metrics">
        ${distance ? `<span>${icon('walk')}${escapeHtml(distance)}</span>` : ''}
        ${duration ? `<span>${icon('clock')}${escapeHtml(duration)}</span>` : ''}
        ${unmeasured ? `<span class="is-unmeasured">${icon('walk')}${Data.NOT_MEASURED}</span>` : ''}
        ${route.stopCount ? `<span>${icon('pin')}${route.stopCount} stops</span>` : ''}
      </span>
      ${route.themes?.length ? `<span class="chip-list">${route.themes.slice(0, 3).map((theme) => `<span class="chip">${escapeHtml(theme)}</span>`).join('')}</span>` : ''}
      <span class="route-card-terrain">
        ${spark || ''}
        <small>${escapeHtml(terrain || 'Terrain not surveyed')}</small>
      </span>
      <span class="text-link">View Route ${icon('arrow')}</span>
    </span>
  </a>`;
}

function hero(featured) {
  const first = featured.find((route) => route.slug === 'hampi-heritage-trail' && route.geometry?.coordinates?.length) || featured.find((route) => route.geometry?.coordinates?.length) || featured[0];
  const preview = first ? routePreview(first, { width: 800, height: 440, numbered: first.hasStops }) : '';
  return `<section class="home-hero" aria-labelledby="home-title">
    <div class="home-hero-copy">
      <h1 id="home-title" class="display">Walk a place. <br><span class="accent">Hear its story.</span></h1>
      <p class="lede">Heritage walks across India, with real routes, local history and stories your phone can read aloud as you walk.</p>
      <form class="home-route-search" role="search" aria-label="Find a route" action="/routes/">
        <label class="sr-only" for="home-route-query">Place, route or theme</label>
        ${icon('search')}<input id="home-route-query" type="search" name="q" placeholder="Place, route or theme">
        <button class="button button-primary" type="submit">Find routes ${icon('arrow')}</button>
      </form>
      <a class="button home-hero-cta" href="/routes/#atlas" data-view="routes">${icon('map')} Open route map ${icon('arrow')}</a>
      <ul class="quick-links">
        ${QUICK_LINKS.map((link) => `<li><a href="${sectionPath(link.view)}" data-view="${link.view}">
          ${icon(link.icon, { className: 'ico-orange' })}
          <span><b>${link.title}</b><small>${link.sub}</small></span>
        </a></li>`).join('')}
      </ul>
    </div>
    <div class="home-hero-media" data-hero-carousel role="region" aria-roledescription="carousel" aria-label="Photo and route map preview">
      <div class="hero-carousel-stage">
        <div class="hero-carousel-slide" data-hero-slide="photo" role="group" aria-roledescription="slide" aria-label="1 of 2: Hampi photograph" aria-hidden="false">
          ${picture('hampi-landscape', {
    sizes: HERO_SIZES,
    alt: 'The boulder landscape of Hampi, Karnataka, with temple towers among the rocks',
    priority: true,
    credit: true,
    className: 'home-hero-photo',
  })}
        </div>
        <div class="hero-carousel-slide" data-hero-slide="map" role="group" aria-roledescription="slide" aria-label="2 of 2: ${escapeHtml(first?.name || 'Route')} map" aria-hidden="true" hidden>
          <a class="home-map-preview" href="/routes/#atlas" data-view="routes" aria-label="Open route map${first ? `, previewing ${escapeHtml(first.name)}` : ''}">
            ${preview || '<span class="data-note">Browse routes to find a mapped walk.</span>'}
            <span class="home-map-open">${icon('map')} Explore the map ${icon('arrow')}</span>
          </a>
          <p class="home-map-disclosure">${first?.geometry?.kind === 'connecting-line' ? 'Route preview · connects published stops' : first?.geometry?.kind === 'recorded-track' ? 'Route preview · recorded track' : 'Route preview'}</p>
        </div>
        <div class="hero-carousel-controls" role="group" aria-label="Preview controls">
          <div class="hero-carousel-select" role="group" aria-label="Choose preview">
            <button type="button" data-hero-select="photo" aria-pressed="true" disabled>Photo</button>
            <button type="button" data-hero-select="map" aria-pressed="false" disabled>Map</button>
          </div>
        </div>
      </div>
      ${first ? `<div class="home-map-route">
        <a href="${routePath(first.slug)}" data-route="${escapeHtml(first.slug)}"><strong>${escapeHtml(first.name)}</strong><span>${escapeHtml(first.location || 'India')}</span><span class="home-map-facts">${[Data.formatDistance(first.distanceM), Data.formatDuration(first.durationMin), first.stopCount ? `${first.stopCount} stops` : ''].filter(Boolean).map(escapeHtml).join(' · ') || Data.NOT_MEASURED}</span></a>
        <a class="text-link home-preview-route" href="${routePath(first.slug)}" data-route="${escapeHtml(first.slug)}">View route ${icon('arrow')}</a>
      </div>` : ''}
    </div>
  </section>`;
}

function featuredSection(routes) {
  return `<section class="home-featured" aria-labelledby="featured-title">
    <div class="section-head">
      <div>
        <h2 id="featured-title" class="section-title">Find your next route.</h2>
      </div>
      <div class="section-head-aside">
        <p>Curated walking routes with place stories, local context and real route data, at your own pace.</p>
        <a class="button button-sm" href="${sectionPath('routes')}" data-view="routes">View All Routes ${icon('arrow')}</a>
      </div>
    </div>
    <div class="route-card-grid">${routes.map((route) => routeCard(route)).join('')}</div>
  </section>`;
}

function voicesSection() {
  return `<section class="home-voices" aria-labelledby="voices-title">
    <div class="voices-copy">
      <h2 id="voices-title" class="section-title">Real people. <br>Richer stories.</h2>
      <p>Naarad is built to carry the voices of the people who know a place best: historians, guides, artists and residents, telling it in their own language.</p>
      <a class="button button-ghost" href="${sectionPath('creators')}" data-view="creators">Meet Our Creators ${icon('arrow')}</a>
    </div>
    <div class="voices-panel">
      <div class="voices-open">
        <h3>Recording opens city by city.</h3>
        <p class="voices-note">No creator narration has been published yet. The first recordings will appear here as creators in each city finish them, credited by name.</p>
        <a class="text-link" href="${sectionPath('creators')}" data-view="creators">Apply to narrate your city ${icon('arrow')}</a>
      </div>
      <ul class="voices-roles">
        <li>${icon('mic')}<span><b>Historians &amp; guides</b><small>Context that holds up</small></span></li>
        <li>${icon('temple')}<span><b>Temple and site staff</b><small>What a visitor never sees</small></span></li>
        <li>${icon('users')}<span><b>Residents</b><small>The place as it is lived</small></span></li>
      </ul>
    </div>
    <div class="voices-languages">
      <h2>India's stories, <br>in your language.</h2>
      <p>Naarad is built for stories in the languages people actually use, not only in English. Every story published so far is in English.</p>
      <ul class="language-list">
        ${LANGUAGES.map((language) => `<li lang="${language.code}">${language.label}</li>`).join('')}
        <li class="is-more">+ more</li>
      </ul>
      <p class="note-plain">Different languages. <br>The same wonder.</p>
    </div>
  </section>`;
}

function experienceSection(routes) {
  const strip = routes.filter((route) => route.media?.photo).slice(0, 4);
  return `<section class="home-experience" aria-labelledby="experience-title">
    <div class="experience-copy">
      <h2 id="experience-title" class="section-title">Like a magazine. <br>Made for real places.</h2>
      <p>Stories, photography and interactive routes in one piece, so reading about a place and walking it are the same experience.</p>
      <a class="button button-sm" href="${routePath('hampi-heritage-trail')}" data-route="hampi-heritage-trail">Take a Look Inside ${icon('arrow')}</a>
    </div>
    <div class="experience-strip">
      ${strip.map((route, index) => `<article class="magazine-page" style="--index:${index}">
        ${picture(route.media.photo, { sizes: '230px', alt: '', ratio: '3 / 4' })}
        <div class="magazine-page-copy">
          <span class="magazine-index">0${index + 1}</span>
          <h3>${escapeHtml(route.name)}</h3>
          <p>${escapeHtml((route.lede || route.overview || '').slice(0, 92))}${(route.lede || '').length > 92 ? '…' : ''}</p>
        </div>
      </article>`).join('')}
    </div>
    <ul class="experience-points">
      ${EXPERIENCE.map((point) => `<li>${icon(point.icon, { className: 'ico-orange' })}<span><b>${point.title}</b><small>${point.copy}</small></span></li>`).join('')}
    </ul>
  </section>`;
}

export async function render() {
  const [featured, all] = await Promise.all([Data.featuredRoutes(4), Data.loadRoutes()]);
  const editorial = all.filter((route) => route.source === 'editorial');
  return `<div class="home">
    ${hero(featured)}
    ${featuredSection(featured)}
    ${voicesSection()}
    ${experienceSection(editorial.length ? editorial : featured)}
  </div>`;
}

export const stylesheet = '/app/home.css';

export function meta() {
  return {
    title: 'Naarad · Walk a place. Hear its story.',
    description: Seo.SITE_DESCRIPTION,
    path: '/',
    card: Seo.HOME_CARD,
    preload: { photo: Seo.HOME_CARD.photo, sizes: HERO_SIZES },
    schema: [Seo.website(), Seo.organization()],
  };
}
