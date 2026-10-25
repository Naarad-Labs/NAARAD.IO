/* The rules of the Startup Operating System, as code.
 *
 * The evidence ledger, the opportunity backlog, the decision log and the
 * guardrails are plain files under ops/. This module reads them and answers
 * three questions without anyone's opinion in the loop:
 *
 *   validate*  is every entry well formed (a claim with no source, quote, date
 *              or tier is rejected, not tidied up)
 *   gateG1     may this opportunity enter the backlog
 *   canAct     may this role do this thing alone
 *
 * Nothing here reads the clock or the network: pass `today` in, so a run on
 * the same files gives the same answer. scripts/ops.mjs is the command line.
 */

import fs from 'node:fs';
import path from 'node:path';

export const TIERS = ['T0', 'T1', 'T2', 'T3', 'T4'];
const tierRank = (tier) => TIERS.indexOf(tier);

/* G1 asks for past behaviour or better (T2+) from this many independent parties. */
export const G1_MIN_TIER = 'T2';
export const G1_MIN_ORIGINS = 3;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const URL_SOURCE = /^https?:\/\/\S+$/;
const INTERVIEW_SOURCE = /^INT-\d{3,}$/;

const isText = (value) => typeof value === 'string' && value.trim().length > 0;

/* The repository is public. Keys and people's contact details must never be in it. */
const SECRET_PATTERNS = [
  ['private key', /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ['AWS access key id', /\bAKIA[0-9A-Z]{16}\b/],
  ['Razorpay live key', /\brzp_live_[A-Za-z0-9]{10,}\b/],
  ['secret API key', /\bsk-[A-Za-z0-9_-]{20,}\b/],
  ['GitHub token', /\bgh[pousr]_[A-Za-z0-9]{30,}\b/],
];
const PERSONAL_PATTERNS = [
  ['email address', /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i],
  ['phone number', /(?:\+?91[\s-]?)?\b[6-9]\d{9}\b/],
];

export const findSecrets = (text) => SECRET_PATTERNS.filter(([, pattern]) => pattern.test(text)).map(([name]) => name);
export const findPersonalData = (text) => PERSONAL_PATTERNS.filter(([, pattern]) => pattern.test(text)).map(([name]) => name);

/* `today` is the checker's UTC date. Naarad writes dates in India time, which is
   a day ahead of UTC for the first five and a half hours of every day, so an
   entry dated tomorrow-in-UTC is today's work, not a date in the future. */
function isRealDate(value, today) {
  if (!ISO_DATE.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) return false;
  if (!today) return true;
  const latest = new Date(`${today}T00:00:00Z`);
  latest.setUTCDate(latest.getUTCDate() + 1);
  return value <= latest.toISOString().slice(0, 10);
}

/* ---- reading the files ---- */

export function readJsonl(file) {
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, 'utf8').split('\n')
    .map((line, index) => ({ line: line.trim(), number: index + 1 }))
    .filter(({ line }) => line && !line.startsWith('#'))
    .map(({ line, number }) => {
      try { return JSON.parse(line); } catch (error) {
        throw new Error(`${path.basename(file)} line ${number}: not valid JSON (${error.message})`);
      }
    });
}

