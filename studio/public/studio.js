// NAARAD Studio: browser side of the Sarvam pipeline. No build step, no dependencies.
//
// Audio is decoded in the browser and re-encoded as 16 kHz mono WAV so the
// server can enforce the 90-second cap exactly and split it for Saaras.
// All model calls go through the local server, which holds the API key.

const MAX_STORY_SECONDS = 90;
const MAX_QUESTION_SECONDS = 15;
const TARGET_RATE = 16000;
const SAMPLE_URL = 'samples/thanjavur-creator-ta.mp3';
const HISTORY_TURNS = 6;

const NATIVE_NAMES = {
  'en-IN': 'English', 'hi-IN': 'हिन्दी', 'bn-IN': 'বাংলা', 'ta-IN': 'தமிழ்', 'te-IN': 'తెలుగు',
  'kn-IN': 'ಕನ್ನಡ', 'ml-IN': 'മലയാളം', 'mr-IN': 'मराठी', 'gu-IN': 'ગુજરાતી', 'pa-IN': 'ਪੰਜਾਬੀ', 'od-IN': 'ଓଡ଼ିଆ',
};
const SOURCE_BADGES = {
  sarvam: ['live', 'Live Sarvam'],
  cache: ['cache', 'Cached · no new spend'],
  fallback: ['fallback', 'Offline fallback'],
  passthrough: ['passthrough', 'Same language'],
};
const RAIL_STATES = { sarvam: 'live', cache: 'cache', fallback: 'fallback', passthrough: 'done' };
const VERDICTS = {
  approve: ['Approved', 'Ready to publish', 'Publish to travellers'],
  review: ['Needs review', 'Held for a heritage editor', 'Publish as draft (editor review pending)'],
  reject: ['Rejected', "This version can't be published", null],
};

const $ = (id) => document.getElementById(id);

const state = {
  health: null,
  offline: false,
  stops: [],
  stop: null,
  clip: null,               // { wav: Blob, duration, url }
  rawTranscript: '',
  transcriptLanguage: 'ta-IN',
  gate: null,               // last moderation result
  gateText: '',             // the transcript text that result applies to
  published: null,          // { text, language, verdict }
  translation: null,        // { text, language }
  translateSeq: 0,
  narrationUrl: null,
  chat: [],                 // [{ role, content }] for multi-turn context
  storyRecorder: null,
  micRecorder: null,
};
const answerPlayer = new Audio();

// ── Small helpers ──────────────────────────────────────────────────────────

function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value == null || value === false) continue;
    if (key === 'class') el.className = value;
    else if (key === 'text') el.textContent = value;
    else if (key.startsWith('on')) el.addEventListener(key.slice(2), value);
    else el.setAttribute(key, value === true ? '' : value);
  }
  el.append(...present(children));
  return el;
}

// Drop the null/false/'' left by `cond && node` so they never render as text.
const present = (children) => children.flat().filter((c) => c != null && c !== false && c !== '');
const fill = (el, ...children) => el.replaceChildren(...present(children));

const langName = (code) => state.health?.languages?.[code] || code;
const seconds = (ms) => `${(ms / 1000).toFixed(1)} s`;
function clock(totalSeconds) {
  const t = Math.round(totalSeconds);
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
}

function notice(el, text, kind = 'warn') {
  el.hidden = !text;
  el.textContent = text || '';
  el.classList.toggle('is-error', kind === 'error');
  el.classList.toggle('is-info', kind === 'info');
}

function renderMeta(el, source, parts) {
  const [cls, label] = SOURCE_BADGES[source] || ['passthrough', source];
  fill(el, h('span', { class: `badge badge-${cls}`, text: label }), parts.filter(Boolean).join(' · '));
}

function setRail(stage, status = '') {
  const item = document.querySelector(`.rail li[data-stage="${stage}"]`);
  item.dataset.state = status;
  const labels = { live: 'live', cache: 'cached', fallback: 'fallback', error: 'error', done: 'done' };
  item.querySelector('.rail-state').textContent = labels[status] || '';
}

function setLocked(id, locked) {
  const card = $(id);
  card.classList.toggle('is-locked', locked);
  card.setAttribute('aria-disabled', String(locked));
}

