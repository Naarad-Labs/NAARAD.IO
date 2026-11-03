/* The route as a GPX file the visitor can load into any walking app. Built in the browser from the
   geometry the page already has: nothing is sent anywhere. Stops become waypoints. */

const escapeXml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[char]
));

/** GPX text for a route, or '' when it has no line to export. */
export function routeGpx(route) {
  const coordinates = route?.geometry?.coordinates;
  if (!coordinates?.length) return '';
  const points = coordinates.map(([lng, lat]) => `      <trkpt lat="${Number(lat).toFixed(6)}" lon="${Number(lng).toFixed(6)}"></trkpt>`).join('\n');
  const waypoints = (route.stops || []).map((stop) => `  <wpt lat="${Number(stop.lat).toFixed(6)}" lon="${Number(stop.lng).toFixed(6)}">
    <name>${escapeXml(`${stop.order}. ${stop.name}`)}</name>
  </wpt>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Naarad (naarad.io)" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata><name>${escapeXml(route.name)}</name><link href="https://naarad.io/routes/${encodeURIComponent(route.slug)}/"><text>Naarad</text></link></metadata>
${waypoints}
  <trk>
    <name>${escapeXml(route.name)}</name>
    <trkseg>
${points}
    </trkseg>
  </trk>
</gpx>
`;
}

/** Offer the file for download. Returns false when there was nothing to export. */
export function downloadGpx(route) {
  const text = routeGpx(route);
  if (!text) return false;
  const url = URL.createObjectURL(new Blob([text], { type: 'application/gpx+xml' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `${route.slug}.gpx`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}
