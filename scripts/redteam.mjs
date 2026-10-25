#!/usr/bin/env node
/* A reviewer that has never seen the builder's reasoning.
 *
 *   node scripts/redteam.mjs O-001                  review one opportunity
 *   node scripts/redteam.mjs O-001 --dry-run        print the prompt, send nothing
 *   node scripts/redteam.mjs O-001 --ledger f.jsonl --opportunities f.json --out dir
 *
 * It sends an OpenAI-compatible endpoint (FreeLLMAPI by default) the ledger
 * entries linked to the opportunity, its title and its metric, and nothing else:
 * no repository, no plan, no argument for building it. The model is asked for the
 * strongest case for killing it and for a score on five criteria. It does this
 * twice with the evidence in a different order each time, and the report says
 * where the two runs disagree, because a score that changes when the entries are
 * shuffled was not measuring the evidence.
 *
 * Environment: FREELLMAPI_API_KEY (required unless --dry-run), and optionally
 * FREELLMAPI_BASE_URL (default http://127.0.0.1:31415) and FREELLMAPI_MODEL
 * (default auto). The model family should differ from the one that built the
 * work; a free model behind the gateway usually does.
 *
 * It writes ops/redteam/<id>-<date>.md. It does not edit the opportunity: a
 * person copies the kill points into `redteam.points`, answers each with a
 * ledger entry, and sets `reviewed_on`. The model's output is a prompt to think,
 * not a gate result.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { loadStores, readJsonl, readJson, findPersonalData, findSecrets } from '../ops/lib.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const CRITERIA = {
  severity: 'how costly or painful the problem is for the people who have it, shown by what they said or did',
  frequency: 'how often it happens, shown by past events they described',
  workaround_or_spend: 'what they already do or pay to cope, which proves the problem is real',
  buyer_identified: 'a named kind of person or body that decides and pays',
  commitment: 'time, introductions or money actually given, not intentions',
};

/* A small seeded generator, so a shuffle can be repeated and checked. */
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function seedFrom(text) {
  let h = 2166136261;
  for (const char of text) h = Math.imul(h ^ char.charCodeAt(0), 16777619);
  return h >>> 0;
}

