import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  loadStores, validateAll, validateLedger, validateOpportunities, validateDecisions,
  validateGuardrails, gateG1, canAct, findSecrets, findPersonalData,
} from '../lib.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const TODAY = '2026-10-26';

/* Fake keys, joined at run time so this file never contains one whole: the
   secret scan reads every tracked file, tests included. */
const FAKE = {
  razorpay: ['rzp_', 'live_abcdef1234567890'].join(''),
  privateKey: ['-----BEGIN ', 'RSA PRIVATE KEY-----'].join(''),
  aws: ['AKIA', 'ABCDEFGHIJKLMNOP'].join(''),
};

const entry = (over = {}) => ({
  id: 'E-0001', claim: 'The trust pays for guides by hand each season',
  source: 'INT-001', quote: 'We pay the guides cash every season', date: '2026-10-20',
  collector: 'founder', origin: 'Trust A', tier: 'T2', ...over,
});

const opportunity = (over = {}) => ({
  id: 'O-001', title: 'Audio guide for trust-run sites', metric: { name: 'paid pilots signed' },
  status: 'candidate', evidence: ['E-0001', 'E-0002', 'E-0003'],
  compliance: { status: 'passed', checked_on: '2026-10-25' },
  redteam: { reviewed_on: '2026-10-25', points: [{ point: 'They may do this free', answered_by: ['E-0001'] }] },
  ...over,
});

const ledger3 = [entry(), entry({ id: 'E-0002', origin: 'Board B', source: 'INT-002' }), entry({ id: 'E-0003', origin: 'CSR C', source: 'INT-003', tier: 'T3' })];

test('the committed stores validate', () => {
  const { errors } = validateAll(loadStores(ROOT), { today: TODAY });
  assert.deepEqual(errors, []);
});

test('an unset daily cap is a warning, never silence', () => {
  const { warnings } = validateAll(loadStores(ROOT), { today: TODAY });
  assert.ok(warnings.some((warning) => /daily cost cap/.test(warning)));
});

test('ledger: a good entry passes', () => {
  assert.deepEqual(validateLedger([entry()], { today: TODAY }), []);
});

test('ledger: a claim without source, quote, date or tier is rejected', () => {
  for (const field of ['source', 'quote', 'date', 'tier', 'origin', 'collector', 'claim']) {
    const errors = validateLedger([entry({ [field]: undefined })], { today: TODAY });
    assert.ok(errors.length > 0, `${field} should be required`);
  }
});

test('ledger: bad sources, dates and duplicate ids are rejected', () => {
  assert.ok(validateLedger([entry({ source: 'my own notes' })], { today: TODAY }).length);
  assert.ok(validateLedger([entry({ date: '2026-02-30' })], { today: TODAY }).length);
  assert.ok(validateLedger([entry({ date: '2027-01-01' })], { today: TODAY }).length);
  assert.ok(validateLedger([entry({ date: '2026-10-28' })], { today: TODAY }).length);
  /* one day ahead is India's morning against a UTC checker: allowed */
  assert.deepEqual(validateLedger([entry({ date: '2026-10-27' })], { today: TODAY }), []);
  assert.ok(validateLedger([entry(), entry()], { today: TODAY }).some((error) => /duplicate/.test(error)));
});

test('ledger: simulated users cannot be above T0', () => {
  assert.ok(validateLedger([entry({ simulated: true, tier: 'T2' })], { today: TODAY }).some((error) => /T0/.test(error)));
  assert.deepEqual(validateLedger([entry({ simulated: true, tier: 'T0' })], { today: TODAY }), []);
});

test('G1: passes with T2+ from three independent origins and everything else in place', () => {
  const result = gateG1(opportunity(), ledger3);
  assert.equal(result.pass, true, result.reasons.join('; '));
});

test('G1: three entries from one origin are one source, not three', () => {
  const same = ledger3.map((item) => ({ ...item, origin: 'Trust A' }));
  const result = gateG1(opportunity(), same);
  assert.equal(result.pass, false);
  assert.match(result.reasons.join(' '), /3 independent origins, has 1/);
});

test('G1: opinion and stated intent do not count', () => {
  const weak = ledger3.map((item) => ({ ...item, tier: 'T1' }));
  assert.equal(gateG1(opportunity(), weak).pass, false);
});

test('G1: needs a metric, a passed compliance check, and a red team that has run and been answered', () => {
  assert.match(gateG1(opportunity({ metric: {} }), ledger3).reasons.join(' '), /metric/);
  assert.match(gateG1(opportunity({ compliance: { status: 'pending' } }), ledger3).reasons.join(' '), /compliance/);
  assert.match(gateG1(opportunity({ redteam: undefined }), ledger3).reasons.join(' '), /red team has not reviewed/);
  const open = opportunity({ redteam: { reviewed_on: '2026-10-25', points: [{ point: 'Unanswered', answered_by: [] }] } });
  assert.match(gateG1(open, ledger3).reasons.join(' '), /no evidence answer/);
});

