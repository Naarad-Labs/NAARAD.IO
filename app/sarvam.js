/* Sarvam AI, through the proxy.
 *
 * The browser never holds a Sarvam key. It asks app/sarvam.js for a
 * transcription, a translation, a voice or an answer, and this module calls
 * the sarvam-proxy Edge Function, which forwards with the key from the
 * deployment's own environment and spends from the project's shared credit
 * ledger. What comes back is the Sarvam result plus the cost and the balance
 * the call was charged against.
 *
 * Nothing here invents a result. If the proxy is not deployed, every call
 * rejects with a reason the interface can show instead of pretending.
 *
 * The four endpoints, one job each:
 *   transcribe  Saarika turns a creator's narration into text
 *   translate    Mayura carries a script into the languages asked for
 *   speak        Bulbul turns a script into audio, for the AI-voice option
 *   answer       the reasoning tier answers a traveller's question
 */

import { backend } from './backend.js';

const PROXY = '/functions/v1/sarvam-proxy';

/** POST to one proxy job. The session token is sent only when there is one;
    the proxy's RLS and the ledger wall are what keep a visitor's spend their own. */
async function call(endpoint, body, { token } = {}) {
  if (!backend.configured()) throw new Error('Sarvam is not available yet.');
  const headers = { 'content-type': 'application/json' };
  if (token) headers.authorization = `Bearer ${token}`;
  let response;
  try {
    response = await fetch(`${PROXY}/${endpoint}`, { method: 'POST', headers, body: JSON.stringify(body) });
  } catch {
    throw new Error('No connection. Nothing was sent.');
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || data.reason || `The proxy answered ${response.status}.`);
    error.reason = data.reason;
    error.balance = data.balance;
    throw error;
  }
  return data;
}

/** Saarika: speech to text. `audio` is a File or Blob. */
export async function transcribe(audio, { language } = {}) {
  const base64 = await new Response(audio).arrayBuffer().then((buf) => btoa(String.fromCharCode(...new Uint8Array(buf))));
  return call('saarika', {
    endpoint: 'saarika',
    body: {
      audio: base64,
      language_code: language || 'en-IN',
      model: 'saarika:v2',
    },
  });
}

/** Mayura: translate a script into the languages asked for. */
export async function translate(text, { source, targets } = {}) {
  return call('mayura', {
    endpoint: 'mayura',
    body: {
      input: text,
      source_language_code: source || 'en-IN',
      target_language_codes: targets,
      mode: 'formal',
      model: 'mayura:v1',
    },
  });
}

/** Bulbul: text to speech, for the Creator Studio's AI-voice option. */
export async function speak(text, { language, speaker = 'anusha' } = {}) {
  return call('bulbul', {
    endpoint: 'bulbul',
    body: {
      text,
      target_language_code: language || 'en-IN',
      speaker,
      model: 'bulbul:v2',
      pace: 1,
    },
  });
}

/** The reasoning tier: answer a traveller's question, grounded in the stop. */
export async function answer(question, { routeSlug, stopOrder, context } = {}) {
  return call('reason', {
    endpoint: 'reason',
    routeSlug,
    stopOrder,
    body: {
      messages: [
        ...(context ? [{ role: 'system', content: context }] : []),
        { role: 'user', content: question },
      ],
      route_slug: routeSlug,
      stop_order: stopOrder,
    },
  });
}

/** Bulk import a .tar.gz route bundle.
 *
 * The browser selects a .tar.gz bundle file. This function:
 *   1. Reads the manifest to get route slugs, stop counts, language configs
 *   2. Calls the Edge Function `/functions/v1/sarvam-proxy/import` which
 *      unpacks the bundle, records each job in sarvam_jobs, and spends from
 *      the credit ledger
 *   3. Returns { draftsCreated, routesImported, errors }
 *
 * The bundle stays in this browser only. No Sarvam key ever leaves the Edge
 * Function. The credit ledger ensures the founder's budget is never surprised.
 */
export async function importBundle(bundle) {
  if (!backend.configured()) throw new Error('Imports need the Naarad backend, which is not part of this build.');
  const formData = new FormData();
  formData.append('bundle', bundle);
  let response;
  try {
    response = await fetch(`${PROXY}/import`, { method: 'POST', body: formData });
  } catch {
    throw new Error('No connection. Nothing was sent.');
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || data.reason || `The proxy answered ${response.status}.`);
    error.reason = data.reason;
    error.balance = data.balance;
    throw error;
  }
  return data;
}

/** The balance the last call was charged against, or null when nothing has been spent. */
export function balanceOf(error) {
  return error && typeof error.balance === 'number' ? error.balance : null;
}

export const ENDPOINTS = ['saarika', 'mayura', 'bulbul', 'reason'];
export const LANGUAGES = [
  ['en', 'English'], ['hi', 'हिंदी'], ['kn', 'ಕನ್ನಡ'], ['ta', 'தமிழ்'],
  ['te', 'తెలుగు'], ['ml', 'മലയാളം'], ['mr', 'मराठी'], ['bn', 'বাংলা'],
];