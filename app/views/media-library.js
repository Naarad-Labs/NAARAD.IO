/* Media Library for Creator Studio.
 *
 * Lists media assets (audio files, photos) associated with drafts.
 * This is a separate page under /creators/media/.
 */

import { escapeHtml } from '../media.js';
import { icon } from '../icons.js';
import * as Drafts from '../studio-store.js';

const NAV = [
  { id: 'create', label: 'Create stories', icon: 'mic' },
  { id: 'stories', label: 'My stories', icon: 'file' },
  { id: 'routes', label: 'My routes', icon: 'map' },
  { id: 'media', label: 'Media library', icon: 'image' },
  { id: 'profile', label: 'Profile', icon: 'users' },
  { id: 'settings', label: 'Settings', icon: 'settings' },
];

function sidebar(active = 'media') {
  return `<nav class="studio-nav" aria-label="Creator Studio">
    <p class="eyebrow eyebrow-mark studio-nav-title">Creator Studio</p>
    <ul>
      ${NAV.map((item) => {
        const isActive = item.id === active;
        const isAvailable = item.id !== 'stories' && item.id !== 'routes' && item.id !== 'profile' && item.id !== 'settings';
        const disabledAttr = isAvailable ? '' : 'disabled title="Coming later"';
        const ariaCurrent = isActive ? 'aria-current="page"' : '';
        const labelSuffix = isAvailable ? '' : '<small>Coming later</small>';
        return `<li><button type="button" data-studio-nav="${item.id}" class="${isActive ? 'is-active' : ''}" ${disabledAttr} ${ariaCurrent}>
          ${icon(item.icon)}<span>${item.label}</span>${labelSuffix}</button></li>`;
      }).join('')}
    </ul>
    <p class="note-plain studio-nav-note">“Every place has a story. <br>You can be the one <br>who lets it speak.”</p>
  </nav>`;
}

export function render() {
  const drafts = Drafts.list();
  const audioDrafts = drafts.filter((d) => d.audioName);

  return `<div class="studio">
    ${sidebar('media')}
    <div class="studio-main">
      <header class="studio-hero">
        <div class="studio-hero-copy">
          <p class="eyebrow eyebrow-mark">Creator Studio</p>
          <h1 class="display">Media Library</h1>
          <p class="lede">Manage audio files and photos for your stories in Naarad.</p>
        </div>
      </header>
      <div class="studio-grid">
        <section class="studio-media-library">
          <div class="studio-panel" data-step="media-audio">
            <h3>Audio files in drafts</h3>
            ${audioDrafts.length ? `
              <table class="studio-table">
                <thead><tr><th>Story</th><th>Audio</th><th>Status</th></tr></thead>
                <tbody>
                  ${audioDrafts.map((draft) => `<tr>
                    <td>${escapeHtml(draft.title || 'Untitled')}</td>
                    <td>${escapeHtml(draft.audioName)}</td>
                    <td><span class="status-pill is-${draft.status === 'submitted' ? 'submitted' : 'draft'}">${escapeHtml(draft.status)}</span></td>
                  </tr>`).join('')}
                </tbody>
              </table>
            ` : `
              <div class="empty-state">${icon('mic')}<div>
                <strong>No audio files yet</strong>
                <p>Add audio when creating stories in the Upload step.</p>
              </div></div>
            `}
          </div>

          <div class="studio-panel">
            <h3>Imported photos</h3>
            <p class="data-note">Media can be imported from this device or the web once the feature is available.</p>
          </div>

          <div class="studio-actions">
            <a class="button button-sm" href="/creators/">${icon('arrow')} Back to Create</a>
          </div>
        </section>
      </div>
    </div>
  </div>`;
}

export const stylesheet = '/app/studio.css';

export function meta() {
  return {
    title: 'Media Library · Creator Studio · Naarad',
    description: 'Manage audio files and photos for your stories in Naarad.',
    path: '/creators/media/',
  };
}