async function withBusy(button, fn) {
  button.classList.add('is-busy');
  button.disabled = true;
  button.setAttribute('aria-busy', 'true');
  try {
    return await fn();
  } finally {
    button.classList.remove('is-busy');
    button.disabled = false;
    button.removeAttribute('aria-busy');
  }
}

// ── API ────────────────────────────────────────────────────────────────────

class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

async function api(path, { json, body, headers = {}, raw = false } = {}) {
  const init = { method: json !== undefined || body !== undefined ? 'POST' : 'GET', headers: { ...headers } };
  if (state.offline) init.headers['X-Naarad-Offline'] = '1';
  if (json !== undefined) {
    init.headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(json);
  } else if (body !== undefined) {
    init.body = body;
  }
  let res;
  try {
    res = await fetch(`api/${path}`, init);
  } catch {
    showServerDown();
    throw new ApiError("Can't reach the Studio server.", 0);
  }
  const type = res.headers.get('Content-Type') || '';
  if (!res.ok) {
    const data = type.includes('json') ? await res.json().catch(() => ({})) : {};
    if (!type.includes('json')) showServerDown(); // a static host without the API behind it
    throw new ApiError(data.error || `Server error ${res.status}`, res.status);
  }
  return raw ? res : res.json();
}

function showServerDown() {
  $('server-banner').hidden = false;
  const pill = $('status-pill');
  pill.className = 'pill pill-down';
  pill.textContent = 'Server offline';
}

function renderStatus() {
  const pill = $('status-pill');
  if (!state.health) return showServerDown();
  if (state.offline) {
    pill.className = 'pill pill-offline';
    pill.textContent = 'Wi-Fi drop simulated';
  } else if (state.health.sarvam === 'live') {
    pill.className = 'pill pill-live';
    pill.textContent = 'Sarvam live';
  } else {
    pill.className = 'pill pill-offline';
    pill.textContent = 'No API key · offline fallbacks';
  }
}

// ── Audio capture and conversion ───────────────────────────────────────────

async function decodeToWav(arrayBuffer, maxSeconds) {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  const ctx = new Ctx();
  let decoded;
  try {
    decoded = await ctx.decodeAudioData(arrayBuffer);
  } catch {
    throw new Error("This file couldn't be decoded. Try MP3, M4A, WAV or WebM audio.");
  } finally {
    ctx.close();
  }
  if (decoded.duration > maxSeconds + 0.5) {
    throw new Error(`This clip is ${clock(decoded.duration)} long. NAARAD stories are capped at ${clock(maxSeconds)}. Trim it and try again.`);
  }
  // Resample and downmix to 16 kHz mono: ~32 KB per second, and exact duration checks on the server.
  const frames = Math.max(1, Math.ceil(decoded.duration * TARGET_RATE));
  const offline = new OfflineAudioContext(1, frames, TARGET_RATE);
  const source = offline.createBufferSource();
  source.buffer = decoded;
  source.connect(offline.destination);
  source.start();
  const rendered = await offline.startRendering();
  return { wav: encodeWav(rendered.getChannelData(0), TARGET_RATE), duration: decoded.duration };
}

function encodeWav(samples, rate) {
  const view = new DataView(new ArrayBuffer(44 + samples.length * 2));
  const text = (offset, s) => { for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i)); };
  text(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  text(8, 'WAVE');
  text(12, 'fmt ');
  view.setUint32(16, 16, true);        // PCM chunk size
  view.setUint16(20, 1, true);         // PCM
  view.setUint16(22, 1, true);         // mono
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * 2, true);  // byte rate
  view.setUint16(32, 2, true);         // block align
  view.setUint16(34, 16, true);        // bits per sample
  text(36, 'data');
  view.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([view.buffer], { type: 'audio/wav' });
}

class Recorder {
  constructor({ maxSeconds, onTick }) {
    this.maxSeconds = maxSeconds;
    this.onTick = onTick;
  }

