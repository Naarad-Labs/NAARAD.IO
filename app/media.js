/* Local route imagery for the editorial route experience.
 *
 * The repository contains these image files, but does not record their original
 * photographer or licence. Keep that uncertainty with the asset so the UI and
 * future CMS migration cannot mistake a local path for cleared rights.
 */
(function (root) {
  'use strict';

  var UNKNOWN_ATTRIBUTION = Object.freeze({
    status: 'unknown',
    credit: 'Unknown; source and usage rights are not documented in this repository.',
    rights: 'unverified'
  });

  var ROUTE_IMAGES = Object.freeze({
    'hampi-vijayanagara-circuit': 'Hampi.webp',
    'thanjavur-brihadeeswarar-trail': 'thanjavur.webp',
    'iit-madras-forest-loop': 'IIt_Madras.webp',
    'mysore-palace-heritage-walk': 'Mysore Palace.webp',
    'varanasi-ghats-dawn-walk': 'Varanasi.webp',
    'jaipur-pink-city-cycling': 'Jaipur.webp'
  });

  function forRoute(route) {
    var file = route && ROUTE_IMAGES[route.slug];
    if (!file) {
      return {
        url: null,
        alt: '',
        source: null,
        attribution: UNKNOWN_ATTRIBUTION
      };
    }

    return {
      url: '/Images/' + encodeURIComponent(file).replace(/%20/g, '%20'),
      alt: route.name + ' route cover',
      source: 'Repository asset: Images/' + file,
      attribution: UNKNOWN_ATTRIBUTION
    };
  }

  var api = { forRoute: forRoute, attributionStatus: UNKNOWN_ATTRIBUTION.status };
  root.NaaradMedia = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
