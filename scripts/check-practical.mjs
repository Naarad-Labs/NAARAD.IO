#!/usr/bin/env node
/* Lint content/practical/*.json: the sourced visitor facts behind the trip-planner pages.
 *
 *   node scripts/check-practical.mjs                         # lint content/practical
 *   node scripts/check-practical.mjs some/dir                # lint another directory
 *   node scripts/check-practical.mjs --today 2026-12-01      # pretend it is that day
 *   node scripts/check-practical.mjs --max-age-days 90       # tighter freshness window
 *   node scripts/check-practical.mjs --routes file.json      # check stop names against another routes file
 *
 * Exit code: 0 clean (warnings allowed), 1 at least one error, 2 bad arguments or
 * an unreadable directory. Zero dependencies, Node 18+. scripts/verify.sh runs it.
 *
 * Rules (the rule id is printed in square brackets):
 *   unsourced-value  a number, hours, closed, free or fees value with no source URL in the
 *                    same object or in an ancestor (a stop's own `sources`, a climate's `source`)
 *   non-https        a source or url that is not an https URL
 *   api-source       a source that is an API endpoint (ksrtcapi, router.project-osrm.org,
 *                    /api/, getTrains.aspx, /route/v1/) without `computed: true` and a `method`
 *                    note in the same object. A computed value is allowed only with its method.
 *   computed-method  `computed: true` without a method note of at least a sentence that carries
 *                    the date the value was computed (YYYY-MM-DD)
 *   computed-hours   a computed object that publishes `hours`: the wording must say it is a
 *                    free-flow, computed figure, and the leg must be 150 km or less. A routing
 *                    engine's free-flow time is far shorter than a real journey, so for longer
 *                    legs `hours` is null and only the distance is published
 *   stale-checked    `checked` missing, malformed, in the future, or older than the window
 *   climate          climate without exactly 12 months, or without period, station and source
 *   schema-keys      the top level or a stop with keys other than the agreed ones, or a getting-there
 *                    origin without city, road, rail and bus (the three files keep one schema)
 *   schema-type      a field of the wrong type (km as a string, fees not an array, ...)
 *   stop-names       the stops are not the route's stops, in order, as in content/routes.source.json
 *                    (stops are keyed "1", "2", ..., so a reordered route would shift facts to the
 *                    wrong stop). Skipped when the route is not in that file, unless --routes is given
 *   gap-note-figure  a price, clock time, distance or duration in `unsourced`, the editor's list of
 *                    what was looked for and not found. That list is never shown on a page, so it
 *                    must not carry anything that could be mistaken for a fact
 *   invalid-json     the file does not parse
 * Warnings:
 *   date-specific    a source URL that carries a journey/booking date (a one-day snapshot)
 *   unsourced-text   factual text (dress, notes, shadeWater) with no source URL at all
 *   stop-no-sources  a stop with no sources array entries
 *   computed-flag    a `method` note on an object that is not `computed: true`
 *
 * Not linted: `route`, `checked` (checked separately) and the contents of `unsourced` beyond
 * gap-note-figure (the gaps list for the editor: no page should render it).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_DIR = path.join(ROOT, 'content', 'practical');
const DEFAULT_MAX_AGE_DAYS = 180;
const MIN_METHOD_LENGTH = 15;
// A routing engine's free-flow time is a floor, not a journey. Past this length it is not published.
const MAX_COMPUTED_HOURS_KM = 150;
const ISO_DAY = /\d{4}-\d{2}-\d{2}/;
const DEFAULT_ROUTES = path.join(ROOT, 'content', 'routes.source.json');

// A source matching one of these is an endpoint, not a page a reader can open.
export const API_PATTERNS = [/ksrtcapi/i, /router\.project-osrm\.org/i, /\/api\//i, /getTrains\.aspx/i, /\/route\/v1\//i];
const DATE_QUERY = /[?&](journeyDate|doj|date)=\d{4}-\d{2}-\d{2}/i;

// Keys whose numeric value is a visitor fact.
const NUMBER_KEYS = new Set(['km', 'distanceKm', 'maxC', 'minC', 'rainMm']);
// Numeric keys that are labels, not facts.
const LABEL_NUMBER_KEYS = new Set(['m', 'month', 'id', 'index', 'order']);
// Text fields that state facts; a digit, a currency sign or a time word in them is a number claim.
const TEXT_KEYS = ['summary', 'dress', 'shadeWater', 'notes', 'note'];
const NUMBER_IN_TEXT = /\d|₹|\bRs\.?\s|\bINR\b|\bnoon\b|\bmidnight\b/i;
const SKIP_KEYS = new Set(['unsourced', 'route', 'checked']);
// The keys every file has, in this order, and the keys every stop has.
export const TOP_KEYS = ['route', 'checked', 'site', 'gettingThere', 'stops', 'climate', 'unsourced'];
export const STOP_KEYS = ['name', 'hours', 'closed', 'fees', 'free', 'dress', 'shadeWater', 'notes', 'sources'];
export const ORIGIN_KEYS = ['city', 'road', 'rail', 'bus'];
// What must not appear in the editor's gap notes: an amount, a clock time, a distance or a duration.
export const GAP_FIGURES = [
  /(?:\u20B9|\bRs\.?|\bINR)\s*\d[\d,]*(?:\.\d+)?/i,
  /\b\d{1,2}:\d{2}\b/,
  /\b\d{1,2}\s?(?:am|pm)\b/i,
  /\b\d+(?:[.,]\d+)?\s?(?:km|kms|kilomet(?:re|er)s?|hours?|hrs?|minutes?|mins?)\b/i,
];

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isNonEmptyString = (v) => typeof v === 'string' && v.trim() !== '';

export function parseDay(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const [y, m, d] = s.split('-').map(Number);
  const t = Date.UTC(y, m - 1, d);
  const back = new Date(t);
  if (back.getUTCFullYear() !== y || back.getUTCMonth() !== m - 1 || back.getUTCDate() !== d) return null;
  return t;
}

export function todayUtc() {
  return new Date().toISOString().slice(0, 10);
}

function classifyUrl(u) {
  let url;
  try {
    url = new URL(u);
  } catch {
    return { ok: false, https: false, api: false };
  }
  return { ok: true, https: url.protocol === 'https:' && url.hostname !== '', api: API_PATTERNS.some((re) => re.test(u)), url };
}

/** The source URLs an object carries itself: `source`, `sources[]`, `url`. */
function ownSources(node) {
  const out = [];
  if (typeof node.source === 'string') out.push({ key: 'source', value: node.source });
  if (Array.isArray(node.sources)) node.sources.forEach((v, i) => out.push({ key: `sources[${i}]`, value: v }));
  if (typeof node.url === 'string') out.push({ key: 'url', value: node.url });
  return out;
}

