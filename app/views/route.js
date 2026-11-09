/* Route detail: the editorial header, the working map, the stop being read,
   the stop rail, and the elevation profile.

   Desktop lays these out as a three-column workspace. The phone composition
   (route.css) turns the same state into a map with a bottom sheet. Both read
   one route object and one selected stop; there is only ever one map. */

import { picture, creditText, escapeHtml, photoPath } from '../media.js';
import { icon } from '../icons.js';
import * as Data from '../data.js';
import { routePreview, elevationProfile, terrainSparkline } from '../previews.js';
import { elevationSamples } from '../elevation-model.js';
import * as Journey from '../journey-store.js';
import * as Offline from '../offline-bundles.js';
import { routePath, sectionPath, absoluteUrl } from '../urls.js';
import * as Seo from '../seo.js';

const HERO_SIZES = '(max-width: 1023px) 100vw, 56vw';

/* The bar under the header links to the sections of this one page (#section-<id>).
   It is navigation, not a tab widget: every section is on the page at once. */
const TABS = [
  { id: 'overview', label: 'Overview', icon: 'file' },
  { id: 'stops', label: 'Stops', icon: 'pin' },
  { id: 'stories', label: 'Stories', icon: 'headphones' },
  { id: 'terrain', label: 'Terrain', icon: 'terrain' },
  { id: 'map', label: 'Map', icon: 'map' },
];

/* Behind the offline-bundles flag. The words say what a bundle leaves out. */
function offlineState(route) {
  const entry = Journey.getDownloads().find((item) => item.slug === route.slug);
  return entry
    ? { value: 'Saved offline', label: `${entry.sizeLabel} · tap to remove`, state: 'saved' }
    : { value: 'Download for offline', label: 'Page, text and photos. No map tiles or audio.', state: 'idle' };
}

/* A measurement a catalogue row does not have yet is said to be missing, in the
   place it would have been, rather than left out as if the route had none. */
function measured(name, route, raw, shown, label) {
  if (Data.isUnmeasured(route, raw)) return { icon: name, value: Data.NOT_MEASURED, label, muted: true };
  return { icon: name, value: shown, label: '' };
}

function factRow(route) {
  const facts = [
    { icon: 'pin', value: route.location || 'India', label: '' },
    measured('clock', route, route.durationMin, Data.formatDuration(route.durationMin), 'Duration'),
    measured('walk', route, route.distanceM, Data.formatDistance(route.distanceM), 'Distance'),
    { icon: 'flag', value: route.stopCount ? `${route.stopCount} stops` : null, label: '' },
    { icon: 'gauge', value: Data.formatDifficulty(route.difficulty), label: 'Difficulty' },
    { icon: 'terrain', value: Data.terrainLabel(route), label: 'Terrain' },
    Offline.enabled()
      ? { icon: 'download', button: true, ...offlineState(route) }
      : { icon: 'download', value: 'Offline bundle', label: 'Not yet available', muted: true },
    { icon: 'globe', value: 'English', label: route.languages?.some((code) => code !== 'en') ? 'Other languages are planned' : '' },
  ].filter((fact) => fact.value);

  return `<div class="route-facts">
    ${facts.map((fact) => fact.button ? `<div class="metric">
      <button type="button" class="metric-button" data-action="offline" data-state="${fact.state}">
        ${icon(fact.icon)}
        <span class="metric-text"><b>${escapeHtml(fact.value)}</b><span>${escapeHtml(fact.label)}</span></span>
      </button>
    </div>` : `<div class="metric${fact.muted ? ' is-muted' : ''}">
      ${icon(fact.icon)}
      <span class="metric-text"><b>${escapeHtml(fact.value)}</b>${fact.label ? `<span>${escapeHtml(fact.label)}</span>` : ''}</span>
    </div>`).join('')}
  </div>`;
}

