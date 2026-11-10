/* Walking mode: which stop has the walker reached?

   Pure: a position and the route's stops in, a stop (or null) out. The position comes from the browser's own
   geolocation, is used on this device to pick a stop, and goes nowhere: nothing is sent or stored. */

import { distanceKm } from './atlas.js';

/** A walker this close to a stop (metres) has reached it. */
export const WALK_RADIUS_M = 40;
/** A fix less certain than this (metres) is ignored: a vague fix can put a walker beside the wrong stop. */
export const MAX_ACCURACY_M = 75;

const usable = (value) => value != null && Number.isFinite(Number(value));

/** The nearest stop within the radius that has not played yet, or null. `fix` is { lat, lng, accuracy }. */
export function arrivedStop(fix, stops, played = new Set(), { radiusM = WALK_RADIUS_M, maxAccuracyM = MAX_ACCURACY_M } = {}) {
  if (!fix || !usable(fix.lat) || !usable(fix.lng)) return null;
  if (usable(fix.accuracy) && Number(fix.accuracy) > maxAccuracyM) return null;
  const from = { lat: Number(fix.lat), lng: Number(fix.lng) };
  let best = null;
  for (const stop of stops || []) {
    if (played.has(stop.order) || !usable(stop.lat) || !usable(stop.lng)) continue;
    const metres = distanceKm(from, { lat: Number(stop.lat), lng: Number(stop.lng) }) * 1000;
    if (metres <= radiusM && (!best || metres < best.metres)) best = { stop, metres };
  }
  return best?.stop || null;
}
