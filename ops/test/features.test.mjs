import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadStores, readJson, readJsonl } from '../lib.mjs';
import { validateFeatures, validateFeatureLog, summarize, exportDashboard, STATUSES, EVENTS } from '../features.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const TODAY = '2026-10-26';
const ctx = { root: ROOT, decisionIds: new Set(['D-0004', 'D-0005']), evidenceIds: new Set(['E-0001']), today: TODAY };

const feature = (over = {}) => ({
  id: 'F-100', name: 'Offline route bundles', area: 'offline', summary: 'Keep a route on the device.',
  status: 'flagged', flag: 'naarad.flag.offline-bundles', origin: 'built-under-override',
  gates: { G1: 'override:D-0004', G2: 'not-required', G3: 'not-checked', G4: 'not-required' },
  metric: null, spec: null, tests: ['ops/test/features.test.mjs'], decisions: ['D-0004'], evidence: [], pr: [12], since: '2026-10-25',
  ...over,
});
const event = (over = {}) => ({ id: 'L-0001', ts: '2026-10-25', feature: 'F-100', type: 'status', actor: 'claude', detail: 'flagged', ref: 'PR 12', ...over });

test('a well-formed feature passes', () => {
  assert.deepEqual(validateFeatures([feature()], ctx), []);
});

test('ids must look like F-nnn and be unique', () => {
  assert.ok(validateFeatures([feature({ id: 'X1' })], ctx).some((e) => /id/.test(e)));
  assert.ok(validateFeatures([feature(), feature()], ctx).some((e) => /duplicate/.test(e)));
});

test('name, area, summary and since are required, and status must be a known one', () => {
  for (const key of ['name', 'area', 'summary', 'since']) {
    assert.ok(validateFeatures([feature({ [key]: '' })], ctx).length > 0, key);
  }
  assert.ok(validateFeatures([feature({ status: 'shipped' })], ctx).some((e) => /status/.test(e)));
  assert.ok(STATUSES.includes('flagged') && STATUSES.includes('live') && STATUSES.includes('idea'));
});

test('a flagged feature must name its flag, and a live or idea one must not pretend to have one', () => {
  assert.ok(validateFeatures([feature({ flag: null })], ctx).some((e) => /flag/.test(e)));
  assert.ok(validateFeatures([feature({ status: 'live', flag: 'x' })], ctx).some((e) => /flag/.test(e)));
});

test('a date in the future is rejected', () => {
  assert.ok(validateFeatures([feature({ since: '2026-12-01' })], ctx).some((e) => /since/.test(e)));
});

test('references must exist: spec and test files, decisions, evidence', () => {
  assert.ok(validateFeatures([feature({ spec: 'ops/specs/nope.md' })], ctx).some((e) => /spec/.test(e)));
  assert.ok(validateFeatures([feature({ tests: ['e2e/nope.spec.js'] })], ctx).some((e) => /tests/.test(e)));
  assert.ok(validateFeatures([feature({ decisions: ['D-9999'] })], ctx).some((e) => /D-9999/.test(e)));
  assert.ok(validateFeatures([feature({ evidence: ['E-9999'] })], ctx).some((e) => /E-9999/.test(e)));
});

test('gates are G1 to G4 with a known value, and an override must cite a decision that exists', () => {
  assert.ok(validateFeatures([feature({ gates: { G1: 'pass' } })], ctx).some((e) => /gates/.test(e)));
  assert.ok(validateFeatures([feature({ gates: { ...feature().gates, G1: 'maybe' } })], ctx).some((e) => /G1/.test(e)));
  assert.ok(validateFeatures([feature({ gates: { ...feature().gates, G1: 'override:D-9999' } })], ctx).some((e) => /D-9999/.test(e)));
});

test('a G1 "pass" needs evidence in the ledger: a feature cannot claim a gate it has no proof for', () => {
  assert.ok(validateFeatures([feature({ gates: { ...feature().gates, G1: 'pass' }, evidence: [] })], ctx).some((e) => /G1.*evidence/.test(e)));
  assert.deepEqual(validateFeatures([feature({ gates: { ...feature().gates, G1: 'pass' }, evidence: ['E-0001'] })], ctx), []);
});