/** Flyover hero: aerial video/animation with overlay headline, lede, CTA. */
function flyoverHero(route) {
  const posterPhoto = route.media?.photo || 'hampi-landscape';
  return `<header class="flyover-hero dither-band" data-dither="sand" aria-labelledby="route-title">
    <div class="flyover-media">
      <video class="flyover-video" playsinline muted loop preload="metadata" poster="${photoPath(posterPhoto) || '/Images/hero-1600.webp'}">
        <source src="/videos/flyover-${route.slug}.av1.mp4" type="video/mp4; codecs=av01.0.05M.08">
        <source src="/videos/flyover-${route.slug}.webm" type="video/webm; codecs=vp09.00.51.08">
        <source src="/videos/flyover-${route.slug}.mp4" type="video/mp4">
      </video>
      <canvas class="flyover-canvas" aria-hidden="true"></canvas>
    </div>
    <div class="flyover-overlay">
      <nav class="breadcrumb" aria-label="Breadcrumb">
        <a href="${sectionPath('routes')}" data-view="routes">Routes</a>${icon('chevron')}
        <span>${escapeHtml(route.region || 'India')}</span>${icon('chevron')}
        <b aria-current="page">${escapeHtml(route.name)}</b>
      </nav>
      <h1 id="route-title" class="flyover-title">${escapeHtml(route.name)}</h1>
      ${route.subtitle ? `<p class="flyover-subtitle">${escapeHtml(route.subtitle)}</p>` : ''}
      ${route.lede ? `<p class="flyover-lede">${escapeHtml(route.lede)}</p>` : ''}
      <div class="flyover-meta">
        <span>${icon('walk')}${escapeHtml(Data.formatDistance(route.distanceM) || Data.NOT_MEASURED)}</span>
        <span>${icon('clock')}${escapeHtml(Data.formatDuration(route.durationMin) || Data.NOT_MEASURED)}</span>
        ${route.stopCount ? `<span>${icon('pin')}${route.stopCount} stops</span>` : ''}
      </div>
      <a class="button button-primary flyover-cta" href="#section-stories" data-action="start">Listen to Route ${icon('headphones')}</a>
      ${route.subtitle ? `<span class="pin-chip flyover-place">${icon('pin')}${escapeHtml(route.location || 'India')}</span>` : ''}
    </div>
  </header>`;
}

