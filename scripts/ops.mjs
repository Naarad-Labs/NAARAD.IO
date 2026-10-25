#!/usr/bin/env node
/* The Startup Operating System's checks, from the command line.
 *
 *   node scripts/ops.mjs validate          every store is well formed; exits 1 if not
 *   node scripts/ops.mjs gate G1 O-001     may this opportunity enter the backlog
 *   node scripts/ops.mjs can <role> <action>   may this role do this alone
 *   node scripts/ops.mjs scan              no key or private key in any tracked file
 *
 * The rules live in ops/lib.mjs; the files they read are under ops/. CI runs
 * `validate` on every change, so a ledger entry with no source cannot merge.
 */

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { loadStores, validateAll, gateG1, canAct, findSecrets } from '../ops/lib.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [command, ...args] = process.argv.slice(2);
const stores = loadStores(ROOT);
const today = new Date().toISOString().slice(0, 10);

function usage() {
  console.error('usage: ops.mjs validate | gate G1 <O-id> | can <role> <action> | scan');
  process.exit(2);
}

if (command === 'validate') {
  const { errors, warnings } = validateAll(stores, { today });
  warnings.forEach((warning) => console.warn(`warning: ${warning}`));
  if (errors.length) {
    errors.forEach((error) => console.error(`error: ${error}`));
    process.exit(1);
  }
  console.log(`ok: ${stores.ledger.length} evidence entries, ${stores.opportunities.length} opportunities, `
    + `${stores.decisions.length} decisions, ${Object.keys(stores.guardrails.roles).length} roles`);
} else if (command === 'gate' && args[0] === 'G1' && args[1]) {
  const opportunity = stores.opportunities.find((item) => item.id === args[1]);
  if (!opportunity) { console.error(`no opportunity ${args[1]}`); process.exit(2); }
  const result = gateG1(opportunity, stores.ledger);
  console.log(result.pass ? `G1 pass: ${opportunity.id}` : `G1 fail: ${opportunity.id}`);
  result.reasons.forEach((reason) => console.log(`  - ${reason}`));
  process.exit(result.pass ? 0 : 1);
} else if (command === 'can' && args.length === 2) {
  const result = canAct(stores.guardrails, args[0], args[1]);
  console.log(`${result.allowed ? 'yes' : 'no'}: ${result.reason}`);
  process.exit(result.allowed ? 0 : 1);
} else if (command === 'scan') {
  /* Text files only, and small ones: images, fonts and generated cards are not read. */
  const files = execFileSync('git', ['ls-files', '-z'], { cwd: ROOT, encoding: 'utf8' }).split('\0').filter(Boolean);
  const hits = [];
  files.forEach((file) => {
    const full = path.join(ROOT, file);
    let stat;
    try { stat = fs.statSync(full); } catch { return; }   // tracked but absent on this checkout
    if (!stat.isFile() || stat.size > 2_000_000) return;
    const buffer = fs.readFileSync(full);
    if (buffer.includes(0)) return;                       // binary
    findSecrets(buffer.toString('utf8')).forEach((kind) => hits.push(`${file}: ${kind}`));
  });
  if (hits.length) { hits.forEach((hit) => console.error(`secret: ${hit}`)); process.exit(1); }
  console.log(`ok: ${files.length} tracked files, no keys found`);
} else {
  usage();
}