test('only a feature built before the operating system, or under a logged override, may skip G1', () => {
  const gates = { G1: 'not-passed', G2: 'not-required', G3: 'not-checked', G4: 'not-required' };
  assert.ok(validateFeatures([feature({ gates, origin: 'planned', status: 'flagged' })], ctx).some((e) => /G1/.test(e)));
  assert.deepEqual(validateFeatures([feature({ gates, origin: 'pre-os', status: 'live', flag: null })], ctx), []);
});

test('an idea cannot carry a gate beyond not-passed', () => {
  assert.ok(validateFeatures([feature({ status: 'idea', flag: null, gates: { G1: 'not-passed', G2: 'approved', G3: 'not-checked', G4: 'not-required' } })], ctx).length > 0);
});

test('log: a good event passes; unknown features, types, dates and duplicate ids are rejected', () => {
  const features = [feature()];
  assert.deepEqual(validateFeatureLog([event()], features, { today: TODAY }), []);
  assert.ok(validateFeatureLog([event({ feature: 'F-999' })], features, { today: TODAY }).some((e) => /F-999/.test(e)));
  assert.ok(validateFeatureLog([event({ type: 'vibes' })], features, { today: TODAY }).some((e) => /type/.test(e)));
  assert.ok(validateFeatureLog([event({ ts: '2027-01-01' })], features, { today: TODAY }).some((e) => /ts/.test(e)));
  assert.ok(validateFeatureLog([event(), event()], features, { today: TODAY }).some((e) => /duplicate/.test(e)));
  assert.ok(validateFeatureLog([event({ detail: '' })], features, { today: TODAY }).some((e) => /detail/.test(e)));
  assert.ok(EVENTS.includes('status') && EVENTS.includes('gate') && EVENTS.includes('note'));
});

test('log: no contact details or keys in an event', () => {
  assert.ok(validateFeatureLog([event({ detail: `call ${['98765', '43210'].join('')}` })], [feature()], { today: TODAY }).some((e) => /phone/.test(e)));
});

test('summarize counts by status and area and lists what needs the founder', () => {
  const features = [feature(), feature({ id: 'F-101', status: 'live', flag: null, origin: 'pre-os', gates: { G1: 'not-passed', G2: 'not-required', G3: 'not-checked', G4: 'not-required' } }),
    feature({ id: 'F-102', status: 'designed', flag: null, gates: { G1: 'override:D-0004', G2: 'proposed:D-0005', G3: 'not-checked', G4: 'not-required' } })];
  const s = summarize(features);
  assert.deepEqual(s.byStatus, { flagged: 1, live: 1, designed: 1 });
  assert.equal(s.byArea.offline, 3);
  assert.deepEqual(s.awaitingFounder.map((f) => f.id), ['F-102']);
});

test('the dashboard export is plain data: features with their last event, the log, a count, and no clock', () => {
  const features = [feature()];
  const log = [event({ id: 'L-0001', ts: '2026-10-24' }), event({ id: 'L-0002', ts: '2026-10-25', detail: 'newer' })];
  const out = exportDashboard(features, log);
  assert.equal(out.schema, 1);
  assert.equal(out.features[0].lastEvent.id, 'L-0002');
  assert.equal(out.log.length, 2);
  assert.equal(out.summary.total, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(out)), out);
  assert.equal(JSON.stringify(exportDashboard(features, log)), JSON.stringify(exportDashboard(features, log)));
});

test('G2 and G4 may be "required": the gate applies and nothing has been decided yet', () => {
  const gates = { G1: 'override:D-0004', G2: 'required', G3: 'not-checked', G4: 'required' };
  assert.deepEqual(validateFeatures([feature({ gates })], ctx), []);
  assert.ok(validateFeatures([feature({ gates: { ...gates, G2: 'sometime' } })], ctx).some((e) => /G2/.test(e)));
});

test('the committed register and log validate against the real decisions, evidence and files', () => {
  const stores = loadStores(ROOT);
  const features = readJson(path.join(ROOT, 'ops', 'features', 'features.json'), []);
  const log = readJsonl(path.join(ROOT, 'ops', 'features', 'log.jsonl'));
  const context = { root: ROOT, decisionIds: new Set(stores.decisions.map((d) => d.id)), evidenceIds: new Set(stores.ledger.map((e) => e.id)), today: TODAY };
  assert.deepEqual(validateFeatures(features, context), []);
  assert.deepEqual(validateFeatureLog(log, features, { today: TODAY }), []);
  assert.ok(features.length >= 20 && log.length >= 20);
});
