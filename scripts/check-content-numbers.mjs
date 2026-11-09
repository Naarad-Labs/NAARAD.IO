#!/usr/bin/env node
/* Lint content/*.json: require sources for factual numbers.
 *
 *   node scripts/check-content-numbers.mjs                      # lint all content/*.json
 *   node scripts/check-content-numbers.mjs content/routes.json  # lint specific file
 *   node scripts/check-content-numbers.mjs --today 2026-12-01  # dates in sources must be recent
 *
 * Exit code: 0 clean, 1 at least one error, 2 bad arguments.
 * Zero dependencies, Node 18+. Part of verify.sh.
 *
 * Rules (the rule id is printed in square brackets):
 *   unsourced-number  a factual number without a source field in the same object or ancestor
 *   number-in-text    a number appearing in textual content (summary, story, body, lede, overview)
 *
 * What counts as a factual number:
 *   - Numeric fields like km, distanceKm, maxC, minC, rainMm when no source exists
 *   - Numbers appearing in textual fields (summary, story, body, etc.)
 *
 * Not linted:
 *   - `note` field (file metadata, not editorial content)
 *   - `id`, `index`, `order`, `number`, `width`, `aspect` fields (labels, not facts)
 *   - `distanceM`, `elevationM`, `durationMin`, `ascentM`, `descentM`, `stopCount` (computed metrics)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Keys whose numeric values are facts that need sources
const FACT_NUMBER_KEYS = new Set([
  'km', 'distanceKm', 'maxC', 'minC', 'rainMm', 'minutes', 'hours',
  'steps', 'widthM', 'lengthM', 'heightCm',
]);

// Keys that are labels/identifiers, not facts
const LABEL_NUMBER_KEYS = new Set([
  'id', 'index', 'order', 'number', 'width', 'aspect',
]);

// Keys whose numeric values are technical/computed metadata, not editorial facts
const META_NUMBER_KEYS = new Set([
  'distanceM', 'elevationM', 'durationMin', 'ascentM', 'descentM', 'stopCount',
]);

// Text fields that may contain factual numbers
const FACT_TEXT_KEYS = ['summary', 'story', 'body', 'lede', 'overview', 'caption', 'heading'];

// Keys that are sources (URLs or source strings)
const SOURCE_KEYS = ['source', 'sourcePage', 'sources'];

/** Find all content/*.json files */
export function findContentFiles(rootDir) {
  const contentDir = path.join(rootDir, 'content');
  const files = [];
  const entries = fs.readdirSync(contentDir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isFile() && entry.name.endsWith('.json')) {
      files.push(path.join(contentDir, entry.name));
    }
  }
  return files;
}

/** Check a values object for unsourced numbers, tracking sources as we descend.
 * Returns true if we should skip this object's children (for 'note' field, etc.)
 */
function checkObject(obj, path, sources, errors, skipChildren, depth) {
  if (!obj || typeof obj !== 'object') return false;

  for (const key of Object.keys(obj)) {
    const value = obj[key];
    const currentPath = path ? `${path}.${key}` : key;

    if (value === null || value === undefined) continue;

    // Skip 'note' field and its children - it's file metadata
    if (key === 'note') continue;

    if (typeof value === 'number') {
      if (FACT_NUMBER_KEYS.has(key)) {
        const hasSource = sources.length > 0;
        if (!hasSource) {
          errors.push({
            rule: 'unsourced-number',
            path: currentPath,
            message: `fact number ${value} in '${key}' needs a source`,
          });
        }
      }
      // Don't recurse into number values
      continue;
    }

    if (Array.isArray(value)) {
      // Handle arrays (numbers, objects, or mixed)
      for (let i = 0; i < value.length; i++) {
        const item = value[i];
        if (item !== null && typeof item === 'object') {
          checkObject(item, `${currentPath}[${i}]`, sources, errors, false, depth + 1);
        }
      }
    } else if (typeof value === 'object') {
      const newSources = [...sources];
      for (const srcKey of SOURCE_KEYS) {
        if (value[srcKey]) newSources.push(value[srcKey]);
      }
      checkObject(value, currentPath, newSources, errors, false, depth + 1);
    }
  }

  return false;
}