  async start() {
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      throw new Error('Recording needs microphone access (a modern browser on localhost or HTTPS). Upload a file instead.');
    }
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    const chunks = [];
    this.media = new MediaRecorder(this.stream);
    this.media.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    this.done = new Promise((resolve) => {
      this.media.onstop = () => resolve(new Blob(chunks, { type: this.media.mimeType || 'audio/webm' }));
    });
    this.media.start(250);
    const started = performance.now();
    this.timer = setInterval(() => {
      const elapsed = (performance.now() - started) / 1000;
      this.onTick?.(elapsed);
      if (elapsed >= this.maxSeconds) this.stop();  // hard cap, no matter what
    }, 200);
  }

  stop() {
    clearInterval(this.timer);
    if (this.media && this.media.state !== 'inactive') this.media.stop();
    this.stream?.getTracks().forEach((t) => t.stop());
  }

  get active() {
    return this.media?.state === 'recording';
  }
}

// ── Stage 1 · Record → Saaras ──────────────────────────────────────────────

async function toggleStoryRecording() {
  const button = $('record-btn');
  if (state.storyRecorder?.active) {
    state.storyRecorder.stop();
    return;
  }
  notice($('record-notice'), '');
  const recorder = new Recorder({
    maxSeconds: MAX_STORY_SECONDS,
    onTick: (t) => {
      $('meter-fill').style.width = `${Math.min(100, (t / MAX_STORY_SECONDS) * 100)}%`;
      $('meter-time').textContent = `${clock(t)} / ${clock(MAX_STORY_SECONDS)}`;
    },
  });
  try {
    await recorder.start();
  } catch (err) {
    notice($('record-notice'), err.message || 'Microphone access was blocked.', 'error');
    return;
  }
  state.storyRecorder = recorder;
  button.classList.add('is-recording');
  button.querySelector('span').textContent = 'Stop';
  button.setAttribute('aria-pressed', 'true');
  $('record-meter').hidden = false;
  const blob = await recorder.done;
  button.classList.remove('is-recording');
  button.querySelector('span').textContent = 'Record';
  button.setAttribute('aria-pressed', 'false');
  $('record-meter').hidden = true;
  await loadClip(blob, 'Recording');
}

async function loadClip(blob, label) {
  notice($('record-notice'), '');
  try {
    const { wav, duration } = await decodeToWav(await blob.arrayBuffer(), MAX_STORY_SECONDS);
    if (state.clip?.url) URL.revokeObjectURL(state.clip.url);
    state.clip = { wav, duration, url: URL.createObjectURL(wav) };
    $('clip-audio').src = state.clip.url;
    $('clip').hidden = false;
    $('clip-meta').textContent = `${label} · ${clock(duration)} of ${clock(MAX_STORY_SECONDS)} · 16 kHz mono WAV, ${(wav.size / 1e6).toFixed(1)} MB`;
    $('transcribe-btn').disabled = false;
  } catch (err) {
    notice($('record-notice'), err.message, 'error');
  }
}

async function useSample() {
  await withBusy($('sample-btn'), async () => {
    try {
      const res = await fetch(SAMPLE_URL);
      if (!res.ok) throw new Error();
      $('source-language').value = 'ta-IN';
      await loadClip(await res.blob(), 'Sample narration (Tamil, synthetic Bulbul voice)');
    } catch {
      notice($('record-notice'), "Couldn't load the sample narration.", 'error');
    }
  });
}

async function transcribe() {
  const language = $('source-language').value;
  setRail('record', 'busy');
  notice($('record-notice'), '');
  try {
    const res = await withBusy($('transcribe-btn'), () =>
      api(`transcribe?language=${encodeURIComponent(language)}`, { body: state.clip.wav, headers: { 'Content-Type': 'audio/wav' } }));
    setRail('record', RAIL_STATES[res.source]);
    renderMeta($('record-meta'), res.source, [
      res.model, `${res.chunks} chunk${res.chunks === 1 ? '' : 's'}`, `${res.duration_s} s audio`, seconds(res.latency_ms),
    ]);
    notice($('record-notice'), res.notice);
    if (res.language !== language) $('source-language').value = res.language;
    loadTranscript(res.transcript, res.language);
  } catch (err) {
    setRail('record', 'error');
    notice($('record-notice'), err.message, 'error');
  }
}

// ── Stage 2 · Creator verification + publish gate ──────────────────────────

