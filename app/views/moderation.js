/* Moderation view for creator submissions.
 *
 * Behind the accounts flag (account-ui.js), only visible to moderators.
 * Lists all submissions, allows approve/reject with review note.
 * All draft content is escaped before rendering.
 */

import { escapeHtml } from '../media.js';
import { icon } from '../icons.js';
import { backend } from '../backend.js';

export const stylesheet = '/app/moderation.css';

const view = {
  submissions: [],
  loading: false,
  error: null,
  selectedId: null,
};

function escapeAll(str) {
  return escapeHtml(str);
}

export async function fetchSubmissions() {
  view.loading = true;
  view.error = null;
  try {
    view.submissions = await backend.listAllSubmissions();
  } catch (error) {
    view.error = error.message || 'Failed to load submissions';
    view.submissions = [];
  }
  view.loading = false;
}

export function moderationBody() {
  if (view.loading) {
    return `<section class="moderation-loading"><h1>Moderation</h1><div class="loading-spinner">${icon('spinner')} Loading…</div></section>`;
  }
  if (view.error) {
    return `<section class="moderation-error" role="alert"><h1>Moderation</h1>${escapeHtml(view.error)}</section>`;
  }
  if (!view.submissions.length) {
    return `<section class="moderation-empty"><h1>Moderation</h1>${icon('inbox')}<p>No submissions yet.</p></section>`;
  }

  return `
    <section class="moderation-content">
      <h1>Moderation</h1>
      <table class="moderation-table" role="table" aria-label="Creator submissions">
      <thead>
        <tr>
          <th scope="col">Title</th>
          <th scope="col">Author</th>
          <th scope="col">Status</th>
          <th scope="col">Updated</th>
          <th scope="col">Actions</th>
        </tr>
      </thead>
      <tbody>
        ${view.submissions.map((sub) => `
          <tr data-sub-id="${escapeHtml(sub.id)}">
            <td>${escapeAll(sub.title || '—')}</td>
            <td>${escapeAll(sub.author_id || '—')}</td>
            <td><span class="status-badge status-${escapeHtml(sub.status)}">${escapeHtml(sub.status)}</span></td>
            <td>${sub.updated_at ? new Date(sub.updated_at).toLocaleString() : '—'}</td>
            <td class="moderation-actions">
              ${sub.status === 'submitted' ? `
                <button type="button" class="button button-sm button-primary" data-action="approve" data-id="${escapeHtml(sub.id)}" ${view.selectedId === sub.id ? 'disabled' : ''}>${icon('check')} Approve</button>
                <button type="button" class="button button-sm button-secondary" data-action="reject" data-id="${escapeHtml(sub.id)}" ${view.selectedId === sub.id ? 'disabled' : ''}>${icon('x')} Reject</button>
              ` : `
                <span class="status-final">${escapeHtml(sub.status)}</span>
                ${sub.review_note ? `<button type="button" class="button button-sm button-tertiary" data-action="view-note" data-id="${escapeHtml(sub.id)}">${icon('eye')} View note</span>` : ''}
              `}
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    ${view.selectedId ? moderationNoteModal() : ''}
  </section>
  `;
}

function moderationNoteModal() {
  const sub = view.submissions.find((s) => s.id === view.selectedId);
  if (!sub) return '';
  return `
    <div class="moderation-modal-overlay" data-modal-close></div>
    <div class="moderation-modal" role="dialog" aria-labelledby="modal-title" aria-modal="true">
      <h2 id="modal-title">${sub.review_note ? 'Review note' : `${escapeAll(sub.action === 'approve' ? 'Approve' : 'Reject')} submission`}</h2>
      <p class="modal-submission-title">${escapeAll(sub.title)}</p>
      <form data-moderation-form data-id="${escapeHtml(sub.id)}" data-action="${sub.review_note ? 'view' : (sub.status === 'submitted' ? 'decide' : 'view')}">
        <div class="form-group">
          <label for="review-note">Review note <span class="required">*</span></label>
          <textarea id="review-note" name="review_note" rows="4" placeholder="Write a note for the creator…" ${sub.review_note || sub.status !== 'submitted' ? 'readonly' : 'required'}>${escapeHtml(sub.review_note || '')}</textarea>
        </div>
        <div class="modal-actions">
          ${sub.status === 'submitted' ? `
            <button type="button" class="button button-secondary" data-action="cancel">${icon('x')} Cancel</button>
            <button type="submit" class="button button-primary" data-action="${sub.action === 'approve' ? 'approve' : 'reject'}">${icon(sub.action === 'approve' ? 'check' : 'x')} ${sub.action === 'approve' ? 'Approve' : 'Reject'}</button>
          ` : `
            <button type="button" class="button button-primary" data-action="close">${icon('check')} Close</button>
          `}
        </div>
      </form>
    </div>
  `;
}

export async function handleAction(event) {
  const btn = event.target.closest('[data-action]');
  if (!btn) return;

  const action = btn.dataset.action;
  const id = btn.dataset.id;

  if (action === 'approve' || action === 'reject') {
    // Open modal with note field
    view.selectedId = id;
    view.submissions.find(s => s.id === id).action = action; // stash for modal
    render();
  } else if (action === 'cancel' || action === 'close') {
    view.selectedId = null;
    render();
  } else if (action === 'decide') {
    const form = event.target.closest('form');
    const note = form.querySelector('[name="review_note"]').value;
    view.loading = true;
    render();
    try {
      await backend.moderateSubmission(id, action, note);
      view.selectedId = null;
      await fetchSubmissions();
    } catch (error) {
      view.error = error.message || 'Failed to update submission';
    }
    view.loading = false;
    render();
  } else if (action === 'view-note') {
    view.selectedId = id;
    render();
  } else if (action === 'view') {
    view.selectedId = null;
    render();
  }
}

let renderTarget = null;
export async function initModeration(target) {
  renderTarget = target;
  await fetchSubmissions();
  renderToTarget();
}

function renderToTarget() {
  if (renderTarget) renderTarget.innerHTML = moderationBody();
}

export function moderationBodyContent() {
  return moderationBody();
}

export async function render(context = {}) {
  // The view is initialized via initModeration, but render() is called by main.js
  // Return the body HTML directly (main.js calls render() with context)
  return moderationBody();
}

export const meta = {
  title: 'Moderation – Naarad',
  description: 'Moderate creator submissions',
  path: '/creators/moderation/',
  robots: 'noindex',   // a moderators-only tool: out of search and out of the sitemap
};

export async function list() {
  return ['/creators/moderation/'];
}