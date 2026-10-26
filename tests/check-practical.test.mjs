// node --test tests/
// Runs the real CLI (scripts/check-practical.mjs) against fixtures in a temp directory,
// so the exit code and the printed report are what verify.sh will see. The last tests run
// it on the committed content/practical files.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPT = path.join(ROOT, 'scripts', 'check-practical.mjs');
const TODAY = '2026-10-26';

const months = () =>
  Array.from({ length: 12 }, (_, i) => ({ m: i + 1, maxC: 30 + (i % 5), minC: 20 + (i % 4), rainMm: 10 * (i + 1) }));

/** A fixture that passes every rule. Tests clone it and break one thing. */
const clean = () => ({
  route: 'fixture-route',
  checked: '2026-10-15',
  site: null,
  gettingThere: {
    from: [
      {
        city: 'Chennai',
        road: {
          km: 150,
          hours: 'about 3 hours by taxi',
          source: 'https://www.example.org/page/where-is-the-place',
        },
        rail: { summary: 'A daily train runs, about 4 hours.', source: 'https://www.example.org/page/trains' },
        bus: null,
      },
      {
        city: 'Bengaluru',
        road: {
          km: 333,
          hours: null,
          source: 'https://router.project-osrm.org/route/v1/driving/77.5,12.9;79.8,12.0?overview=false',
          computed: true,
          method: 'OSRM public demo server, driving profile, origin 77.5,12.9 to destination 79.8,12.0, road distance only. Run 2026-10-15.',
        },
        rail: null,
        bus: null,
      },
      {
        city: 'Puducherry',
        road: {
          km: 13,
          hours: 'about 21 minutes of free-flow driving (computed, not a real journey time)',
          source: 'https://router.project-osrm.org/route/v1/driving/79.8,11.9;79.8,12.0?overview=false',
          computed: true,
          method: 'OSRM public demo server, driving profile, origin 79.8,11.9 to destination 79.8,12.0, free-flow time. Run 2026-10-15.',
        },
        rail: null,
        bus: null,
      },
    ],
    nearestStation: { name: 'Town Junction (TJ)', distanceKm: 15, source: 'https://www.example.org/page/transport' },
    nearestAirport: { name: 'Town Airport', distanceKm: 12, source: 'https://www.example.org/page/where-is-the-place' },
    timetables: [{ label: 'Indian Railways', url: 'https://www.indianrail.gov.in/enquiry/TBIS/TrainBetweenImportantStations.html' }],
    localTransport: { summary: 'Cycles can be hired 9 am to 5:30 pm.', source: 'https://www.example.org/page/transport' },
  },
  stops: {
    1: {
      name: 'First Stop',
      hours: '9 am to 5 pm',
      closed: null,
      fees: [],
      free: true,
      dress: 'Dress modestly.',
      shadeWater: null,
      notes: 'There is no entrance fee.',
      sources: ['https://www.example.org/page/first-stop'],
    },
    2: {
      name: 'Second Stop',
      hours: null,
      closed: null,
      fees: [],
      free: null,
      dress: null,
      shadeWater: null,
      notes: null,
      sources: ['https://www.example.org/page/second-stop'],
    },
  },
  climate: {
    station: 'Town (IMD index 12345)',
    period: '1991-2020',
    source: 'https://imdpune.gov.in/library/public/Climatological%20Tables%201991-2020.pdf',
    months: months(),
  },
  unsourced: ['A gap the editor knows about, with no figure in it, is never linted for sources.'],
});

