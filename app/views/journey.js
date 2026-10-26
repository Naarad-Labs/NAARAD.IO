/* My Journey.
 *
 * Everything on this page is the visitor's own record, kept on this device by
 * journey-store.js: routes they saved, walks they marked complete, notes they
 * wrote, stops they listened to. There is no account system yet, so the page
 * starts empty and fills as they use the site — which is the honest version
 * of a travel journal, and the one that still works offline.
 */

import { picture, escapeHtml, getPhoto } from '../media.js';
import { icon } from '../icons.js';
import * as Data from '../data.js';
import * as Journey from '../journey-store.js';
import * as Offline from '../offline-bundles.js';
import { routePreview } from '../previews.js';
import { routePath, sectionPath } from '../urls.js';
import * as Seo from '../seo.js';

const TABS = [
  { id: 'journey', label: 'My Journey', icon: 'compass' },
  { id: 'saved', label: 'Saved Routes', icon: 'bookmark' },
  { id: 'journal', label: 'Journal', icon: 'book' },
  { id: 'downloads', label: 'Downloads', icon: 'download' },
  { id: 'badges', label: 'Achievements', icon: 'award' },
];

const dateLabel = (iso) => {
  if (!iso) return '';
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

function ring(totals, target) {
  const done = Math.min(totals.walksCompleted, target);
  const fraction = target ? done / target : 0;
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  return `<div class="journey-ring">
    <svg viewBox="0 0 130 130" role="img" aria-label="${done} of ${target} routes walked">
      <circle cx="65" cy="65" r="${radius}" class="ring-track"></circle>
      <circle cx="65" cy="65" r="${radius}" class="ring-value"
        stroke-dasharray="${circumference.toFixed(1)}" stroke-dashoffset="${(circumference * (1 - fraction)).toFixed(1)}"></circle>
    </svg>
    <div class="journey-ring-copy"><b>${done}</b><span>of ${target}</span></div>
  </div>`;
}

function statList(totals) {
  const stats = [
    ['temple', totals.placesExplored, 'Places explored'],
    ['walk', totals.kilometres >= 10 ? totals.kilometres.toFixed(0) : totals.kilometres.toFixed(1), 'Kilometres walked'],
    ['clock', totals.listenedHours >= 1 ? totals.listenedHours.toFixed(1) : totals.listenedHours.toFixed(2), 'Hours listened'],
    ['book', totals.journalCount, 'Notes in journal'],
    ['leaf', totals.walksCompleted, 'Routes completed'],
  ];
  return `<ul class="journey-stats">
    ${stats.map(([name, value, label]) => `<li>${icon(name, { className: 'ico-orange' })}<span><b>${escapeHtml(String(value))}</b><small>${label}</small></span></li>`).join('')}
  </ul>`;
}

function savedCard(entry, route) {
  const preview = route ? routePreview(route, { width: 160, height: 150, numbered: Boolean(route.stops?.length) }) : '';
  return `<article class="journey-card">
    <div class="journey-card-media">
      ${entry.photo ? picture(entry.photo, { sizes: '220px', alt: '', ratio: '4 / 3' }) : '<span class="photo photo-missing"></span>'}
      ${preview ? `<span class="journey-card-map">${preview}</span>` : ''}
      <span class="journey-card-flag">${icon('bookmark')} Saved</span>
    </div>
    <div class="journey-card-body">
      <strong>${escapeHtml(entry.name)}</strong>
      <small>${escapeHtml(entry.location || '')}</small>
      <span class="route-card-metrics">
        ${entry.distanceM ? `<span>${icon('walk')}${escapeHtml(Data.formatDistance(entry.distanceM))}</span>` : ''}
        ${entry.durationMin ? `<span>${icon('clock')}${escapeHtml(Data.formatDuration(entry.durationMin))}</span>` : ''}
        ${entry.stops ? `<span>${icon('pin')}${entry.stops} stops</span>` : ''}
      </span>
      <div class="journey-card-actions">
        <a class="text-link" href="${routePath(entry.slug)}" data-route="${escapeHtml(entry.slug)}">View route ${icon('arrow')}</a>
        <button type="button" class="icon-button" data-journey-unsave="${escapeHtml(entry.slug)}" aria-label="Remove ${escapeHtml(entry.name)} from saved">${icon('trash')}</button>
      </div>
    </div>
  </article>`;
}

function walkCard(entry) {
  return `<article class="journey-card is-complete">
    <div class="journey-card-media">
      ${entry.photo ? picture(entry.photo, { sizes: '220px', alt: '', ratio: '4 / 3' }) : '<span class="photo photo-missing"></span>'}
      <span class="journey-card-flag is-done">${icon('check')} Completed</span>
    </div>
    <div class="journey-card-body">
      <strong>${escapeHtml(entry.name)}</strong>
      <small>${escapeHtml(entry.location || '')} · ${escapeHtml(dateLabel(entry.completedAt))}</small>
      <span class="route-card-metrics">
        ${entry.distanceM ? `<span>${icon('walk')}${escapeHtml(Data.formatDistance(entry.distanceM))}</span>` : ''}
        ${entry.stops ? `<span>${icon('pin')}${entry.stops} stops</span>` : ''}
      </span>
      <a class="text-link" href="${routePath(entry.slug)}" data-route="${escapeHtml(entry.slug)}">Revisit ${icon('arrow')}</a>
    </div>
  </article>`;
}

function emptyPanel(title, copy, action = '') {
  return `<div class="empty-state">${icon('sparkle')}<div><strong>${escapeHtml(title)}</strong><p>${escapeHtml(copy)}</p>${action}</div></div>`;
}

/* Behind the offline-bundles flag; otherwise the honest "not available" panel. */
function downloadsPanel(store) {
  if (!Offline.enabled()) {
    return emptyPanel('Offline bundles are not available yet',
      'Downloading a route for offline use needs versioned bundles of map data, audio and transcripts. The route pages say where this stands.');
  }
  if (!store.downloads.length) {
    return emptyPanel('No offline routes yet', 'Use "Download for offline" on a route page. Map tiles and audio are not included.');
  }
  return `<ul class="journal-list">
    ${store.downloads.map((entry) => `<li class="journal-note">
      <div class="journal-note-head"><b>${escapeHtml(entry.name)}</b><span>${escapeHtml(entry.sizeLabel)}</span></div>
      <small>${entry.stops ? `${entry.stops} stops · ` : ''}page, text and photos; no map tiles or audio · ${escapeHtml(dateLabel(entry.savedAt))}</small>
      <button type="button" class="icon-button" data-download-remove="${escapeHtml(entry.slug)}" aria-label="Remove ${escapeHtml(entry.name)} from this device">${icon('trash')}</button>
    </li>`).join('')}
  </ul>`;
}

export async function render() {
  const store = Journey.all();
  const totals = Journey.stats();
  const badges = Journey.badges();
  const routes = await Data.loadRoutes();
  const bySlug = new Map(routes.map((route) => [route.slug, route]));
  const target = Math.max(5, Math.ceil((totals.walksCompleted + 1) / 5) * 5);

  return `<div class="journey">
    <header class="journey-hero">
      <div class="journey-hero-copy">
        <nav class="breadcrumb" aria-label="Breadcrumb"><a href="/" data-view="home">Home</a>${icon('chevron')}<b aria-current="page">My Journey</b></nav>
        <h1 class="display">My Journey<br><span class="accent">More than places.</span></h1>
        <p class="lede">Your walks, stories and notes in one place. Everything here is kept on this device — there are no accounts yet, so nothing leaves your browser.</p>
      </div>
      <div class="journey-hero-media">
        ${picture('india-traveller', {
    sizes: '(max-width: 1023px) 100vw, 50vw', alt: '', priority: true, credit: true, className: 'torn-left',
    // Reserves the photograph's height on a phone, where it sits in the flow.
    ratio: getPhoto('india-traveller')?.aspect ? `${getPhoto('india-traveller').aspect} / 1` : '',
  })}
        <p class="note-plain note-over-photo journey-hero-note">Same places.<br>New stories.<br>A richer you.</p>
      </div>
    </header>

    <div class="journey-tabs" role="tablist" aria-label="Journey sections">
      ${TABS.map((tab, index) => `<button type="button" role="tab" data-journey-tab="${tab.id}"
        aria-selected="${index === 0}" tabindex="${index === 0 ? 0 : -1}">${icon(tab.icon)}<span>${tab.label}</span></button>`).join('')}
    </div>

    <section class="journey-panel" data-journey-panel="journey">
      <div class="journey-overview">
        <div class="journey-progress">
          ${ring(totals, target)}
          <div>
            <h2>${totals.walksCompleted ? 'Routes completed' : 'No routes walked yet'}</h2>
            <p class="data-note">${totals.walksCompleted
    ? 'Every place adds a new chapter to your story.'
    : 'Open a route and mark it complete when you have walked it. It will appear here.'}</p>
          </div>
        </div>
        ${statList(totals)}
      </div>

      <div class="journey-section">
        <div class="section-head">
          <div><p class="eyebrow eyebrow-mark">Saved routes</p><h2 class="section-title">Places to explore next.</h2></div>
          <div class="section-head-aside"><a class="button button-sm" href="${sectionPath('routes')}" data-view="routes">Browse routes ${icon('arrow')}</a></div>
        </div>
        ${store.saved.length
    ? `<div class="journey-grid">${store.saved.slice(0, 3).map((entry) => savedCard(entry, bySlug.get(entry.slug))).join('')}</div>`
    : emptyPanel('Nothing saved yet', 'Save a route from its page and it will wait for you here.')}
      </div>

      ${store.walks.length ? `<div class="journey-section">
        <div class="section-head"><div><p class="eyebrow eyebrow-mark">Recently completed walks</p><h2 class="section-title">Journeys you have walked.</h2></div></div>
        <div class="journey-grid">${store.walks.slice(0, 3).map(walkCard).join('')}</div>
      </div>` : ''}
    </section>

    <section class="journey-panel" data-journey-panel="saved" hidden>
      ${store.saved.length
    ? `<div class="journey-grid">${store.saved.map((entry) => savedCard(entry, bySlug.get(entry.slug))).join('')}</div>`
    : emptyPanel('No saved routes', 'The bookmark on any route page keeps it here.')}
    </section>

    <section class="journey-panel" data-journey-panel="journal" hidden>
      <form class="journal-form" data-journal-form>
        <h2 class="eyebrow eyebrow-mark">Write a new entry</h2>
        <label class="field"><span>Title</span><input type="text" name="title" required placeholder="Evening at the Stone Chariot"></label>
        <label class="field"><span>Place</span><input type="text" name="place" placeholder="Hampi, Karnataka"></label>
        <label class="field"><span>Note</span><textarea name="body" rows="4" placeholder="What you saw, heard or want to remember."></textarea></label>
        <button type="submit" class="button button-primary button-sm">${icon('edit')} Save entry</button>
      </form>
      ${store.journal.length ? `<ul class="journal-list">
        ${store.journal.map((entry) => `<li class="journal-note">
          <div class="journal-note-head"><b>${escapeHtml(entry.title)}</b><span>${escapeHtml(dateLabel(entry.createdAt))}</span></div>
          ${entry.place ? `<small>${escapeHtml(entry.place)}</small>` : ''}
          <p>${escapeHtml(entry.body)}</p>
          <button type="button" class="icon-button" data-journal-delete="${escapeHtml(entry.id)}" aria-label="Delete note">${icon('trash')}</button>
        </li>`).join('')}
      </ul>` : emptyPanel('No notes yet', 'Notes you write stay on this device.')}
    </section>

    <section class="journey-panel" data-journey-panel="downloads" hidden>
      ${downloadsPanel(store)}
    </section>

    <section class="journey-panel" data-journey-panel="badges" hidden>
      <div class="badge-grid">
        ${badges.map((badge) => `<article class="badge ${badge.earned ? 'is-earned' : ''}">
          ${icon(badge.icon)}
          <b>${escapeHtml(badge.name)}</b>
          <small>${badge.earned ? 'Earned' : `${badge.have} of ${badge.need} ${escapeHtml(badge.unit)}`}</small>
        </article>`).join('')}
      </div>
      <p class="data-note">Badges count what you have actually done on this device.</p>
    </section>
  </div>`;
}

export const stylesheet = '/app/journey.css';

/* Everything here is this visitor's own, kept on their device, so the page
   stays out of search: what a crawler would index is an empty journal. */
export function meta() {
  return {
    title: 'My Journey · Naarad',
    description: 'Your saved routes, completed walks, journal notes and listening history, kept on your device.',
    path: sectionPath('journey'),
    robots: 'noindex',
    card: Seo.HOME_CARD,
    schema: [Seo.breadcrumbs([['My Journey', sectionPath('journey')]])],
  };
}