/** Stop names by route slug, from content/routes.source.json (or null when it cannot be read). */
export function loadRouteStops(file) {
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    const out = new Map();
    for (const route of Array.isArray(parsed?.routes) ? parsed.routes : []) {
      if (isObj(route) && typeof route.slug === 'string' && Array.isArray(route.stops)) out.set(route.slug, route.stops.map((s) => s?.name));
    }
    return out;
  } catch {
    return null;
  }
}

export function lintData(data, { today = todayUtc(), maxAgeDays = DEFAULT_MAX_AGE_DAYS, routes = null, routesExplicit = false } = {}) {
  const errors = [];
  const warnings = [];
  const err = (rule, p, message) => errors.push({ rule, path: p, message });
  const warn = (rule, p, message) => warnings.push({ rule, path: p, message });
  const sourceStats = { total: 0, https: 0, api: 0, computedApi: 0 };

  if (!isObj(data)) {
    err('schema-type', '$', 'top level must be a JSON object');
    return { errors, warnings, coverage: null };
  }

  // ---- checked ------------------------------------------------------------
  const todayMs = parseDay(today);
  if (!isNonEmptyString(data.checked)) {
    err('stale-checked', '$.checked', "missing 'checked' (YYYY-MM-DD date the facts were last verified)");
  } else {
    const checkedMs = parseDay(data.checked);
    if (checkedMs === null) {
      err('stale-checked', '$.checked', `'${data.checked}' is not a valid YYYY-MM-DD date`);
    } else if (checkedMs > todayMs) {
      err('stale-checked', '$.checked', `'${data.checked}' is after today (${today})`);
    } else {
      const age = Math.round((todayMs - checkedMs) / 86400000);
      if (age > maxAgeDays) err('stale-checked', '$.checked', `checked ${data.checked} is ${age} days old at ${today}; the limit is ${maxAgeDays} days`);
    }
  }

  // ---- generic walk: sources, https, api endpoints, unsourced values -------
  function walk(node, p, inherited) {
    if (Array.isArray(node)) {
      node.forEach((child, i) => walk(child, `${p}[${i}]`, inherited));
      return;
    }
    if (!isObj(node)) return;

    const own = ownSources(node);
    for (const s of own) {
      const at = `${p}.${s.key}`;
      sourceStats.total += 1;
      if (typeof s.value !== 'string') {
        err('schema-type', at, 'a source must be a URL string');
        continue;
      }
      const c = classifyUrl(s.value);
      if (!c.ok) {
        err('non-https', at, `not a valid URL: ${s.value}`);
        continue;
      }
      if (!c.https) err('non-https', at, `source is not https: ${s.value}`);
      else sourceStats.https += 1;
      if (c.api) {
        sourceStats.api += 1;
        const computed = node.computed === true;
        const method = isNonEmptyString(node.method) && node.method.trim().length >= MIN_METHOD_LENGTH;
        if (computed && method) sourceStats.computedApi += 1;
        else {
          err(
            'api-source',
            at,
            `API endpoint cited as a source (${s.value.slice(0, 90)}${s.value.length > 90 ? '...' : ''}); an endpoint is allowed only with computed: true and a method note (inputs, engine, date) in the same object`
          );
        }
      }
      if (DATE_QUERY.test(s.value)) warn('date-specific', at, 'the URL carries a date, so it is a one-day snapshot; say which day in the text and treat it as stale after that day');
    }
    if (node.computed !== undefined && node.computed !== true) {
      err('schema-type', `${p}.computed`, 'computed is either absent or true');
    }
    if (node.computed === true) {
      const m = isNonEmptyString(node.method) ? node.method.trim() : '';
      if (m.length < MIN_METHOD_LENGTH) {
        err('computed-method', `${p}.method`, 'computed: true needs a method note (at least a sentence: engine, inputs, what it measures, the date it was run)');
      } else if (!ISO_DAY.test(m)) {
        err('computed-method', `${p}.method`, 'the method note must carry the date the value was computed (YYYY-MM-DD)');
      }
      if (typeof node.hours === 'string' && node.hours.trim() !== '') {
        if (!(/free-flow/i.test(node.hours) && /computed/i.test(node.hours))) {
          err('computed-hours', `${p}.hours`, 'a computed time must say that it is a free-flow, computed figure, not a real journey time');
        }
        if (typeof node.km === 'number' && node.km > MAX_COMPUTED_HOURS_KM) {
          err('computed-hours', `${p}.hours`, `a computed time is not published for a leg of ${node.km} km (limit ${MAX_COMPUTED_HOURS_KM} km): set hours to null and publish the distance only`);
        }
      }
    } else if (node.method !== undefined) {
      warn('computed-flag', `${p}.method`, 'a method note without computed: true');
    }

    const hasSource = inherited || own.some((s) => typeof s.value === 'string' && s.value.trim() !== '');

    for (const [k, v] of Object.entries(node)) {
      if (SKIP_KEYS.has(k)) continue;
      const at = `${p}.${k}`;

      if (NUMBER_KEYS.has(k) && v !== null && v !== undefined) {
        if (typeof v !== 'number' || !Number.isFinite(v)) err('schema-type', at, `${k} must be a finite number, got ${JSON.stringify(v)}`);
      }
      if (typeof v === 'number' && !LABEL_NUMBER_KEYS.has(k) && !hasSource) {
        err('unsourced-value', at, `${k}: ${v} has no source URL in this object or its parent`);
      }
      if (k === 'hours' && v !== null && v !== undefined) {
        if (typeof v !== 'string') err('schema-type', at, 'hours must be a string or null');
        else if (v.trim() !== '' && !hasSource) err('unsourced-value', at, `hours "${v.slice(0, 60)}" has no source URL in this object or its parent`);
      }
      if (k === 'closed' && v !== null && v !== undefined) {
        if (typeof v !== 'string') err('schema-type', at, 'closed must be a string or null');
        else if (v.trim() !== '' && !hasSource) err('unsourced-value', at, `closed "${v.slice(0, 60)}" has no source URL in this object or its parent`);
      }
      if (k === 'free' && v !== null && v !== undefined) {
        if (typeof v !== 'boolean') err('schema-type', at, 'free must be true, false or null');
        else if (!hasSource) err('unsourced-value', at, `free: ${v} has no source URL in this object or its parent`);
      }
      if (k === 'fees') {
        if (!Array.isArray(v)) err('schema-type', at, 'fees must be an array (empty when no fee is sourced)');
        else if (v.length > 0 && !hasSource) err('unsourced-value', at, 'fees has entries but no source URL in this object or its parent');
      }
      if (TEXT_KEYS.includes(k) && typeof v === 'string' && v.trim() !== '' && !hasSource) {
        if (NUMBER_IN_TEXT.test(v)) err('unsourced-value', at, `${k} states a number or time but has no source URL in this object or its parent`);
        else warn('unsourced-text', at, `${k} has no source URL in this object or its parent`);
      }

      if (Array.isArray(v) || isObj(v)) walk(v, at, hasSource);
    }
  }
  for (const [k, v] of Object.entries(data)) {
    if (SKIP_KEYS.has(k)) continue;
    if (Array.isArray(v) || isObj(v)) walk(v, `$.${k}`, false);
  }

  // ---- stops ----------------------------------------------------------------
  const stopEntries = isObj(data.stops) ? Object.entries(data.stops) : Array.isArray(data.stops) ? data.stops.map((s, i) => [String(i + 1), s]) : [];
  if (data.stops !== undefined && !isObj(data.stops) && !Array.isArray(data.stops)) err('schema-type', '$.stops', 'stops must be an object keyed "1", "2", ... or an array');
  for (const [key, stop] of stopEntries) {
    const at = `$.stops.${key}`;
    if (!isObj(stop)) {
      err('schema-type', at, 'a stop must be an object');
      continue;
    }
    if (!isNonEmptyString(stop.name)) err('schema-type', `${at}.name`, 'a stop needs a name');
    for (const k of STOP_KEYS) if (!(k in stop)) err('schema-keys', `${at}.${k}`, `a stop has every key, with an explicit null for a fact that is not known; ${k} is missing`);
    for (const k of Object.keys(stop)) if (!STOP_KEYS.includes(k)) err('schema-keys', `${at}.${k}`, `unknown stop key ${k}; the stops of all files share one schema (${STOP_KEYS.join(', ')})`);
    if (stop.sources !== undefined && !Array.isArray(stop.sources)) err('schema-type', `${at}.sources`, 'sources must be an array of URLs');
    if (!Array.isArray(stop.sources) || stop.sources.length === 0) warn('stop-no-sources', `${at}.sources`, 'stop has no source URLs');
    for (const f of ['dress', 'shadeWater', 'notes']) {
      if (stop[f] !== undefined && stop[f] !== null && typeof stop[f] !== 'string') err('schema-type', `${at}.${f}`, `${f} must be a string or null`);
    }
  }

  // ---- the stops are the route's stops, in order ------------------------------
  if (routes instanceof Map || routesExplicit) {
    const names = routes instanceof Map && typeof data.route === 'string' ? routes.get(data.route) : undefined;
    if (!names) {
      if (routesExplicit) err('stop-names', '$.route', `route ${JSON.stringify(data.route)} is not in the routes file, so its stop names cannot be checked`);
    } else {
      const have = stopEntries.map(([, s]) => (isObj(s) ? s.name : undefined));
      const keys = stopEntries.map(([k]) => k);
      if (!keys.every((k, i) => k === String(i + 1))) err('stop-names', '$.stops', `stop keys must be "1", "2", ... in order, found ${keys.map((k) => JSON.stringify(k)).join(', ')}`);
      if (have.length !== names.length) err('stop-names', '$.stops', `the route has ${names.length} stop(s), this file has ${have.length}`);
      for (let i = 0; i < Math.min(have.length, names.length); i++) {
        if (have[i] !== names[i]) err('stop-names', `$.stops.${i + 1}.name`, `stop ${i + 1} is ${JSON.stringify(have[i])} here but ${JSON.stringify(names[i])} in the route`);
      }
    }
  }

  // ---- the shared schema: top level, site, origins ----------------------------------
  for (const k of TOP_KEYS) if (!(k in data)) err('schema-keys', `$.${k}`, `${k} is missing (all files have ${TOP_KEYS.join(', ')}; site is null when there is no site-level fact)`);
  for (const k of Object.keys(data)) if (!TOP_KEYS.includes(k)) err('schema-keys', `$.${k}`, `unknown top-level key ${k}; the files share one schema (${TOP_KEYS.join(', ')})`);
  if ('site' in data && data.site !== null && !isObj(data.site)) err('schema-type', '$.site', 'site must be an object or null');
  if (isObj(data.site)) {
    for (const k of Object.keys(data.site)) if (!['hours', 'sources'].includes(k)) err('schema-keys', `$.site.${k}`, `unknown site key ${k}; site has hours and sources`);
    if (data.site.hours !== undefined && data.site.hours !== null && typeof data.site.hours !== 'string') err('schema-type', '$.site.hours', 'site.hours must be a string or null');
  }
  const fromList = data.gettingThere?.from;
  if (data.gettingThere !== undefined && !Array.isArray(fromList)) err('schema-type', '$.gettingThere.from', 'gettingThere.from must be an array of origins');
  (Array.isArray(fromList) ? fromList : []).forEach((o, i) => {
    const at = `$.gettingThere.from[${i}]`;
    if (!isObj(o)) return err('schema-type', at, 'an origin must be an object');
    for (const k of ORIGIN_KEYS) if (!(k in o)) err('schema-keys', `${at}.${k}`, `an origin has city, road, rail and bus (null when not known); ${k} is missing`);
    for (const k of Object.keys(o)) if (!ORIGIN_KEYS.includes(k)) err('schema-keys', `${at}.${k}`, `unknown origin key ${k}`);
    if (!isObj(o.road)) err('schema-type', `${at}.road`, 'road must be an object: every origin has at least its road distance');
    else if (typeof o.road.km !== 'number' || !Number.isFinite(o.road.km)) err('schema-type', `${at}.road.km`, 'road.km must be a finite number');
    for (const k of ['rail', 'bus']) if (o[k] !== null && o[k] !== undefined && !isObj(o[k])) err('schema-type', `${at}.${k}`, `${k} must be an object or null`);
  });
  if (data.unsourced !== undefined) {
    if (!Array.isArray(data.unsourced) || !data.unsourced.every((g) => typeof g === 'string')) {
      err('schema-type', '$.unsourced', 'unsourced must be an array of strings');
    } else {
      data.unsourced.forEach((g, i) => {
        const hit = GAP_FIGURES.map((re) => g.match(re)).find(Boolean);
        if (hit) err('gap-note-figure', `$.unsourced[${i}]`, `the gap note holds a figure (${JSON.stringify(hit[0])}); this list is never shown, and a price, time or distance in it is a number nobody sourced`);
      });
    }
  }

  // ---- climate --------------------------------------------------------------
  const climate = data.climate;
  if (!isObj(climate)) {
    err('climate', '$.climate', 'climate is missing; it needs period, station, source and exactly 12 months');
  } else {
    if (!isNonEmptyString(climate.period)) err('climate', '$.climate.period', 'climate.period is missing (the normals period, e.g. 1991-2020)');
    if (!isNonEmptyString(climate.station)) err('climate', '$.climate.station', 'climate.station is missing (the IMD station the table is for)');
    const monthSources = Array.isArray(climate.months) ? climate.months.map((m) => isObj(m) && (isNonEmptyString(m.source) || (Array.isArray(m.sources) && m.sources.length > 0))) : [];
    if (!isNonEmptyString(climate.source) && !(monthSources.length === 12 && monthSources.every(Boolean))) {
      err('climate', '$.climate.source', 'climate.source is missing (the IMD table URL), and not every month carries its own');
    }
    if (!Array.isArray(climate.months) || climate.months.length !== 12) {
      err('climate', '$.climate.months', `climate needs exactly 12 months, found ${Array.isArray(climate.months) ? climate.months.length : 'none'}`);
    } else {
      const seen = new Set();
      climate.months.forEach((m, i) => {
        const at = `$.climate.months[${i}]`;
        if (!isObj(m)) return err('climate', at, 'month must be an object');
        if (!Number.isInteger(m.m) || m.m < 1 || m.m > 12) err('climate', `${at}.m`, `m must be an integer 1 to 12, got ${JSON.stringify(m.m)}`);
        else if (seen.has(m.m)) err('climate', `${at}.m`, `month ${m.m} appears twice`);
        else seen.add(m.m);
        for (const f of ['maxC', 'minC', 'rainMm']) {
          if (typeof m[f] !== 'number' || !Number.isFinite(m[f])) err('climate', `${at}.${f}`, `${f} must be a number for every month, got ${JSON.stringify(m[f])}`);
        }
        if (typeof m.maxC === 'number' && typeof m.minC === 'number' && m.maxC < m.minC) err('climate', at, `maxC ${m.maxC} is below minC ${m.minC}`);
        if (typeof m.rainMm === 'number' && m.rainMm < 0) err('climate', `${at}.rainMm`, 'rainMm cannot be negative');
      });
    }
  }

  // ---- coverage -------------------------------------------------------------
  const N = stopEntries.length;
  const stops = stopEntries.map(([, s]) => (isObj(s) ? s : {}));
  const count = (fn) => stops.filter(fn).length;
  const origins = Array.isArray(data.gettingThere?.from) ? data.gettingThere.from.filter(isObj) : [];
  const coverage = {
    stops: N,
    hours: count((s) => isNonEmptyString(s.hours)),
    closed: count((s) => isNonEmptyString(s.closed)),
    fees: count((s) => Array.isArray(s.fees) && s.fees.length > 0),
    free: count((s) => typeof s.free === 'boolean'),
    dress: count((s) => isNonEmptyString(s.dress)),
    shadeWater: count((s) => isNonEmptyString(s.shadeWater)),
    stopSources: count((s) => Array.isArray(s.sources) && s.sources.length > 0),
    climateMonths: Array.isArray(climate?.months) ? climate.months.filter((m) => isObj(m) && ['maxC', 'minC', 'rainMm'].every((f) => typeof m[f] === 'number')).length : 0,
    origins: origins.length,
    road: origins.filter((o) => isObj(o.road)).length,
    rail: origins.filter((o) => isObj(o.rail)).length,
    bus: origins.filter((o) => isObj(o.bus)).length,
    sources: sourceStats,
  };
  return { errors, warnings, coverage };
}