/** Airbnb-style 5-photo mosaic: 1 large (route hero) + 4 small (stops). */
function photoMosaic(route) {
  const stopsWithPhotos = route.stops?.filter((s) => s.photo).slice(0, 4) || [];
  if (!stopsWithPhotos.length && !route.media?.photo) return '';

  const photos = [
    { id: route.media?.photo, alt: `${route.name}, ${route.location || ''}`, routeSlug: route.slug, routeName: route.name, isLarge: true },
    ...stopsWithPhotos.map((stop, index) => ({
      id: stop.photo,
      alt: stop.name,
      routeSlug: route.slug,
      routeName: `Stop ${stop.order}: ${stop.name}`,
      isLarge: false,
    })),
  ].filter((p) => p.id);

  if (!photos.length) return '';

  return `<section class="photo-mosaic route-mosaic" aria-labelledby="mosaic-title">
    <h2 id="mosaic-title" class="visually-hidden">Route photos</h2>
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

/** AllTrails-style photo scrubber: horizontal track with stop thumbnails + main preview. */
function photoScrubber(route) {
  if (!route.stops?.length) return '';

  const stops = route.stops.filter((s) => s.photo);
  if (!stops.length) return '';

  const totalDistance = route.distanceM || 1;
  return `<section class="photo-scrubber-section" aria-labelledby="scrubber-title">
    <h2 id="scrubber-title" class="visually-hidden">Photos along the route</h2>
    <div class="photo-scrubber" data-scrubber>
      <div class="photo-scrubber-preview" data-scrubber-preview>
        ${picture(stops[0].photo, { sizes: '(max-width: 1023px) 100vw, 320px', alt: escapeHtml(stops[0].name), ratio: '4 / 3' })}
        <span class="photo-credit">${escapeHtml(creditText(stops[0].photo))}</span>
      </div>
      <div class="photo-scrubber-track" data-scrubber-track role="slider" aria-label="Route photos" aria-orientation="horizontal">
        ${stops.map((stop, i) => {
          const progress = totalDistance ? (stop.distanceM || 0) / totalDistance * 100 : (i / Math.max(1, stops.length - 1)) * 100;
          return `<button type="button" class="photo-scrubber-stop ${i === 0 ? 'is-active' : ''}" data-stop="${stop.order}" data-progress="${progress.toFixed(2)}" aria-label="${escapeHtml(stop.name)}" style="--progress:${progress.toFixed(2)}%">
            <span class="photo-scrubber-thumb">
              ${picture(stop.photo, { sizes: '72px', alt: '', ratio: '1 / 1' })}
            </span>
            <small>${escapeHtml(stop.name)}</small>
          </button>`;
        }).join('')}
      </div>
      <div class="photo-scrubber-line" data-scrubber-line>
        <div class="photo-scrubber-progress" data-scrubber-progress style="width: 0%"></div>
        <span class="photo-scrubber-pin" data-scrubber-pin style="left: 0%"></span>
      </div>
    </div>
  </section>`;
}

/* Walking a route is something the visitor says they did; listening to it never marks it. */
function walkedButton(route) {
  const walked = Journey.isWalked(route.slug);
  return `<button type="button" class="button button-sm stop-rail-all stop-rail-walked" data-action="walked" aria-pressed="${walked}">${icon('footprints')} <span>${walked ? 'Marked as walked · undo' : 'Mark as walked'}</span></button>`;
}

function tabBar(route) {
  const saved = Journey.isSaved(route.slug);
  const tabs = TABS.filter((tab) => tab.id !== 'stops' || route.stops.length);
  return `<div class="route-bar">
    <nav class="route-tabs" aria-label="Route sections">
      ${tabs.map((tab, index) => `<a href="#section-${tab.id}" data-tab="${tab.id}"${index === 0 ? ' aria-current="location"' : ''}>${icon(tab.icon)}<span>${tab.label}</span></a>`).join('')}
    </nav>
    <div class="route-bar-actions">
      <button type="button" class="button button-sm" data-action="share">${icon('share')} Share</button>
      <button type="button" class="button button-sm${saved ? ' is-saved' : ''}" data-action="save" aria-pressed="${saved}">${icon('bookmark')} <span>${saved ? 'Saved' : 'Save'}</span></button>
      ${route.stops.length ? `<button type="button" class="button button-primary button-sm" data-action="start" aria-label="Listen from stop 1">${icon('headphones')} Listen</button>` : ''}
    </div>
  </div>`;
}

function stopPanel(route, stop) {
  if (!stop) {
    return `<section class="stop-panel" id="section-stories">
      <div class="empty-state">${icon('sparkle')}<div>
        <strong>Stops are not published for this route</strong>
        <p>This route is in the catalogue, but no one has published its ordered stops yet. Routes with stops show each one here, with its story.</p>
      </div></div>
    </section>`;
  }

  const minutes = Math.max(1, Math.round(stop.story.length / 900));
  return `<section class="stop-panel" id="section-stories" data-stop="${stop.order}">
    <div class="stop-panel-head">
      <p class="eyebrow eyebrow-mark">Stop ${stop.order} of ${route.stopCount}</p>
      <div class="stop-panel-meta">
        <span>${minutes} min read</span>
        <span class="stop-lang">${icon('globe')} English</span>
      </div>
    </div>
    <h2 class="stop-title">${escapeHtml(stop.name)}</h2>
    <p class="stop-tagline">${escapeHtml(stop.tagline)}</p>
    <p class="stop-summary">${escapeHtml(stop.summary)}</p>

    <div class="stop-media">
      ${picture(stop.photo, { sizes: '(max-width: 1023px) 100vw, 520px', alt: stop.name, ratio: '16 / 9' })}
      <button type="button" class="stop-play" data-action="listen" data-stop="${stop.order}">
        <span class="stop-play-mark">${icon('play')}</span>
        <span>Listen to this story</span>
      </button>
      <span class="stop-media-note">${escapeHtml(creditText(stop.photo))}</span>
    </div>

    <div class="stop-tabs" role="tablist" aria-label="Stop detail">
      <button type="button" role="tab" id="stop-tab-transcript" aria-controls="stop-panel-transcript" aria-selected="true" tabindex="0" data-stop-tab="transcript">Transcript</button>
      <button type="button" role="tab" id="stop-tab-place" aria-controls="stop-panel-place" aria-selected="false" tabindex="-1" data-stop-tab="place">About the place</button>
      <button type="button" role="tab" id="stop-tab-related" aria-controls="stop-panel-related" aria-selected="false" tabindex="-1" data-stop-tab="related">Related stops</button>
    </div>
    <div class="stop-tab-panel" id="stop-panel-transcript" role="tabpanel" aria-labelledby="stop-tab-transcript" data-stop-panel="transcript">
      <blockquote class="stop-quote">${icon('quote')}<p>${escapeHtml(stop.story)}</p></blockquote>
      <p class="data-note">Text written for Naarad. Narration is read aloud by your device until a creator recording is published for this stop.</p>
    </div>
    <div class="stop-tab-panel" id="stop-panel-place" role="tabpanel" aria-labelledby="stop-tab-place" data-stop-panel="place" hidden>
      <dl class="stop-facts">
        <div><dt>Distance along route</dt><dd>${escapeHtml(Data.formatDistance(stop.distanceM) || '—')}</dd></div>
        <div><dt>Elevation</dt><dd>${stop.elevationM != null ? `${stop.elevationM} m` : 'Not sampled'}</dd></div>
        <div><dt>Coordinates</dt><dd>${stop.lat.toFixed(4)}, ${stop.lng.toFixed(4)}</dd></div>
      </dl>
    </div>
    <div class="stop-tab-panel" id="stop-panel-related" role="tabpanel" aria-labelledby="stop-tab-related" data-stop-panel="related" hidden>
      <ul class="stop-related">
        ${route.stops.filter((other) => other.order !== stop.order).slice(0, 3).map((other) => `<li>
          <button type="button" data-select-stop="${other.order}"><b>${other.order}. ${escapeHtml(other.name)}</b><span>${escapeHtml(other.tagline)}</span></button>
        </li>`).join('')}
      </ul>
    </div>
  </section>`;
}

function stopRail(route, selected) {
  if (!route.stops.length) return '';
  return `<aside class="stop-rail" id="section-stops" aria-labelledby="stops-heading">
    <div class="stop-rail-head">
      <h2 id="stops-heading" class="eyebrow eyebrow-mark">All stops (${route.stopCount})</h2>
      <span class="chip">In route order</span>
    </div>
    <ol class="stop-list">
      ${route.stops.map((stop) => `<li class="stop-row">
        <button type="button" class="stop-item${stop.order === selected ? ' is-active' : ''}" data-select-stop="${stop.order}" aria-current="${stop.order === selected}">
          <span class="stop-index">${stop.order}</span>
          <span class="stop-thumb">${picture(stop.photo, { sizes: '72px', alt: '', ratio: '1 / 1' })}</span>
          <span class="stop-item-copy">
            <b>${escapeHtml(stop.name)}</b>
            <small>${escapeHtml(stop.tagline)}</small>
            <span class="stop-item-meta">${icon('walk')}${escapeHtml(Data.formatDistance(stop.distanceM) || '')}</span>
            <span class="stop-playing-tag" hidden>Playing</span>
          </span>
        </button>
        <button type="button" class="stop-item-play" data-action="listen" data-stop="${stop.order}" aria-label="Listen to ${escapeHtml(stop.name)}">${icon('play')}</button>
      </li>`).join('')}
    </ol>
    <button type="button" class="button button-sm stop-rail-all" data-action="listen-all">${icon('headphones')} Listen to all stops</button>
    ${walkedButton(route)}
  </aside>`;
}

function mapPanel(route) {
  return `<section class="map-panel" id="section-map" aria-labelledby="map-heading">
    <h2 id="map-heading" class="sr-only">Interactive map</h2>
    <div class="map-frame" data-map>
      ${route.hasGeometry ? `
        <div class="map-canvas" id="route-map"></div>
        <button type="button" class="map-control map-fullscreen" data-map="fullscreen" aria-label="Open map fullscreen">${icon('expand')}</button>
        ${route.stops.length ? `
          <button type="button" class="map-control map-locate" data-map="locate" aria-label="Show my location">${icon('locate')}</button>
          <button type="button" class="map-control map-stops" data-map="stops" aria-label="Show all stops">${icon('pin')}</button>
        ` : ''}
      ` : `
        <div class="empty-state" data-map-dialog-empty>${icon('map')}<div>
          <strong>No mapped line yet</strong>
          <p>This route has no surveyed track to show on the map.</p></div></div>
      `}
    </div>
  </section>`;
}

function elevationCursor(route, profile) {
  const samples = elevationSamples(profile);
  return `<div class="elevation-control" data-elevation>
    <label for="elevation-slider">Position along route</label>
    <input type="range" id="elevation-slider" min="0" max="${samples.length - 1}" value="0" step="1" aria-label="Move along elevation profile">
    <output aria-live="polite">${samples[0] ? `${samples[0].d.toFixed(2)} km · ${samples[0].e} m` : ''}</output>
  </div>
  <div class="elevation-profile" data-elevation-profile>
    ${elevationProfile(route, { width: 520, height: 200, profile })}
  </div>`;
}

function glance(route) {
  if (!route.hasGeometry && !route.stops.length && !route.elevation?.samples?.length) return '';
  const profile = route.elevation?.profile;
  return `<section class="route-glance" id="section-terrain" aria-labelledby="glance-heading">
    <h2 id="glance-heading" class="eyebrow eyebrow-mark">At a glance</h2>
    <div class="glance-grid">
      ${route.hasGeometry ? `
        <div class="glance-map">
          <h3 class="eyebrow">The line on the map</h3>
          ${routePreview(route, { width: 300, height: 220, numbered: route.hasStops })}
        </div>
      ` : ''}
      ${route.stops.length ? `
        <div class="glance-stops">
          <h3 class="eyebrow">Stops in order</h3>
          <ol class="glance-stop-list">
            ${route.stops.map((stop) => `<li>
              <span class="glance-stop-index">${stop.order}</span>
              <span class="glance-stop-name">${escapeHtml(stop.name)}</span>
              <span class="glance-stop-distance">${escapeHtml(Data.formatDistance(stop.distanceM) || '')}</span>
            </li>`).join('')}
          </ol>
        </div>
      ` : ''}
      ${profile ? `
        <div class="glance-elevation">
          <h3 class="eyebrow">Elevation profile</h3>
          ${elevationCursor(route, profile)}
        </div>
      ` : ''}
    </div>
  </section>`;
}

function overview(route) {
  return `<section class="route-overview" id="section-overview">
    <div class="overview-copy">
      <h2 class="eyebrow eyebrow-mark">About this route</h2>
      <p>${escapeHtml(route.overview || route.lede || 'This route is published with its headline facts. Its description has not been written yet.')}</p>
      ${route.themes?.length ? `<div class="chip-list">${route.themes.map((theme) => `<span class="chip">${escapeHtml(theme)}</span>`).join('')}</div>` : ''}
    </div>
    <div class="overview-geometry">
      <h3 class="eyebrow">The line on the map</h3>
      ${route.hasGeometry ? `
        <div class="overview-map">
          ${routePreview(route, { width: 600, height: 400, numbered: route.hasStops })}
        </div>
      ` : `
        <p class="data-note">No mapped line published yet for this route.</p>
      `}
    </div>
  </section>`;
}

/** Full-screen photo gallery for the route and its stops. */
export function routePhotos(route) {
  const photos = [
    { id: route.media?.photo, name: route.name, credit: route.media?.photo ? creditText(route.media.photo) : '' },
    ...(route.stops || []).filter((s) => s.photo).map((stop) => ({
      id: stop.photo,
      name: stop.name,
      credit: stop.photo ? creditText(stop.photo) : '',
    })),
  ].filter((p) => p.id);

  if (!photos.length) return '';

  return `<section class="route-photos" id="section-photos" aria-labelledby="photos-heading">
    <h2 id="photos-heading" class="eyebrow eyebrow-mark">Route photos</h2>
    <div class="photo-grid">
      ${photos.map((photo) => `
        <figure class="photo-tile">
          ${picture(photo.id, { sizes: '(max-width: 639px) 100vw, 50vw', alt: escapeHtml(photo.name), ratio: '4 / 3' })}
          ${photo.name ? `<figcaption>${escapeHtml(photo.name)}${photo.credit ? `<span class="photo-credit">${escapeHtml(photo.credit)}</span>` : ''}</figcaption>` : ''}
        </figure>
      `).join('')}
    </div>
  </section>`;
}

function photoStrip(route) {
  return routePhotos(route);
}

async function inCollections(route) {
  const view = await import('./collection.js');
  const collections = await view.collectionsForRoute(route.slug);
  if (!collections.length) return '';
  return `<section class="route-collections" id="section-collections" aria-labelledby="collections-heading">
    <h2 id="collections-heading" class="eyebrow eyebrow-mark">Part of these collections</h2>
    <div class="collection-card-grid">
      ${collections.map((c) => view.collectionCard(c)).join('')}
    </div>
  </section>`;
}

async function relatedSection(route) {
  const related = await Data.relatedRoutes(route);
  if (!related.length) return '';
  return `<section class="route-related" id="section-related" aria-labelledby="related-heading">
    <h2 id="related-heading" class="eyebrow eyebrow-mark">You might also like</h2>
    <div class="route-card-grid">
      ${related.map((r) => routeCard(r)).join('')}
    </div>
  </section>`;
}

/** Small card for related routes. */
function routeCard(route) {
  const distance = Data.formatDistance(route.distanceM);
  const duration = Data.formatDuration(route.durationMin);
  const unmeasured = Data.isUnmeasured(route, route.distanceM) && Data.isUnmeasured(route, route.durationMin);
  const terrain = Data.terrainLabel(route);
  const preview = routePreview(route, { width: 150, height: 210, numbered: route.hasStops });
  const spark = terrainSparkline(route);
  const photo = route.media?.card || route.media?.photo;

  return `<a class="route-card" href="${routePath(route.slug)}" data-route="${escapeHtml(route.slug)}">
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

function summary(route) {
  return {
    name: route.name,
    slug: route.slug,
    location: route.location,
    region: route.region,
    distanceM: route.distanceM,
    durationMin: route.durationMin,
    stopCount: route.stopCount,
    difficulty: route.difficulty,
    themes: route.themes,
    photo: route.media?.card || route.media?.photo,
    hasStops: route.stops.length > 0,
    hasGeometry: route.hasGeometry,
    hasElevation: route.hasElevation,
  };
}

function trip(route, url) {
  const fullUrl = absoluteUrl(url);
  return {
    '@context': 'https://schema.org',
    '@type': 'TouristTrip',
    '@id': `${fullUrl}#trip`,
    name: route.name,
    description: route.overview || route.lede || '',
    url: fullUrl,
    image: route.media?.photo ? absoluteUrl(photoPath(route.media.photo, 1200)) : null,
    distance: route.distanceM ? { '@type': 'QuantitativeValue', value: route.distanceM / 1000, unitCode: 'KMT' } : undefined,
    duration: route.durationMin ? `PT${route.durationMin}M` : undefined,
    startLocation: route.stops[0] ? {
      '@type': 'Place',
      geo: { '@type': 'GeoCoordinates', latitude: route.stops[0].lat, longitude: route.stops[0].lng },
    } : undefined,
    endLocation: route.stops[route.stops.length - 1] ? {
      '@type': 'Place',
      geo: { '@type': 'GeoCoordinates', latitude: route.stops[route.stops.length - 1].lat, longitude: route.stops[route.stops.length - 1].lng },
    } : undefined,
  };
}

export async function meta({ route }) {
  const firstStopPhoto = route.stops[0]?.photo || route.media?.photo || 'hampi-landscape';
  const withStops = route.stopCount > 0;
  return {
    title: `${route.name} · Naarad`,
    description: route.lede || route.overview || 'Walk this heritage route with real route data and a written story for each stop.',
    path: routePath(route.slug),
    card: {
      name: 'route',
      eyebrow: 'Route',
      title: route.name,
      facts: [
        route.location || 'India',
        Data.formatDistance(route.distanceM) || Data.NOT_MEASURED,
        Data.formatDuration(route.durationMin) || Data.NOT_MEASURED,
        withStops ? `${route.stopCount} stops with stories` : 'Stops not yet published',
      ],
      photo: route.media?.card || route.media?.photo || firstStopPhoto,
      route: route.slug,
      alt: `${route.name}, ${route.location || ''}: the Naarad title card, set on a photograph from the route.`,
    },
    preload: { photo: route.media?.card || route.media?.photo || firstStopPhoto, sizes: HERO_SIZES },
    schema: [trip(route, routePath(route.slug))],
  };
}

export const stylesheet = '/app/route.css';
export async function render({ route, stop = 1 }) {
  const selectedStop = Data.getStop(route, stop);
  return `<div class="route-page">
    ${flyoverHero(route)}
    ${photoMosaic(route)}
    ${photoScrubber(route)}
    ${factRow(route)}
    ${tabBar(route)}
    <div class="route-workspace">
      ${mapPanel(route)}
      ${stopPanel(route, selectedStop)}
      ${stopRail(route, stop)}
    </div>
    ${glance(route)}
    ${overview(route)}
    ${routePhotos(route)}
    
    ${await relatedSection(route)}
  </div>`;
}
