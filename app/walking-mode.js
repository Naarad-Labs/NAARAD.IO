/* Walking mode module for VoiceMap-style audio-guided walking experience.
 *
 * HTML structure:
 *   .walking-bar   - fixed bottom, hidden by default
 *     .walking-bar-art  - img
 *     .walking-bar-meta - strong + span
 *     .walking-bar-progress - input[type=range]
 *     .walking-bar-time
 *     .walking-bar-actions - .walking-bar-play, .walking-bar-expand
 *   .walking-screen - fixed inset, z-index 1200, hidden
 *     .walking-screen-map  - #walking-map
 *     .walking-screen-header - .walking-screen-title, .walking-screen-close
 *     .walking-screen-stop - .walking-screen-stop-name, .walking-screen-stop-tagline, .walking-screen-progress
 *     .walking-screen-controls - .walking-screen-btn.play, .walking-screen-btn for prev/next/close
 *
 * API:
 *   init(route, options) -> controller
 *     play(stop), pause(), next(), prev(), openScreen(), closeScreen(), on(event, fn), destroy()
 *   options: { audio: Audio module, map: Leaflet map instance, onStopChange: fn }
 *   Events: 'play', 'pause', 'stopchange', 'screenopen', 'screenclose'
 *
 * Manages:
 *   - walking-bar visibility (show when playing)
 *   - walking-screen open/close
 *   - stop progress from audio
 *   - GPS location marker on map (if provided)
 *   - keyboard shortcuts (Space=play/pause, ArrowRight=next, ArrowLeft=prev)
 */

import * as Audio from './audio.js';
import { icon } from './icons.js';

// CSS styles for the walking mode
const barStyles = `.walking-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: 56px;
  background: var(--surface, #fff);
  border-top: 1px solid var(--border, #e0e0e0);
  z-index: 1100;
  display: none;
  align-items: center;
  gap: 8px;
  padding: 0 12px;
  box-sizing: border-box;
}

.walking-bar.active {
  display: flex;
}

.walking-bar-art {
  width: 48px;
  height: 48px;
  flex-shrink: 0;
  background: #eee;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 8px;
}

.walking-bar-art img {
  max-width: 100%;
  max-height: 100%;
  object-fit: cover;
  border-radius: 6px;
}

.walking-bar-meta {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.walking-bar-meta strong {
  font-size: 14px;
  color: var(--on-surface, #000);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 200px;
}

.walking-bar-meta span {
  font-size: 12px;
  color: var(--on-surface-variant, #666);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 200px;
}

.walking-bar-progress {
  flex: 1;
  height: 24px;
  -webkit-appearance: none;
  background: var(--secondary, #e0e0e0);
  border-radius: 12px;
  outline: none;
  margin: 0 8px;
}

.walking-bar-progress::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 20px;
  height: 20px;
  background: #3b82f6;
  border-radius: 50%;
  cursor: pointer;
  margin-top: -8px;
}

.walking-bar-progress::-moz-range-thumb {
  width: 20px;
  height: 20px;
  background: #3b82f6;
  border-radius: 50%;
  cursor: pointer;
  margin-top: -8px;
}

.walking-bar-time {
  font-size: 12px;
  color: var(--on-surface-variant, #666);
  white-space: nowrap;
  min-width: 40px;
}

.walking-bar-actions {
  display: flex;
  gap: 8px;
}

.walking-bar-play,
.walking-bar-expand {
  width: 32px;
  height: 32px;
  background: none;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--on-surface, #000);
}

.walking-bar-play:hover,
.walking-bar-expand:hover {
  color: #3b82f6;
}

.walking-bar-play.playing .icon-pause,
.walking-bar-play:not(.playing) .icon-play {
  display: block;
}

.walking-bar-play.playing .icon-play,
.walking-bar-play:not(.playing) .icon-pause {
  display: none;
}`;

