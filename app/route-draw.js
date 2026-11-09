/* The route as one SVG path, for the line drawn over the hero photograph.
   Pure: coordinates in, a path string out, so the page prerenders it and no script has to run. */

/** `[lng, lat]` pairs to an `M x y L x y ...` string inside a width x height box; null when there is no line to draw.
    shortcut: a flat projection (longitude scaled by cos of the mean latitude), fine for India-sized routes. */
export function routeDrawPath(coordinates, { width = 100, height = 60, pad = 4 } = {}) {
  const points = (coordinates || []).filter((c) => Array.isArray(c) && Number.isFinite(c[0]) && Number.isFinite(c[1]));
  if (points.length < 2) return null;
  const meanLat = points.reduce((sum, c) => sum + c[1], 0) / points.length;
  const scale = Math.cos((meanLat * Math.PI) / 180);
  const flat = points.map(([lng, lat]) => [lng * scale, lat]);
  const xs = flat.map((p) => p[0]);
  const ys = flat.map((p) => p[1]);
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const spanX = maxX - minX;
  const spanY = maxY - minY;
  if (!(spanX > 0 || spanY > 0)) return null;
  const fit = Math.min((width - 2 * pad) / (spanX || Infinity), (height - 2 * pad) / (spanY || Infinity));
  const offsetX = (width - spanX * fit) / 2;
  const offsetY = (height - spanY * fit) / 2;
  return flat
    .map(([x, y], i) => `${i ? 'L' : 'M'}${((x - minX) * fit + offsetX).toFixed(1)} ${((maxY - y) * fit + offsetY).toFixed(1)}`)
    .join('');
}
