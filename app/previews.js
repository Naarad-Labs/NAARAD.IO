/* Static previews drawn from real route data.
 *
 * Route cards, saved-route lists and story sidebars show a map without loading
 * a tile engine: an SVG built from the route's own geometry, with its numbered
 * stops. The elevation profile is drawn the same way, from the sampled SRTM
 * heights. Both return markup, so a page of twenty cards costs twenty small
 * SVGs rather than twenty map instances.
 */

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]
));

/** Web Mercator, so the preview matches the shape an interactive map shows. */
function project([lng, lat]) {
  const x = (lng + 180) / 360;
  const radians = (lat * Math.PI) / 180;
  const y = (1 - Math.log(Math.tan(radians) + 1 / Math.cos(radians)) / Math.PI) / 2;
  return [x, y];
}

/* Each preview's grid pattern needs an id unique in the document. A counter
   rather than a random value, so the same page always renders the same
   markup: the build's output is byte-stable, and a pre-rendered page can be
   recognised as already drawn. */
let previewCount = 0;

function fit(points, width, height, pad) {
  const xs = points.map((point) => point[0]);
  const ys = points.map((point) => point[1]);
  const minX = Math.min(...xs); const maxX = Math.max(...xs);
  const minY = Math.min(...ys); const maxY = Math.max(...ys);
  const spanX = Math.max(maxX - minX, 1e-9);
  const spanY = Math.max(maxY - minY, 1e-9);
  const scale = Math.min((width - pad * 2) / spanX, (height - pad * 2) / spanY);
  const offsetX = (width - spanX * scale) / 2 - minX * scale;
  const offsetY = (height - spanY * scale) / 2 - minY * scale;
  const place = (point) => [point[0] * scale + offsetX, point[1] * scale + offsetY];
  place.scale = scale;
  place.offsetX = offsetX;
  place.offsetY = offsetY;
  return place;
}

const TILE_URL = 'https://tile.openstreetmap.org';
const MAX_TILES = 9;
const MIN_TILE_PX = 200;

/**
 * Map tiles under the line. They are named here but not fetched: each <image>
 * carries data-src, and loadPreviewTiles() sets its href only when the card
 * nears the screen. Pre-rendered pages therefore make no tile requests, and the
 * markup stays byte-stable because every number comes from the geometry.
 */
function tileLayer(place, width, height) {
  const { scale, offsetX, offsetY } = place;
  let zoom = Math.min(17, Math.max(2, Math.floor(Math.log2(scale / MIN_TILE_PX))));
  const marginX = width * 0.1; const marginY = height * 0.1;
  const west = (-marginX - offsetX) / scale; const east = (width + marginX - offsetX) / scale;
  const north = (-marginY - offsetY) / scale; const south = (height + marginY - offsetY) / scale;
  let range;
  for (;;) {
    const n = 2 ** zoom;
    range = [Math.floor(west * n), Math.floor(east * n), Math.floor(north * n), Math.floor(south * n)];
    const count = (range[1] - range[0] + 1) * (range[3] - range[2] + 1);
    if (count <= MAX_TILES || zoom <= 2) break;
    zoom -= 1;
  }
  const n = 2 ** zoom;
  const size = scale / n;
  const images = [];
  for (let ty = range[2]; ty <= range[3]; ty += 1) {
    for (let tx = range[0]; tx <= range[1]; tx += 1) {
      if (tx < 0 || ty < 0 || tx >= n || ty >= n) continue;
      const [x, y] = place([tx / n, ty / n]);
      images.push(`<image class="rp-tile" data-src="${TILE_URL}/${zoom}/${tx}/${ty}.png" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${(size + 0.6).toFixed(1)}" height="${(size + 0.6).toFixed(1)}" preserveAspectRatio="none"></image>`);
    }
  }
  return images.length ? `<g class="rp-tiles" aria-hidden="true">${images.join('')}</g>` : '';
}

/**
 * A small map of the route: its line, and a numbered marker per stop.
 * Returns '' when the route has no published geometry, so the caller can show
 * its own empty state rather than a decorative fake.
 */