/** Check text fields for embedded numbers; an ancestor's source field covers them */
function checkTextNumbers(obj, path, sources, errors) {
  if (!obj || typeof obj !== 'object') return;

  for (const key of Object.keys(obj)) {
    const value = obj[key];
    const currentPath = path ? `${path}.${key}` : key;

    // Skip 'note' - it's file metadata, not editorial content
    if (key === 'note') continue;

    const hasSource = sources.length > 0;
    if (typeof value === 'string') {
      if (FACT_TEXT_KEYS.includes(key)) {
        const numberPattern = /\b\d+\.?\d*\b/g;
        const matches = value.match(numberPattern);
        if (matches && matches.length > 0 && !hasSource) {
          errors.push({
            rule: 'number-in-text',
            path: currentPath,
            message: `found numbers (${matches.slice(0, 3).join(', ')}${matches.length > 3 ? ', ...' : ''}) in text - needs a source or removal if not factual`,
          });
        }
      }
    } else if (Array.isArray(value)) {
      for (const item of value) {
        if (item !== null && typeof item === 'object') {
          const newSources = [...sources];
          for (const srcKey of SOURCE_KEYS) {
            if (item[srcKey]) newSources.push(item[srcKey]);
          }
          checkTextNumbers(item, currentPath, newSources, errors);
        }
      }
    } else if (typeof value === 'object' && value !== null) {
      const newSources = [...sources];
      for (const srcKey of SOURCE_KEYS) {
        if (value[srcKey]) newSources.push(value[srcKey]);
      }
      checkTextNumbers(value, currentPath, newSources, errors);
    }
  }
}

export function check(files, options = {}) {
  const errors = [];

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    try {
      const data = JSON.parse(content);
      checkObject(data, '', [], errors, false, 0);
      checkTextNumbers(data, '', [], errors);
    } catch (e) {
      errors.push({
        rule: 'invalid-json',
        file,
        message: `invalid JSON: ${e.message}`,
      });
    }
  }

  return errors;
}

const USAGE = `Usage: node scripts/check-content-numbers.mjs [OPTIONS] FILE...
  Checks content/*.json files for unsourced numbers.

  OPTIONS:
    --today DATE       pretend today is DATE (YYYY-MM-DD), for freshness checks

  Without arguments, checks all content/*.json files.
  Exit codes: 0 (clean), 1 (unsourced numbers found), 2 (bad arguments).

  WHAT IS LINTED:
    - Numeric fields: km, distanceKm, hours, steps, elevationM, etc.
    - Text fields: summary, story, body, lede, overview, caption, heading

  NOT LINTED:
    - 'note' field (file metadata)
    - 'id', 'index', 'order', 'number', 'width', 'aspect' (labels)
    - 'distanceM', 'elevationM', 'durationMin', 'ascentM', 'descentM', 'stopCount' (computed metrics)`

export function main(argv, io = { out: (s) => console.log(s), err: (s) => console.error(s) }) {
  let today = null;
  let files = [];

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--help' || a === '-h') {
      io.out(USAGE);
      return 0;
    }
    if (a === '--today' && i + 1 < argv.length) {
      today = argv[++i];
      continue;
    }
    if (a.startsWith('--today=')) {
      today = a.slice(7);
      continue;
    }
    if (a.startsWith('-')) {
      io.err(`unknown option ${a}\n${USAGE}`);
      return 2;
    }
    files.push(path.resolve(process.cwd(), a));
  }

  if (files.length === 0) {
    files = findContentFiles(ROOT);
  }

  const problems = check(files, { today });

  if (problems.length === 0) {
    io.out('No problems found');
    return 0;
  }

  for (const p of problems) {
    const location = p.file || p.path;
    io.out(`[number-problem] ${location}: ${p.message}`);
  }

  const summary = `${problems.length} number${problems.length === 1 ? '' : 's'} found needing sources`;
  io.out(summary);

  return 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  process.exitCode = main(process.argv.slice(2));
}