function loadTranscript(text, language) {
  state.rawTranscript = text;
  state.transcriptLanguage = language;
  const area = $('transcript');
  area.value = text;
  area.lang = language;
  area.disabled = false;
  $('reset-btn').disabled = false;
  $('reviewed-check').disabled = false;
  $('reviewed-check').checked = false;
  setLocked('stage-verify', false);
  renderGlossary();
  onTranscriptChange();
  unpublish();
}

function wordEdits(before, after) {
  const a = before.split(/\s+/).filter(Boolean);
  const b = after.split(/\s+/).filter(Boolean);
  if (a.length * b.length > 400000) return Math.abs(a.length - b.length);
  let prev = new Array(b.length + 1).fill(0);
  for (let i = 1; i <= a.length; i++) {
    const row = new Array(b.length + 1).fill(0);
    for (let j = 1; j <= b.length; j++) {
      row[j] = a[i - 1] === b[j - 1] ? prev[j - 1] + 1 : Math.max(prev[j], row[j - 1]);
    }
    prev = row;
  }
  return Math.max(a.length, b.length) - prev[b.length];
}

function mentions(entity, text) {
  const lower = text.toLowerCase();
  return Object.values(entity.aliases).flat().some((alias) => {
    if (/^[\x00-\x7f]+$/.test(alias)) {
      const escaped = alias.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return new RegExp(`(^|[^a-z])${escaped}($|[^a-z])`).test(lower);
    }
    return text.includes(alias);
  });
}

function renderGlossary() {
  const box = $('glossary-chips');
  box.replaceChildren();
  if (!state.stop) return;
  for (const entity of state.stop.entities) {
    const term = (entity.aliases[state.transcriptLanguage] || entity.aliases['en-IN'])[0];
    box.append(h('button', {
      type: 'button',
      class: 'chip',
      text: term,
      title: `${entity.aliases['en-IN'][0]} · ${entity.type}`,
      lang: state.transcriptLanguage,
      'data-entity': entity.id,
      disabled: $('transcript').disabled,
      onmousedown: (e) => e.preventDefault(),  // keep the textarea selection
      onclick: () => insertTerm(term),
    }));
  }
  updateGlossaryMatches();
}

function updateGlossaryMatches() {
  const text = $('transcript').value;
  for (const chip of $('glossary-chips').children) {
    const entity = state.stop.entities.find((e) => e.id === chip.dataset.entity);
    chip.classList.toggle('is-found', mentions(entity, text));
  }
}

function insertTerm(term) {
  const area = $('transcript');
  if (area.disabled) return;
  area.setRangeText(term, area.selectionStart, area.selectionEnd, 'end');
  area.focus();
  onTranscriptChange();
}

function onTranscriptChange() {
  const text = $('transcript').value;
  const edits = wordEdits(state.rawTranscript, text);
  $('edit-count').textContent = edits ? `${edits} word${edits === 1 ? '' : 's'} corrected by the creator` : 'No corrections yet';
  updateGlossaryMatches();
  if (state.gate && text.trim() !== state.gateText) {
    state.gate = null;
    $('gate').hidden = true;
    $('publish-row').hidden = true;
    setRail('verify', '');
  }
  $('moderate-btn').disabled = !(text.trim() && $('reviewed-check').checked);
}

async function runGate() {
  const text = $('transcript').value.trim();
  setRail('verify', 'busy');
  $('publish-row').hidden = true;
  try {
    const res = await withBusy($('moderate-btn'), () =>
      api('moderate', { json: { text, language: state.transcriptLanguage, stop_id: state.stop.id } }));
    state.gate = res;
    state.gateText = text;
    renderGate(res);
    setRail('verify', RAIL_STATES[res.source]);
  } catch (err) {
    setRail('verify', 'error');
    $('gate').className = 'gate is-reject';
    $('gate').hidden = false;
    $('gate').replaceChildren(h('p', { text: err.message }));
  }
  onTranscriptChange();
}