export function routePreview(route, options = {}) {
  const { width = 320, height = 220, className = '', tiles = true } = options;
  const numbered = options.numbered !== false && (route?.stops?.length || 0) <= 14;
  const coordinates = route?.geometry?.coordinates;
  if (!coordinates?.length) return '';

  const projected = coordinates.map(project);
  const stops = (route.stops || []).map((stop) => project([stop.lng, stop.lat]));
  const place = fit([...projected, ...stops], width, height, numbered ? 22 : 12);

  const line = projected.map(place).map(([x, y], index) => `${index ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join('');
  const markers = numbered ? (route.stops || []).map((stop, index) => {
    const [x, y] = place(stops[index]);
    return `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)})">
      <circle r="9.5" class="rp-pin"></circle>
      <text y="3.4" class="rp-num">${stop.order}</text>
    </g>`;
  }).join('') : '';

  const layer = tiles ? tileLayer(place, width, height) : '';
  const id = `rp${++previewCount}`;
  return `<svg class="route-preview ${escapeHtml(className)}" viewBox="0 0 ${width} ${height}" role="img"
    aria-label="Map preview of ${escapeHtml(route.name)}${numbered && route.stops?.length ? ` with ${route.stops.length} numbered stops` : ''}" preserveAspectRatio="xMidYMid slice">
    <defs>
      <pattern id="${id}" width="26" height="26" patternUnits="userSpaceOnUse">
        <path d="M26 0H0v26" class="rp-grid" fill="none" stroke-width="1"></path>
      </pattern>
    </defs>
    <rect width="${width}" height="${height}" class="rp-ground"></rect>
    <rect width="${width}" height="${height}" fill="url(#${id})"></rect>
    ${layer}
    <path d="${line}" class="rp-line-case"></path>
    <path d="${line}" class="rp-line"></path>
    ${markers}
    ${layer ? `<text x="${width - 4}" y="${height - 4}" class="rp-credit" text-anchor="end">© OpenStreetMap</text>` : ''}
  </svg>`;
}

/**
 * The elevation profile, from the route's sampled heights.
 * Markers show where each stop falls along the walk.
 */
export function elevationProfile(route, options = {}) {
  const { width = 720, height = 150, markers = true, labels = true, className = '' } = options;
  const samples = route?.elevation?.samples;
  if (!samples?.length || samples.length < 3) return '';

  const padTop = 16;
  const padBottom = labels ? 24 : 8;
  const padX = 2;
  const heights = samples.map((sample) => sample.e);
  const minE = Math.min(...heights);
  const maxE = Math.max(...heights);
  const span = Math.max(maxE - minE, 10);
  const low = minE - span * 0.18;
  const high = maxE + span * 0.18;
  const total = samples[samples.length - 1].d || 1;

  const toX = (distance) => padX + (distance / total) * (width - padX * 2);
  const toY = (elevation) => padTop + (1 - (elevation - low) / (high - low)) * (height - padTop - padBottom);

  const points = samples.map((sample) => [toX(sample.d), toY(sample.e)]);
  const line = points.map(([x, y], index) => `${index ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join('');
  const area = `${line}L${points[points.length - 1][0].toFixed(1)} ${(height - padBottom).toFixed(1)}L${points[0][0].toFixed(1)} ${(height - padBottom).toFixed(1)}Z`;

  const elevationAt = (distance) => {
    const sample = samples.reduce((best, candidate) => (
      Math.abs(candidate.d - distance) < Math.abs(best.d - distance) ? candidate : best
    ), samples[0]);
    return sample.e;
  };

  const pins = markers ? (route.stops || []).map((stop) => `
    <g transform="translate(${toX(stop.distanceM).toFixed(1)} ${toY(elevationAt(stop.distanceM)).toFixed(1)})">
      <line y2="${(height - padBottom - toY(elevationAt(stop.distanceM))).toFixed(1)}" class="ep-stem"></line>
      <circle r="8.5" class="ep-pin"></circle>
      <text y="3.2" class="ep-num">${stop.order}</text>
    </g>`).join('') : '';

  const axis = labels ? `
    <text x="${padX}" y="${height - 6}" class="ep-axis">0 km</text>
    <text x="${width - padX}" y="${height - 6}" class="ep-axis" text-anchor="end">${(total / 1000).toFixed(1)} km</text>
    <text x="${padX}" y="${(toY(maxE) - 5).toFixed(1)}" class="ep-axis">${Math.round(maxE)} m</text>
    <text x="${padX}" y="${(toY(minE) + 12).toFixed(1)}" class="ep-axis">${Math.round(minE)} m</text>` : '';

  return `<svg class="elevation-svg ${escapeHtml(className)}" viewBox="0 0 ${width} ${height}" role="img" preserveAspectRatio="none"
    aria-label="Elevation profile: ${Math.round(minE)} to ${Math.round(maxE)} metres over ${(total / 1000).toFixed(1)} kilometres">
    <path d="${area}" class="ep-area"></path>
    <path d="${line}" class="ep-line"></path>
    ${pins}
    ${axis}
  </svg>`;
}

/** A one-line terrain sparkline for a route card. */
export function terrainSparkline(route, options = {}) {
  const { width = 120, height = 30 } = options;
  return elevationProfile(route, { width, height, markers: false, labels: false, className: 'is-spark' });
}

/**
 * Fetch a preview's tiles when it nears the screen. Safe to call repeatedly.
 * Called by the app after it has drawn or kept a page, never before: boot compares the
 * pre-rendered markup with what it would draw, and this edits that markup.
 * Skipped on Data Saver; the grid and line underneath are then the whole map.
 */
export function loadPreviewTiles(root = document) {
  if (typeof IntersectionObserver === 'undefined') return;
  if (globalThis.navigator?.connection?.saveData) return;
  loadPreviewTiles.observer ||= new IntersectionObserver((entries, observer) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      observer.unobserve(entry.target);
      entry.target.classList.add('has-tiles');
      for (const image of entry.target.querySelectorAll('image[data-src]')) {
        image.setAttribute('href', image.dataset.src);
        image.removeAttribute('data-src');
      }
    }
  }, { rootMargin: '240px' });
  for (const svg of root.querySelectorAll('svg.route-preview')) {
    if (svg.querySelector('image[data-src]')) loadPreviewTiles.observer.observe(svg);
  }
}
