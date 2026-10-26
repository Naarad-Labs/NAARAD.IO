/* Creator Studio.
 *
 * Desktop: a workspace with the route and stop picker beside the five-step
 * story builder. Phone: the same five steps as a wizard (studio.css).
 *
 * What works here and now: choosing a route and stop, adding an audio file
 * from the device and listening back to it, writing a transcript, choosing
 * languages and metadata, and keeping all of it as a local draft. What cannot
 * work yet is publishing, machine transcription and translation: those need
 * the Naarad backend, and the interface says so rather than pretending.
 */

import { picture, escapeHtml } from '../media.js';
import { icon } from '../icons.js';
import * as Data from '../data.js';
import { routePreview } from '../previews.js';
import * as Drafts from '../studio-store.js';
import { routePath, sectionPath } from '../urls.js';
import * as Seo from '../seo.js';

const STEPS = [
  { id: 'upload', label: 'Upload' },
  { id: 'transcript', label: 'Transcript' },
  { id: 'translate', label: 'Translate' },
  { id: 'metadata', label: 'Metadata' },
  { id: 'review', label: 'Review' },
];

const NAV = [
  { id: 'create', label: 'Create stories', icon: 'mic' },
  { id: 'stories', label: 'My stories', icon: 'file' },
  { id: 'routes', label: 'My routes', icon: 'map' },
  { id: 'media', label: 'Media library', icon: 'image' },
  { id: 'profile', label: 'Profile', icon: 'users' },
  { id: 'settings', label: 'Settings', icon: 'settings' },
];

const LANGUAGES = [
  ['en', 'English'], ['hi', 'हिंदी'], ['kn', 'ಕನ್ನಡ'], ['ta', 'தமிழ்'],
  ['te', 'తెలుగు'], ['ml', 'മലയാളം'], ['mr', 'मराठी'], ['bn', 'বাংলা'],
];

const STATUS_LABEL = { draft: 'Draft', ready: 'Ready to submit', submitted: 'Awaiting backend' };

function sidebar(active = 'create') {
  return `<nav class="studio-nav" aria-label="Creator Studio">
    <p class="eyebrow eyebrow-mark studio-nav-title">Creator Studio</p>
    <ul>
      ${NAV.map((item) => `<li><button type="button" data-studio-nav="${item.id}" class="${item.id === active ? 'is-active' : ''}" ${item.id === active ? 'aria-current="page"' : ''}>
        ${icon(item.icon)}<span>${item.label}</span></button></li>`).join('')}
    </ul>
    <p class="note-plain studio-nav-note">“Every place has a story.<br>You can be the one<br>who lets it speak.”</p>
  </nav>`;
}

function picker(routes, draft) {
  const route = routes.find((candidate) => candidate.slug === draft.routeSlug) || routes[0];
  const stops = route?.stops || [];
  const preview = route ? routePreview(route, { width: 440, height: 300, numbered: true }) : '';

  return `<section class="studio-picker">
    <h2 class="studio-step-title"><span>1</span> Choose a route and stop</h2>
    <div class="studio-picker-controls">
      <label class="field">
        <span class="sr-only">Route</span>
        <select data-studio="route">
          ${routes.map((candidate) => `<option value="${escapeHtml(candidate.slug)}" ${candidate.slug === route?.slug ? 'selected' : ''}>${escapeHtml(candidate.name)}</option>`).join('')}
        </select>
      </label>
      <label class="field">
        <span class="sr-only">Stop</span>
        <select data-studio="stop" ${stops.length ? '' : 'disabled'}>
          ${stops.length
    ? stops.map((stop) => `<option value="${stop.order}" ${stop.order === draft.stopOrder ? 'selected' : ''}>${stop.order}. ${escapeHtml(stop.name)}</option>`).join('')
    : '<option>No published stops</option>'}
        </select>
      </label>
      ${route ? `<a class="button button-sm" href="${routePath(route.slug)}" data-route="${escapeHtml(route.slug)}">View route details ${icon('arrow')}</a>` : ''}
    </div>

    <div class="studio-picker-body">
      <ol class="studio-stop-list">
        ${stops.length ? stops.map((stop) => `<li>
          <button type="button" data-studio-stop="${stop.order}" class="${stop.order === draft.stopOrder ? 'is-active' : ''}">
            <span class="stop-index">${stop.order}</span><span>${escapeHtml(stop.name)}</span>
          </button></li>`).join('')
    : `<li class="studio-stop-empty">This route has no published stops yet, so there is nothing to record against.</li>`}
      </ol>
      <div class="studio-map">
        ${preview || `<div class="empty-state">${icon('map')}<div><strong>No route line</strong><p>This route has no published geometry.</p></div></div>`}
      </div>
    </div>
  </section>`;
}