function run(files, args = []) {
  const dir = mkdtempSync(path.join(tmpdir(), 'check-practical-'));
  try {
    for (const [name, data] of Object.entries(files)) {
      writeFileSync(path.join(dir, name), typeof data === 'string' ? data : JSON.stringify(data, null, 2));
    }
    const r = spawnSync(process.execPath, [SCRIPT, dir, '--today', TODAY, ...args], { encoding: 'utf8' });
    return { status: r.status, out: r.stdout + r.stderr };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** Runs against a routes file written next to the fixtures. */
function runWithRoutes(files, routes, args = []) {
  const dir = mkdtempSync(path.join(tmpdir(), 'check-practical-routes-'));
  try {
    const file = path.join(dir, 'routes.json');
    writeFileSync(file, JSON.stringify(routes));
    return run(files, ['--routes', file, ...args]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('a clean fixture passes and prints per-file coverage counts', () => {
  const r = run({ 'fixture.json': clean() });
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /PASSED: 0 errors/);
  assert.match(r.out, /fixture\.json/);
  assert.match(r.out, /stops 2 \| hours 1\/2/);
  assert.match(r.out, /fees 0\/2/);
  assert.match(r.out, /climate months 12\/12/);
  assert.match(r.out, /all files: stop hours 1\/2, stop fees 0\/2/);
});

test('an unsourced number fails (stop hours with no sources)', () => {
  const d = clean();
  d.stops[1].sources = [];
  const r = run({ 'fixture.json': d });
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /\[unsourced-value\] \$\.stops\.1\.hours/);
  assert.match(r.out, /\[unsourced-value\] \$\.stops\.1\.free/);
});

test('an unsourced distance fails (nearestStation without a source)', () => {
  const d = clean();
  delete d.gettingThere.nearestStation.source;
  const r = run({ 'fixture.json': d });
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /\[unsourced-value\] \$\.gettingThere\.nearestStation\.distanceKm/);
});

test('a distance that official pages disagree on may be null, with its note sourced', () => {
  const d = clean();
  d.gettingThere.nearestStation.distanceKm = null;
  d.gettingThere.nearestStation.note = 'Official pages differ: 12 km on one, 15 km on another.';
  assert.equal(run({ 'fixture.json': d }).status, 0);
  delete d.gettingThere.nearestStation.source;
  const r = run({ 'fixture.json': d });
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /\[unsourced-value\] \$\.gettingThere\.nearestStation\.note/);
});

test('an unsourced fee fails, a sourced one passes', () => {
  const bad = clean();
  bad.stops[1].fees = [{ label: 'Adult', amountInr: 40 }];
  bad.stops[1].sources = [];
  const r1 = run({ 'fixture.json': bad });
  assert.equal(r1.status, 1, r1.out);
  assert.match(r1.out, /\[unsourced-value\] \$\.stops\.1\.fees/);
  assert.match(r1.out, /\[unsourced-value\] \$\.stops\.1\.fees\[0\]\.amountInr/);

  const ok = clean();
  ok.stops[1].fees = [{ label: 'Adult', amountInr: 40 }];
  const r2 = run({ 'fixture.json': ok });
  assert.equal(r2.status, 0, r2.out);
  assert.match(r2.out, /fees 1\/2/);
});

test('a non-https source fails', () => {
  const d = clean();
  d.stops[1].sources = ['http://www.example.org/page/first-stop'];
  const r = run({ 'fixture.json': d });
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /\[non-https\] \$\.stops\.1\.sources\[0\]/);
});

test('a non-https timetable link fails too', () => {
  const d = clean();
  d.gettingThere.timetables[0].url = 'http://www.indianrail.gov.in/enquiry/';
  const r = run({ 'fixture.json': d });
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /\[non-https\] \$\.gettingThere\.timetables\[0\]\.url/);
});

test('a bare API-endpoint source fails (OSRM, KSRTC, erail data); a computed one with a method passes', () => {
  const d = clean();
  delete d.gettingThere.from[1].road.computed;
  delete d.gettingThere.from[1].road.method;
  d.gettingThere.from[0].bus = {
    summary: 'Buses run.',
    source: 'https://ksrtcapi.iamgds.com/api/resource/searchRoutesV4?fromCityID=1&toCityID=2&journeyDate=2026-10-23&mode=oneway',
  };
  d.gettingThere.from[0].rail.source = 'https://erail.in/rail/getTrains.aspx?Station_From=MS&Station_To=PDY&DataSource=0&Language=0&Cache=true';
  const r = run({ 'fixture.json': d });
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /\[api-source\] \$\.gettingThere\.from\[1\]\.road\.source/);
  assert.match(r.out, /\[api-source\] \$\.gettingThere\.from\[0\]\.bus\.source/);
  assert.match(r.out, /\[api-source\] \$\.gettingThere\.from\[0\]\.rail\.source/);
  assert.match(r.out, /\[date-specific\] \$\.gettingThere\.from\[0\]\.bus\.source/);

  const ok = run({ 'fixture.json': clean() });
  assert.equal(ok.status, 0, ok.out);
  assert.match(ok.out, /API endpoints 2, of which computed with a method 2/);
});