export function lintDirectory(dir, opts = {}) {
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .sort();
  return files.map((f) => {
    const full = path.join(dir, f);
    let data;
    try {
      data = JSON.parse(fs.readFileSync(full, 'utf8'));
    } catch (e) {
      return { file: f, errors: [{ rule: 'invalid-json', path: '$', message: String(e.message) }], warnings: [], coverage: null };
    }
    return { file: f, ...lintData(data, opts) };
  });
}

const frac = (n, d) => `${n}/${d}`;

export function formatReport(results, { dir, today, maxAgeDays }) {
  const lines = [];
  lines.push(`check-practical: ${results.length} file(s) in ${dir}`);
  lines.push(`today ${today}, checked-date limit ${maxAgeDays} days`);
  lines.push('');
  let errors = 0;
  let warnings = 0;
  for (const r of results) {
    errors += r.errors.length;
    warnings += r.warnings.length;
    lines.push(`${r.errors.length ? 'FAIL' : 'ok  '}  ${r.file}  (${r.errors.length} error(s), ${r.warnings.length} warning(s))`);
    for (const e of r.errors) lines.push(`      error   [${e.rule}] ${e.path}: ${e.message}`);
    for (const w of r.warnings) lines.push(`      warning [${w.rule}] ${w.path}: ${w.message}`);
    const c = r.coverage;
    if (c) {
      lines.push(
        `      coverage: stops ${c.stops} | hours ${frac(c.hours, c.stops)} | closed ${frac(c.closed, c.stops)} | fees ${frac(c.fees, c.stops)} | free flag ${frac(c.free, c.stops)} | dress ${frac(c.dress, c.stops)} | shade/water ${frac(c.shadeWater, c.stops)} | stops with sources ${frac(c.stopSources, c.stops)}`
      );
      lines.push(
        `                climate months ${frac(c.climateMonths, 12)} | origins ${c.origins}: road ${frac(c.road, c.origins)}, rail ${frac(c.rail, c.origins)}, bus ${frac(c.bus, c.origins)} | source URLs ${c.sources.total} (https ${c.sources.https}, API endpoints ${c.sources.api}, of which computed with a method ${c.sources.computedApi})`
      );
    }
    lines.push('');
  }
  const total = results.reduce((a, r) => (r.coverage ? { stops: a.stops + r.coverage.stops, hours: a.hours + r.coverage.hours, fees: a.fees + r.coverage.fees } : a), { stops: 0, hours: 0, fees: 0 });
  lines.push(`all files: stop hours ${frac(total.hours, total.stops)}, stop fees ${frac(total.fees, total.stops)}`);
  lines.push(errors ? `FAILED: ${errors} error(s), ${warnings} warning(s)` : `PASSED: 0 errors, ${warnings} warning(s)`);
  return { text: lines.join('\n'), errors, warnings };
}

