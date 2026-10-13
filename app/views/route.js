/* Route detail: the editorial header, the working map, the stop being read,
   the stop rail, and the elevation profile.

   Desktop lays these out as a three-column workspace. The phone composition
   (route.css) turns the same state into a map with a bottom sheet. Both read
   one route object and one selected stop; there is only ever one map. */

import { picture, creditText, escapeHtml } from '../media.js';
import { icon } from '../icons.js';
import * as Data from '../data.js';
import { routePreview, elevationProfile } from '../previews.js';
import * as Journey from '../journey-store.js';

const TABS = [
  { id: 'overview', label: 'Overview', icon: 'file' },
  { id: 'stops', label: 'Stops', icon: 'pin' },
  { id: 'stories', label: 'Stories', icon: 'headphones' },
  { id: 'terrain', label: 'Terrain', icon: 'terrain' },
  { id: 'map', label: 'Map', icon: 'map' },
];

const LANGUAGE_NAMES = {
  en: 'English', hi: 'हिंदी', ta: 'தமிழ்', te: 'తెలుగు', kn: 'ಕನ್ನಡ', ml: 'മലയാളം', mr: 'मराठी', bn: 'বাংলা',
};

function factRow(route) {
  const facts = [
    { icon: 'pin', value: route.location || 'India', label: '' },
    { icon: 'clock', value: Data.formatDuration(route.durationMin), label: '' },
    { icon: 'walk', value: Data.formatDistance(route.distanceM), label: '' },
    { icon: 'flag', value: route.stopCount ? `${route.stopCount} stops` : null, label: '' },
    { icon: 'gauge', value: Data.formatDifficulty(route.difficulty), label: 'Difficulty' },
    { icon: 'terrain', value: Data.terrainLabel(route), label: 'Terrain' },
    { icon: 'download', value: 'Offline bundle', label: 'Not yet available', muted: true },
    { icon: 'globe', value: route.languages?.length ? `${route.languages.length} languages` : 'English', label: route.languages?.length ? route.languages.map((code) => LANGUAGE_NAMES[code] || code).slice(0, 4).join(' · ') : '' },
  ].filter((fact) => fact.value);

  return `<div class="route-facts">
    ${facts.map((fact) => `<div class="metric${fact.muted ? ' is-muted' : ''}">
      ${icon(fact.icon)}
      <span class="metric-text"><b>${escapeHtml(fact.value)}</b>${fact.label ? `<span>${escapeHtml(fact.label)}</span>` : ''}</span>
    </div>`).join('')}
  </div>`;
}

function hero(route) {
  return `<header class="route-hero">
    <div class="route-hero-copy">
      <nav class="breadcrumb" aria-label="Breadcrumb">
        <a href="/?view=routes" data-view="routes">Routes</a>${icon('chevron')}
        <span>${escapeHtml(route.region || 'India')}</span>${icon('chevron')}
        <b aria-current="page">${escapeHtml(route.name)}</b>
      </nav>
      <h1 id="route-title">${escapeHtml(route.name)}</h1>
      ${route.subtitle ? `<p class="route-subtitle">${escapeHtml(route.subtitle)}</p>` : ''}
      ${route.lede ? `<p class="route-lede">${escapeHtml(route.lede)}</p>` : ''}
      <div class="route-byline">
        <span class="byline-mark" aria-hidden="true"><img src="/Images/cropped_logo.png" alt=""></span>
        <span class="byline-copy">
          <small>Curated by</small>
          <b>Naarad editorial</b>
          <span>No creator narration published yet</span>
        </span>
      </div>
    </div>
    <div class="route-hero-media">
      ${route.media?.photo
    ? picture(route.media.photo, {
      sizes: '(max-width: 1023px) 100vw, 56vw',
      alt: `${route.name}, ${route.location || ''}`,
      priority: true, credit: true, className: 'route-hero-photo torn-left',
    })
    : '<div class="route-hero-photo photo photo-missing"></div>'}
      ${route.subtitle ? `<p class="note-plain note-over-photo route-hero-note">${escapeHtml(route.themes?.[0] || 'A living story')}.<br>Walk it slowly.</p>` : ''}
      <span class="pin-chip route-hero-place">${icon('pin')}${escapeHtml(route.location || 'India')}</span>
    </div>
  </header>`;
}