function renderGate(res) {
  const [badge, headline, publishLabel] = VERDICTS[res.verdict];
  const gate = $('gate');
  gate.className = `gate is-${res.verdict}`;
  gate.hidden = false;
  const claims = res.claims.map((c) => h('li', {},
    h('span', { class: `status status-${c.status}`, text: c.status }),
    h('span', {}, c.claim, c.fact_id && h('span', { class: 'fact-ref', text: c.fact_id })),
    c.note && h('span', { class: 'note', text: c.note })));
  const entities = res.entities.map((e) => h('span', {
    class: `chip chip-static${e.via.includes('graph') ? ' is-found' : ' chip-model'}`,
    lang: state.transcriptLanguage,
    title: e.via.includes('graph') ? `${e.label}: found in the text` : `${e.label}: suggested by Sarvam-105B only`,
    text: e.local_label,
  }));
  const meta = h('p', { class: 'meta' });
  renderMeta(meta, res.source, [res.model, seconds(res.latency_ms)]);
  fill(gate,
    h('div', { class: 'verdict' }, h('span', { class: 'verdict-badge', text: badge }), h('strong', { text: headline })),
    res.summary && h('p', { text: res.summary }),
    res.categories.length > 0 && h('p', {}, h('strong', { text: 'Safety flags: ' }), res.categories.join(', ')),
    claims.length > 0 && h('div', {}, h('h4', { text: 'Claims checked against the Cultural Graph' }), h('ul', { class: 'claims' }, claims)),
    entities.length > 0 && h('div', {}, h('h4', { text: 'Cultural Graph entities' }), h('div', { class: 'chips' }, entities)),
    res.notice && h('p', { class: 'notice', text: res.notice }),
    meta,
  );
  $('publish-row').hidden = !publishLabel;
  if (publishLabel) $('publish-btn').textContent = publishLabel;
}

function unpublish() {
  state.published = null;
  state.translation = null;
  state.chat = [];
  for (const id of ['stage-translate', 'stage-listen', 'stage-ask']) setLocked(id, true);
  $('traveller-lock').hidden = false;
  for (const el of [$('target-language'), $('speaker-select'), $('speak-btn'), $('question'), $('mic-btn'), $('ask-btn'),
    ...document.querySelectorAll('input[name="mode"]')]) el.disabled = true;
  $('orig-text').textContent = '';
  $('trans-text').textContent = '';
  $('chat').replaceChildren();
  $('suggested').replaceChildren();
  for (const id of ['translate-notice', 'listen-notice', 'ask-notice']) notice($(id), '');
  $('translate-meta').replaceChildren();
  clearNarration();
  for (const stage of ['translate', 'listen', 'ask']) setRail(stage, '');
}

function publish() {
  const { verdict } = state.gate;
  state.published = { text: state.gateText, language: state.transcriptLanguage, verdict };
  for (const id of ['stage-translate', 'stage-listen', 'stage-ask']) setLocked(id, false);
  $('traveller-lock').hidden = true;
  for (const el of [$('target-language'), $('speaker-select'), $('question'), $('mic-btn'), $('ask-btn'),
    ...document.querySelectorAll('input[name="mode"]')]) el.disabled = false;
  $('orig-label').textContent = `Original · ${langName(state.published.language)}${verdict === 'review' ? ' · draft' : ''}`;
  $('orig-text').textContent = state.published.text;
  $('orig-text').lang = state.published.language;
  $('chat').replaceChildren();
  state.chat = [];
  translate();
  if (window.matchMedia('(max-width: 1000px)').matches) $('stage-translate').scrollIntoView({ block: 'start' });
}

// ── Stage 3 · Mayura translation ───────────────────────────────────────────

async function translate() {
  if (!state.published) return;
  const target = $('target-language').value;
  const seq = ++state.translateSeq;
  clearNarration();
  $('speak-btn').disabled = true;
  $('trans-label').textContent = `Translation · ${langName(target)}`;
  $('trans-text').textContent = '';
  $('trans-text').setAttribute('aria-busy', 'true');
  notice($('translate-notice'), '');
  setRail('translate', 'busy');
  renderSuggested();
  try {
    const res = await api('translate', {
      json: { text: state.published.text, source_language: state.published.language, target_language: target },
    });
    if (seq !== state.translateSeq) return;  // the traveller picked another language meanwhile
    state.translation = { text: res.translation, language: res.language };
    $('trans-text').textContent = res.translation;
    $('trans-text').lang = res.language;
    if (res.language !== target) $('trans-label').textContent = `Original shown · ${langName(res.language)}`;
    notice($('translate-notice'), res.notice);
    renderMeta($('translate-meta'), res.source, [
      res.model, res.chunks > 1 && `${res.chunks} chunks`,
      `${state.published.text.length} → ${res.translation.length} characters`,
      res.source !== 'passthrough' && seconds(res.latency_ms),
    ]);
    setRail('translate', RAIL_STATES[res.source]);
    $('speak-btn').disabled = false;
  } catch (err) {
    if (seq !== state.translateSeq) return;
    setRail('translate', 'error');
    notice($('translate-notice'), err.message, 'error');
  } finally {
    if (seq === state.translateSeq) $('trans-text').removeAttribute('aria-busy');
  }
}

