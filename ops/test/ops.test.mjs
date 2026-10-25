import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  loadStores, validateAll, validateLedger, validateOpportunities, validateDecisions,
  validateGuardrails, gateG1, canAct, findSecrets, findPersonalData, intake, lintGuide,
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
  estimates: { reach: 40, expected_move: 0.25, effort: 5, basis: ['E-0001'] },
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

test('intake: score is evidence tier x reach x expected move / effort, using the weakest of the top three origins', () => {
  /* tiers T2, T2, T3 -> the weakest leg is T2 = 2; 2 x 40 x 0.25 / 5 = 4 */
  const { scored, blocked } = intake([opportunity()], ledger3);
  assert.deepEqual(blocked, []);
  assert.equal(scored[0].score, 4);
  assert.equal(scored[0].tier, 'T2');
});

test('intake: a better quote does not rescue a thin leg', () => {
  const strongOne = [entry({ tier: 'T4' }), entry({ id: 'E-0002', origin: 'Board B', source: 'INT-002' }), entry({ id: 'E-0003', origin: 'CSR C', source: 'INT-003' })];
  assert.equal(intake([opportunity()], strongOne).scored[0].score, 4);
});

test('intake: nothing below T2, or without a metric, or with fewer than three origins, is scored', () => {
  const weak = ledger3.map((item) => ({ ...item, tier: 'T1' }));
  assert.match(intake([opportunity()], weak).blocked[0].reasons.join(' '), /below T2/);
  assert.match(intake([opportunity({ metric: {} })], ledger3).blocked[0].reasons.join(' '), /metric/);
  assert.match(intake([opportunity({ evidence: ['E-0001', 'E-0002'] })], ledger3).blocked[0].reasons.join(' '), /fewer than 3/);
});

test('intake: estimates must be positive numbers resting on ledger entries', () => {
  assert.match(intake([opportunity({ estimates: undefined })], ledger3).blocked[0].reasons.join(' '), /estimates are missing/);
  assert.match(intake([opportunity({ estimates: { reach: 0, expected_move: 0.1, effort: 1, basis: ['E-0001'] } })], ledger3).blocked[0].reasons.join(' '), /reach/);
  assert.match(intake([opportunity({ estimates: { reach: 1, expected_move: 0.1, effort: 1, basis: ['E-9999'] } })], ledger3).blocked[0].reasons.join(' '), /E-9999/);
});

test('intake: highest score first, top three marked', () => {
  const many = [1, 2, 3, 4].map((n) => opportunity({ id: `O-00${n}`, estimates: { reach: 10 * n, expected_move: 0.2, effort: 4, basis: ['E-0001'] } }));
  const { scored, top } = intake(many, ledger3);
  assert.deepEqual(scored.map((item) => item.id), ['O-004', 'O-003', 'O-002', 'O-001']);
  assert.equal(top.length, 3);
});

test('opportunities: a backlog item without sourced estimates is rejected', () => {
  const errors = validateOpportunities([opportunity({ status: 'backlog', estimates: undefined })], ledger3);
  assert.ok(errors.some((error) => /estimates are missing/.test(error)));
});

const goodGuide = `# Guide
## Questions
${[1, 2, 3, 4, 5, 6, 7, 8].map((n) => `${n}. Tell me about the last time you handled thing ${n}?`).join('\n')}
## Commitments to ask for
- Ask for 30 minutes next week, an introduction to the person who decides, or a paid pilot.
`;

test('guide lint: a past-tense guide with a commitments section passes', () => {
  assert.deepEqual(lintGuide(goodGuide), []);
});

test('guide lint: hypotheticals, opinions, prices, pitches and promises are rejected', () => {
  for (const bad of [
    'Would you use an audio guide?', 'Do you think visitors want this?', 'How much would you pay for it?',
    'If we built an app, what would it need?', 'Will you sign a pilot?', 'Do you like the idea?',
    'What if guides were free?', 'How does Naarad fit your work?', 'Where do you see this in the future?',
  ]) {
    assert.ok(lintGuide(`${goodGuide}\n- ${bad}`).length > 0, bad);
  }
});

test('guide lint: too few questions, no commitments section, or contact details are rejected', () => {
  assert.ok(lintGuide('# Guide\n1. Tell me about the last visit?\n').some((error) => /at least 8/.test(error)));
  assert.ok(lintGuide(goodGuide.replace('Commitments to ask for', 'Wrap up')).some((error) => /Commitments/.test(error)));
  assert.ok(lintGuide(`${goodGuide}\nCall 9876543210`).some((error) => /phone number/.test(error)));
});

test('guide lint: a "Do not" section may quote the bad questions it forbids', () => {
  const guide = `${goodGuide}\n## Do not ask\n- "Would you use this?"\n- "How much would you pay?"\n`;
  assert.deepEqual(lintGuide(guide), []);
  /* but the quoting ends at the next heading */
  assert.ok(lintGuide(`${guide}\n## More questions\n- Would you use this?\n`).length > 0);
});