export function shuffle(items, seed) {
  const random = mulberry32(seed);
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function buildPrompt(opportunity, entries) {
  const evidence = entries.map((entry) => [
    `${entry.id} [${entry.tier}] origin: ${entry.origin}, ${entry.date}`,
    `  claim: ${entry.claim}`,
    `  said: "${entry.quote}"`,
  ].join('\n')).join('\n\n');
  const criteria = Object.entries(CRITERIA).map(([key, text]) => `- ${key}: ${text}`).join('\n');
  return `You are reviewing a proposal to build something. You have not seen any argument for building it, and you must not assume one. Judge only from the evidence below.

Proposal: ${opportunity.title}
Metric it is meant to move: ${opportunity.metric && opportunity.metric.name}

Evidence tiers: T0 opinion, T1 stated intent, T2 past behaviour, T3 time or reputation commitment, T4 money or signed pilot. Only T2 and above shows what people do.

Evidence (in no particular order):

${evidence || '(none)'}

Task 1. Give the strongest case for KILLING this proposal. Each point must cite the entry ids it rests on, or use an empty list and say "no evidence" when the point is that evidence is missing. Do not invent facts, organisations or numbers that are not in the entries.

Task 2. Score each criterion from 0 (no evidence) to 5 (strong, repeated, specific evidence):
${criteria}

Answer with JSON only, between the lines <<<JSON>>> and <<<END>>>, in exactly this shape:
<<<JSON>>>
{"kill_points":[{"point":"...","cites":["E-0001"]}],"scores":{"severity":0,"frequency":0,"workaround_or_spend":0,"buyer_identified":0,"commitment":0},"verdict":"kill","reason":"..."}
<<<END>>>
The verdict is one of: kill, revise, proceed. Think briefly, then answer once.`;
}

/* Models behind a free gateway sometimes think out loud before answering. Take
   the last marked block, and refuse anything that is not the shape asked for. */
export function extractReview(text) {
  const blocks = [...text.matchAll(/<<<JSON>>>\s*([\s\S]*?)\s*<<<END>>>/g)];
  if (!blocks.length) throw new Error('no <<<JSON>>> block in the reply');
  let parsed;
  try { parsed = JSON.parse(blocks[blocks.length - 1][1]); } catch (error) { throw new Error(`the JSON block does not parse: ${error.message}`); }
  if (!Array.isArray(parsed.kill_points)) throw new Error('kill_points is not a list');
  Object.keys(CRITERIA).forEach((key) => {
    const value = parsed.scores && parsed.scores[key];
    if (!(Number.isInteger(value) && value >= 0 && value <= 5)) throw new Error(`score ${key} must be an integer from 0 to 5`);
  });
  if (!['kill', 'revise', 'proceed'].includes(parsed.verdict)) throw new Error('verdict must be kill, revise or proceed');
  return parsed;
}

/* A kill point may only cite entries that were shown; anything else is the
   model making up evidence, and is dropped and reported. */
export function checkCitations(review, shownIds) {
  const invented = [];
  review.kill_points.forEach((point) => {
    point.cites = (point.cites || []).filter((id) => {
      if (shownIds.has(id)) return true;
      invented.push(id);
      return false;
    });
  });
  return invented;
}

export function compare(a, b) {
  const unstable = Object.keys(CRITERIA).filter((key) => Math.abs(a.scores[key] - b.scores[key]) > 1);
  return { unstable, sameVerdict: a.verdict === b.verdict };
}

async function ask({ fetchImpl, base, key, model, prompt }) {
  const response = await fetchImpl(`${base}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
    body: JSON.stringify({ model, messages: [{ role: 'user', content: prompt }], max_tokens: 12000, temperature: 0.2 }),
  });
  if (!response.ok) throw new Error(`the endpoint answered ${response.status}`);
  const body = await response.json();
  return body.choices[0].message.content || '';
}

/* One pass; a reply that is not in the asked-for shape gets one more try. */
async function review(options, prompt) {
  let lastError;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try { return extractReview(await ask({ ...options, prompt })); } catch (error) { lastError = error; }
  }
  throw new Error(`no usable review after 2 tries: ${lastError.message}`);
}

export async function redteam(opportunity, ledger, options) {
  const byId = new Map(ledger.map((entry) => [entry.id, entry]));
  const entries = (opportunity.evidence || []).map((id) => byId.get(id)).filter(Boolean);
  entries.forEach((entry) => {
    const text = `${entry.claim} ${entry.quote} ${entry.origin}`;
    if (findPersonalData(text).length || findSecrets(text).length) throw new Error(`${entry.id} holds personal data or a key: fix the ledger before sending it anywhere`);
  });
  const shown = new Set(entries.map((entry) => entry.id));
  const passes = [];
  for (let n = 1; n <= 2; n += 1) {
    const order = shuffle(entries, seedFrom(`${opportunity.id}:${n}`));
    const result = await review(options, buildPrompt(opportunity, order));
    const invented = checkCitations(result, shown);
    passes.push({ order: order.map((entry) => entry.id), result, invented });
  }
  return { passes, comparison: compare(passes[0].result, passes[1].result), entries: entries.length };
}

export function render(opportunity, outcome, date) {
  const lines = [`# Red team: ${opportunity.id} ${opportunity.title}`, '',
    `Date: ${date}. Entries shown: ${outcome.entries}. Two passes, evidence shuffled differently each time.`,
    'Output of a model asked to argue against the proposal. It prompts a person to think; it is not a gate result.', ''];
  outcome.passes.forEach((pass, index) => {
    lines.push(`## Pass ${index + 1}  (order shown: ${pass.order.join(', ') || 'none'})`, '',
      `Verdict: **${pass.result.verdict}**. ${pass.result.reason || ''}`, '', '| criterion | score |', '|---|---|',
      ...Object.keys(CRITERIA).map((key) => `| ${key} | ${pass.result.scores[key]} |`), '', 'Kill points:');
    pass.result.kill_points.forEach((point) => lines.push(`- ${point.point} (cites: ${(point.cites || []).join(', ') || 'no evidence'})`));
    if (pass.invented.length) lines.push('', `Dropped: the model cited ${pass.invented.join(', ')}, which were not shown to it.`);
    lines.push('');
  });
  const { unstable, sameVerdict } = outcome.comparison;
  lines.push('## Stability', '',
    sameVerdict ? 'Both passes reached the same verdict.' : '**The two passes disagree on the verdict.** Do not rely on either.',
    unstable.length ? `Scores that moved by more than 1 when the order changed: ${unstable.join(', ')}. Treat those as unmeasured.` : 'No score moved by more than 1.', '',
    '## Next', '', 'Copy the kill points that survive into `redteam.points` in the opportunity file, answer each with ledger entries in `answered_by`, then set `redteam.reviewed_on`.', '');
  return lines.join('\n');
}

async function main() {
  const [id, ...flags] = process.argv.slice(2);
  const option = (name) => { const at = flags.indexOf(name); return at === -1 ? null : flags[at + 1]; };
  if (!id || id.startsWith('--')) { console.error('usage: redteam.mjs <O-id> [--dry-run] [--ledger f] [--opportunities f] [--out dir]'); process.exit(2); }

  const stores = loadStores(ROOT);
  const ledger = option('--ledger') ? readJsonl(path.resolve(option('--ledger'))) : stores.ledger;
  const opportunities = option('--opportunities') ? readJson(path.resolve(option('--opportunities')), []) : stores.opportunities;
  const opportunity = opportunities.find((item) => item.id === id);
  if (!opportunity) { console.error(`no opportunity ${id}`); process.exit(2); }

  if (flags.includes('--dry-run')) {
    const byId = new Map(ledger.map((entry) => [entry.id, entry]));
    const entries = shuffle((opportunity.evidence || []).map((evidenceId) => byId.get(evidenceId)).filter(Boolean), seedFrom(`${id}:1`));
    console.log(buildPrompt(opportunity, entries));
    return;
  }
  const key = process.env.FREELLMAPI_API_KEY;
  if (!key) { console.error('set FREELLMAPI_API_KEY (or use --dry-run)'); process.exit(2); }
  const options = {
    fetchImpl: globalThis.fetch,
    base: (process.env.FREELLMAPI_BASE_URL || 'http://127.0.0.1:31415').replace(/\/$/, ''),
    key,
    model: process.env.FREELLMAPI_MODEL || 'auto',
  };
  const outcome = await redteam(opportunity, ledger, options);
  const date = new Date().toISOString().slice(0, 10);
  const dir = path.resolve(option('--out') || path.join(ROOT, 'ops', 'redteam'));
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${id}-${date}.md`);
  fs.writeFileSync(file, render(opportunity, outcome, date));
  console.log(`wrote ${path.relative(process.cwd(), file)}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => { console.error(`error: ${error.message}`); process.exit(1); });
}
