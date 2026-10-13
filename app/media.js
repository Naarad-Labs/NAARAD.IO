/* Responsive photography with its licence attached.
 *
 * Every photograph the site ships is described in content/photo-sources.json,
 * which scripts/build-photos.py writes from the Wikimedia Commons API. This
 * module turns an entry into a <picture> with AVIF and WebP sources, and keeps
 * the author and licence with the image so a credit can always be shown.
 *
 * An id with no manifest entry falls back to an inherited repository image,
 * whose rights this repository has never recorded; those are reported as
 * unverified rather than dressed up as cleared.
 */

const MANIFEST_URL = '/content/photo-sources.json';
const PHOTO_DIR = '/Images/photos';

/** Inherited files kept from the previous site; rights unrecorded. */
const LEGACY = {
  'hampi-landscape': '/Images/hero-1600.webp',
  'hampi-gopuram': '/Images/hero-1600.webp',
  'hampi-virupaksha': '/Images/Hampi.webp',
  'hampi-bazaar': '/Images/Hampi.webp',
  'hampi-stone-chariot': '/Images/Hampi.webp',
  'thanjavur-temple': '/Images/thanjavur.webp',
  'varanasi-ghats': '/Images/Varanasi.webp',
  'mysore-palace': '/Images/Mysore Palace.webp',
  'jaipur-hawa-mahal': '/Images/Jaipur.webp',
  'chennai-iitm': '/Images/IIt_Madras.webp',
};

const UNVERIFIED = Object.freeze({
  status: 'unverified',
  author: 'Not recorded',
  licence: 'Not recorded',
  licenceUrl: '',
  commonsPage: '',
});

let photos = {};
let loaded = false;

export async function loadMedia() {
  if (loaded) return photos;
  try {
    const response = await fetch(MANIFEST_URL, { cache: 'force-cache' });
    if (response.ok) photos = (await response.json()).photos || {};
  } catch {
    photos = {};
  }
  loaded = true;
  return photos;
}

export function getPhoto(id) {
  return photos[id] || null;
}

/** Attribution for an id, honest about what is not known. */
export function attribution(id) {
  const photo = photos[id];
  if (!photo) return { ...UNVERIFIED, verified: false };
  return {
    status: 'verified',
    verified: true,
    author: photo.author,
    licence: photo.licence,
    licenceUrl: photo.licenceUrl || '',
    commonsPage: photo.commonsPage || '',
    source: 'Wikimedia Commons',
  };
}

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]
));

function srcset(id, widths, extension) {
  return widths.map((width) => `${PHOTO_DIR}/${id}-${width}.${extension} ${width}w`).join(', ');
}

/**
 * Build a <picture> element as markup.
 *
 * @param {string} id        photo id from the manifest
 * @param {object} options
 *   sizes     - the CSS `sizes` attribute; required for a correct pick
 *   alt       - alternative text; '' marks the image decorative
 *   priority  - true for the one above-the-fold hero image on a page
 *   className - class for the wrapping <picture>
 *   ratio     - CSS aspect-ratio for the <img>, keeping layout stable
 *   credit    - render the licence badge over the image
 */
export function picture(id, options = {}) {
  const {
    sizes = '100vw', alt = '', priority = false, className = '', ratio = '', credit = false,
  } = options;
  const photo = photos[id];
  const loading = priority ? 'eager' : 'lazy';
  const fetchPriority = priority ? 'high' : 'auto';
  const style = ratio ? ` style="aspect-ratio:${ratio}"` : '';

  if (!photo) {
    const legacy = LEGACY[id];
    if (!legacy) {
      return `<span class="photo photo-missing ${escapeHtml(className)}"${style} aria-hidden="true"></span>`;
    }
    return `<picture class="photo ${escapeHtml(className)}">
      <img src="${escapeHtml(legacy)}" alt="${escapeHtml(alt)}" loading="${loading}" decoding="async" fetchpriority="${fetchPriority}"${style}>
      ${credit ? '<span class="photo-credit">Rights for this inherited image are not recorded</span>' : ''}
    </picture>`;
  }

  const widths = photo.widths || [];
  const fallbackWidth = widths[Math.min(1, widths.length - 1)] || widths[0];
  const creditMarkup = credit ? creditLine(id) : '';
  return `<picture class="photo ${escapeHtml(className)}">
    <source type="image/avif" srcset="${srcset(id, widths, 'avif')}" sizes="${escapeHtml(sizes)}">
    <source type="image/webp" srcset="${srcset(id, widths, 'webp')}" sizes="${escapeHtml(sizes)}">
    <img src="${PHOTO_DIR}/${id}-${fallbackWidth}.webp" alt="${escapeHtml(alt)}"
      loading="${loading}" decoding="async" fetchpriority="${fetchPriority}"${style}>
    ${creditMarkup}
  </picture>`;
}

/** The small credit badge drawn over a photograph. */
export function creditLine(id) {
  const info = attribution(id);
  if (!info.verified) return '<span class="photo-credit">Rights not recorded</span>';
  const licence = info.licenceUrl
    ? `<a href="${escapeHtml(info.licenceUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(info.licence)}</a>`
    : escapeHtml(info.licence);
  return `<span class="photo-credit">Photo: ${escapeHtml(info.author)} (${licence})</span>`;
}

/** A plain-text credit, for captions under an image. */
export function creditText(id) {
  const info = attribution(id);
  return info.verified ? `Photo: ${info.author} (${info.licence})` : 'Photo rights not recorded';
}

/** First id that the manifest actually has, so layouts never show a hole. */
export function firstAvailable(...ids) {
  return ids.find((id) => photos[id]) || ids.find((id) => LEGACY[id]) || ids[0];
}

export { escapeHtml };