test('computed: true needs a method note that carries the date it was run', () => {
  const short = clean();
  short.gettingThere.from[1].road.method = 'x';
  const r1 = run({ 'fixture.json': short });
  assert.equal(r1.status, 1, r1.out);
  assert.match(r1.out, /\[computed-method\] \$\.gettingThere\.from\[1\]\.road\.method/);
  assert.match(r1.out, /\[api-source\]/);

  const undated = clean();
  undated.gettingThere.from[1].road.method = 'OSRM public demo server, driving profile, road distance only, run some time ago.';
  const r2 = run({ 'fixture.json': undated });
  assert.equal(r2.status, 1, r2.out);
  assert.match(r2.out, /\[computed-method\] .*date the value was computed/);

  const notTrue = clean();
  notTrue.gettingThere.from[1].road.computed = 'yes';
  assert.match(run({ 'fixture.json': notTrue }).out, /\[schema-type\] \$\.gettingThere\.from\[1\]\.road\.computed/);
});

test('a method note without computed: true is a warning, not an error', () => {
  const d = clean();
  d.gettingThere.from[0].road.method = 'Looked up by hand on 2026-10-15 from the page.';
  const r = run({ 'fixture.json': d });
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /warning \[computed-flag\] \$\.gettingThere\.from\[0\]\.road\.method/);
});

test('a computed time must say it is free-flow and computed, and is not published past 150 km', () => {
  const vague = clean();
  vague.gettingThere.from[2].road.hours = 'about 21 minutes';
  const r1 = run({ 'fixture.json': vague });
  assert.equal(r1.status, 1, r1.out);
  assert.match(r1.out, /\[computed-hours\] \$\.gettingThere\.from\[2\]\.road\.hours: a computed time must say/);

  const long = clean();
  long.gettingThere.from[1].road.hours = 'about 4.6 hours of free-flow driving (computed, not a real journey time)';
  const r2 = run({ 'fixture.json': long });
  assert.equal(r2.status, 1, r2.out);
  assert.match(r2.out, /\[computed-hours\] \$\.gettingThere\.from\[1\]\.road\.hours: a computed time is not published for a leg of 333 km/);

  // a time from an official page is not computed and is not limited
  assert.equal(run({ 'fixture.json': clean() }).status, 0);
});

test('a stale or missing checked date fails; 180 days passes, 181 fails', () => {
  const stale = clean();
  stale.checked = '2026-01-01';
  const r1 = run({ 'fixture.json': stale });
  assert.equal(r1.status, 1, r1.out);
  assert.match(r1.out, /\[stale-checked\] \$\.checked: checked 2026-01-01 is 298 days old at 2026-10-26/);

  const missing = clean();
  delete missing.checked;
  const r2 = run({ 'fixture.json': missing });
  assert.equal(r2.status, 1, r2.out);
  assert.match(r2.out, /\[stale-checked\] \$\.checked: missing/);

  const edge = clean();
  edge.checked = '2026-04-29'; // exactly 180 days before 2026-10-26
  assert.equal(run({ 'fixture.json': edge }).status, 0);
  edge.checked = '2026-04-28'; // 181 days
  assert.equal(run({ 'fixture.json': edge }).status, 1);

  const future = clean();
  future.checked = '2026-12-01';
  assert.equal(run({ 'fixture.json': future }).status, 1);
});

test('--today moves the window: the clean fixture goes stale on 2027-04-14', () => {
  const ok = run({ 'fixture.json': clean() }, ['--today', '2027-04-13']);
  assert.equal(ok.status, 0, ok.out);
  const stale = run({ 'fixture.json': clean() }, ['--today', '2027-04-14']);
  assert.equal(stale.status, 1, stale.out);
  assert.match(stale.out, /181 days old/);
});

test('climate needs exactly 12 months, with period, station and source', () => {
  const eleven = clean();
  eleven.climate.months.pop();
  const r1 = run({ 'fixture.json': eleven });
  assert.equal(r1.status, 1, r1.out);
  assert.match(r1.out, /exactly 12 months, found 11/);

  const noStation = clean();
  delete noStation.climate.station;
  assert.match(run({ 'fixture.json': noStation }).out, /\[climate\] \$\.climate\.station/);

  const noPeriod = clean();
  delete noPeriod.climate.period;
  assert.match(run({ 'fixture.json': noPeriod }).out, /\[climate\] \$\.climate\.period/);

  const noSource = clean();
  delete noSource.climate.source;
  assert.match(run({ 'fixture.json': noSource }).out, /\[climate\] \$\.climate\.source/);

  const dup = clean();
  dup.climate.months[11].m = 11;
  assert.match(run({ 'fixture.json': dup }).out, /month 11 appears twice/);

  const gap = clean();
  gap.climate.months[3].rainMm = null;
  assert.match(run({ 'fixture.json': gap }).out, /\[climate\] \$\.climate\.months\[3\]\.rainMm/);

  const none = clean();
  delete none.climate;
  assert.match(run({ 'fixture.json': none }).out, /\[climate\] \$\.climate: climate is missing/);
});

