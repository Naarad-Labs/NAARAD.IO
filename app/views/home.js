/* The homepage: a cinematic flyover hero, 5-photo mosaic, featured routes
   with their real previews, the creator and language bands, and the magazine strip.

   Desktop reads as an editorial spread; the same components stack into a
   single column on a phone (see home.css). */

import { picture, escapeHtml, photoPath } from '../media.js'; import { routePath, sectionPath } from '../urls.js';
import { icon } from '../icons.js';
import * as Data from '../data.js';
import { routePreview, terrainSparkline } from '../previews.js';
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

/** Flyover hero: aerial video/animation with overlay headline, lede, CTA, quick-links. */
function flyoverHero(featured) {
  const first = featured[0];
  const posterPhoto = first?.media?.card || first?.media?.photo || 'hampi-landscape';
  return `<section class="flyover-hero dither-band" data-dither="sand" aria-labelledby="home-title">
    <div class="flyover-media">
      <video class="flyover-video" playsinline muted loop preload="metadata" poster="${photoPath(posterPhoto) || '/Images/hero-1600.webp'}">
        <source src="/videos/flyover-hampi.av1.mp4" type="video/mp4; codecs=av01.0.05M.08">
        <source src="/videos/flyover-hampi.webm" type="video/webm; codecs=vp09.00.51.08">
        <source src="/videos/flyover-hampi.mp4" type="video/mp4">
      </video>
      <canvas class="flyover-canvas" aria-hidden="true"></canvas>
    </div>
    <div class="flyover-overlay">
      <div class="flyover-copy">
        <p class="eyebrow">A living heritage, a shared human story</p>
        <h1 id="home-title" class="display">Walk a place. <br><span class="accent">Hear its story.</span></h1>
        <p class="lede">Heritage walks across India, told at the places where the stories happened: real routes, local history, and stories your phone can read aloud as you walk.</p>
        <a class="button button-primary flyover-cta" href="${sectionPath('explore')}" data-view="explore">Start Exploring ${icon('arrow')}</a>
        <ul class="quick-links">
          ${QUICK_LINKS.map((link) => `<li><a href="${sectionPath(link.view)}" data-view="${link.view}">
            ${icon(link.icon, { className: 'ico-orange' })}
            <span><b>${link.title}</b><small>${link.sub}</small></span>
          </a></li>`).join('')}
        </ul>
        ${first ? `<span class="pin-chip flyover-place">${icon('pin')}${escapeHtml(first.location || 'India')}</span>` : ''}
      </div>
    </div>
  </section>`;
}

/** Airbnb-style 5-photo mosaic: 1 large (featured[0]) + 4 small (featured[1]..featured[4]). */
function photoMosaic(featured) {
  if (!featured?.length) return '';

  const photos = featured.slice(0, 5).map((route, index) => {
    const photo = route.media?.card || route.media?.photo;
    if (!photo) return null;
    return {
      id: photo,
      alt: `${route.name}, ${route.location || ''}`,
      routeSlug: route.slug,
      routeName: route.name,
      isLarge: index === 0,
    };
  }).filter(Boolean);

  if (!photos.length) return '';

  return `<section class="photo-mosaic" aria-labelledby="mosaic-title">
    <h2 id="mosaic-title" class="visually-hidden">Featured places</h2>
    <div class="mosaic-grid">
      ${photos.map((photo, index) => `
        <a class="mosaic-tile ${photo.isLarge ? 'is-large' : ''}" href="${routePath(photo.routeSlug)}" data-route="${escapeHtml(photo.routeSlug)}" style="--index:${index}">
          ${picture(photo.id, { sizes: photo.isLarge ? '(max-width: 1023px) 100vw, 50vw' : '(max-width: 760px) 50vw, 25vw', alt: escapeHtml(photo.alt), ratio: photo.isLarge ? '4 / 3' : '3 / 4', className: 'mosaic-photo' })}
          <div class="mosaic-overlay">
            <span class="mosaic-name">${escapeHtml(photo.routeName)}</span>
            <span class="text-link">View Route ${icon('arrow')}</span>
          </div>
        </a>
      `).join('')}
    </div>
  </section>`;
}

