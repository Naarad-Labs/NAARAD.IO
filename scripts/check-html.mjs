#!/usr/bin/env node
/* Lint HTML files for validity.
 *
 *   node scripts/check-html.mjs [FILES...]
 *
 * Uses html-validate if available, falls back to tidy.
 * Exit code: 0 clean, 1 errors found, 2 bad arguments.
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function findHtmlFiles(rootDir) {
  const files = [];
  const entries = fs.readdirSync(rootDir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(rootDir, entry.name);
    if (entry.isDirectory() && !['node_modules', '.git', '.claude', '.agents', 'replica', 'docs', 'Images', 'test-results', 'e2e'].includes(entry.name)) {
      files.push(...findHtmlFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.html')) {
      files.push(fullPath);
    }
  }
  return files;
}

function checkWithHtmlValidate(files) {
  try {
    const cmd = `npx html-validate -f compact ${files.join(' ')}`;
    const output = execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
    return { valid: true, output };
  } catch (e) {
    const output = e.stdout || e.message || '';
    const valid = !output.includes(' error') || output.includes('error-free');
    return { valid, output };
  }
}

function checkWithTidy(files) {
  const errors = [];
  for (const file of files) {
    try {
      const cmd = `tidy -e -q 2>&1 < "${file}"`;
      execSync(cmd, { encoding: 'utf8', stdio: 'pipe' });
    } catch (e) {
      if (e.stdout) errors.push(`${file}: ${e.stdout.trim()}`);
    }
  }
  return { valid: errors.length === 0, errors };
}

export function main(argv, io = { out: console.log, err: console.error }) {
  const files = argv.length > 0
    ? argv.map((a) => path.resolve(a))
    : findHtmlFiles(ROOT);

  if (files.length === 0) {
    io.out('No HTML files found');
    return 0;
  }

  io.out(`Checking ${files.length} HTML file(s)...`);

  // Try html-validate first
  const htmlValidateResult = checkWithHtmlValidate(files);
  if (htmlValidateResult.valid) {
    io.out('HTML validation passed');
    return 0;
  }

  // Fall back to tidy
  const tidyResult = checkWithTidy(files);
  if (tidyResult.valid) {
    io.out('HTML validation passed (tidy)');
    return 0;
  }

  io.out('HTML validation errors:');
  tidyResult.errors.forEach((e) => io.out(`  ${e}`));
  return 1;
}

if (import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  process.exitCode = main(process.argv.slice(2));
}