test('the three files keep one schema: top-level keys, stop keys and origin keys', () => {
  const noSite = clean();
  delete noSite.site;
  assert.match(run({ 'fixture.json': noSite }).out, /\[schema-keys\] \$\.site: site is missing/);

  const extra = clean();
  extra.verdict = 'good';
  assert.match(run({ 'fixture.json': extra }).out, /\[schema-keys\] \$\.verdict: unknown top-level key/);

  const stopMissing = clean();
  delete stopMissing.stops[2].shadeWater;
  const r1 = run({ 'fixture.json': stopMissing });
  assert.equal(r1.status, 1, r1.out);
  assert.match(r1.out, /\[schema-keys\] \$\.stops\.2\.shadeWater: .*explicit null/);

  const stopExtra = clean();
  stopExtra.stops[2].rating = 4.5;
  assert.match(run({ 'fixture.json': stopExtra }).out, /\[schema-keys\] \$\.stops\.2\.rating: unknown stop key/);

  const originMissing = clean();
  delete originMissing.gettingThere.from[0].bus;
  assert.match(run({ 'fixture.json': originMissing }).out, /\[schema-keys\] \$\.gettingThere\.from\[0\]\.bus/);

  const noRoad = clean();
  noRoad.gettingThere.from[0].road = null;
  assert.match(run({ 'fixture.json': noRoad }).out, /\[schema-type\] \$\.gettingThere\.from\[0\]\.road: road must be an object/);

  const noKm = clean();
  noKm.gettingThere.from[0].road.km = null;
  assert.match(run({ 'fixture.json': noKm }).out, /\[schema-type\] \$\.gettingThere\.from\[0\]\.road\.km/);
});

test('site hours need a source of their own', () => {
  const d = clean();
  d.site = { hours: 'Open from sunrise to sunset.', sources: ['https://www.example.org/page/site'] };
  assert.equal(run({ 'fixture.json': d }).status, 0);
  d.site.sources = [];
  const r = run({ 'fixture.json': d });
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /\[unsourced-value\] \$\.site\.hours/);
  d.site = 'sunrise to sunset';
  assert.match(run({ 'fixture.json': d }).out, /\[schema-type\] \$\.site: site must be an object or null/);
});

test('the stops must be the route\'s stops, in order, when the route is known', () => {
  const routes = { routes: [{ slug: 'fixture-route', stops: [{ name: 'First Stop' }, { name: 'Second Stop' }] }] };
  assert.equal(runWithRoutes({ 'fixture.json': clean() }, routes).status, 0);

  const reordered = { routes: [{ slug: 'fixture-route', stops: [{ name: 'Second Stop' }, { name: 'First Stop' }] }] };
  const r1 = runWithRoutes({ 'fixture.json': clean() }, reordered);
  assert.equal(r1.status, 1, r1.out);
  assert.match(r1.out, /\[stop-names\] \$\.stops\.1\.name: stop 1 is "First Stop" here but "Second Stop" in the route/);

  const longer = { routes: [{ slug: 'fixture-route', stops: [{ name: 'First Stop' }, { name: 'Second Stop' }, { name: 'Third Stop' }] }] };
  assert.match(runWithRoutes({ 'fixture.json': clean() }, longer).out, /\[stop-names\] \$\.stops: the route has 3 stop\(s\), this file has 2/);

  const holey = clean();
  holey.stops = { 1: holey.stops[1], 3: holey.stops[2] };
  assert.match(runWithRoutes({ 'fixture.json': holey }, routes).out, /\[stop-names\] \$\.stops: stop keys must be "1", "2"/);

  // with an explicit routes file, a route that is not in it is an error; with the default file it is skipped
  const other = { routes: [{ slug: 'some-other-route', stops: [] }] };
  assert.match(runWithRoutes({ 'fixture.json': clean() }, other).out, /\[stop-names\] \$\.route: route "fixture-route" is not in the routes file/);
  assert.equal(run({ 'fixture.json': clean() }).status, 0);
});