function featuredSection(routes) {
  return `<section class="home-featured" aria-labelledby="featured-title">
    <div class="section-head">
      <div>
        <p class="eyebrow eyebrow-mark">Featured routes</p>
        <h2 id="featured-title" class="section-title">Iconic journeys, deeper stories.</h2>
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
      <p class="eyebrow eyebrow-mark">Voices of Naarad</p>
      <h2 id="voices-title" class="section-title">Real people. <br>Richer stories.</h2>
      <p>Naarad is built to carry the voices of the people who know a place best: historians, guides, artists and residents, telling it in their own language.</p>
      <a class="button button-ghost" href="${sectionPath('creators')}" data-view="creators">Meet Our Creators ${icon('arrow')}</a>
    </div>
    <div class="voices-panel">
      <div class="voices-open">
        <p class="eyebrow">Creator programme</p>
        <h3>Recording opens city by city.</h3>
        <p class="voices-note">No creator narration has been published yet. The first recordings will appear here as creators in each city finish them, credited by name.</p>
        <a class="text-link" href="${sectionPath('creators')}" data-view="creators">Apply to narrate your city ${icon('arrow')}</a>
      </div>
      <ul class="voices-roles">
        <li>${icon('mic')}<span><b>Historians & guides</b><small>Context that holds up</small></span></li>
        <li>${icon('temple')}<span><b>Temple and site staff</b><small>What a visitor never sees</small></span></li>
        <li>${icon('users')}<span><b>Residents</b><small>The place as it is lived</small></span></li>
      </ul>
    </div>
    <div class="voices-languages">
      <p class="eyebrow eyebrow-mark">Multilingual audio</p>
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
      <p class="eyebrow eyebrow-mark">The Naarad experience</p>
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

/** The intro video, or '' when content/visuals.json lists none. No autoplay: it has sound. */
export function introVideoMarkup(visuals) {
  const video = visuals?.introVideo;
  if (!video?.src || !video.captions) return '';   // a narrated video without captions fails WCAG 1.2.2
  return `<section class="home-video" aria-labelledby="intro-video-title">
    <h2 id="intro-video-title" class="section-title">See Naarad in two minutes.</h2>
    <video controls playsinline preload="metadata" src="${escapeHtml(video.src)}"${video.poster ? ` poster="${escapeHtml(video.poster)}"` : ''}>
      <track kind="captions" src="${escapeHtml(video.captions)}" srclang="en" label="English" default>
    </video>
  </section>`;
}

/** The route-tracker picture (an Ultramock export), or '' when content/visuals.json lists none. */
export function trackerSectionMarkup(visuals) {
  const tracker = visuals?.tracker;
  if (!tracker?.image) return '';
  return `<section class="home-how" aria-labelledby="how-title">
    <h2 id="how-title" class="section-title">Your walk, tracked as you go.</h2>
    <img src="${escapeHtml(tracker.image)}" width="${Number(tracker.width) || 1200}" height="${Number(tracker.height) || 800}" alt="${escapeHtml(tracker.alt || '')}" loading="lazy" decoding="async">
  </section>`;
}

async function loadVisuals() {
  try {
    const response = await fetch('/content/visuals.json');
    return response.ok ? await response.json() : {};
  } catch {
    return {};
  }
}

export async function render() {
  const [featured, all, visuals] = await Promise.all([Data.featuredRoutes(5), Data.loadRoutes(), loadVisuals()]);
  const editorial = all.filter((route) => route.source === 'editorial');
  return `<div class="home">
    ${flyoverHero(featured)}
    ${photoMosaic(featured)}
    ${introVideoMarkup(visuals)}
    ${featuredSection(featured.slice(0, 4))}
    ${trackerSectionMarkup(visuals)}
    ${voicesSection()}
    ${experienceSection(editorial.length ? editorial : featured)}
  </div>`;
}

export const stylesheet = '/app/home.css';

export function meta() {
  const firstHeroPhoto = 'hampi-landscape'; // will be overridden by featured[0] at render time
  return {
    title: 'Naarad · Walk a place. Hear its story.',
    description: Seo.SITE_DESCRIPTION,
    path: '/',
    card: Seo.HOME_CARD,
    preload: { photo: firstHeroPhoto, sizes: HERO_SIZES },
    schema: [Seo.website(), Seo.organization()],
  };
}
