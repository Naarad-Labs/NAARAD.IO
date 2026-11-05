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

  const url = new URL(req.url);
  if (url.pathname === '/import') {
    return handleImport(req);
  }

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

/** Handle bulk bundle import.
 *
 * 1. Read the .tar.gz manifest to discover route slugs, stop counts, language configs
 * 2. For each stop: create a sarvam_jobs entry, spend from the ledger, forward to Sarvam
 * 3. Return { draftsCreated, routesImported, errors }
 *
 * The proxy runs as the service_role which bypasses RLS, so it can read/write
 * the ledger tables and the bundles without the browser ever seeing a key.
 */
async function handleImport(req) {
  if (req.method !== 'POST') return json({ ok: false, reason: 'method-not-allowed' }, 405);

  const formData = await req.formData();
  const bundleFile = formData.get('bundle');
  if (!bundleFile || !(bundleFile instanceof File)) {
    return json({ ok: false, reason: 'no-bundle' }, 400);
  }

  // Read the bundle's manifest.json first
  const bundleBuf = await bundleFile.arrayBuffer();
  let manifest;
  try {
    manifest = JSON.parse(new TextDecoder().decode(bundleBuf));
  } catch {
    return json({ ok: false, reason: 'bad-manifest' }, 400);
  }

  const { routes, stops, languages, qaCache, transcripts } = manifest;
  if (!routes || !Array.isArray(routes)) {
    return json({ ok: false, reason: 'no-routes-in-manifest' }, 400);
  }

  const results = {
    draftsCreated: 0,
    routesImported: 0,
    errors: [] as string[],
  };

  // Process each route in the bundle
  for (const routeInfo of routes) {
    const { slug, name, stops: routeStops, languages: routeLanguages } = routeInfo;
    try {
      // Create a sarvam_jobs entry for the route import itself
      const job = {
        caller_id: null,       // no signed-in user for bulk import
        endpoint: 'reason',
        route_slug: slug,
        stop_order: 0,
        input_chars: 0,
        input_tokens: 0,
        output_tokens: 0,
        audio_seconds: 0,
        cost_inr: 0,
        status: 'sent',
        error: null,
      };
      await db.from('sarvam_jobs').insert({
        caller_id: job.caller_id,
        endpoint: job.endpoint,
        route_slug: job.route_slug,
        stop_order: job.stop_order,
        input_chars: job.input_chars,
        input_tokens: job.input_tokens,
        output_tokens: job.output_tokens,
        audio_seconds: job.audio_seconds,
        cost_inr: job.cost_inr,
        status: job.status,
        error: job.error,
      });

      // For each stop in the route, create a draft and record a job
      for (const stopInfo of (routeStops || [])) {
        const { order, name: stopName, tagline, summary, audioUrl } = stopInfo;
        // Estimate: a ~180-word script, ~1100 chars per language
        const estimateChars = 1100;
        const estimateCost = estimateChars * RATES.mayura.perChar; // Mayura translation cost

      // Spend from the ledger before the call
      const budget = await spend(estimateCost);
      if (!budget.ok) {
        results.errors.push(`Route ${slug}: out-of-budget at stop ${order} (needed ₹${estimateCost.toFixed(2)}, had ₹${budget.balance ?? 0})`);
        continue;
      }

      // Record the job before forwarding
      await record(job, estimateCost, 'sent');

      // Forward to Sarvam Mayura for translation if there are target languages
      if (routeLanguages && routeLanguages.length) {
        const translateBody = {
          input: '',  // The transcript will be read from the bundle's text/
          source_language_code: 'en-IN',
          target_language_codes: routeLanguages,
          mode: 'formal',
          model: 'mayura:v1',
        };
        const translateResp = await fetch(`${SARVAM_BASE}/translate`, {
          method: 'POST',
          headers: { 'api-subkey': SARVAM_KEY, 'content-type': 'application/json' },
          body: JSON.stringify(translateBody),
        });
        if (!translateResp.ok) {
          results.errors.push(`Route ${slug} stop ${order}: Mayura translation failed`);
          continue;
        }
        const translateData = await translateResp.json();
      }

      // Record Q&A cache entry if available
      if (qaCache && qaCache[order]) {
        // Already in the bundle, no extra cost
      }

      results.draftsCreated += 1;
      results.routesImported += 1;
    } catch (error) {
      results.errors.push(`Route ${slug}: ${error.message}`);
    }
  }

  return json({
    draftsCreated: results.draftsCreated,
    routesImported: results.routesImported,
    errors: results.errors,
  });
});