// ── Stage 4 · Bulbul voice (device voice as fallback) ──────────────────────

function clearNarration() {
  const player = $('narration-audio');
  player.pause();
  player.removeAttribute('src');
  player.hidden = true;
  $('download-link').hidden = true;
  $('device-voice').hidden = true;
  if (state.narrationUrl) URL.revokeObjectURL(state.narrationUrl);
  state.narrationUrl = null;
  notice($('listen-notice'), '');
  $('listen-meta').replaceChildren();
  stopDeviceVoice();
  setRail('listen', '');
}

async function fetchSpeech(text, language) {
  const res = await api('speak', { json: { text, language, speaker: $('speaker-select').value }, raw: true });
  return {
    blob: await res.blob(),
    source: res.headers.get('X-Naarad-Source') || 'sarvam',
    model: res.headers.get('X-Naarad-Model'),
    latency: Number(res.headers.get('X-Naarad-Latency-Ms') || 0),
  };
}

async function speakNarration() {
  const { text, language } = state.translation;
  clearNarration();
  setRail('listen', 'busy');
  try {
    const speech = await withBusy($('speak-btn'), () => fetchSpeech(text, language));
    state.narrationUrl = URL.createObjectURL(speech.blob);
    const player = $('narration-audio');
    player.src = state.narrationUrl;
    player.hidden = false;
    $('download-link').href = state.narrationUrl;
    $('download-link').hidden = false;
    const parts = [speech.model, $('speaker-select').value, langName(language), speech.source !== 'cache' && seconds(speech.latency)];
    renderMeta($('listen-meta'), speech.source, parts);
    player.addEventListener('loadedmetadata', () => renderMeta($('listen-meta'), speech.source,
      [...parts.slice(0, 3), `${clock(player.duration)} of audio`, parts[3]]), { once: true });
    player.play().catch(() => {});
    setRail('listen', RAIL_STATES[speech.source]);
  } catch (err) {
    if (err.status !== 503) {
      setRail('listen', 'error');
      notice($('listen-notice'), err.message, 'error');
      return;
    }
    setRail('listen', 'fallback');
    $('device-voice').hidden = false;
    const voiced = speakWithDevice(text, language);
    notice($('listen-notice'), `${err.message} ${voiced.message}`);
    renderMeta($('listen-meta'), 'fallback', ['Web Speech API', langName(language)]);
  }
}

function speakWithDevice(text, language) {
  if (!('speechSynthesis' in window)) {
    return { ok: false, message: 'This browser has no built-in voice either, so read the text above.' };
  }
  speechSynthesis.cancel();
  const voices = speechSynthesis.getVoices();
  const voice = voices.find((v) => v.lang.replace('_', '-') === language)
    || voices.find((v) => v.lang.toLowerCase().startsWith(language.slice(0, 2)));
  // Queue sentence by sentence: some browsers stop long single utterances early.
  for (const sentence of text.split(/(?<=[.!?।॥])\s+/)) {
    const utterance = new SpeechSynthesisUtterance(sentence);
    utterance.lang = language;
    if (voice) utterance.voice = voice;
    speechSynthesis.speak(utterance);
  }
  return {
    ok: true,
    message: voice
      ? `Playing with this device's ${voice.name} voice instead.`
      : `This device has no ${langName(language)} voice, so the default voice may mispronounce it.`,
  };
}

function stopDeviceVoice() {
  if ('speechSynthesis' in window) speechSynthesis.cancel();
}

// ── Stage 5 · Ask NAARAD (Sarvam-105B) ─────────────────────────────────────

