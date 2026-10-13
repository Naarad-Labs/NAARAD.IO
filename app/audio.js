/* The listening bar.
 *
 * It lives outside the view container, so moving between a route, a story and
 * the catalogue does not interrupt narration.
 *
 * Two kinds of narration:
 *   recorded  a published audio file from a creator (none exist yet; the
 *             player uses one as soon as a stop carries an audioUrl)
 *   read      the device's own speech synthesis reading the published text,
 *             which the bar labels plainly so it is never mistaken for a
 *             creator's recording
 */

import { picture, escapeHtml } from './media.js';
import { icon } from './icons.js';

const synth = typeof window !== 'undefined' ? window.speechSynthesis : null;
const canRead = Boolean(synth);

let bar = null;
let queue = [];
let index = -1;
let mode = 'idle';      // idle | recorded | read
let element = null;     // HTMLAudioElement for recorded narration
let chunks = [];        // sentences for read-aloud
let chunkIndex = 0;
let spokenChars = 0;
let totalChars = 0;
let playing = false;
let rate = 1;
let listeners = new Set();

const SENTENCE = /[^.!?।]+[.!?।]*\s*/g;

function emit() {
  const state = {
    playing, mode, item: queue[index] || null, index, length: queue.length,
    progress: progressValue(), rate,
  };
  listeners.forEach((listener) => { try { listener(state); } catch { /* a view unmounted */ } });
}

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function progressValue() {
  if (mode === 'recorded' && element?.duration) return element.currentTime / element.duration;
  if (mode === 'read' && totalChars) return Math.min(spokenChars / totalChars, 1);
  return 0;
}