const USAGE = `Usage: node scripts/check-practical.mjs [dir] [--today YYYY-MM-DD] [--max-age-days N] [--routes FILE]
  dir              directory of practical JSON files (default: content/practical)
  --today DATE     the date to measure 'checked' against (default: today, UTC)
  --max-age-days N how old 'checked' may be (default: ${DEFAULT_MAX_AGE_DAYS})
  --routes FILE    the routes file the stop names are checked against (default: content/routes.source.json,
                   used for the routes it lists; with this option every file's route must be in FILE)`;

export function main(argv, io = { out: (s) => console.log(s), err: (s) => console.error(s) }) {
  let dir = null;
  let today = todayUtc();
  let maxAgeDays = DEFAULT_MAX_AGE_DAYS;
  let routesFile = null;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--help' || a === '-h') {
      io.out(USAGE);
      return 0;
    }
    const takeValue = (name) => {
      if (a === name) return argv[++i];
      if (a.startsWith(`${name}=`)) return a.slice(name.length + 1);
      return undefined;
    };
    const t = takeValue('--today');
    if (t !== undefined || a === '--today') {
      if (parseDay(t) === null) {
        io.err(`--today needs a YYYY-MM-DD date, got ${JSON.stringify(t)}\n${USAGE}`);
        return 2;
      }
      today = t;
      continue;
    }
    const m = takeValue('--max-age-days');
    if (m !== undefined || a === '--max-age-days') {
      const n = Number(m);
      if (!Number.isInteger(n) || n < 0) {
        io.err(`--max-age-days needs a whole number, got ${JSON.stringify(m)}\n${USAGE}`);
        return 2;
      }
      maxAgeDays = n;
      continue;
    }
    const r = takeValue('--routes');
    if (r !== undefined || a === '--routes') {
      if (!isNonEmptyString(r)) {
        io.err(`--routes needs a file name\n${USAGE}`);
        return 2;
      }
      routesFile = r;
      continue;
    }
    if (a.startsWith('-')) {
      io.err(`unknown option ${a}\n${USAGE}`);
      return 2;
    }
    if (dir !== null) {
      io.err(`only one directory argument is allowed\n${USAGE}`);
      return 2;
    }
    dir = a;
  }
  const target = dir ? path.resolve(process.cwd(), dir) : DEFAULT_DIR;
  let st;
  try {
    st = fs.statSync(target);
  } catch {
    io.err(`not a directory: ${target}`);
    return 2;
  }
  if (!st.isDirectory()) {
    io.err(`not a directory: ${target}`);
    return 2;
  }
  let routes = null;
  if (routesFile) {
    routes = loadRouteStops(path.resolve(process.cwd(), routesFile));
    if (!routes) {
      io.err(`cannot read routes from ${routesFile}`);
      return 2;
    }
  } else {
    routes = loadRouteStops(DEFAULT_ROUTES);
  }
  const results = lintDirectory(target, { today, maxAgeDays, routes, routesExplicit: Boolean(routesFile) });
  if (results.length === 0) {
    io.err(`no .json files in ${target}`);
    return 2;
  }
  const report = formatReport(results, { dir: path.relative(process.cwd(), target) || '.', today, maxAgeDays });
  io.out(report.text);
  return report.errors ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  process.exitCode = main(process.argv.slice(2));
}
