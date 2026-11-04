const EARTH_RADIUS_M = 6_371_008.8;

export function elevationSamples(route) {
  const samples = route?.elevation?.samples;
  if (!Array.isArray(samples) || samples.length < 2) return [];

  const copy = [];
  let previousDistance = -1;
  for (const sample of samples) {
    if (!sample || !Number.isFinite(sample.d) || sample.d < 0
      || !Number.isFinite(sample.e) || sample.d <= previousDistance) return [];
    copy.push(Object.freeze({ d: sample.d, e: sample.e }));
    previousDistance = sample.d;
  }
  return Object.freeze(copy);
}

function radians(degrees) {
  return degrees * Math.PI / 180;
}

function segmentDistance(a, b) {
  const lat1 = radians(a[1]);
  const lat2 = radians(b[1]);
  const deltaLat = lat2 - lat1;
  const deltaLng = radians(((b[0] - a[0] + 540) % 360) - 180);
  const haversine = Math.sin(deltaLat / 2) ** 2
    + Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(Math.min(1, haversine)));
}

function validLine(route) {
  const geometry = route?.geometry;
  const coordinates = geometry?.coordinates;
  if ((geometry?.type != null && geometry.type !== 'LineString')
    || !Array.isArray(coordinates) || coordinates.length < 2) return null;
  if (!coordinates.every((point) => Array.isArray(point) && point.length >= 2
    && Number.isFinite(point[0]) && point[0] >= -180 && point[0] <= 180
    && Number.isFinite(point[1]) && point[1] >= -90 && point[1] <= 90)) return null;
  return coordinates;
}

function interpolateCoordinate(a, b, fraction) {
  if (fraction <= 0) return [a[0], a[1]];
  if (fraction >= 1) return [b[0], b[1]];

  const lat1 = radians(a[1]);
  const lng1 = radians(a[0]);
  const lat2 = radians(b[1]);
  const deltaLng = radians(((b[0] - a[0] + 540) % 360) - 180);
  const lng2 = lng1 + deltaLng;
  const first = [Math.cos(lat1) * Math.cos(lng1), Math.cos(lat1) * Math.sin(lng1), Math.sin(lat1)];
  const second = [Math.cos(lat2) * Math.cos(lng2), Math.cos(lat2) * Math.sin(lng2), Math.sin(lat2)];
  const dot = Math.max(-1, Math.min(1, first[0] * second[0] + first[1] * second[1] + first[2] * second[2]));
  const angle = Math.acos(dot);

  if (angle < 1e-12 || Math.abs(Math.sin(angle)) < 1e-12) {
    const longitude = a[0] + (((b[0] - a[0] + 540) % 360) - 180) * fraction;
    const normalizedLongitude = ((longitude + 540) % 360) - 180;
    return [normalizedLongitude, a[1] + (b[1] - a[1]) * fraction];
  }

  const firstWeight = Math.sin((1 - fraction) * angle) / Math.sin(angle);
  const secondWeight = Math.sin(fraction * angle) / Math.sin(angle);
  const x = firstWeight * first[0] + secondWeight * second[0];
  const y = firstWeight * first[1] + secondWeight * second[1];
  const z = firstWeight * first[2] + secondWeight * second[2];
  const longitude = ((Math.atan2(y, x) * 180 / Math.PI + 540) % 360) - 180;
  const latitude = Math.atan2(z, Math.hypot(x, y)) * 180 / Math.PI;
  return [longitude, latitude];
}

function coordinateAt(coordinates, distanceM) {
  const segments = [];
  let total = 0;
  for (let index = 1; index < coordinates.length; index += 1) {
    const length = segmentDistance(coordinates[index - 1], coordinates[index]);
    segments.push({ start: total, length, index });
    total += length;
  }

  if (total === 0 || distanceM <= 0) return [coordinates[0][0], coordinates[0][1]];
  if (distanceM >= total) {
    const last = coordinates[coordinates.length - 1];
    return [last[0], last[1]];
  }

  for (const segment of segments) {
    if (segment.length === 0) continue;
    if (distanceM <= segment.start + segment.length) {
      const fraction = (distanceM - segment.start) / segment.length;
      return interpolateCoordinate(coordinates[segment.index - 1], coordinates[segment.index], fraction);
    }
  }
  const last = coordinates[coordinates.length - 1];
  return [last[0], last[1]];
}

export function elevationPoint(route, distanceM) {
  if (!Number.isFinite(distanceM)) return null;
  const samples = elevationSamples(route);
  if (!samples.length) return null;

  const first = samples[0];
  const last = samples[samples.length - 1];
  const distance = Math.max(first.d, Math.min(last.d, distanceM));
  let elevation = first.e;
  if (distance >= last.d) {
    elevation = last.e;
  } else {
    for (let index = 1; index < samples.length; index += 1) {
      const next = samples[index];
      if (distance <= next.d) {
        const previous = samples[index - 1];
        const fraction = (distance - previous.d) / (next.d - previous.d);
        elevation = previous.e + (next.e - previous.e) * fraction;
        break;
      }
    }
  }

  const coordinates = validLine(route);
  return {
    distanceM: distance,
    elevationM: elevation,
    coordinate: coordinates ? coordinateAt(coordinates, distance) : null,
  };
}