function tabBar(route) {
  const saved = Journey.isSaved(route.slug);
  return `<div class="route-bar">
    <div class="route-tabs" role="tablist" aria-label="Route sections">
      ${TABS.map((tab, index) => `<button type="button" role="tab" id="tab-${tab.id}" data-tab="${tab.id}"
        aria-selected="${index === 0}" aria-controls="panel-${tab.id}" tabindex="${index === 0 ? 0 : -1}">
        ${icon(tab.icon)}<span>${tab.label}</span></button>`).join('')}
    </div>
    <div class="route-bar-actions">
      <button type="button" class="button button-sm" data-action="share">${icon('share')} Share</button>
      <button type="button" class="button button-sm${saved ? ' is-saved' : ''}" data-action="save" aria-pressed="${saved}">${icon('bookmark')} <span>${saved ? 'Saved' : 'Save'}</span></button>
      <button type="button" class="button button-primary button-sm" data-action="start">${icon('footprints')} Start Walk</button>
    </div>
  </div>`;
}

function stopPanel(route, stop) {
  if (!stop) {
    return `<section class="stop-panel" aria-live="polite">
      <div class="empty-state">${icon('sparkle')}<div>
        <strong>Stops are not published for this route</strong>
        <p>This route is in the catalogue with its distance and duration, but no one has published its ordered stops yet. Routes with stops show each one here, with its story.</p>
      </div></div>
    </section>`;
  }

  const minutes = Math.max(1, Math.round(stop.story.length / 900));
  return `<section class="stop-panel" aria-live="polite" data-stop="${stop.order}">
    <div class="stop-panel-head">
      <p class="eyebrow eyebrow-mark">Stop ${stop.order} of ${route.stopCount}</p>
      <div class="stop-panel-meta">
        <span>${minutes} min read</span>
        <span class="stop-lang">${icon('globe')} English ${icon('chevron')}</span>
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
      <button type="button" role="tab" aria-selected="true" data-stop-tab="transcript">Transcript</button>
      <button type="button" role="tab" aria-selected="false" data-stop-tab="place">About the place</button>
      <button type="button" role="tab" aria-selected="false" data-stop-tab="related">Related stops</button>
    </div>
    <div class="stop-tab-panel" data-stop-panel="transcript">
      <blockquote class="stop-quote">${icon('quote')}<p>${escapeHtml(stop.story)}</p></blockquote>
      <p class="data-note">Text written for Naarad. Narration is read aloud by your device until a creator recording is published for this stop.</p>
    </div>
    <div class="stop-tab-panel" data-stop-panel="place" hidden>
      <dl class="stop-facts">
        <div><dt>Distance along route</dt><dd>${escapeHtml(Data.formatDistance(stop.distanceM) || '—')}</dd></div>
        <div><dt>Elevation</dt><dd>${stop.elevationM != null ? `${stop.elevationM} m` : 'Not sampled'}</dd></div>
        <div><dt>Coordinates</dt><dd>${stop.lat.toFixed(4)}, ${stop.lng.toFixed(4)}</dd></div>
      </dl>
    </div>
    <div class="stop-tab-panel" data-stop-panel="related" hidden>
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
  return `<aside class="stop-rail" aria-labelledby="stops-heading">
    <div class="stop-rail-head">
      <h2 id="stops-heading" class="eyebrow eyebrow-mark">All stops (${route.stopCount})</h2>
      <span class="chip">In route order</span>
    </div>
    <ol class="stop-list">
      ${route.stops.map((stop) => `<li>
        <button type="button" class="stop-item${stop.order === selected ? ' is-active' : ''}" data-select-stop="${stop.order}" aria-current="${stop.order === selected}">
          <span class="stop-index">${stop.order}</span>
          <span class="stop-thumb">${picture(stop.photo, { sizes: '72px', alt: '', ratio: '1 / 1' })}</span>
          <span class="stop-item-copy">
            <b>${escapeHtml(stop.name)}</b>
            <small>${escapeHtml(stop.tagline)}</small>
            <span class="stop-item-meta">${icon('walk')}${escapeHtml(Data.formatDistance(stop.distanceM) || '')}</span>
          </span>
          <span class="stop-item-play" data-action="listen" data-stop="${stop.order}" role="button" tabindex="0" aria-label="Listen to ${escapeHtml(stop.name)}">${icon('play')}</span>
        </button>
      </li>`).join('')}
    </ol>
    <button type="button" class="button button-sm stop-rail-all" data-action="listen-all">${icon('headphones')} Play all stops</button>
  </aside>`;
}

function mapPanel(route) {
  return `<section class="map-panel" id="panel-map" role="tabpanel" aria-labelledby="tab-map">
    <div class="map-frame">
      <div id="map" class="route-map" role="application" aria-label="Map of ${escapeHtml(route.name)}">
        ${routePreview(route, { width: 560, height: 620, numbered: true, className: 'map-placeholder' })}
      </div>
      <div class="map-controls">
        <button type="button" class="map-control" data-map="in" aria-label="Zoom in">${icon('plus')}</button>
        <button type="button" class="map-control" data-map="out" aria-label="Zoom out">${icon('minus')}</button>
        <button type="button" class="map-control" data-map="locate" aria-label="Show my location">${icon('locate')}</button>
      </div>
      <div class="map-toolbar">
        <button type="button" class="map-control" data-map="layers" aria-pressed="true">${icon('layers')}<span>Satellite</span></button>
        <button type="button" class="map-control" data-map="fit">${icon('compass')}<span>Fit route</span></button>
      </div>
      <p class="map-note script">Stories at every stop</p>
    </div>
  </section>`;
}

function glance(route) {
  const profile = elevationProfile(route, { width: 760, height: 168 });
  return `<section class="route-glance" id="panel-terrain" role="tabpanel" aria-labelledby="tab-terrain">
    <div class="glance-facts">
      <h2 class="eyebrow eyebrow-mark">Route at a glance</h2>
      <div class="metric-row">
        ${[['walk', Data.formatDistance(route.distanceM), 'Distance'],
    ['clock', Data.formatDuration(route.durationMin), 'Duration'],
    ['pin', route.stopCount ? `${route.stopCount}` : null, 'Stops'],
    ['gauge', Data.formatDifficulty(route.difficulty), 'Difficulty'],
    ['terrain', Data.terrainLabel(route), 'Terrain'],
    ['flag', route.ascentM != null ? `${route.ascentM} m` : null, 'Ascent']]
    .filter(([, value]) => value)
    .map(([name, value, label]) => `<div class="metric">${icon(name)}<span class="metric-text"><b>${escapeHtml(value)}</b><span>${label}</span></span></div>`).join('')}
      </div>
      ${route.surface ? `<p class="data-note">${escapeHtml(route.surface)}.</p>` : ''}
    </div>
    <div class="glance-elevation">
      <div class="glance-elevation-head">
        <h3 class="eyebrow eyebrow-mark">Elevation profile</h3>
        ${route.elevation ? `<span class="chip">${escapeHtml(route.elevation.source)}</span>` : ''}
      </div>
      ${profile || `<div class="empty-state">${icon('terrain')}<div>
        <strong>No elevation profile yet</strong>
        <p>This route has no sampled heights, so no profile is drawn.</p></div></div>`}
    </div>
  </section>`;
}

function overview(route) {
  return `<section class="route-overview" id="panel-overview" role="tabpanel" aria-labelledby="tab-overview">
    <div class="overview-copy">
      <h2 class="eyebrow eyebrow-mark">About this route</h2>
      <p>${escapeHtml(route.overview || route.lede || 'This route is published with its headline facts. Its description has not been written yet.')}</p>
      ${route.themes?.length ? `<div class="chip-list">${route.themes.map((theme) => `<span class="chip">${escapeHtml(theme)}</span>`).join('')}</div>` : ''}
    </div>
    <div class="overview-geometry">
      <h3 class="eyebrow">The line on the map</h3>
      <p class="data-note">${escapeHtml(route.geometry?.note || (route.hasGeometry ? 'A recorded track.' : 'No route line has been published for this route.'))}</p>
    </div>
  </section>`;
}

async function relatedSection(route) {
  const related = await Data.relatedRoutes(route, 3);
  if (!related.length) return '';
  const { routeCard } = await import('./home.js');
  return `<section class="route-related">
    <div class="section-head">
      <div><p class="eyebrow eyebrow-mark">Compare routes</p><h2 class="section-title">Nearby, and next.</h2></div>
      <div class="section-head-aside"><a class="button button-sm" href="/?view=routes" data-view="routes">View All Routes ${icon('arrow')}</a></div>
    </div>
    <div class="route-card-grid is-three">${related.map((candidate) => routeCard(candidate)).join('')}</div>
  </section>`;
}

export async function render(context) {
  const route = context.route;
  const selected = context.stop || route.stops[0]?.order || 0;
  const related = await relatedSection(route);

  return `<article class="route-page" data-route="${escapeHtml(route.slug)}">
    ${hero(route)}
    ${factRow(route)}
    ${tabBar(route)}
    <div class="route-workspace" id="panel-stops" role="tabpanel" aria-labelledby="tab-stops">
      ${mapPanel(route)}
      ${stopPanel(route, Data.getStop(route, selected))}
      ${stopRail(route, selected)}
    </div>
    ${glance(route)}
    ${overview(route)}
    ${related}
  </article>`;
}

export const stylesheet = '/app/route.css';

export function meta(route) {
  return {
    title: `${route.name} · Naarad`,
    description: route.lede || `A heritage walking route in ${route.location || 'India'} on Naarad.`,
  };
}