export function readJson(file, fallback) {
  if (!fs.existsSync(file)) return fallback;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

export function loadStores(root) {
  const dir = path.join(root, 'ops');
  return {
    ledger: readJsonl(path.join(dir, 'evidence', 'ledger.jsonl')),
    opportunities: readJson(path.join(dir, 'backlog', 'opportunities.json'), []),
    decisions: readJsonl(path.join(dir, 'decisions', 'decision-log.jsonl')),
    guardrails: readJson(path.join(dir, 'guardrails.json'), null),
  };
}

/* ---- evidence ledger ---- */

export function validateLedger(entries, { today } = {}) {
  const errors = [];
  const seen = new Set();
  entries.forEach((entry, index) => {
    const where = entry && entry.id ? entry.id : `entry ${index + 1}`;
    const fail = (message) => errors.push(`${where}: ${message}`);

    if (!/^E-\d{4,}$/.test(entry.id || '')) fail('id must look like E-0001');
    else if (seen.has(entry.id)) fail('duplicate id');
    else seen.add(entry.id);

    if (!isText(entry.claim)) fail('claim is missing');
    if (!isText(entry.quote)) fail('verbatim quote is missing (a claim without its words is deleted)');
    if (!isText(entry.collector)) fail('collector is missing');
    if (!isText(entry.origin)) fail('origin is missing: name the independent party this came from');
    if (!isText(entry.source) || !(URL_SOURCE.test(entry.source) || INTERVIEW_SOURCE.test(entry.source))) {
      fail('source must be a URL or an interview id like INT-001');
    }
    if (!isRealDate(entry.date, today)) fail('date must be a real YYYY-MM-DD date, not in the future');
    if (tierRank(entry.tier) === -1) fail(`tier must be one of ${TIERS.join(', ')}`);
    if (entry.simulated === true && entry.tier !== 'T0') fail('simulated users are opinion: tier must be T0');
    if (entry.opportunities !== undefined && !Array.isArray(entry.opportunities)) fail('opportunities must be a list of ids');
    const words = `${entry.claim || ''} ${entry.quote || ''} ${entry.origin || ''}`;
    findPersonalData(words).forEach((kind) => fail(`contains a ${kind}: the repository is public, use the interview id instead`));
    findSecrets(words).forEach((kind) => fail(`contains a ${kind}`));
  });
  return errors;
}

/* ---- opportunities and gate G1 ---- */

export function validateOpportunities(opportunities, ledger) {
  const errors = [];
  const ids = new Set(ledger.map((entry) => entry.id));
  const seen = new Set();
  opportunities.forEach((opportunity, index) => {
    const where = opportunity && opportunity.id ? opportunity.id : `opportunity ${index + 1}`;
    const fail = (message) => errors.push(`${where}: ${message}`);

    if (!/^O-\d{3,}$/.test(opportunity.id || '')) fail('id must look like O-001');
    else if (seen.has(opportunity.id)) fail('duplicate id');
    else seen.add(opportunity.id);

    if (!isText(opportunity.title)) fail('title is missing');
    if (!opportunity.metric || !isText(opportunity.metric.name)) fail('one named outcome metric is required');
    if (!['candidate', 'backlog'].includes(opportunity.status)) fail('status must be candidate or backlog');
    (opportunity.evidence || []).forEach((id) => { if (!ids.has(id)) fail(`evidence ${id} is not in the ledger`); });
    ((opportunity.redteam && opportunity.redteam.points) || []).forEach((point, n) => {
      (point.answered_by || []).forEach((id) => { if (!ids.has(id)) fail(`red-team point ${n + 1} cites ${id}, not in the ledger`); });
    });
    if (opportunity.status === 'backlog') {
      const gate = gateG1(opportunity, ledger);
      if (!gate.pass) fail(`is in the backlog but fails G1: ${gate.reasons.join('; ')}`);
    }
  });
  return errors;
}

/* G1, into the backlog: T2+ evidence from 3+ independent parties, one named
   metric, the compliance check passed, and every red-team kill point answered
   with evidence by a review that has actually run. */
export function gateG1(opportunity, ledger) {
  const reasons = [];
  const byId = new Map(ledger.map((entry) => [entry.id, entry]));
  const linked = (opportunity.evidence || []).map((id) => byId.get(id)).filter(Boolean);

  const strong = linked.filter((entry) => tierRank(entry.tier) >= tierRank(G1_MIN_TIER));
  const origins = new Set(strong.map((entry) => entry.origin.trim().toLowerCase()));
  if (origins.size < G1_MIN_ORIGINS) {
    reasons.push(`needs ${G1_MIN_TIER}+ evidence from ${G1_MIN_ORIGINS} independent origins, has ${origins.size}`);
  }

  if (!opportunity.metric || !isText(opportunity.metric.name)) reasons.push('no outcome metric named');

  if (!opportunity.compliance || opportunity.compliance.status !== 'passed') {
    reasons.push('compliance check has not passed');
  }

  const redteam = opportunity.redteam;
  if (!redteam || !isRealDate(redteam.reviewed_on || '')) {
    reasons.push('the red team has not reviewed it');
  } else {
    const unanswered = (redteam.points || []).filter((point) => !(point.answered_by || []).some((id) => byId.has(id)));
    if (unanswered.length) reasons.push(`${unanswered.length} red-team kill point(s) have no evidence answer`);
  }

  return { pass: reasons.length === 0, reasons, origins: [...origins] };
}

/* ---- decision log ---- */

export function validateDecisions(decisions, ledger, { today } = {}) {
  const errors = [];
  const ids = new Set(ledger.map((entry) => entry.id));
  const seen = new Set();
  decisions.forEach((decision, index) => {
    const where = decision && decision.id ? decision.id : `decision ${index + 1}`;
    const fail = (message) => errors.push(`${where}: ${message}`);

    if (!/^D-\d{4,}$/.test(decision.id || '')) fail('id must look like D-0001');
    else if (seen.has(decision.id)) fail('duplicate id');
    else seen.add(decision.id);

    if (!isRealDate(decision.date, today)) fail('date must be a real YYYY-MM-DD date, not in the future');
    if (!['adopt', 'G1', 'G2', 'G3', 'G4', 'learn'].includes(decision.gate)) fail('gate must be adopt, G1, G2, G3, G4 or learn');
    if (!isText(decision.subject)) fail('subject is missing');
    if (!isText(decision.reason)) fail('reason is missing');
    if (!['pass', 'fail', 'proposed'].includes(decision.result)) fail('result must be pass, fail or proposed');
    if (!isText(decision.author)) fail('author is missing');
    (decision.evidence || []).forEach((id) => { if (!ids.has(id)) fail(`evidence ${id} is not in the ledger`); });

    /* Hard rule 1: the same agent never writes and approves its own change. */
    if (decision.approved_by && decision.approved_by === decision.author) fail('the author cannot approve their own decision');
    /* G2 and G4 are the founder's: a pass there needs a named approver. */
    if (['G2', 'G4'].includes(decision.gate) && decision.result === 'pass' && !isText(decision.approved_by)) {
      fail(`${decision.gate} passes only with a named human approver`);
    }
  });
  return errors;
}

/* ---- guardrails ---- */

export function validateGuardrails(guardrails) {
  const errors = [];
  if (!guardrails) return ['ops/guardrails.json is missing'];
  const fail = (message) => errors.push(`guardrails: ${message}`);

  const roles = guardrails.roles || {};
  const scopes = new Map();
  Object.entries(roles).forEach(([name, role]) => {
    if (![0, 1, 2].includes(role.tier)) fail(`${name}: tier must be 0, 1 or 2 (Tier 3 is a kind of action, not a place to promote a role)`);
    if (role.tier === 2 && !(role.clean_weeks >= 4)) fail(`${name}: Tier 2 needs 4 clean weeks first`);
    if (role.credential) {
      if (scopes.has(role.credential)) fail(`${name} shares credential "${role.credential}" with ${scopes.get(role.credential)}`);
      scopes.set(role.credential, name);
    }
  });

  Object.entries(guardrails.actions || {}).forEach(([action, rule]) => {
    const valid = [0, 1, 2].includes(rule) || rule === 'ask' || rule === 'never';
    if (!valid) fail(`action ${action}: rule must be 0, 1, 2, "ask" or "never"`);
  });
  return errors;
}

/* May this role do this action alone? 'ask' (Tier 3) and 'never' are never a
   yes: the first needs the founder's logged approval, the second is the
   founder's alone. An action nobody has classified is a no, not a guess. */
export function canAct(guardrails, roleName, action) {
  const role = guardrails.roles && guardrails.roles[roleName];
  if (!role) return { allowed: false, reason: `unknown role "${roleName}"` };
  const rule = guardrails.actions && guardrails.actions[action];
  if (rule === undefined) return { allowed: false, reason: `action "${action}" is not classified in guardrails.json` };
  if (rule === 'never') return { allowed: false, reason: `"${action}" is never an agent's: only the founder does it` };
  if (rule === 'ask') return { allowed: false, reason: `"${action}" is Tier 3: ask first and log the approval` };
  if (role.tier >= rule) return { allowed: true, reason: `${roleName} is Tier ${role.tier}, "${action}" needs Tier ${rule}` };
  return { allowed: false, reason: `${roleName} is Tier ${role.tier}, "${action}" needs Tier ${rule}` };
}

/* Everything at once. `warnings` are things the founder still has to decide;
   they do not fail the run, but they are never silent. */
export function validateAll(stores, { today } = {}) {
  const errors = [
    ...validateLedger(stores.ledger, { today }),
    ...validateOpportunities(stores.opportunities, stores.ledger),
    ...validateDecisions(stores.decisions, stores.ledger, { today }),
    ...validateGuardrails(stores.guardrails),
  ];
  const warnings = [];
  const caps = (stores.guardrails && stores.guardrails.daily_cap) || {};
  if (caps.tokens == null || caps.cloud_inr == null) {
    warnings.push('daily cost cap is not set (guardrails.json daily_cap): hard rule 3 cannot halt anything until it is');
  }
  return { errors, warnings };
}