function timeLabel(seconds) {
  if (!Number.isFinite(seconds)) return '--:--';
  const value = Math.max(0, Math.round(seconds));
  return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`;
}

/** Rough spoken length: about 15 characters a second at normal pace. */
function estimateSeconds(text) {
  return Math.round((text.length / 15) / rate);
}

function splitSentences(text) {
  return String(text || '').match(SENTENCE)?.map((value) => value.trim()).filter(Boolean) || [];
}

function stopEverything() {
  if (synth) synth.cancel();
  if (element) { element.pause(); element.src = ''; element = null; }
  playing = false;
}

function speakChunk() {
  if (!canRead || chunkIndex >= chunks.length) { finishItem(); return; }
  const utterance = new SpeechSynthesisUtterance(chunks[chunkIndex]);
  utterance.rate = rate;
  utterance.lang = queue[index]?.lang || 'en-IN';
  const base = chunks.slice(0, chunkIndex).reduce((sum, chunk) => sum + chunk.length, 0);
  utterance.onboundary = (event) => {
    spokenChars = base + (event.charIndex || 0);
    emit();
  };
  utterance.onend = () => {
    if (!playing) return;
    spokenChars = base + chunks[chunkIndex].length;
    chunkIndex += 1;
    speakChunk();
  };
  utterance.onerror = () => { playing = false; emit(); };
  synth.speak(utterance);
}

function finishItem() {
  if (index < queue.length - 1) { playAt(index + 1); return; }
  playing = false;
  emit();
}

function playAt(next) {
  stopEverything();
  index = next;
  const item = queue[index];
  if (!item) { mode = 'idle'; emit(); return; }

  if (item.audioUrl) {
    mode = 'recorded';
    element = new Audio(item.audioUrl);
    element.preload = 'metadata';
    element.playbackRate = rate;
    element.addEventListener('timeupdate', emit);
    element.addEventListener('ended', finishItem);
    element.addEventListener('error', () => { playing = false; emit(); });
    playing = true;
    element.play().catch(() => { playing = false; emit(); });
  } else if (canRead && item.text) {
    mode = 'read';
    chunks = splitSentences(item.text);
    chunkIndex = 0;
    spokenChars = 0;
    totalChars = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    playing = true;
    speakChunk();
  } else {
    mode = 'idle';
    playing = false;
  }
  render();
  emit();
}

/** Start a queue. Items: { id, title, subtitle, photo, text, audioUrl, lang, href } */
export function play(items, start = 0) {
  queue = Array.isArray(items) ? items : [items];
  mount();
  playAt(Math.max(0, Math.min(start, queue.length - 1)));
}

export function toggle() {
  if (!queue.length) return;
  if (mode === 'recorded' && element) {
    if (playing) { element.pause(); playing = false; } else { element.play().catch(() => {}); playing = true; }
  } else if (mode === 'read' && synth) {
    if (playing) { synth.pause(); playing = false; } else { synth.resume(); playing = true; }
  } else {
    playAt(index < 0 ? 0 : index);
    return;
  }
  render();
  emit();
}

export function next() { if (index < queue.length - 1) playAt(index + 1); }
export function previous() { if (index > 0) playAt(index - 1); }

export function seekBy(seconds) {
  if (mode === 'recorded' && element?.duration) {
    element.currentTime = Math.max(0, Math.min(element.duration, element.currentTime + seconds));
  } else if (mode === 'read') {
    // Read-aloud moves by sentence, which is the nearest honest equivalent.
    const step = seconds > 0 ? 1 : -1;
    chunkIndex = Math.max(0, Math.min(chunks.length - 1, chunkIndex + step));
    spokenChars = chunks.slice(0, chunkIndex).reduce((sum, chunk) => sum + chunk.length, 0);
    if (synth) synth.cancel();
    if (playing) speakChunk();
  }
  emit();
}

export function setRate(value) {
  rate = value;
  if (element) element.playbackRate = value;
  if (mode === 'read' && playing && synth) { synth.cancel(); speakChunk(); }
  render();
}

export function close() {
  stopEverything();
  queue = []; index = -1; mode = 'idle';
  document.documentElement.style.setProperty('--player-h', '0px');
  bar?.remove();
  bar = null;
  emit();
}

export function currentItem() { return queue[index] || null; }
export function isPlaying() { return playing; }

function mount() {
  if (bar) return;
  bar = document.createElement('div');
  bar.className = 'listen-bar';
  bar.setAttribute('role', 'region');
  bar.setAttribute('aria-label', 'Audio player');
  document.body.append(bar);
  bar.addEventListener('click', (event) => {
    const action = event.target.closest('[data-audio]')?.dataset.audio;
    if (!action) return;
    if (action === 'toggle') toggle();
    if (action === 'back') seekBy(-15);
    if (action === 'forward') seekBy(15);
    if (action === 'next') next();
    if (action === 'close') close();
    if (action === 'rate') setRate(rate === 1 ? 1.25 : rate === 1.25 ? 1.5 : rate === 1.5 ? 0.75 : 1);
  });
  bar.addEventListener('input', (event) => {
    if (event.target.dataset.audio !== 'seek') return;
    const fraction = Number(event.target.value) / 1000;
    if (mode === 'recorded' && element?.duration) element.currentTime = fraction * element.duration;
  });
  subscribe(render);
}

function render() {
  if (!bar) return;
  const item = queue[index];
  if (!item) { close(); return; }

  const fraction = progressValue();
  const elapsed = mode === 'recorded' && element ? element.currentTime : (totalChars ? (spokenChars / 15) / rate : 0);
  const duration = mode === 'recorded' && element?.duration ? element.duration : estimateSeconds(item.text || '');
  const upNext = queue[index + 1];

  bar.innerHTML = `
    <div class="listen-art">${item.photo ? picture(item.photo, { sizes: '56px', alt: '', ratio: '1 / 1' }) : ''}</div>
    <div class="listen-meta">
      <strong>${escapeHtml(item.title)}</strong>
      <span>${escapeHtml(item.subtitle || '')}${queue.length > 1 ? ` · Stop ${index + 1} of ${queue.length}` : ''}</span>
    </div>
    <div class="listen-controls">
      <button type="button" data-audio="back" class="listen-skip" aria-label="Back 15 seconds">${icon('back15')}<span>15</span></button>
      <button type="button" data-audio="toggle" class="listen-play" aria-label="${playing ? 'Pause' : 'Play'}">${icon(playing ? 'pause' : 'play')}</button>
      <button type="button" data-audio="forward" class="listen-skip" aria-label="Forward 15 seconds">${icon('forward15')}<span>15</span></button>
    </div>
    <div class="listen-progress">
      <input type="range" min="0" max="1000" value="${Math.round(fraction * 1000)}" data-audio="seek"
        aria-label="Seek" ${mode === 'read' ? 'disabled' : ''}>
      <span class="listen-time">${timeLabel(elapsed)} / ${timeLabel(duration)}</span>
    </div>
    <div class="listen-aside">
      <span class="listen-source">${mode === 'read' ? 'Read aloud by your device' : 'Creator recording'}</span>
      <button type="button" data-audio="rate" class="listen-rate" aria-label="Playback speed">${rate}x</button>
      ${upNext ? `<span class="listen-next">${icon('list')}<span><small>Up next</small><b>${escapeHtml(upNext.title)}</b></span></span>` : ''}
      <button type="button" data-audio="close" class="icon-button listen-close" aria-label="Close player">${icon('close')}</button>
    </div>`;
  document.documentElement.style.setProperty('--player-h', `${bar.offsetHeight || 76}px`);
}

/** Can this device read a story aloud when no recording exists? */
export const readAloudAvailable = canRead;