const screenStyles = `.walking-screen {
  position: fixed;
  inset: 0;
  z-index: 1200;
  background: rgba(0, 0, 0, 0.7);
  display: none;
  align-items: center;
  justify-content: center;
}

.walking-screen.active {
  display: flex;
}

.walking-screen-map {
  width: 100%;
  max-width: 400px;
  height: 100%;
  max-height: 600px;
  background: #fff;
  border-radius: 12px;
  position: relative;
}

.walking-screen-map #walking-map {
  width: 100%;
  height: 100%;
}

.walking-screen-header {
  padding: 12px 16px;
  color: #fff;
  background: rgba(0, 0, 0, 0.5);
  border-radius: 12px 12px 0 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  max-width: 400px;
}

.walking-screen-title {
  font-size: 18px;
  font-weight: 600;
}

.walking-screen-close {
  background: none;
  border: none;
  color: #fff;
  font-size: 24px;
  cursor: pointer;
  padding: 4px;
}

.walking-screen-close:hover {
  color: #ff5f5f;
}

.walking-screen-stop {
  padding: 16px;
  color: #fff;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 0 0 12px 12px;
  width: 100%;
  max-width: 400px;
}

.walking-screen-stop-name {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 4px;
}

.walking-screen-stop-tagline {
  font-size: 13px;
  color: #ccc;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 300px;
}

.walking-screen-progress {
  font-size: 12px;
  color: #666;
  margin-top: 4px;
}

.walking-screen-controls {
  padding: 12px 16px;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 0 0 12px 12px;
  width: 100%;
  max-width: 400px;
  display: flex;
  justify-content: center;
  gap: 12px;
}

.walking-screen-btn {
  background: none;
  border: none;
  color: #fff;
  font-size: 14px;
  cursor: pointer;
  padding: 6px 12px;
  border-radius: 6px;
}

.walking-screen-btn.play {
  background: #3b82f6;
}

.walking-screen-btn.prev {
  background: #6b7280;
}

.walking-screen-btn.next {
  background: #6b7280;
}

.walking-screen-btn.close {
  background: #ff5f5f;
}

.walking-screen-btn:hover {
  opacity: 0.9;
}`;

const allStyles = barStyles + screenStyles;
const styleSheet = document.createElement('style');
styleSheet.textContent = allStyles;
document.head.appendChild(styleSheet);

