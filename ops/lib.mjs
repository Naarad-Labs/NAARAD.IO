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
      validateEstimates(opportunity.estimates, ids).forEach(fail);
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

/* ---- feature intake: scoring the backlog ---- */

/* Estimates a score is built from. Each is a guess, so each says where it came
   from: a ledger entry, not a feeling. `reach` is people or organisations who
   have the problem, `expected_move` is the fraction by which the named metric
   should move, `effort` is person-weeks. */
export function validateEstimates(estimates, ledgerIds) {
  const errors = [];
  if (!estimates) return ['estimates are missing (reach, expected_move, effort and the evidence they rest on)'];
  ['reach', 'expected_move', 'effort'].forEach((key) => {
    if (!(typeof estimates[key] === 'number' && estimates[key] > 0)) errors.push(`estimates.${key} must be a number above 0`);
  });
  const basis = estimates.basis || [];
  if (!Array.isArray(basis) || !basis.length) errors.push('estimates.basis must list the ledger entries the numbers rest on');
  else basis.forEach((id) => { if (!ledgerIds.has(id)) errors.push(`estimates.basis ${id} is not in the ledger`); });
  return errors;
}

/* The evidence factor is deliberately cautious: take the best tier from each
   independent origin, keep the three strongest, and use the weakest of those.
   An opportunity rests on its thinnest leg, not its best quote. */
export function evidenceFactor(opportunity, ledger) {
  const byId = new Map(ledger.map((entry) => [entry.id, entry]));
  const best = new Map();
  (opportunity.evidence || []).map((id) => byId.get(id)).filter(Boolean).forEach((entry) => {
    const key = entry.origin.trim().toLowerCase();
    if (!best.has(key) || tierRank(entry.tier) > best.get(key)) best.set(key, tierRank(entry.tier));
  });
  const top = [...best.values()].sort((a, b) => b - a).slice(0, G1_MIN_ORIGINS);
  return { factor: top.length === G1_MIN_ORIGINS ? Math.min(...top) : 0, strongest: top.length ? Math.max(...top) : -1 };
}

/* score = evidence tier x reach x expected metric move / effort. The weights
   are a heuristic, not a measurement: recalibrate them each quarter against
   what actually moved. Nothing below T2, and nothing without a metric, is
   scored at all: it is blocked, with the reason. */
export function intake(opportunities, ledger) {
  const scored = [];
  const blocked = [];
  opportunities.forEach((opportunity) => {
    const reasons = [];
    const { factor, strongest } = evidenceFactor(opportunity, ledger);
    if (!opportunity.metric || !isText(opportunity.metric.name)) reasons.push('no outcome metric named');
    if (strongest < tierRank(G1_MIN_TIER)) reasons.push(`best evidence is below ${G1_MIN_TIER}`);
    else if (factor < tierRank(G1_MIN_TIER)) reasons.push(`fewer than ${G1_MIN_ORIGINS} independent origins at ${G1_MIN_TIER}+`);
    const estimateErrors = validateEstimates(opportunity.estimates, new Set(ledger.map((entry) => entry.id)));
    reasons.push(...estimateErrors);
    if (reasons.length) { blocked.push({ id: opportunity.id, title: opportunity.title, reasons }); return; }
    const { reach, expected_move: move, effort } = opportunity.estimates;
    scored.push({ id: opportunity.id, title: opportunity.title, tier: TIERS[factor], score: (factor * reach * move) / effort });
  });
  scored.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  return { scored, top: scored.slice(0, 3), blocked };
}

/* ---- interview guides ---- */

/* The Mom Test: ask about their past and their present, never about a product
   that does not exist. A question that invites a hypothetical or a compliment
   produces opinion (T0), which is the one thing the ledger cannot use. */
