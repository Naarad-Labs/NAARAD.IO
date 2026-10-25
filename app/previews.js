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
  return (point) => [point[0] * scale + offsetX, point[1] * scale + offsetY];
}

/**
 * A small map of the route: its line, and a numbered marker per stop.
 * Returns '' when the route has no published geometry, so the caller can show
 * its own empty state rather than a decorative fake.
 */
export function routePreview(route, options = {}) {
  const { width = 320, height = 220, numbered = true, className = '' } = options;
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

  const id = `rp${++previewCount}`;
  return `<svg class="route-preview ${escapeHtml(className)}" viewBox="0 0 ${width} ${height}" role="img"
    aria-label="Map preview of ${escapeHtml(route.name)}${numbered && route.stops?.length ? ` with ${route.stops.length} numbered stops` : ''}" preserveAspectRatio="xMidYMid slice">
    <defs>
      <pattern id="${id}" width="26" height="26" patternUnits="userSpaceOnUse">
        <path d="M26 0H0v26" fill="none" stroke="rgba(18,41,74,.07)" stroke-width="1"></path>
      </pattern>
    </defs>
    <rect width="${width}" height="${height}" fill="#eef2e6"></rect>
    <rect width="${width}" height="${height}" fill="url(#${id})"></rect>
    <path d="${line}" class="rp-line-case"></path>
    <path d="${line}" class="rp-line"></path>
    ${markers}
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
