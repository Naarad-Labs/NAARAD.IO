/* Line icons, inline so no icon font or sprite request is needed.
   All are drawn on a 24x24 grid and inherit colour and stroke from CSS. */

const PATHS = {
  walk: '<path d="M13 4.6a1.6 1.6 0 1 0 0-.1"/><path d="M11 21l1.4-5.1-2.6-2.3.9-4.6L8 10.6 7 13.6"/><path d="M17 12.4l-2.3-1.1-1.4-3.2-2.6.9"/><path d="M14.6 15.9L16.4 21"/>',
  clock: '<circle cx="12" cy="12" r="8.4"/><path d="M12 7.3V12l3.1 1.9"/>',
  pin: '<path d="M19 10.2c0 5-7 11.6-7 11.6S5 15.2 5 10.2a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2.4"/>',
  flag: '<path d="M6 21V4.2"/><path d="M6 4.6c3.4-1.6 6.2 1.3 9.6 0v7.8c-3.4 1.3-6.2-1.6-9.6 0Z"/>',
  gauge: '<path d="M5 19.5v-5"/><path d="M12 19.5V9"/><path d="M19 19.5V4.6"/>',
  terrain: '<path d="M3 17.5l4.6-5.6 3.2 3.4 3.4-5.2L21 17.5Z"/><path d="M3 20.2h18"/>',
  download: '<path d="M12 4v10.5"/><path d="m8 11 4 3.8 4-3.8"/><path d="M4.6 19.4h14.8"/>',
  globe: '<circle cx="12" cy="12" r="8.4"/><path d="M3.8 12h16.4"/><path d="M12 3.6c2.3 2.4 3.4 5.3 3.4 8.4s-1.1 6-3.4 8.4c-2.3-2.4-3.4-5.3-3.4-8.4s1.1-6 3.4-8.4Z"/>',
  headphones: '<path d="M4.4 15v-2.8a7.6 7.6 0 0 1 15.2 0V15"/><path d="M4.4 14.2h2.2a1 1 0 0 1 1 1v3.2a1 1 0 0 1-1 1H5.6a1.2 1.2 0 0 1-1.2-1.2Z"/><path d="M19.6 14.2h-2.2a1 1 0 0 0-1 1v3.2a1 1 0 0 0 1 1h1a1.2 1.2 0 0 0 1.2-1.2Z"/>',
  book: '<path d="M4 5.2c2.6-1 5.3-1 8 0v14c-2.7-1-5.4-1-8 0Z"/><path d="M12 5.2c2.7-1 5.4-1 8 0v14c-2.6-1-5.3-1-8 0"/>',
  map: '<path d="M9 4.3 3.8 6.6v13l5.2-2.3 6 2.4 5.2-2.3v-13l-5.2 2.3Z"/><path d="M9 4.3v13.4"/><path d="M15 6.7v13"/>',
  compass: '<circle cx="12" cy="12" r="8.4"/><path d="m14.8 9.2-1.6 4.2-4.2 1.6 1.6-4.2Z"/>',
  users: '<circle cx="9.6" cy="9" r="3.2"/><path d="M3.8 19.2a5.9 5.9 0 0 1 11.6 0"/><path d="M16 6.2a3.1 3.1 0 0 1 0 5.8"/><path d="M17.6 14.6a5.6 5.6 0 0 1 2.7 4.6"/>',
  play: '<path d="M8.6 5.6 18.4 12l-9.8 6.4Z"/>',
  pause: '<path d="M9.4 5.4v13.2"/><path d="M14.6 5.4v13.2"/>',
  search: '<circle cx="10.8" cy="10.8" r="6.6"/><path d="m15.8 15.8 4.4 4.4"/>',
  share: '<circle cx="17.6" cy="6" r="2.6"/><circle cx="6.4" cy="12" r="2.6"/><circle cx="17.6" cy="18" r="2.6"/><path d="m8.7 10.8 6.6-3.5"/><path d="m8.7 13.2 6.6 3.5"/>',
  bookmark: '<path d="M6.4 4.4h11.2v15.4L12 15.6l-5.6 4.2Z"/>',
  arrow: '<path d="M4.5 12h15"/><path d="m13.6 6 5.9 6-5.9 6"/>',
  chevron: '<path d="m9 5.5 6.5 6.5L9 18.5"/>',
  plus: '<path d="M12 5.2v13.6"/><path d="M5.2 12h13.6"/>',
  minus: '<path d="M5.2 12h13.6"/>',
  locate: '<circle cx="12" cy="12" r="3.2"/><circle cx="12" cy="12" r="7.6"/><path d="M12 1.8v3"/><path d="M12 19.2v3"/><path d="M22.2 12h-3"/><path d="M4.8 12h-3"/>',
  layers: '<path d="m12 3.6 8.4 4.2-8.4 4.2-8.4-4.2Z"/><path d="m3.6 12.4 8.4 4.2 8.4-4.2"/>',
  camera: '<path d="M4 7.8h3.4l1.4-2.2h6.4l1.4 2.2H20v10.6H4Z"/><circle cx="12" cy="12.8" r="3.3"/>',
  quote: '<path d="M9.4 6.2c-2.8 1.4-4.2 3.6-4.2 6.6v5h5.6v-5.6H7.2c0-1.8.9-3.2 2.8-4.2Z"/><path d="M19 6.2c-2.8 1.4-4.2 3.6-4.2 6.6v5h5.6v-5.6h-3.6c0-1.8.9-3.2 2.8-4.2Z"/>',
  mic: '<rect x="9.2" y="3.2" width="5.6" height="10.6" rx="2.8"/><path d="M5.6 11.6a6.4 6.4 0 0 0 12.8 0"/><path d="M12 18v2.8"/>',
  file: '<path d="M13.4 3.6H6.4v16.8h11.2V7.8Z"/><path d="M13.4 3.6v4.2h4.2"/>',
  image: '<rect x="3.8" y="5.2" width="16.4" height="13.6" rx="1.6"/><circle cx="8.8" cy="10" r="1.6"/><path d="m4.6 17.4 4.8-4.4 3.4 3 2.8-2.4 3.8 3.4"/>',
  sparkle: '<path d="M12 3.6 13.8 9l5.4 1.8-5.4 1.8L12 18l-1.8-5.4L4.8 10.8 10.2 9Z"/>',
  check: '<path d="m5.2 12.6 4.4 4.4 9.2-10"/>',
  leaf: '<path d="M5 19c0-7.2 4.6-11.4 14-12-.4 8.8-4.8 13-12 13Z"/><path d="M8.6 15.4 19 7"/>',
  award: '<circle cx="12" cy="9.2" r="5.4"/><path d="m8.6 13.6-1.4 6.8 4.8-2.6 4.8 2.6-1.4-6.8"/>',
  settings: '<circle cx="12" cy="12" r="3.1"/><path d="M19.2 14.6a1.6 1.6 0 0 0 .3 1.8l.1.1a1.9 1.9 0 1 1-2.7 2.7l-.1-.1a1.6 1.6 0 0 0-2.7 1.1v.3a1.9 1.9 0 1 1-3.8 0v-.2a1.6 1.6 0 0 0-2.8-1.1l-.1.1a1.9 1.9 0 1 1-2.7-2.7l.1-.1a1.6 1.6 0 0 0-1.1-2.7h-.3a1.9 1.9 0 1 1 0-3.8h.2a1.6 1.6 0 0 0 1.1-2.8l-.1-.1a1.9 1.9 0 1 1 2.7-2.7l.1.1a1.6 1.6 0 0 0 1.8.3h.1a1.6 1.6 0 0 0 1-1.5v-.3a1.9 1.9 0 1 1 3.8 0v.2a1.6 1.6 0 0 0 2.7 1.1l.1-.1a1.9 1.9 0 1 1 2.7 2.7l-.1.1a1.6 1.6 0 0 0 1.1 2.7h.3a1.9 1.9 0 1 1 0 3.8h-.2a1.6 1.6 0 0 0-1.5 1Z"/>',
  back15: '<path d="M4.8 9.6A8 8 0 1 1 4 13.4"/><path d="M4.4 4.6v5h5"/>',
  forward15: '<path d="M19.2 9.6A8 8 0 1 0 20 13.4"/><path d="M19.6 4.6v5h-5"/>',
  volume: '<path d="M11.4 5.4 7 9H3.8v6H7l4.4 3.6Z"/><path d="M15.4 9.4a3.8 3.8 0 0 1 0 5.2"/><path d="M18 7a7.3 7.3 0 0 1 0 10"/>',
  close: '<path d="M6 6 18 18"/><path d="M18 6 6 18"/>',
  calendar: '<rect x="3.8" y="5.4" width="16.4" height="14.4" rx="1.6"/><path d="M3.8 10h16.4"/><path d="M8.4 3.4v3.6"/><path d="M15.6 3.4v3.6"/>',
  list: '<path d="M8.6 7h11"/><path d="M8.6 12h11"/><path d="M8.6 17h11"/><path d="M4.6 7h.01"/><path d="M4.6 12h.01"/><path d="M4.6 17h.01"/>',
  captions: '<rect x="3.6" y="5.6" width="16.8" height="12.8" rx="2"/><path d="M10 10.4a2.6 2.6 0 1 0 0 3.2"/><path d="M16.6 10.4a2.6 2.6 0 1 0 0 3.2"/>',
  upload: '<path d="M12 19.4V8.8"/><path d="m8 12.6 4-3.8 4 3.8"/><path d="M4.6 19.4h14.8"/>',
  trash: '<path d="M5.4 7h13.2"/><path d="M9.2 7V5.2h5.6V7"/><path d="M7 7l.9 12.2h8.2L17 7"/>',
  edit: '<path d="M4.6 19.4h4l10-10a2.1 2.1 0 0 0-3-3l-10 10Z"/><path d="M14.4 6.6 17.4 9.6"/>',
  footprints: '<path d="M7 20.4c-1.5 0-2.4-.8-2.4-2.3 0-1.3.6-2 .6-3.4 0-1-.6-1.6-.6-3C4.6 9.4 5.8 8 7.4 8s2.6 1.4 2.4 3.6c-.2 2-.8 3-.8 4.6s-.5 4.2-2 4.2Z"/><path d="M17 16.4c-1.5 0-2-2.6-2-4.2 0-1.6-.6-2.6-.8-4.6C14 5.4 15.4 4 17 4s2.8 1.4 2.8 3.7c0 1.4-.6 2-.6 3 0 1.4.6 2.1.6 3.4 0 1.5-.9 2.3-2.8 2.3Z"/>',
  temple: '<path d="M12 3.2 5.4 8.4h13.2Z"/><path d="M6.6 8.4v10.8"/><path d="M17.4 8.4v10.8"/><path d="M9.8 19.2v-5.4a2.2 2.2 0 0 1 4.4 0v5.4"/><path d="M3.8 19.2h16.4"/>',
};

const VIEWBOX = '0 0 24 24';

/** Inline SVG for an icon name. Decorative by default; pass a label for meaning. */
export function icon(name, options = {}) {
  const { className = '', label = '', size = 0 } = options;
  const body = PATHS[name];
  if (!body) return '';
  const dimensions = size ? ` width="${size}" height="${size}"` : '';
  const semantics = label
    ? ` role="img" aria-label="${String(label).replace(/"/g, '&quot;')}"`
    : ' aria-hidden="true" focusable="false"';
  return `<svg class="ico ${className}" viewBox="${VIEWBOX}"${dimensions}${semantics}>${body}</svg>`;
}

export const iconNames = Object.keys(PATHS);