const LEADING = [
  [/\bwould you\b/i, 'asks what they would do'],
  [/\bwould (it|this|that|they|your|the)\b/i, 'asks about a hypothetical'],
  [/\bwill you\b/i, 'asks for a promise'],
  [/\bdo you think\b/i, 'asks for an opinion'],
  [/\bdo you (like|love|want|need)\b/i, 'asks for a feeling or a wish'],
  [/\bhow much would\b/i, 'asks for a price they would pay'],
  [/\bif we\b/i, 'describes a product that does not exist'],
  [/\bwhat if\b/i, 'describes a hypothetical'],
  [/\bin the future\b/i, 'asks about the future'],
  [/\b(naarad|our (app|product|platform|website|service|solution))\b/i, 'pitches instead of listening'],
];

export function lintGuide(text) {
  const errors = [];
  /* A section headed "Do not" or "Avoid" quotes the bad questions on purpose. */
  let quoting = false;
  const questions = text.split('\n')
    .map((line, index) => {
      const heading = line.match(/^#{1,6}\s*(.*)$/);
      if (heading) quoting = /^(do not|don'?t|avoid)\b/i.test(heading[1].trim());
      return { line: line.trim(), number: index + 1, quoting };
    })
    .filter(({ line, quoting: skip }) => !skip && /^(?:[-*]|\d+[.)])\s/.test(line) && line.includes('?'));
  questions.forEach(({ line, number }) => {
    LEADING.forEach(([pattern, why]) => { if (pattern.test(line)) errors.push(`line ${number}: ${why}: "${line.replace(/^(?:[-*]|\d+[.)])\s/, '')}"`); });
  });
  if (questions.length < 8) errors.push(`has ${questions.length} questions; a guide needs at least 8`);
  if (!/^#{1,3}\s*Commitments? to ask for/im.test(text)) errors.push('has no "Commitments to ask for" section: every conversation ends by asking for time, an introduction or money');
  findPersonalData(text).forEach((kind) => errors.push(`contains a ${kind}: the repository is public`));
  findSecrets(text).forEach((kind) => errors.push(`contains a ${kind}`));
  return errors;
}

/* ---- decision log ---- */

/* The log is append-only, so ids run D-0001, D-0002 ... with no gap and no reuse. */
export const validateDecisionOrder = (decisions) => decisions
  .map((d, i) => (d.id === `D-${String(i + 1).padStart(4, '0')}` ? null : `${d.id}: ids must run D-0001, D-0002 ... in order; this is entry ${i + 1}`))
  .filter(Boolean);

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
    if (!['pass', 'fail', 'proposed', 'override'].includes(decision.result)) fail('result must be pass, fail, proposed or override');
    /* An override is the founder choosing to go ahead without a gate passing. It
       is allowed, but it is named, scoped, dated and approved by a human, and it
       never turns a failing gate into a passing one. */
    if (decision.result === 'override') {
      if (!isText(decision.approved_by)) fail('an override needs a named human approver');
      if (!isText(decision.scope)) fail('an override must say exactly what it covers (scope)');
      if (!isRealDate(decision.expires || '')) fail('an override must have an expires date (YYYY-MM-DD)');
    }
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
    ...validateDecisionOrder(stores.decisions),
    ...validateGuardrails(stores.guardrails),
  ];
  const warnings = [];
  stores.decisions.filter((decision) => decision.result === 'override').forEach((decision) => {
    const live = decision.expires && today && decision.expires >= today;
    warnings.push(`${decision.id}: ${decision.gate} override ${live ? 'active until' : 'EXPIRED on'} ${decision.expires}: ${decision.scope}`);
  });
  const caps = (stores.guardrails && stores.guardrails.daily_cap) || {};
  /* "unbounded" is a choice the founder has made on purpose; null is a choice nobody has made. */
  const unset = ['tokens', 'cloud_inr'].filter((key) => caps[key] == null);
  if (unset.length) {
    warnings.push(`daily cost cap is not set for ${unset.join(' and ')} (guardrails.json daily_cap): hard rule 3 cannot halt anything until it is, or the founder records "unbounded"`);
  }
  return { errors, warnings };
}
