const LEAFLET_CSS = '/app/vendor/leaflet/leaflet.css';
const LEAFLET_JS = '/app/vendor/leaflet/leaflet.js';
const STREET_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const SATELLITE_URL = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';

let leafletPromise;
let mapCssPromise;
const mountedMaps = new WeakMap();

function loadMapCss() {
  if (mapCssPromise) return mapCssPromise;
  mapCssPromise = new Promise((resolve) => {
    if (document.querySelector('link[data-naarad-map-css]')) return resolve();
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = new URL('./map.css', import.meta.url).href;
    link.dataset.naaradMapCss = '';
    link.onload = resolve;
    link.onerror = resolve;
    document.head.append(link);
  });
  return mapCssPromise;
}

function loadLeaflet() {
  let stylesheet = document.querySelector('link[data-naarad-leaflet]');
  if (!stylesheet) {
    stylesheet = document.createElement('link');
    stylesheet.rel = 'stylesheet';
    stylesheet.href = LEAFLET_CSS;
    stylesheet.dataset.naaradLeaflet = '';
    document.head.append(stylesheet);
  }
  if (window.L) return Promise.resolve(window.L);
  if (leafletPromise) return leafletPromise;

  leafletPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-naarad-leaflet]');
    if (existing) {
      existing.addEventListener('load', () => window.L ? resolve(window.L) : reject(new Error('Leaflet did not initialize.')), { once: true });
      existing.addEventListener('error', () => {
        existing.remove();
        reject(new Error('Could not load Leaflet.'));
      }, { once: true });
      if (window.L) resolve(window.L);
      return;
    }

    const script = document.createElement('script');
    script.src = LEAFLET_JS;
    script.async = true;
    script.dataset.naaradLeaflet = '';
    script.onload = () => window.L ? resolve(window.L) : reject(new Error('Leaflet did not initialize.'));
    script.onerror = () => {
      script.remove();
      reject(new Error('Could not load Leaflet.'));
    };
    document.head.append(script);
  }).catch((error) => {
    leafletPromise = undefined;
    throw error;
  });

  return leafletPromise;
}