function renderSuggested() {
  const box = $('suggested');
  box.replaceChildren();
  if (!state.published || !state.stop) return;
  const target = $('target-language').value;
  const questions = state.stop.suggested_questions[target] || state.stop.suggested_questions['en-IN'];
  for (const q of questions) {
    box.append(h('button', { type: 'button', class: 'chip', text: q, lang: target, onclick: () => ask(q) }));
  }
}

async function ask(question) {
  question = question.trim();
  if (!question || !state.published) return;
  const mode = document.querySelector('input[name="mode"]:checked').value;
  const language = $('target-language').value;
  const chat = $('chat');
  chat.append(h('li', { class: 'msg msg-user', lang: language, text: question }));
  const label = mode === 'think' ? 'Thinking' : 'Answering';
  const pending = h('li', { class: 'msg msg-bot is-pending', text: `${label}…` });
  chat.append(pending);
  pending.scrollIntoView({ block: 'nearest' });
  const started = performance.now();
  const ticker = setInterval(() => { pending.textContent = `${label}… ${Math.round((performance.now() - started) / 1000)} s`; }, 1000);
  setRail('ask', 'busy');
  setAskEnabled(false);
  notice($('ask-notice'), '');
  try {
    const res = await api('ask', {
      json: {
        question, language, mode, stop_id: state.stop.id,
        narration: state.published.text, narration_language: state.published.language,
        history: state.chat.slice(-HISTORY_TURNS),
      },
    });
    state.chat.push({ role: 'user', content: question }, { role: 'assistant', content: res.answer });
    renderAnswer(pending, res);
    setRail('ask', RAIL_STATES[res.source]);
  } catch (err) {
    pending.classList.remove('is-pending');
    pending.textContent = err.message;
    setRail('ask', 'error');
  } finally {
    clearInterval(ticker);
    setAskEnabled(true);
    pending.scrollIntoView({ block: 'nearest' });
  }
}

function renderAnswer(item, res) {
  const meta = h('span', { class: 'meta' });
  renderMeta(meta, res.source, [res.model, res.source === 'sarvam' && `${res.mode} mode`, seconds(res.latency_ms)]);
  const listen = h('button', { type: 'button', class: 'btn-link', text: 'Listen' });
  listen.addEventListener('click', () => playAnswer(listen, res.answer, res.language));
  item.classList.remove('is-pending');
  fill(item,
    h('p', { lang: res.language, style: 'margin:0', text: res.answer }),
    res.citations.length > 0 && h('details', {},
      h('summary', { text: `Grounded in ${res.citations.length} Cultural Graph fact${res.citations.length === 1 ? '' : 's'}` }),
      h('ul', {}, res.citations.map((c) => h('li', { lang: res.language }, h('strong', { text: `${c.id} · ${c.confidence}: ` }), c.text)))),
    res.reasoning && h('details', {}, h('summary', { text: 'How Sarvam-105B reasoned' }), h('pre', { text: res.reasoning })),
    res.notice && h('span', { class: 'meta', text: res.notice }),
    h('div', { class: 'msg-tools' }, listen, meta),
  );
}

async function playAnswer(button, text, language) {
  answerPlayer.pause();
  stopDeviceVoice();
  try {
    const speech = await withBusy(button, () => fetchSpeech(text, language));
    if (answerPlayer.src) URL.revokeObjectURL(answerPlayer.src);
    answerPlayer.src = URL.createObjectURL(speech.blob);
    answerPlayer.play().catch(() => {});
  } catch (err) {
    if (err.status === 503) speakWithDevice(text, language);
    else notice($('ask-notice'), err.message, 'error');
  }
}

function setAskEnabled(enabled) {
  for (const el of [$('question'), $('ask-btn'), $('mic-btn'), ...$('suggested').children]) el.disabled = !enabled;
}

