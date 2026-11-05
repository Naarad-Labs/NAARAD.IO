/* Media Library for Creator Studio.
 *
 * Lists media assets (audio files, photos) associated with drafts.
 * This is a separate page under /creators/media/.
 */

import { picture, escapeHtml } from '../media.js';
import { icon } from '../icons.js';
import * as Drafts from '../studio-store.js';
import * as Account from '../account.js';

export function render() {
  const drafts = Drafts.list();
  const audioDrafts = drafts.filter((d) => d.audioName);

  return `<section class="studio-media-library">
    <h2 class="studio-step-title">Media Library</h2>

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
  </section>`;
}

export const stylesheet = '/app/studio.css';

export function meta() {
  return {
    title: 'Media Library · Creator Studio · Naarad',
    description: 'Manage audio files and photos for your stories in Naarad.',
    path: '/creators/media/',
  };
}