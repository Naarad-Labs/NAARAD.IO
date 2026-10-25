import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CRITERIA, seedFrom, shuffle, buildPrompt, extractReview, checkCitations, compare, redteam, render,
} from '../../scripts/redteam.mjs';

const entries = [
  { id: 'E-0001', claim: 'Trust A hires guides by hand', quote: 'We pay guides cash each season', tier: 'T2', origin: 'Trust A', date: '2026-10-20' },
  { id: 'E-0002', claim: 'Board B has no audio', quote: 'Our signage is all in print', tier: 'T2', origin: 'Board B', date: '2026-10-21' },
  { id: 'E-0003', claim: 'CSR C funds trails', quote: 'We fund two trails a year', tier: 'T3', origin: 'CSR C', date: '2026-10-22' },
];
const opportunity = { id: 'O-001', title: 'Audio guide for trust-run sites', metric: { name: 'paid pilots signed' }, evidence: ['E-0001', 'E-0002', 'E-0003'] };

const reply = (over = {}) => `thinking out loud first...
<<<JSON>>>
${JSON.stringify({
    kill_points: [{ point: 'Only three sources', cites: ['E-0001'] }, { point: 'No payment shown', cites: [] }],
    scores: { severity: 3, frequency: 2, workaround_or_spend: 3, buyer_identified: 2, commitment: 1 },
    verdict: 'revise', reason: 'thin', ...over,
  })}
<<<END>>>`;

const fakeFetch = (replies) => {
  const calls = [];
  const queue = [...replies];
  const fn = async (url, init) => {
    calls.push({ url, body: JSON.parse(init.body), headers: init.headers });
    const next = queue.length > 1 ? queue.shift() : queue[0];
    return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: next } }] }) };
  };
  fn.calls = calls;
  return fn;
};
const options = (fetchImpl) => ({ fetchImpl, base: 'http://gateway.invalid', key: 'k', model: 'auto' });

test('shuffle is repeatable for a seed, different for another, and keeps every item', () => {
  const ids = ['a', 'b', 'c', 'd', 'e', 'f'];
  assert.deepEqual(shuffle(ids, seedFrom('O-001:1')), shuffle(ids, seedFrom('O-001:1')));
  assert.notDeepEqual(shuffle(ids, seedFrom('O-001:1')), shuffle(ids, seedFrom('O-001:2')));
  assert.deepEqual([...shuffle(ids, 7)].sort(), ids);
});

test('the prompt holds the evidence and the metric, and nothing that argues for building', () => {
  const prompt = buildPrompt(opportunity, entries);
  for (const entry of entries) { assert.ok(prompt.includes(entry.id)); assert.ok(prompt.includes(entry.quote)); }
  assert.ok(prompt.includes('paid pilots signed'));
  for (const key of Object.keys(CRITERIA)) assert.ok(prompt.includes(key));
  assert.ok(!/naarad/i.test(prompt), 'the reviewer should not be told who is asking');
});

test('extractReview takes the last marked block and ignores the thinking before it', () => {
  const text = `<<<JSON>>>{"draft":true}<<<END>>> no wait\n${reply()}`;
  assert.equal(extractReview(text).verdict, 'revise');
});

test('extractReview refuses a missing block, bad JSON, a bad score and a bad verdict', () => {
  assert.throws(() => extractReview('no block here'), /no <<<JSON>>>/);
  assert.throws(() => extractReview('<<<JSON>>>{nope<<<END>>>'), /does not parse/);
  assert.throws(() => extractReview(reply({ scores: { severity: 9, frequency: 1, workaround_or_spend: 1, buyer_identified: 1, commitment: 1 } })), /severity/);
  assert.throws(() => extractReview(reply({ verdict: 'maybe' })), /verdict/);
});

test('citations the model was never shown are dropped and reported', () => {
  const review = extractReview(reply({ kill_points: [{ point: 'x', cites: ['E-0001', 'E-0099'] }] }));
  const invented = checkCitations(review, new Set(['E-0001', 'E-0002']));
  assert.deepEqual(invented, ['E-0099']);
  assert.deepEqual(review.kill_points[0].cites, ['E-0001']);
});

test('compare flags scores that move by more than 1 and a changed verdict', () => {
  const a = extractReview(reply());
  const b = extractReview(reply({ scores: { severity: 3, frequency: 4, workaround_or_spend: 3, buyer_identified: 2, commitment: 1 }, verdict: 'proceed' }));
  assert.deepEqual(compare(a, b), { unstable: ['frequency'], sameVerdict: false });
});

test('two passes see the same entries in a different order', async () => {
  const fetchImpl = fakeFetch([reply()]);
  const outcome = await redteam(opportunity, entries, options(fetchImpl));
  assert.equal(fetchImpl.calls.length, 2);
  assert.deepEqual([...outcome.passes[0].order].sort(), ['E-0001', 'E-0002', 'E-0003']);
  assert.deepEqual([...outcome.passes[1].order].sort(), ['E-0001', 'E-0002', 'E-0003']);
  assert.equal(fetchImpl.calls[0].headers.authorization, 'Bearer k');
});

test('an unusable reply is retried once, then reported', async () => {
  const recovers = fakeFetch(['garbage', reply()]);
  assert.equal((await redteam(opportunity, entries, options(recovers))).passes.length, 2);
  const hopeless = fakeFetch(['garbage']);
  await assert.rejects(redteam(opportunity, entries, options(hopeless)), /no usable review after 2 tries/);
});

test('entries with contact details are never sent', async () => {
  const dirty = [{ ...entries[0], quote: 'ring me on 9876543210' }];
  const fetchImpl = fakeFetch([reply()]);
  await assert.rejects(redteam({ ...opportunity, evidence: ['E-0001'] }, dirty, options(fetchImpl)), /personal data/);
  assert.equal(fetchImpl.calls.length, 0);
});

test('the report says what to do next and warns when the passes disagree', async () => {
  const fetchImpl = fakeFetch([reply(), reply({ verdict: 'proceed' })]);
  const text = render(opportunity, await redteam(opportunity, entries, options(fetchImpl)), '2026-10-26');
  assert.match(text, /disagree on the verdict/);
  assert.match(text, /not a gate result/);
  assert.match(text, /set `redteam.reviewed_on`/);
});