test('opportunities: one cannot sit in the backlog while failing G1', () => {
  const errors = validateOpportunities([opportunity({ status: 'backlog', evidence: ['E-0001'] })], ledger3);
  assert.ok(errors.some((error) => /fails G1/.test(error)));
  assert.deepEqual(validateOpportunities([opportunity({ status: 'backlog' })], ledger3), []);
});

test('opportunities: evidence ids must exist in the ledger', () => {
  assert.ok(validateOpportunities([opportunity({ evidence: ['E-9999'] })], ledger3).some((error) => /not in the ledger/.test(error)));
});

test('decisions: an author cannot approve their own decision', () => {
  const decision = { id: 'D-0002', date: '2026-10-26', gate: 'G3', subject: 's', reason: 'r', result: 'pass', author: 'qa', approved_by: 'qa' };
  assert.ok(validateDecisions([decision], [], { today: TODAY }).some((error) => /own decision/.test(error)));
});

test('decisions: G2 and G4 pass only with a named human approver', () => {
  for (const gate of ['G2', 'G4']) {
    const decision = { id: 'D-0002', date: '2026-10-26', gate, subject: 's', reason: 'r', result: 'pass', author: 'tech-lead' };
    assert.ok(validateDecisions([decision], [], { today: TODAY }).some((error) => /named human approver/.test(error)));
    assert.deepEqual(validateDecisions([{ ...decision, approved_by: 'founder' }], [], { today: TODAY }), []);
  }
});

const rails = () => JSON.parse(JSON.stringify(loadStores(ROOT).guardrails));

test('guardrails: every role starts at Tier 1', () => {
  const { roles } = rails();
  assert.equal(Object.keys(roles).length, 16);
  for (const role of Object.values(roles)) assert.equal(role.tier, 1);
});

test('guardrails: Tier 2 needs 4 clean weeks, and credentials are not shared', () => {
  const g = rails();
  g.roles.qa.tier = 2; g.roles.qa.clean_weeks = 3;
  assert.ok(validateGuardrails(g).some((error) => /4 clean weeks/.test(error)));
  g.roles.qa.clean_weeks = 4;
  assert.deepEqual(validateGuardrails(g), []);
  g.roles.qa.credential = 'shared'; g.roles.security.credential = 'shared';
  assert.ok(validateGuardrails(g).some((error) => /shares credential/.test(error)));
});

test('canAct: Tier 1 may open a PR, not merge behind a flag', () => {
  const g = rails();
  assert.equal(canAct(g, 'qa', 'open_pr').allowed, true);
  assert.equal(canAct(g, 'qa', 'merge_behind_flag').allowed, false);
});

test('canAct: ask-first and never actions are a no for every role, even at Tier 2', () => {
  const g = rails();
  g.roles.payments.tier = 2; g.roles.payments.clean_weeks = 4;
  assert.match(canAct(g, 'payments', 'payments_change').reason, /ask first/);
  assert.match(canAct(g, 'payments', 'delete_backups').reason, /never/);
  assert.equal(canAct(g, 'payments', 'merge_behind_flag').allowed, true);
});

test('canAct: wiring analytics into pages waits for the founder', () => {
  assert.equal(canAct(rails(), 'data-analytics', 'wire_analytics_into_pages').allowed, false);
});

test('canAct: an unknown role or an unclassified action is a no, not a guess', () => {
  const g = rails();
  assert.equal(canAct(g, 'intern', 'open_pr').allowed, false);
  assert.equal(canAct(g, 'qa', 'rewrite_everything').allowed, false);
});

test('ledger: a name-free quote passes, contact details and keys are rejected', () => {
  assert.ok(validateLedger([entry({ quote: 'Call me on 9876543210' })], { today: TODAY }).some((error) => /phone number/.test(error)));
  assert.ok(validateLedger([entry({ quote: 'write to guide@example.org' })], { today: TODAY }).some((error) => /email address/.test(error)));
  assert.ok(validateLedger([entry({ claim: `key is ${FAKE.razorpay}` })], { today: TODAY }).some((error) => /Razorpay/.test(error)));
});

test('scanner: finds keys, ignores ordinary text', () => {
  assert.deepEqual(findSecrets(FAKE.privateKey), ['private key']);
  assert.deepEqual(findSecrets(FAKE.aws), ['AWS access key id']);
  assert.deepEqual(findSecrets('the sky is blue and sk-short is not a key'), []);
  assert.deepEqual(findPersonalData('route is 12.5 km, 2026-10-26'), []);
});
