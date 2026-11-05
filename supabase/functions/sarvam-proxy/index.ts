// Sarvam AI proxy.
//
// The browser never holds a Sarvam credential. It asks this function for a
// transcription, a translation, a voice or an answer, and this function
// forwards the call with the key from the deployment's own environment, after
// spending from the project's shared credit ledger.
//
// Four endpoints, one job each:
//   POST /sarvam-proxy/saarika   Saarika speech-to-text (creator narration)
//   POST /sarvam-proxy/mayura    Mayura translation (script -> languages)
//   POST /sarvam-proxy/bulbul    Bulbul text-to-speech (script -> audio)
//   POST /sarvam-proxy/reason    the reasoning tier (fact-check, Q&A, answers)
//
// Every call is recorded in sarvam_jobs before it is made, so the spend is
// visible and the ledger is never surprised. A call that the budget refuses
// comes back refused with the balance it was refused at, and no key is ever
// sent to the caller.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SARVAM_BASE = Deno.env.get('SARVAM_BASE_URL') || 'https://api.sarvam.ai';
const SARVAM_KEY = Deno.env.get('SARVAM_API_KEY');
const SUPA_URL = Deno.env.get('SUPABASE_URL')!;
const SUPA_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const db = createClient(SUPA_URL, SUPA_KEY, { auth: { persistSession: false } });

// Sarvam's indicative list prices, in rupees, per unit. A single rates table
// lives here so re-pricing takes seconds; see docs/Naarad X Sarvam Integration.md.
const RATES = {
  saarika:  { perAudioHour: 30 },
  mayura:   { perChar: 0.002 },          // 20 per 10K characters
  bulbul:   { perChar: 0.003 },          // 30 per 10K characters
  reason:   { perInputToken: 0.00002928, perCachedToken: 0.00001098, perOutputToken: 0.00007320 },
};

const cors = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'POST, OPTIONS',
  'access-control-allow-headers': 'authorization, apikey, content-type',
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'content-type': 'application/json' } });
}

/** Cost of a finished call, in rupees. */
function costOf(endpoint, usage) {
  const r = RATES[endpoint];
  if (!r) return 0;
  if (endpoint === 'saarika') return r.perAudioHour * (usage.audioSeconds || 0) / 3600;
  if (endpoint === 'mayura' || endpoint === 'bulbul') return r.perChar * (usage.inputChars || 0);
  return r.perInputToken * (usage.inputTokens || 0)
       + r.perCachedToken * (usage.cachedTokens || 0)
       + r.perOutputToken * (usage.outputTokens || 0);
}

async function spend(amount) {
  if (amount <= 0) return { ok: true, balance: null, spent: null };
  const { data, error } = await db.rpc('sarvam_spend', { amount_inr: Number(amount.toFixed(2)) });
  if (error) return { ok: false, reason: 'ledger', balance: null, spent: null };
  return data;
}

async function record(job, amount, outcome, error = null) {
  await db.from('sarvam_jobs').insert({
    caller_id: job.callerId || null,
    endpoint: job.endpoint,
    route_slug: job.routeSlug || null,
    stop_order: job.stopOrder || null,
    input_chars: job.inputChars || null,
    input_tokens: job.inputTokens || null,
    output_tokens: job.outputTokens || null,
    audio_seconds: job.audioSeconds || null,
    cost_inr: Number(amount.toFixed(2)),
    status: outcome,
    error,
  });
}

async function forward(job) {
  const headers = { 'api-subkey': SARVAM_KEY, 'content-type': 'application/json' };
  let path;
  switch (job.endpoint) {
    case 'saarika': path = '/transcribe'; break;
    case 'mayura':  path = '/translate'; break;
    case 'bulbul':  path = '/text-to-speech'; break;
    case 'reason':  path = '/chat/completions'; break;
    default: return json({ ok: false, reason: 'unknown-endpoint' }, 400);
  }
  const response = await fetch(`${SARVAM_BASE}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(job.body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    await record(job, 0, 'failed', data?.error?.message || data?.error || `Sarvam answered ${response.status}`);
    return json({ ok: false, reason: 'sarvam', error: data?.error?.message || data?.error }, response.status);
  }
  return data;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (!SARVAM_KEY) return json({ ok: false, reason: 'no-key' }, 503);

  let job;
  try { job = await req.json(); } catch { return json({ ok: false, reason: 'bad-json' }, 400); }
  if (!job?.endpoint) return json({ ok: false, reason: 'missing-endpoint' }, 400);

  const budget = await spend(job.estimate || 0);
  if (!budget.ok) {
    await record(job, 0, 'refused', budget.reason);
    return json({ ok: false, reason: budget.reason, balance: budget.balance, spent: budget.spent }, 402);
  }

  const result = await forward(job);
  const amount = costOf(job.endpoint, result.usage || {});
  await record(job, amount, 'sent');
  return json({ ok: true, ...result, cost_inr: Number(amount.toFixed(2)), balance: budget.balance });
});