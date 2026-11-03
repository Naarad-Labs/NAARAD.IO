/* A photo viewer: one photograph at a time, with its caption and credit.
   Opened from any [data-photo-open] button inside a [data-photo-set] list; the
   buttons in that list are the photographs it steps through. Escape closes it
   and focus returns to the button that opened it; arrow keys step. */

import { photoPath, creditText, escapeHtml } from './media.js';

let box = null;
let opener = null;
let items = [];
let index = 0;

function ensure() {
  if (box) return box;
  box = document.createElement('div');
  box.className = 'lightbox';
  box.hidden = true;
  box.setAttribute('role', 'dialog');
  box.setAttribute('aria-modal', 'true');
  box.setAttribute('aria-label', 'Photographs');
  box.innerHTML = `<button type="button" class="lightbox-close" data-lightbox="close" aria-label="Close photographs">×</button>
    <button type="button" class="lightbox-step is-prev" data-lightbox="prev" aria-label="Previous photograph">‹</button>
    <figure class="lightbox-figure"><img class="lightbox-image" alt=""><figcaption class="lightbox-caption" aria-live="polite"></figcaption></figure>
    <button type="button" class="lightbox-step is-next" data-lightbox="next" aria-label="Next photograph">›</button>`;
  document.body.append(box);
  box.addEventListener('click', (event) => {
    const action = event.target.closest('[data-lightbox]')?.dataset.lightbox;
    if (action === 'close' || event.target === box) close();
    if (action === 'prev') show(index - 1);
    if (action === 'next') show(index + 1);
  });
  return box;
}

function show(next) {
  index = (next + items.length) % items.length;
  const item = items[index];
  const frame = ensure();
  const image = frame.querySelector('.lightbox-image');
  image.src = photoPath(item.id) || '';
  image.alt = item.caption ? '' : item.alt;   // the caption below names the photograph
  frame.querySelector('.lightbox-caption').innerHTML =
    `${item.caption ? `<strong>${escapeHtml(item.caption)}</strong> ` : ''}<span>${escapeHtml(creditText(item.id))}</span> · ${index + 1} of ${items.length}`;
  const single = items.length < 2;
  frame.querySelectorAll('.lightbox-step').forEach((button) => { button.hidden = single; });
}

export function open(button) {
  const list = button.closest('[data-photo-set]');
  if (!list) return;
  const buttons = [...list.querySelectorAll('[data-photo-open]')];
  items = buttons.map((node) => ({ id: node.dataset.photoOpen, caption: node.dataset.photoCaption || '', alt: node.dataset.photoAlt || '' }));
  opener = button;
  const frame = ensure();
  frame.hidden = false;
  document.documentElement.classList.add('has-lightbox');
  show(buttons.indexOf(button));
  frame.querySelector('[data-lightbox="close"]').focus();
}

export function close() {
  if (!box || box.hidden) return;
  box.hidden = true;
  document.documentElement.classList.remove('has-lightbox');
  opener?.focus({ preventScroll: true });
}

export function isOpen() { return Boolean(box && !box.hidden); }

document.addEventListener('keydown', (event) => {
  if (!isOpen()) return;
  if (event.key === 'Escape') { event.preventDefault(); close(); }
  if (event.key === 'Tab') {
    const focusable = [...box.querySelectorAll('button')].filter((button) => !button.hidden);
    const first = focusable[0]; const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    else if (!box.contains(document.activeElement)) { event.preventDefault(); first.focus(); }
  }
  if (event.key === 'ArrowLeft') show(index - 1);
  if (event.key === 'ArrowRight') show(index + 1);
});