function builder(draft, route, stop) {
  const stepIndex = Math.max(0, STEPS.findIndex((step) => step.id === draft.step));
  return `<section class="studio-builder">
    <h2 class="studio-step-title"><span>2</span> Add your story</h2>
    <ol class="studio-steps" role="list">
      ${STEPS.map((step, index) => `<li class="${index === stepIndex ? 'is-active' : ''}${index < stepIndex ? ' is-done' : ''}">
        <button type="button" data-studio-step="${step.id}"><span class="studio-step-dot">${index < stepIndex ? icon('check') : index + 1}</span>${step.label}</button>
      </li>`).join('')}
    </ol>

    <div class="studio-panel" data-step="upload" ${draft.step === 'upload' ? '' : 'hidden'}>
      <h3>Audio upload</h3>
      <label class="studio-drop" for="studio-audio">
        ${icon('upload')}
        <span><b>Choose an audio file from this device</b><small>MP3, M4A or WAV. Nothing is uploaded.</small></span>
        <input id="studio-audio" type="file" accept="audio/*" data-studio="audio" hidden>
      </label>
      <div class="studio-audio-preview" data-studio-audio-preview>
        ${draft.audioName
    ? `<p class="data-note">${escapeHtml(draft.audioName)} is attached to this draft in this browser. Audio is not uploaded: publishing needs the Naarad backend.</p>`
    : '<p class="data-note">No audio attached yet. You can also write the story first and record later.</p>'}
      </div>
    </div>

    <div class="studio-panel" data-step="transcript" ${draft.step === 'transcript' ? '' : 'hidden'}>
      <h3>Language and transcript</h3>
      <div class="studio-row">
        <label class="field"><span>Spoken language</span>
          <select data-studio="language">
            ${LANGUAGES.map(([code, label]) => `<option value="${code}" ${code === draft.language ? 'selected' : ''}>${label}</option>`).join('')}
          </select>
        </label>
        <button type="button" class="button button-sm" data-studio="transcribe" aria-disabled="true">${icon('sparkle')} Transcribe audio</button>
      </div>
      <label class="field">
        <span>Transcript</span>
        <textarea data-studio="transcript" rows="8" placeholder="Type or paste what the narration says…">${escapeHtml(draft.transcript)}</textarea>
      </label>
      <p class="data-note">Automatic transcription runs on the server, so it is unavailable in this build. Typing a transcript here works and is saved with the draft.</p>
    </div>

    <div class="studio-panel" data-step="translate" ${draft.step === 'translate' ? '' : 'hidden'}>
      <h3>Translate</h3>
      <div class="studio-languages" role="group" aria-label="Languages to publish in">
        ${LANGUAGES.map(([code, label]) => `<label class="filter-check">
          <input type="checkbox" data-studio-language="${code}" ${draft.targetLanguages.includes(code) ? 'checked' : ''}>
          <span>${label}</span></label>`).join('')}
      </div>
      <p class="data-note">Machine translation is a server step. Choosing languages here records what this story should be published in.</p>
    </div>

    <div class="studio-panel" data-step="metadata" ${draft.step === 'metadata' ? '' : 'hidden'}>
      <h3>Story details</h3>
      <label class="field"><span>Title</span>
        <input type="text" data-studio="title" value="${escapeHtml(draft.title)}" placeholder="${escapeHtml(stop?.name || 'Story title')}"></label>
      <label class="field"><span>Summary</span>
        <textarea data-studio="summary" rows="3" placeholder="One or two sentences for the stop card.">${escapeHtml(draft.summary)}</textarea></label>
      <div class="chip-list studio-auto-tags">
        ${[stop?.name, route?.region, ...(route?.themes || [])].filter(Boolean)
    .map((tag) => `<span class="chip">${escapeHtml(tag)}</span>`).join('')}
      </div>
      <p class="data-note">Tags come from the route and stop you chose.</p>
    </div>

    <div class="studio-panel" data-step="review" ${draft.step === 'review' ? '' : 'hidden'}>
      <h3>Review</h3>
      <dl class="studio-review">
        <div><dt>Route</dt><dd>${escapeHtml(route?.name || '—')}</dd></div>
        <div><dt>Stop</dt><dd>${stop ? `${stop.order}. ${escapeHtml(stop.name)}` : '—'}</dd></div>
        <div><dt>Audio</dt><dd>${draft.audioName ? escapeHtml(draft.audioName) : 'None attached'}</dd></div>
        <div><dt>Transcript</dt><dd>${draft.transcript ? `${draft.transcript.split(/\s+/).filter(Boolean).length} words` : 'Not written'}</dd></div>
        <div><dt>Languages</dt><dd>${draft.targetLanguages.length ? draft.targetLanguages.join(', ') : 'English only'}</dd></div>
      </dl>
      <div class="empty-state">${icon('upload')}<div>
        <strong>Publishing is not available in this build</strong>
        <p>Submitting a story needs the Naarad backend: audio storage, transcription, translation and review. Your draft stays in this browser until then.</p>
      </div></div>
    </div>

    <div class="studio-actions">
      <button type="button" class="button button-sm" data-studio="back" ${stepIndex === 0 ? 'disabled' : ''}>Back</button>
      <button type="button" class="button button-sm" data-studio="save">${icon('check')} Save draft</button>
      ${stepIndex < STEPS.length - 1
    ? `<button type="button" class="button button-primary button-sm" data-studio="next">Next ${icon('arrow')}</button>`
    : `<button type="button" class="button button-primary button-sm" data-studio="submit" aria-disabled="true">Submit for review</button>`}
    </div>
  </section>`;
}

