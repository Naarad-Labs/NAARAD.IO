/* Flyover hero animation for Naarad.io
 * HTML: .flyover-hero with .flyover-media containing <video class="flyover-video"> (with poster) and <canvas class="flyover-canvas">.
 * API: init(heroEl, options) -> controller { start(), stop(), destroy() }
 * options: { photoId, duration: 30000, kenBurns: true, dither: true, palette: 'sand' }
 */

import { mountDither, pickPalette } from './dither.js';
import { photoPath } from './media.js';

export function initFlyover(heroEl, options = {}) {
  const {
    photoId,
    duration = 30000,
    kenBurns = true,
    dither = true,
    palette = 'sand',
  } = options;

  // Early exit if reduced-motion is preferred
  const prefersReducedMotion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReducedMotion) {
    const media = document.createElement('div');
    media.className = 'flyover-media';
    heroEl.innerHTML = '';
    heroEl.appendChild(media);
    return { start() {}, stop() {}, destroy() {} };
  }

  // Create .flyover-media container
  const mediaEl = document.createElement('div');
  mediaEl.className = 'flyover-media';
  heroEl.innerHTML = '';
  heroEl.appendChild(mediaEl);

  // Create video element with poster and sources
  const videoEl = document.createElement('video');
  videoEl.className = 'flyover-video';
  videoEl.muted = true;
  videoEl.loop = true;
  videoEl.playsInline = true;
  videoEl.setAttribute('aria-hidden', 'true');

  // Set poster from photoId if available
  if (photoId) {
    const pp = photoPath(photoId);
    if (pp) {
      videoEl.poster = pp;
    }
  }

  let videoSourcesAvailable = false;
  let canvasEl = null;
  let ditherTeardown = null;

  function setupKenBurns() {
    canvasEl = document.createElement('canvas');
    canvasEl.className = 'flyover-canvas';
    canvasEl.width = heroEl.clientWidth || 1600;
    canvasEl.height = heroEl.clientHeight || 900;
    mediaEl.appendChild(canvasEl);

    // Apply the existing hero-drift keyframes via CSS animation
    // @keyframes hero-drift { from { transform: scale(1.015) translate3d(0, 0, 0); }
    //                         to { transform: scale(1.075) translate3d(0, -1.1%, 0); } }
    // [data-motion='on'] .story-hero-photo img { animation: hero-drift 28s var(--ease-out) alternate infinite; }
    canvasEl.style.animation = 'hero-drift ' + (duration / 1000) + 's var(--ease-out) alternate infinite';
    canvasEl.dataset.motion = 'on';

    Object.assign(canvasEl.style, {
      position: 'absolute',
      inset: 0,
      width: '100%',
      height: '100%',
      objectFit: 'cover',
    });
  }

  function checkAndSetupVideo() {
    if (!photoId) {
      setupKenBurns();
      return;
    }

    const pp = photoPath(photoId);
    if (pp) {
      videoEl.src = pp;
      videoEl.poster = pp;
      videoEl.oncanplaythrough = () => {
        videoSourcesAvailable = true;
        videoEl.play();
      };
      videoEl.onerror = () => {
        videoSourcesAvailable = false;
        setupKenBurns();
      };
      mediaEl.appendChild(videoEl);
      if (videoEl.readyState < videoEl.HAVE_METADATA) {
        videoEl.load();
      }
    } else {
      setupKenBurns();
    }
  }

  function showMedia() {
    mediaEl.style.opacity = 1;
  }

  function start() {
    if (prefersReducedMotion) return;

    if (videoSourcesAvailable) {
      return;
    }

    if (canvasEl && videoEl.src && !videoSourcesAvailable) {
      videoEl.play().catch(() => {
        setupKenBurns();
        showMedia();
      });
      return;
    }

    setupKenBurns();
    showMedia();
  }

  function stop() {
    if (prefersReducedMotion) return;

    if (videoEl && videoEl.src) {
      videoEl.pause();
    }
    if (canvasEl) {
      canvasEl.style.animation = 'none';
      canvasEl.dataset.motion = 'off';
    }
  }

  function destroy() {
    stop();

    if (ditherTeardown && typeof ditherTeardown === 'function') {
      ditherTeardown();
      ditherTeardown = null;
    }

    if (mediaEl && mediaEl.parentNode) {
      mediaEl.parentNode.removeChild(mediaEl);
    }

    if (videoEl && videoEl.parentNode) {
      videoEl.parentNode.removeChild(videoEl);
    }

    if (canvasEl && canvasEl.parentNode) {
      canvasEl.parentNode.removeChild(canvasEl);
    }

    heroEl.dataset.motion = '';
    heroEl.style.animation = '';
  }

  // Initial setup: check for video sources and set up accordingly
  checkAndSetupVideo();
  showMedia();

  // If dither is enabled, mount dither.js on the hero
  if (dither) {
    try {
      ditherTeardown = mountDither(heroEl, { palette });
    } catch (e) {
      console.error('Dither mount failed:', e);
    }
  }

  // Return controller
  return { start, stop, destroy };
}
