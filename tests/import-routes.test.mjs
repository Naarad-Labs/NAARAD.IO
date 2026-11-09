/* scripts/import-routes.py and the catalogue half of scripts/build-routes.py.
   Each test works in its own copy of the source file (NAARAD_ROOT), so the
   repository is never touched. */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const REPO = new URL('../', import.meta.url).pathname;

function workspace() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'naarad-import-'));
  for (const dir of ['content', 'discover', 'routes']) fs.mkdirSync(path.join(root, dir));
  fs.copyFileSync(path.join(REPO, 'content/routes.source.json'), path.join(root, 'content/routes.source.json'));
  return root;
}

const run = (script, root, ...args) => spawnSync('python3', [path.join(REPO, 'scripts', script), ...args],
  { env: { ...process.env, NAARAD_ROOT: root }, encoding: 'utf8' });
const read = (root, file) => fs.readFileSync(path.join(root, file), 'utf8');
const source = (root) => JSON.parse(read(root, 'content/routes.source.json'));

const GPX = (name, points) => `<?xml version="1.0"?><gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1">`
  + `<trk><name>${name}</name><trkseg>${points.map(([la, lo]) => `<trkpt lat="${la}" lon="${lo}"/>`).join('')}</trkseg></trk></gpx>`;

test('the source rebuilds the two runtime files byte for byte', () => {
  const root = workspace();
  const result = run('build-routes.py', root, '--catalogue-only');
  assert.equal(result.status, 0, result.stderr);
  assert.equal(read(root, 'discover/seed-tours.json'), fs.readFileSync(path.join(REPO, 'discover/seed-tours.json'), 'utf8'));
  assert.equal(read(root, 'routes/geo-tracks.json'), fs.readFileSync(path.join(REPO, 'routes/geo-tracks.json'), 'utf8'));
});

test('a CSV adds catalogue rows with the next ids, blanks stay null, and a re-run adds nothing', () => {
  const root = workspace();
  const before = source(root).catalogue.length;
  const csv = path.join(root, 'in.csv');
  fs.writeFileSync(csv, 'Name,Location,Sport,Theme,Difficulty,Distance_km,Start_lat,Start_lng\n'
    + 'Gingee Fort Climb,"Gingee, Tamil Nadu",hike,Heritage Walk,hard,4.5,12.2533,79.4167\n'
    + 'Tiruvannamalai Girivalam,"Tiruvannamalai, Tamil Nadu",,,,,,\n');
  const first = run('import-routes.py', root, '--csv', csv);
  assert.equal(first.status, 0, first.stderr);
  const rows = source(root).catalogue;
  assert.equal(rows.length, before + 2);
  const [gingee, giri] = rows.slice(-2);
  const lastCur = Math.max(...rows.slice(0, before).filter((r) => r.id.startsWith('cur-')).map((r) => Number(r.id.slice(4))));
  assert.equal(gingee.id, `cur-${lastCur + 1}`);
  assert.equal(giri.id, `cur-${lastCur + 2}`);
  assert.equal(new Set(rows.map((r) => r.id)).size, rows.length, 'ids stay unique');
  assert.deepEqual([gingee.slug, gingee.sport, gingee.theme, gingee.distance_m], ['gingee-fort-climb', 'hike', 'heritage-walk', 4500]);
  assert.deepEqual([giri.sport, giri.theme, giri.difficulty, giri.distance_m, giri.start_lat], ['walk', null, null, null, null]);
  assert.equal(JSON.parse(read(root, 'discover/seed-tours.json')).tours.length, before + 2);   // the build ran

  const again = run('import-routes.py', root, '--csv', csv);
  assert.equal(again.status, 0);
  assert.match(again.stdout, /skipped \(already exists\): gingee-fort-climb/);
  assert.equal(source(root).catalogue.length, before + 2);
});

test('one bad row aborts the whole run and writes nothing', () => {
  const root = workspace();
  const original = read(root, 'content/routes.source.json');
  const csv = path.join(root, 'bad.csv');
  fs.writeFileSync(csv, 'name,location,sport,start_lat\nGood One,"Somewhere, India",walk,12.0\nBad One,"Elsewhere, India",skate,95\n');
  const result = run('import-routes.py', root, '--csv', csv);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /line 3: sport 'skate'/);
  assert.match(result.stderr, /line 3: start_lat 95\.0 is out of range/);
  assert.equal(read(root, 'content/routes.source.json'), original);
});

test('--dry-run reports and writes nothing', () => {
  const root = workspace();
  const original = read(root, 'content/routes.source.json');
  const csv = path.join(root, 'in.csv');
  fs.writeFileSync(csv, 'name,location\nDry Run Walk,"Nowhere, India"\n');
  const result = run('import-routes.py', root, '--csv', csv, '--dry-run');
  assert.equal(result.status, 0);
  assert.match(result.stdout, /would add: 1 catalogue rows, 0 tracks/);
  assert.equal(read(root, 'content/routes.source.json'), original);
});

test('a GPX folder becomes tracks: length measured on every point, thinned to --max-points, ends kept', () => {
  const root = workspace();
  const folder = path.join(root, 'gpx');
  fs.mkdirSync(folder);
  const line = Array.from({ length: 101 }, (_, i) => [12 + i * 0.001, 80]);     // 0.1 degrees of latitude, about 11.12 km
  fs.writeFileSync(path.join(folder, 'straight.gpx'), GPX('Straight Line Walk', line));
  fs.writeFileSync(path.join(folder, 'broken.gpx'), '<gpx>');
  const failed = run('import-routes.py', root, '--gpx', folder);
  assert.equal(failed.status, 1);
  assert.match(failed.stderr, /broken\.gpx: not valid XML/);

  fs.unlinkSync(path.join(folder, 'broken.gpx'));
  const ok = run('import-routes.py', root, '--gpx', folder, '--max-points', '11', '--type', 'nature-hike');
  assert.equal(ok.status, 0, ok.stderr);
  const track = source(root).tracks.at(-1);
  assert.equal(track.name, 'Straight Line Walk');
  assert.equal(track.type, 'nature-hike');
  assert.ok(Math.abs(track.dist_km - 11.12) < 0.05, `distance ${track.dist_km}`);
  assert.equal(track.coords.length, 11);
  assert.deepEqual(track.coords[0], [12, 80]);
  assert.deepEqual(track.coords.at(-1), [12.1, 80]);
  assert.equal(JSON.parse(read(root, 'routes/geo-tracks.json')).tracks.at(-1).name, 'Straight Line Walk');
});