test('one bad file fails the run even when another file is clean, and both are listed', () => {
  const bad = clean();
  bad.stops[1].sources = ['http://www.example.org/x'];
  const r = run({ 'good.json': clean(), 'bad.json': bad });
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /ok\s+good\.json/);
  assert.match(r.out, /FAIL\s+bad\.json/);
  assert.match(r.out, /FAILED: 1 error\(s\)/);
});

test('invalid JSON and wrong types are errors, not crashes', () => {
  assert.equal(run({ 'broken.json': '{ not json' }).status, 1);
  const d = clean();
  d.gettingThere.nearestStation.distanceKm = '15 km';
  d.stops[1].fees = 'none';
  const r = run({ 'fixture.json': d });
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /\[schema-type\] \$\.gettingThere\.nearestStation\.distanceKm/);
  assert.match(r.out, /\[schema-type\] \$\.stops\.1\.fees/);
});

test('the unsourced gaps list is not linted for sources, but may not hold a figure', () => {
  const ok = clean();
  ok.unsourced = ['Bus fares (left out because they change)', 'http://not-a-source.example', 'IMD 1991-2020 normals for the town'];
  assert.equal(run({ 'fixture.json': ok }).status, 0);

  for (const [note, figure] of [
    ['Bus fares Rs 476 to Rs 1,328 on 23 October 2026', 'Rs 476'],
    ['Entry is ₹40 for adults', '₹40'],
    ['Departures at 7:30 and 13:30', '7:30'],
    ['Opens at 9 am', '9 am'],
    ['Ballari is about 65 km from the town', '65 km'],
    ['OSRM gives 4.2 hours against 6 to 7', '4.2 hours'],
    ['About 21 minutes with no traffic', '21 minutes'],
  ]) {
    const d = clean();
    d.unsourced = [note];
    const r = run({ 'fixture.json': d });
    assert.equal(r.status, 1, `${note}\n${r.out}`);
    assert.match(r.out, new RegExp(`\\[gap-note-figure\\] \\$\\.unsourced\\[0\\]: .*${figure.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`), note);
  }

  const notStrings = clean();
  notStrings.unsourced = [{ note: 'x' }];
  assert.match(run({ 'fixture.json': notStrings }).out, /\[schema-type\] \$\.unsourced: unsourced must be an array of strings/);
});

test('bad arguments exit 2', () => {
  assert.equal(spawnSync(process.execPath, [SCRIPT, '/no/such/dir/at/all'], { encoding: 'utf8' }).status, 2);
  assert.equal(spawnSync(process.execPath, [SCRIPT, '--today', 'yesterday'], { encoding: 'utf8' }).status, 2);
  assert.equal(spawnSync(process.execPath, [SCRIPT, '--nope'], { encoding: 'utf8' }).status, 2);
  assert.equal(spawnSync(process.execPath, [SCRIPT, '--routes', '/no/such/routes.json'], { encoding: 'utf8' }).status, 2);
  const help = spawnSync(process.execPath, [SCRIPT, '--help'], { encoding: 'utf8' });
  assert.equal(help.status, 0);
  assert.match(help.stdout, /Usage:/);
});

// ---- the committed content ------------------------------------------------

const PRACTICAL = ['hampi-heritage-trail', 'thanjavur-living-heritage', 'auroville-explorer'];
// The latest `checked` date among the files: "today" for the data tests, so they check the data and not the calendar.
// verify.sh runs the script on the real day, which is what makes the data go stale.
const latestChecked = PRACTICAL.map((slug) => JSON.parse(readFileSync(path.join(ROOT, 'content', 'practical', `${slug}.json`), 'utf8')).checked).sort().pop();

test('the committed content/practical files pass, with no warnings, and their stops are the routes\' stops', () => {
  const r = spawnSync(process.execPath, [SCRIPT, '--today', latestChecked, '--routes', path.join(ROOT, 'content', 'routes.source.json')], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /PASSED: 0 errors, 0 warning\(s\)/);
  for (const slug of PRACTICAL) assert.match(r.stdout, new RegExp(`ok\\s+${slug}\\.json`));
});

test('the committed files fail once they are older than the freshness window', () => {
  const day = new Date(Date.parse(`${latestChecked}T00:00:00Z`) + 400 * 86400000).toISOString().slice(0, 10);
  const r = spawnSync(process.execPath, [SCRIPT, '--today', day], { encoding: 'utf8' });
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.match(r.stdout, /\[stale-checked\] \$\.checked: checked \d{4}-\d{2}-\d{2} is \d+ days old/);
});