function draftTable(drafts) {
  return `<section class="studio-drafts">
    <h2 class="studio-step-title"><span>3</span> Your drafts</h2>
    ${drafts.length ? `<table class="studio-table">
      <thead><tr><th>#</th><th>Title</th><th>Route / stop</th><th>Language</th><th>Status</th><th>Updated</th><th><span class="sr-only">Actions</span></th></tr></thead>
      <tbody>
        ${drafts.map((draft, index) => `<tr>
          <td>${index + 1}</td>
          <td>${escapeHtml(draft.title || 'Untitled story')}</td>
          <td>${escapeHtml(draft.routeName || draft.routeSlug || '—')}${draft.stopOrder ? ` · Stop ${draft.stopOrder}` : ''}</td>
          <td>${escapeHtml(draft.language || 'en')}</td>
          <td><span class="status-pill is-${escapeHtml(draft.status || 'draft')}">${escapeHtml(STATUS_LABEL[draft.status] || 'Draft')}</span></td>
          <td>${escapeHtml((draft.updatedAt || '').slice(0, 10))}</td>
          <td><button type="button" class="icon-button" data-studio-open="${escapeHtml(draft.id)}" aria-label="Open draft">${icon('edit')}</button>
              <button type="button" class="icon-button" data-studio-delete="${escapeHtml(draft.id)}" aria-label="Delete draft">${icon('trash')}</button></td>
        </tr>`).join('')}
      </tbody>
    </table>` : `<div class="empty-state">${icon('file')}<div>
      <strong>No drafts yet</strong><p>Pick a stop above and start a story. Drafts are kept in this browser.</p></div></div>`}
  </section>`;
}

export async function render() {
  const routes = (await Data.loadRoutes()).filter((route) => route.hasStops);
  const drafts = Drafts.list();
  const draft = Drafts.current(routes[0]);
  const route = routes.find((candidate) => candidate.slug === draft.routeSlug) || routes[0];
  const stop = route?.stops?.find((candidate) => candidate.order === draft.stopOrder) || route?.stops?.[0];

  return `<div class="studio">
    ${sidebar()}
    <div class="studio-main">
      <header class="studio-hero">
        <div class="studio-hero-copy">
          <p class="eyebrow eyebrow-mark">Creator Studio</p>
          <h1 class="display">Real places.<br><span class="accent">Your voice.</span></h1>
          <p class="lede">A drafting space for narrators: pick a stop on one of Naarad's routes, write the story you would tell there and note the languages it should come in. Your drafts stay in this browser, and publishing is not open yet.</p>
        </div>
        <div class="studio-hero-media">
          ${picture('india-storyteller', { sizes: '(max-width: 1023px) 100vw, 40vw', alt: '', credit: true, className: 'torn-left' })}
          <p class="note-plain note-over-photo studio-hero-note">Places speak differently<br>when locals tell the story.</p>
        </div>
      </header>
      <div class="studio-grid">
        ${picker(routes, draft)}
        ${builder(draft, route, stop)}
      </div>
      ${draftTable(drafts)}
    </div>
  </div>`;
}

export const stylesheet = '/app/studio.css';

export function meta() {
  return {
    title: 'Creator Studio · Naarad',
    description: 'A drafting space for narrators: pick a route and stop, write a story and note its languages. Drafts stay in your browser; publishing is not open yet.',
    path: sectionPath('creators'),
    card: Seo.HOME_CARD,
    schema: [Seo.breadcrumbs([['Creators', sectionPath('creators')]])],
  };
}