// Walking mode module - functional approach
const walkingModeModule = (function() {
  let controller = null;
  let isPlaying = false;
  let currentStop = null;
  let map = null;
  let onStopChange = null;
  let audioBar = null;
  let screen = null;
  let userMarker = null;
  let eventListeners = new Set();
  let keyboardHandler = null;

  // Initialize the walking mode
  function init(route, options) {
    const { audio, map: leafletMap, onStopChange: callback } = options || {};

    // Store references
    map = leafletMap;
    onStopChange = callback;

    // Build HTML elements
    buildElements();

    // Subscribe to audio module events
    if (audio) {
      subscribeToAudio(audio);
    }

    // Set up keyboard shortcuts
    keyboardHandler = setupKeyboardShortcuts();

    // Return controller object
    controller = {
      play: function(stop) { playStop(stop); },
      pause: function() { if (isPlaying && audioBar) { audio.toggle(); } },
      next: function() { if (audio) { audio.next(); } },
      prev: function() { if (audio) { audio.previous(); } },
      openScreen: function() {
        if (screen) {
          screen.classList.add('active');
          document.body.classList.add('no-scroll');
          eventListeners.forEach(fn => fn('screenopen'));
        }
      },
      closeScreen: function() {
        if (screen) {
          screen.classList.remove('active');
          document.body.classList.remove('no-scroll');
          eventListeners.forEach(fn => fn('screenclose'));
        }
      },
      on: function(event, fn) {
        eventListeners.add(fn);
        return function() { eventListeners.delete(fn); };
      },
      destroy: function() { cleanup(); }
    };

    return controller;
  }

  // Build the HTML elements
  function buildElements() {
    // Create walking bar
    audioBar = document.createElement('div');
    audioBar.className = 'walking-bar';
    audioBar.innerHTML = `
      <div class="walking-bar-art">
        <img src="" alt="Stop artwork">
      </div>
      <div class="walking-bar-meta">
        <strong></strong>
        <span></span>
      </div>
      <input type="range" class="walking-bar-progress" min="0" max="1000" value="0">
      <span class="walking-bar-time">0:00</span>
      <div class="walking-bar-actions">
        <button class="walking-bar-play" aria-label="Play">
          ${icon('play', { className: 'icon icon-play' })}
          ${icon('pause', { className: 'icon icon-pause', label: 'Pause' })}
        </button>
        <button class="walking-bar-expand" aria-label="Expand to walking screen">
          ${icon('map', { className: 'icon icon-expand' })}
        </button>
      </div>
    `;
    document.body.appendChild(audioBar);

    // Create walking screen
    screen = document.createElement('div');
    screen.className = 'walking-screen';
    screen.innerHTML = `
      <div class="walking-screen-map">
        <div id="walking-map"></div>
      </div>
      <div class="walking-screen-header">
        <span class="walking-screen-title">Stop title</span>
        <button class="walking-screen-close" aria-label="Close walking screen">&times;</button>
      </div>
      <div class="walking-screen-stop">
        <div class="walking-screen-stop-name">Stop name</div>
        <div class="walking-screen-stop-tagline">Tagline or description</div>
        <div class="walking-screen-progress">Progress: 0:00 / 0:00</div>
      </div>
      <div class="walking-screen-controls">
        <button class="walking-screen-btn prev" aria-label="Previous stop"><</button>
        <button class="walking-screen-btn play" aria-label="Play/pause">Play</button>
        <button class="walking-screen-btn next" aria-label="Next stop">></button>
        <button class="walking-screen-btn close" aria-label="Close">Close</button>
      </div>
    `;
    document.body.appendChild(screen);

    // Initialize map if Leaflet is provided
    if (map && window.L) {
      initMap();
    }

    // Set up event listeners for walking screen
    setupWalkingScreenListeners();
  }

  // Initialize the walking screen map
  function initMap() {
    const mapContainer = screen.querySelector('#walking-map');
    if (!mapContainer || !window.L) return;

    // Create a new Leaflet map instance for the walking screen
    const walkingMap = window.L.map(mapContainer).setView([0, 0], 15);

    // Add a tile layer (use OSM as default)
    window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(walkingMap);

    // Sync with the main map if it has a route
    if (map && map.getBounds) {
      const bounds = map.getBounds();
      if (bounds && bounds.isValid()) {
        walkingMap.fitBounds(bounds);
      }
    }

    // Store reference
    screen._walkingMap = walkingMap;
  }

  // Update user location marker on map
  function updateUserMarker(lat, lng) {
    if (!screen || !screen._walkingMap || !window.L) return;

    const walkingMap = screen._walkingMap;
    if (userMarker) {
      userMarker.setLatLng([lat, lng]);
    } else {
      userMarker = window.L.marker([lat, lng], {
        icon: window.L.divIcon({
          className: 'walking-user-marker',
          html: '<div style="width: 20px; height: 20px; background: #3b82f6; border: 3px solid #fff; border-radius: 50%; box-shadow: 0 2px 6px rgba(0,0,0,0.3);"></div>',
          iconSize: [20, 20],
          iconAnchor: [10, 10]
        })
      }).addTo(walkingMap);
    }

    // Pan map to user location if not manually moved
    if (!screen._mapMoved) {
      walkingMap.panTo([lat, lng], { animate: true });
    }

    // Listen for map movement to disable auto-pan
    walkingMap.off('dragstart', screen._dragHandler);
    screen._dragHandler = function() {
      screen._mapMoved = true;
    };
    walkingMap.on('dragstart', screen._dragHandler);
  }

  // Subscribe to audio module events
  function subscribeToAudio(audio) {
    // Subscribe to state changes
    const unsubscribe = audio.subscribe(function(state) {
      updateFromAudioState(state);
    });

    // Initial update
    if (audio.currentItem()) {
      updateFromAudioState({
        playing: audio.isPlaying(),
        mode: 'recorded',
        item: audio.currentItem(),
        index: 0,
        length: 1,
        progress: 0,
        rate: 1
      });
    }
  }

  // Update UI from audio state
  function updateFromAudioState(state) {
    if (!audioBar) return;

    isPlaying = state.playing || false;
    currentStop = state.item || null;

    // Update walking bar
    if (audioBar) {
      audioBar.classList.toggle('active', isPlaying);

      // Update play/pause button state
      const playBtn = audioBar.querySelector('.walking-bar-play');
      if (playBtn) {
        playBtn.classList.toggle('playing', isPlaying);
      }

      // Update metadata
      const metaStrong = audioBar.querySelector('.walking-bar-meta strong');
      const metaSpan = audioBar.querySelector('.walking-bar-meta span');
      const progressInput = audioBar.querySelector('.walking-bar-progress');
      const timeSpan = audioBar.querySelector('.walking-bar-time');

      if (metaStrong && currentStop) {
        metaStrong.textContent = currentStop.title || 'Stop';
      }
      if (metaSpan && currentStop) {
        const subtitle = currentStop.subtitle || currentStop.tagline || '';
        metaSpan.textContent = subtitle ? subtitle : '';
      }

      // Update progress
      if (progressInput) {
        progressInput.value = state.progress !== undefined ? Math.round(state.progress * 1000) : 0;
      }

      // Update time
      if (timeSpan) {
        const seconds = state.progress !== undefined ? Math.round(state.progress * 60) : 0;
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        timeSpan.textContent = mins + ':' + (secs < 10 ? '0' : '') + secs;
      }
    }

    // Update walking screen if open
    if (screen && currentStop) {
      const screenTitle = screen.querySelector('.walking-screen-title');
      const screenStopName = screen.querySelector('.walking-screen-stop-name');
      const screenTagline = screen.querySelector('.walking-screen-stop-tagline');
      const screenProgress = screen.querySelector('.walking-screen-progress');
      const playBtn = screen.querySelector('.walking-screen-btn.play');

      if (screenTitle) screenTitle.textContent = currentStop.title || 'Stop';
      if (screenStopName) screenStopName.textContent = currentStop.title || 'Stop';
      if (screenTagline) screenTagline.textContent = currentStop.tagline || currentStop.subtitle || '';
      if (screenProgress) {
        screenProgress.textContent = 'Progress: 0:00 / ' + (currentStop.duration || '0:00');
      }
      if (playBtn) {
        playBtn.textContent = isPlaying ? 'Pause' : 'Play';
      }

      // Update map with stop location if available
      if (currentStop.lat && currentStop.lng && screen._walkingMap && window.L) {
        const walkingMap = screen._walkingMap;
        // Add stop marker
        if (screen._stopMarker) {
          walkingMap.removeLayer(screen._stopMarker);
        }
        screen._stopMarker = window.L.marker([currentStop.lat, currentStop.lng], {
          icon: window.L.divIcon({
            className: 'walking-stop-marker',
            html: '<div style="width: 16px; height: 16px; background: #ff5f5f; border: 3px solid #fff; border-radius: 50%; box-shadow: 0 2px 6px rgba(0,0,0,0.3);"></div>',
            iconSize: [16, 16],
            iconAnchor: [8, 8]
          })
        }).addTo(walkingMap);
      }
    }

    // Call onStopChange callback
    if (onStopChange && currentStop) {
      onStopChange(currentStop);
    }

    // Emit events
    eventListeners.forEach(function(fn) {
      try {
        fn(isPlaying ? 'play' : 'pause');
      } catch (e) {}
    });
  }

  // Play a specific stop
  function playStop(stop) {
    if (audio) {
      // If stop is provided, try to play it
      if (stop && stop.audioUrl) {
        audio.play(stop);
      } else if (stop && stop.text) {
        audio.play([stop]);
      } else {
        audio.toggle();
      }
    }
  }

  // Next stop
  function nextStop() {
    if (audio) {
      audio.next();
    }
  }

  // Previous stop
  function prevStop() {
    if (audio) {
      audio.previous();
    }
  }

  // Set up keyboard shortcuts
  function setupKeyboardShortcuts() {
    const handleKeyDown = function(event) {
      // Space = play/pause
      if (event.key === ' ') {
        event.preventDefault();
        if (audio) {
          audio.toggle();
        }
      }
      // ArrowRight = next
      else if (event.key === 'ArrowRight') {
        if (audio) {
          audio.next();
        }
      }
      // ArrowLeft = prev
      else if (event.key === 'ArrowLeft') {
        if (audio) {
          audio.previous();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    // Return cleanup function
    return function() {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }

  // Set up walking screen event listeners
  function setupWalkingScreenListeners() {
    if (!screen) return;

    const closeBtn = screen.querySelector('.walking-screen-close');
    const playBtn = screen.querySelector('.walking-screen-btn.play');
    const prevBtn = screen.querySelector('.walking-screen-btn.prev');
    const nextBtn = screen.querySelector('.walking-screen-btn.next');

    if (closeBtn) {
      closeBtn.addEventListener('click', function() {
        if (screen) screen.classList.remove('active');
        document.body.classList.remove('no-scroll');
        eventListeners.forEach(fn => fn('screenclose'));
      });
    }

    if (playBtn) {
      playBtn.addEventListener('click', function() {
        if (audio) {
          audio.toggle();
        }
        if (screen) screen.classList.add('active');
        document.body.classList.add('no-scroll');
        eventListeners.forEach(fn => fn('screenopen'));
      });
    }

    if (prevBtn) {
      prevBtn.addEventListener('click', function() {
        if (audio) {
          audio.previous();
        }
      });
    }

    if (nextBtn) {
      nextBtn.addEventListener('click', function() {
        if (audio) {
          audio.next();
        }
      });
    }
  }

  // Clean up
  function cleanup() {
    // Remove event listeners
    eventListeners.clear();

    // Remove HTML elements
    if (audioBar) {
      audioBar.remove();
      audioBar = null;
    }

    if (screen) {
      // Clean up map if exists
      if (screen._walkingMap) {
        screen._walkingMap.remove();
        screen._walkingMap = null;
      }
      screen.remove();
      screen = null;
    }

    // Remove keyboard shortcuts
    if (keyboardHandler) {
      keyboardHandler();
      keyboardHandler = null;
    }
  }

  return {
    init: init
  };
})();

// Export as ES module
export function initWalkingMode(route, options) {
  return walkingModeModule.init(route, options);
}
