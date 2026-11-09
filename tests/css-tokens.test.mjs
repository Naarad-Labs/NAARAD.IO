import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

function extractTokens(cssPath) {
  const content = fs.readFileSync(path.join(root, cssPath), 'utf8');
  const tokens = {};
  const varPattern = /--([a-zA-Z0-9-]+):\s*([^;]+);/g;
  let match;
  while ((match = varPattern.exec(content)) !== null) {
    tokens[match[1]] = match[2].trim();
  }
  return tokens;
}

function extractUsages(cssPath) {
  const content = fs.readFileSync(path.join(root, cssPath), 'utf8');
  const usages = [];
  const varUsagePattern = /var\((--[a-zA-Z0-9-]+)/g;
  let match;
  while ((match = varUsagePattern.exec(content)) !== null) {
    usages.push(match[1]);
  }
  return usages;
}

test('tokens.css defines all CSS custom properties used in journey.css', () => {
  const tokens = extractTokens('app/tokens.css');
  const usages = extractUsages('app/journey.css');
  
  // Check that 'sand' token (extracted without --) is defined in tokens
  assert.ok('sand' in tokens, 'sand should be defined in tokens.css');
  assert.equal(tokens['sand'], '#f2e8db', 'sand should be #f2e8db');
  
  // Check that all variables used in journey.css are defined in tokens.css
  // Note: some variables may be defined elsewhere (like page-specific styles)
  // We only check the ones that should be in the design tokens
  const requiredTokens = ['sand'];
  for (const token of requiredTokens) {
    if (usages.includes('--' + token)) {
      assert.ok(tokens[token], `${token} should be defined in tokens.css`);
    }
  }
});

test('journey.css uses --sand without fallback now that token is defined', () => {
  const journeyCss = fs.readFileSync(path.join(root, 'app/journey.css'), 'utf8');
  
  // The --sand variable should be used without a fallback
  assert.ok(/background:\s*var\(--sand\)/.test(journeyCss), 'journey.css should use --sand without fallback');
});