function coordinate(value) {
  if (!Array.isArray(value) || value.length < 2) return null;
  const lng = Number(value[0]);
  const lat = Number(value[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return [lat, lng];
}

function geoJsonLines(input) {
  if (!input || typeof input !== 'object') return [];
  if (input.type === 'FeatureCollection' && Array.isArray(input.features)) {
    return input.features.flatMap(geoJsonLines);
  }
  if (input.type === 'GeometryCollection' && Array.isArray(input.geometries)) {
    return input.geometries.flatMap(geoJsonLines);
  }
  const geometry = input.type === 'Feature' ? input.geometry : input;
  if (!geometry || typeof geometry !== 'object') return [];
  if (geometry.type === 'LineString' && Array.isArray(geometry.coordinates)) {
    const points = geometry.coordinates.map(coordinate);
    return points.length >= 2 && points.every(Boolean) ? [points] : [];
  }
  if (geometry.type === 'MultiLineString' && Array.isArray(geometry.coordinates)) {
    return geometry.coordinates.map((line) => Array.isArray(line) ? line.map(coordinate) : [])
      .filter((line) => line.length >= 2 && line.every(Boolean));
  }
  return [];
}

function routeLines(route) {
  // A GeoJSON line is an explicit published track. Legacy [lat, lng] sketches
  // are intentionally ignored because they often imply a route that does not exist.
  const geometry = route?.geometry ?? route?.geometryPreview ?? route?.path ?? route?.path_preview;

  // The route model carries { kind, coordinates } with [lng, lat] pairs, which
  // is a GeoJSON LineString in all but name.
  if (geometry && !geometry.type && Array.isArray(geometry.coordinates)) {
    return geoJsonLines({ type: 'LineString', coordinates: geometry.coordinates });
  }
  return geoJsonLines(geometry);
}

function explicitStops(route) {
  const source = [route?.stops, route?.story_stops, route?.audioStops].find((stops) => Array.isArray(stops) && stops.length);
  if (!source) return [];
  return source.map((stop, index) => {
    const lat = Number(stop?.lat ?? stop?.latitude);
    const lng = Number(stop?.lng ?? stop?.lon ?? stop?.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
    return {
      data: stop, index, latlng: [lat, lng],
      order: Number(stop.order) || index + 1,
      title: stop.name || stop.title || `Story stop ${index + 1}`,
    };
  }).filter(Boolean);
}

function makeStatus(container, message, actionLabel, action, kind = 'notice') {
  let status = container.querySelector('.nr-map-status');
  if (!status) {
    status = document.createElement('div');
    status.className = 'nr-map-status';
    status.setAttribute('role', 'status');
    container.append(status);
  }
  status.replaceChildren();
  status.dataset.kind = kind;
  const text = document.createElement('span');
  text.textContent = message;
  status.append(text);
  if (actionLabel && action) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = actionLabel;
    button.addEventListener('click', action, { once: true });
    status.append(button);
  }
  status.hidden = false;
  return status;
}

function markerIcon(L, number, selected = false) {
  return L.divIcon({
    className: 'nr-map-marker-shell',
    html: number == null
      ? '<span class="nr-map-start-marker" aria-hidden="true"></span>'
      : `<span class="nr-map-stop-marker${selected ? ' is-selected' : ''}" aria-hidden="true">${number}</span>`,
    iconSize: number == null ? [24, 24] : selected ? [38, 38] : [32, 32],
    iconAnchor: number == null ? [12, 12] : selected ? [19, 19] : [16, 16],
  });
}

/** Mount an interactive route map. Returns map controls and a destroy method. */
export async function mountRouteMap(container, route, options = {}) {
  if (!(container instanceof HTMLElement)) throw new TypeError('mountRouteMap requires a map container element.');
  mountedMaps.get(container)?.destroy();
  const originalRole = container.getAttribute('role');
  const originalLabel = container.getAttribute('aria-label');
  container.classList.add('nr-map-host');
  container.setAttribute('aria-label', `${route?.name || 'Route'} map`);
  container.setAttribute('role', 'region');

  const state = { destroyed: false, map: null, tileLayers: {}, activeLayer: 'street', resizeObserver: null, status: null };
  const instance = {
    fit() {
      if (!state.map) return;
      const bounds = state.routeLayer?.getBounds?.();
      if (bounds?.isValid()) state.map.fitBounds(bounds, { padding: [42, 42], maxZoom: 16 });
      else if (state.start) state.map.setView(state.start, 15);
    },
    setLayer(layer) {
      if (!state.map || !state.tileLayers[layer] || layer === state.activeLayer) return;
      if (state.tileLayers[state.activeLayer]) state.map.removeLayer(state.tileLayers[state.activeLayer]);
      state.activeLayer = layer;
      state.tileLayers[layer].addTo(state.map);
      container.dataset.mapLayer = layer;
      options.onLayerChange?.(layer);
    },
    flyTo(lat, lng, zoom = 15) {
      const latitude = Number(lat);
      const longitude = Number(lng);
      if (!state.map || !Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return false;
      state.map.flyTo([latitude, longitude], Math.max(2, Math.min(19, Number(zoom) || 15)), { duration: 0.65 });
      return true;
    },
    /** Highlight a stop and bring it into view, without re-mounting the map. */
    selectStop(order, { pan = true } = {}) {
      if (!state.map || !state.stopMarkers?.size || order == null) return;
      const L = window.L;
      for (const [key, entry] of state.stopMarkers) {
        entry.marker.setIcon(markerIcon(L, key, key === Number(order)));
        if (key === Number(order)) {
          entry.marker.setZIndexOffset(600);
          if (pan) state.map.panTo(entry.stop.latlng, { animate: true, duration: 0.5 });
        } else {
          entry.marker.setZIndexOffset(0);
        }
      }
    },
    zoomIn() { state.map?.zoomIn(); },
    zoomOut() { state.map?.zoomOut(); },
    locate() {
      if (!state.map) return;
      if (!navigator.geolocation) {
        state.status = makeStatus(container, 'Location is not available in this browser.', undefined, undefined, 'location');
        return;
      }
      state.status = makeStatus(container, 'Finding your location…', undefined, undefined, 'location');
      navigator.geolocation.getCurrentPosition(({ coords }) => {
        if (state.destroyed) return;
        state.status?.remove();
        state.status = null;
        state.location?.remove();
        state.location = window.L.circleMarker([coords.latitude, coords.longitude], {
          radius: 8, color: '#fff', weight: 3, fillColor: '#c95013', fillOpacity: 1,
        }).addTo(state.map).bindPopup('You are here');
        state.map.setView([coords.latitude, coords.longitude], 15);
      }, () => {
        if (!state.destroyed) state.status = makeStatus(container, 'Your location could not be found. Check location access and try again.', undefined, undefined, 'location');
      }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 });
    },
    destroy() {
      if (state.destroyed) return;
      state.destroyed = true;
      state.resizeObserver?.disconnect();
      state.map?.off();
      state.map?.remove();
      state.status?.remove();
      container.classList.remove('nr-map-host');
      delete container.dataset.mapLayer;
      if (originalRole == null) container.removeAttribute('role');
      else container.setAttribute('role', originalRole);
      if (originalLabel == null) container.removeAttribute('aria-label');
      else container.setAttribute('aria-label', originalLabel);
      if (mountedMaps.get(container) === instance) mountedMaps.delete(container);
    },
  };
  state.status = makeStatus(container, 'Loading map…', undefined, undefined, 'loading');
  mountedMaps.set(container, instance);

  try {
    await loadMapCss();
    const L = await loadLeaflet();
    if (state.destroyed) return instance;
    state.status?.remove();
    // A static preview may have been rendered into this container while the
    // engine loaded. Keep it behind the map until real tiles arrive, so a
    // blocked tile server leaves the route visible instead of an empty box.
    state.placeholder = container.querySelector('.map-placeholder');
    if (state.placeholder) state.placeholder.classList.add('is-behind');
    state.map = L.map(container, { zoomControl: false, scrollWheelZoom: true, preferCanvas: true });
    const attributionOSM = '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap contributors</a>';
    const attributionEsri = 'Tiles © <a href="https://www.esri.com/" target="_blank" rel="noopener">Esri</a>, Maxar, Earthstar Geographics, and the GIS User Community';
    state.tileLayers.street = L.tileLayer(STREET_URL, { maxZoom: 19, attribution: attributionOSM, subdomains: 'abc' });
    state.tileLayers.satellite = L.tileLayer(SATELLITE_URL, { maxZoom: 19, attribution: attributionEsri });
    state.activeLayer = options.initialLayer === 'satellite' ? 'satellite' : 'street';
    container.dataset.mapLayer = state.activeLayer;

    for (const [name, layer] of Object.entries(state.tileLayers)) {
      let tileSuccess = false;
      let tileErrors = 0;
      layer.on('tileload', () => {
        tileSuccess = true;
        if (state.placeholder) { state.placeholder.remove(); state.placeholder = null; }
        if (state.activeLayer === name && state.status?.dataset.kind === 'tile') {
          state.status.remove();
          state.status = null;
        }
      });
      layer.on('tileerror', () => {
        tileErrors += 1;
        if (state.activeLayer === name && !tileSuccess && tileErrors >= 3 && !state.destroyed) {
          state.status = makeStatus(container, 'Map imagery could not be loaded. Check your connection and retry.', 'Retry', () => {
            tileErrors = 0;
            tileSuccess = false;
            state.status?.remove();
            state.status = null;
            layer.redraw();
          }, 'tile');
        }
      });
    }
    const activeTiles = state.tileLayers[state.activeLayer];
    activeTiles.addTo(state.map);
    L.control.scale({ imperial: false, maxWidth: 120, position: 'bottomleft' }).addTo(state.map);

    state.start = route?.start && !Array.isArray(route.start)
      ? [Number(route.start.lat), Number(route.start.lng)]
      : null;
    if (!state.start && Number.isFinite(Number(route?.lat)) && Number.isFinite(Number(route?.lng))) {
      state.start = [Number(route.lat), Number(route.lng)];
    }
    if (!state.start && Array.isArray(route?.start)) state.start = [Number(route.start[0]), Number(route.start[1])];
    if (!state.start && Number.isFinite(Number(route?.startLat)) && Number.isFinite(Number(route?.startLng))) {
      state.start = [Number(route.startLat), Number(route.startLng)];
    }
    if (state.start && (!state.start.every(Number.isFinite) || Math.abs(state.start[0]) > 90 || Math.abs(state.start[1]) > 180)) state.start = null;

    const lines = routeLines(route);
    if (lines.length) {
      // Keep the casing and bright center as separate vector layers for contrast.
      const routeLayers = [];
      for (const line of lines) {
        const casing = L.polyline(line, { color: '#f7f2e8', weight: 8, opacity: 0.95, lineCap: 'round', lineJoin: 'round' });
        const stroke = L.polyline(line, { color: '#173d68', weight: 4, opacity: 1, lineCap: 'round', lineJoin: 'round', className: 'nr-map-route-line' });
        casing.on('click', () => options.onSelectRoute?.(route));
        stroke.on('click', () => options.onSelectRoute?.(route));
        routeLayers.push(casing, stroke);
      }
      state.routeLayer = L.featureGroup(routeLayers).addTo(state.map);
    }

    const start = state.start || lines[0]?.[0] || null;
    if (start) {
      state.startMarker = L.marker(start, { icon: markerIcon(L, null), title: `${route?.name || 'Route'} starting point`, alt: 'Route starting point' }).addTo(state.map);
      state.startMarker.bindPopup(`<strong>${escapeHtml(route?.name || 'Route start')}</strong><br>Starting point`);
    }

    const stops = explicitStops(route);
    state.stopMarkers = new Map();
    stops.forEach((stop) => {
      const marker = L.marker(stop.latlng, { icon: markerIcon(L, stop.order), title: stop.title, alt: `Story stop ${stop.order}: ${stop.title}` }).addTo(state.map);
      marker.bindPopup(`<strong>${stop.order}. ${escapeHtml(stop.title)}</strong>`);
      marker.on('click', () => options.onSelectStop?.(stop.order, stop.data, route));
      state.stopMarkers.set(stop.order, { marker, stop });
    });

    if (state.routeLayer?.getBounds().isValid()) state.map.fitBounds(state.routeLayer.getBounds(), { padding: [42, 42], maxZoom: 16 });
    else if (start) state.map.setView(start, 14);
    else state.map.setView([20.5937, 78.9629], 4);

    state.resizeObserver = new ResizeObserver(() => { if (!state.destroyed) state.map?.invalidateSize({ pan: false }); });
    state.resizeObserver.observe(container);
    requestAnimationFrame(() => { if (!state.destroyed) state.map?.invalidateSize({ pan: false }); });
  } catch (error) {
    if (!state.destroyed) state.status = makeStatus(container, 'The interactive map could not start.', 'Retry', () => {
      state.status?.remove();
      mountedMaps.delete(container);
      void mountRouteMap(container, route, options);
    });
    options.onError?.(error);
  }

  return instance;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}
