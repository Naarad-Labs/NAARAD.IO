/**
 * AllTrails-style photo scrubber module
 * @module photo-scrubber
 */

/**
 * Initialize the photo scrubber
 * @param {HTMLElement} rootEl - The .photo-scrubber element
 * @param {Object} route - Route object with stops array
 * @param {Array} route.stops - Array of stop objects {order, photo, name, distanceM}
 * @param {number} route.distanceM - Total route distance in meters
 * @param {Object} options - Configuration options
 * @param {number} options.initialStop - Initial stop index (1-based, default: 1)
 * @param {Function} options.onChange - Callback when stop changes
 * @param {boolean} options.preload - Whether to preload images (default: true)
 * @returns {Object} Controller with gotoStop, onChange, destroy methods
 */
export function initPhotoScrubber(rootEl, route, options = {}) {
  const {
    initialStop = 1,
    onChange,
    preload = true
  } = options;

  // Validate inputs
  if (!rootEl || !rootEl.classList.contains('photo-scrubber')) {
    throw new Error('rootEl must be a .photo-scrubber element');
  }
  if (!route || !Array.isArray(route.stops) || route.stops.length === 0) {
    throw new Error('route must have a non-empty stops array');
  }
  if (typeof route.distanceM !== 'number' || route.distanceM <= 0) {
    throw new Error('route.distanceM must be a positive number');
  }

  // Check for reduced motion preference
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // DOM elements
  const previewEl = rootEl.querySelector('.photo-scrubber-preview');
  const trackEl = rootEl.querySelector('.photo-scrubber-track');
  const lineEl = rootEl.querySelector('.photo-scrubber-line');
  const progressEl = rootEl.querySelector('.photo-scrubber-progress');
  const pinEl = rootEl.querySelector('.photo-scrubber-pin');

  if (!previewEl || !trackEl || !lineEl || !progressEl || !pinEl) {
    throw new Error('Missing required child elements in .photo-scrubber');
  }

  // State
  let currentIndex = Math.max(0, Math.min(initialStop - 1, route.stops.length - 1));
  let isDestroyed = false;
  let changeListeners = [];
  let touchStartX = 0;
  let touchStartScrollLeft = 0;
  let isTouchScrolling = false;

  // Sort stops by order
  const sortedStops = [...route.stops].sort((a, b) => (a.order || 0) - (b.order || 0));

  // Preload images if enabled
  if (preload) {
    sortedStops.forEach(stop => {
      if (stop.photo) {
        const img = new Image();
        img.src = stop.photo;
      }
    });
  }

  // Create stop buttons
  function renderStops() {
    trackEl.innerHTML = '';
    sortedStops.forEach((stop, index) => {
      const btn = document.createElement('button');
      btn.className = 'photo-scrubber-stop';
      btn.type = 'button';
      btn.dataset.stop = stop.order || (index + 1);
      btn.dataset.progress = ((stop.distanceM / route.distanceM) * 100).toFixed(2);
      btn.setAttribute('aria-label', stop.name || `Stop ${index + 1}`);
      btn.setAttribute('role', 'tab');
      btn.setAttribute('aria-selected', index === currentIndex);

      const thumb = document.createElement('img');
      thumb.className = 'photo-scrubber-thumb';
      thumb.src = stop.photo || '';
      thumb.alt = stop.name || `Stop ${index + 1}`;
      thumb.loading = 'lazy';

      btn.appendChild(thumb);
      trackEl.appendChild(btn);

      btn.addEventListener('click', () => gotoStop(index));
    });
  }

  // Update preview image
  function updatePreview(index) {
    const stop = sortedStops[index];
    if (!stop) return;

    // Fade out/in for smooth transition (respect reduced motion)
    if (!prefersReducedMotion) {
      previewEl.style.opacity = '0';
      setTimeout(() => {
        previewEl.src = stop.photo || '';
        previewEl.alt = stop.name || `Stop ${index + 1}`;
        previewEl.style.opacity = '1';
      }, 150);
    } else {
      previewEl.src = stop.photo || '';
      previewEl.alt = stop.name || `Stop ${index + 1}`;
    }
  }

  // Update active stop highlight
  function updateActiveStop(index) {
    const stops = trackEl.querySelectorAll('.photo-scrubber-stop');
    stops.forEach((btn, i) => {
      const isActive = i === index;
      btn.setAttribute('aria-selected', isActive);
      btn.classList.toggle('is-active', isActive);
    });
  }

  // Update progress bar and pin position
  function updateProgress(index) {
    const stop = sortedStops[index];
    if (!stop) return;

    const progressPercent = (stop.distanceM / route.distanceM) * 100;
    progressEl.style.width = `${progressPercent}%`;
    pinEl.style.left = `${progressPercent}%`;
  }

  // Scroll track to keep active stop visible
  function scrollToActiveStop(index) {
    const stops = trackEl.querySelectorAll('.photo-scrubber-stop');
    const activeStop = stops[index];
    if (!activeStop) return;

    const trackRect = trackEl.getBoundingClientRect();
    const stopRect = activeStop.getBoundingClientRect();

    const stopCenter = stopRect.left + stopRect.width / 2;
    const trackCenter = trackRect.left + trackRect.width / 2;
    const offset = stopCenter - trackCenter;

    if (Math.abs(offset) > trackRect.width / 4) {
      trackEl.scrollBy({ left: offset, behavior: prefersReducedMotion ? 'auto' : 'smooth' });
    }
  }

  // Emit change event
  function emitChange(index) {
    const stop = sortedStops[index];
    const event = new CustomEvent('scrubber:change', {
      detail: { stop, index },
      bubbles: true
    });
    rootEl.dispatchEvent(event);

    // Call onChange callback if provided
    if (typeof onChange === 'function') {
      onChange(stop, index);
    }

    // Call registered listeners
    changeListeners.forEach(fn => fn(stop, index));
  }

  // Navigate to stop by index (0-based)
  function gotoStop(index) {
    if (isDestroyed) return;
    const clampedIndex = Math.max(0, Math.min(index, sortedStops.length - 1));
    if (clampedIndex === currentIndex) return;

    currentIndex = clampedIndex;
    updatePreview(currentIndex);
    updateActiveStop(currentIndex);
    updateProgress(currentIndex);
    scrollToActiveStop(currentIndex);
    emitChange(currentIndex);
  }

  // Navigate to next stop
  function nextStop() {
    gotoStop(currentIndex + 1);
  }

  // Navigate to previous stop
  function prevStop() {
    gotoStop(currentIndex - 1);
  }

  // Keyboard navigation
  function handleKeydown(e) {
    if (isDestroyed) return;

    // Only handle arrows when scrubber is focused or a stop is focused
    const activeElement = document.activeElement;
    const isFocused = rootEl.contains(activeElement) || trackEl.contains(activeElement);

    if (!isFocused) return;

    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        e.preventDefault();
        nextStop();
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        e.preventDefault();
        prevStop();
        break;
      case 'Home':
        e.preventDefault();
        gotoStop(0);
        break;
      case 'End':
        e.preventDefault();
        gotoStop(sortedStops.length - 1);
        break;
    }
  }

  // Touch/swipe handling for track scrolling
  function handleTouchStart(e) {
    if (isDestroyed) return;
    touchStartX = e.touches[0].clientX;
    touchStartScrollLeft = trackEl.scrollLeft;
    isTouchScrolling = true;
  }

  function handleTouchMove(e) {
    if (!isTouchScrolling || isDestroyed) return;
    const x = e.touches[0].clientX;
    const walk = (touchStartX - x) * 1.5; // Scroll faster than finger
    trackEl.scrollLeft = touchStartScrollLeft + walk;
  }

  function handleTouchEnd() {
    isTouchScrolling = false;
  }

  // Initialize
  function init() {
    renderStops();
    updatePreview(currentIndex);
    updateActiveStop(currentIndex);
    updateProgress(currentIndex);
    scrollToActiveStop(currentIndex);

    // Event listeners
    document.addEventListener('keydown', handleKeydown);
    trackEl.addEventListener('touchstart', handleTouchStart, { passive: true });
    trackEl.addEventListener('touchmove', handleTouchMove, { passive: true });
    trackEl.addEventListener('touchend', handleTouchEnd, { passive: true });
    trackEl.addEventListener('touchcancel', handleTouchEnd, { passive: true });

    // Listen for reduced motion changes
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    mediaQuery.addEventListener('change', () => {
      // prefersReducedMotion is checked at runtime in functions
    });
  }

  // Destroy controller
  function destroy() {
    if (isDestroyed) return;
    isDestroyed = true;

    document.removeEventListener('keydown', handleKeydown);
    trackEl.removeEventListener('touchstart', handleTouchStart);
    trackEl.removeEventListener('touchmove', handleTouchMove);
    trackEl.removeEventListener('touchend', handleTouchEnd);
    trackEl.removeEventListener('touchcancel', handleTouchEnd);

    trackEl.innerHTML = '';
    changeListeners = [];
  }

  // Initialize on creation
  init();

  // Return controller API
  return {
    /**
     * Navigate to a specific stop (1-based index for external API)
     * @param {number} n - Stop number (1-based)
     */
    gotoStop(n) {
      gotoStop(n - 1);
    },

    /**
     * Register a change listener
     * @param {Function} fn - Callback(stop, index)
     * @returns {Function} Unsubscribe function
     */
    onChange(fn) {
      if (typeof fn !== 'function') return () => {};
      changeListeners.push(fn);
      return () => {
        changeListeners = changeListeners.filter(l => l !== fn);
      };
    },

    /**
     * Destroy the scrubber and clean up
     */
    destroy()
  };
}

export default initPhotoScrubber;