async function toggleMic() {
  const mic = $('mic-btn');
  if (state.micRecorder?.active) {
    state.micRecorder.stop();
    return;
  }
  notice($('ask-notice'), '');
  const recorder = new Recorder({
    maxSeconds: MAX_QUESTION_SECONDS,
    onTick: (t) => { $('question').placeholder = `Listening… ${clock(t)} / ${clock(MAX_QUESTION_SECONDS)}`; },
  });
  try {
    await recorder.start();
  } catch (err) {
    notice($('ask-notice'), err.message || 'Microphone access was blocked.', 'error');
    return;
  }
  state.micRecorder = recorder;
  mic.classList.add('is-recording');
  mic.setAttribute('aria-pressed', 'true');
  const blob = await recorder.done;
  mic.classList.remove('is-recording');
  mic.setAttribute('aria-pressed', 'false');
  $('question').placeholder = 'Ask about this place…';
  const language = $('target-language').value;
  try {
    const res = await withBusy(mic, async () => {
      const { wav } = await decodeToWav(await blob.arrayBuffer(), MAX_QUESTION_SECONDS + 1);
      return api(`transcribe?language=${encodeURIComponent(language)}&purpose=question`, {
        body: wav, headers: { 'Content-Type': 'audio/wav' },
      });
    });
    if (res.transcript) ask(res.transcript);
    else notice($('ask-notice'), res.notice || 'No speech was detected.');
  } catch (err) {
    notice($('ask-notice'), err.message, 'error');
  }
}

// ── Wiring ─────────────────────────────────────────────────────────────────

function fillLanguageSelect(select, selected) {
  select.replaceChildren(...Object.entries(state.health.languages).map(([code, english]) =>
    h('option', { value: code, selected: code === selected, text: NATIVE_NAMES[code] && NATIVE_NAMES[code] !== english ? `${NATIVE_NAMES[code]} · ${english}` : english })));
}

function bindEvents() {
  $('simulate-offline').addEventListener('change', (e) => { state.offline = e.target.checked; renderStatus(); });
  $('record-btn').addEventListener('click', toggleStoryRecording);
  $('upload-btn').addEventListener('click', () => $('upload-input').click());
  $('upload-input').addEventListener('change', (e) => {
    const [file] = e.target.files;
    if (file) loadClip(file, file.name);
    e.target.value = '';
  });
  $('sample-btn').addEventListener('click', useSample);
  $('transcribe-btn').addEventListener('click', transcribe);
  $('transcript').addEventListener('input', onTranscriptChange);
  $('reviewed-check').addEventListener('change', onTranscriptChange);
  $('reset-btn').addEventListener('click', () => { $('transcript').value = state.rawTranscript; onTranscriptChange(); });
  $('moderate-btn').addEventListener('click', runGate);
  $('publish-btn').addEventListener('click', publish);
  $('stop-select').addEventListener('change', (e) => {
    state.stop = state.stops.find((s) => s.id === e.target.value);
    renderGlossary();
    unpublish();
  });
  $('target-language').addEventListener('change', translate);
  $('speaker-select').addEventListener('change', clearNarration);
  $('speak-btn').addEventListener('click', speakNarration);
  $('device-play').addEventListener('click', () => state.translation && speakWithDevice(state.translation.text, state.translation.language));
  $('device-stop').addEventListener('click', stopDeviceVoice);
  $('mic-btn').addEventListener('click', toggleMic);
  $('ask-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const q = $('question').value;
    $('question').value = '';
    ask(q);
  });
}

async function init() {
  bindEvents();
  try {
    const [health, graph] = await Promise.all([api('health'), api('graph')]);
    state.health = health;
    state.stops = graph.stops;
  } catch {
    showServerDown();
    return;
  }
  state.stop = state.stops[0];
  fillLanguageSelect($('source-language'), 'ta-IN');
  fillLanguageSelect($('target-language'), 'hi-IN');
  $('stop-select').replaceChildren(...state.stops.map((s) =>
    h('option', { value: s.id, text: `${s.title['en-IN']}, ${s.place}` })));
  $('stop-title').textContent = `${state.stop.title['en-IN']} · ${state.stop.place}`;
  const { speakers, models: m } = state.health;
  $('speaker-select').replaceChildren(...speakers.map((name) =>
    h('option', { value: name, selected: name === m.speaker, text: name[0].toUpperCase() + name.slice(1) })));
  $('model-list').textContent = `${m.stt} (speech-to-text) · ${m.translate} (translation) · ${m.tts} (voice) · ${m.chat} (moderation and Q&A)`;
  renderGlossary();
  renderStatus();
}

init();
