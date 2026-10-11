// Vektorové ikony (inline SVG sprite). Žádné emotikony na webu.
const P = {
  speaker: '<path d="M11 5 6 9H3v6h3l5 4V5z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.5 5.5a9 9 0 0 1 0 13"/>',
  play: '<path d="M7 4.5v15l12-7.5z"/>',
  stop: '<rect x="6" y="6" width="12" height="12" rx="1.5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  flag: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.5-4.5"/>',
  chev: '<path d="M6 9l6 6 6-6"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.5M12 19v2.5M4.6 4.6l1.8 1.8M17.6 17.6l1.8 1.8M2.5 12H5M19 12h2.5M4.6 19.4l1.8-1.8M17.6 6.4l1.8-1.8"/>',
  cloudsun: '<circle cx="8" cy="8" r="2.6"/><path d="M8 2.5V4M2.5 8H4M4.1 4.1l1 1M11.9 4.1l-1 1"/><path d="M8.5 20a3.5 3.5 0 0 1-.4-7A5 5 0 0 1 17.8 13.4 3.3 3.3 0 0 1 17.5 20H8.5z"/>',
  cloud: '<path d="M7 19a4 4 0 0 1-.5-7.97A6 6 0 0 1 18 11a4 4 0 0 1 0 8H7z"/>',
  fog: '<path d="M4 8h16M2.5 12h19M5 16h14M8 20h8"/>',
  rain: '<path d="M7 15a4 4 0 0 1-.5-7.97A6 6 0 0 1 18 7a4 4 0 0 1 0 8H7z"/><path d="M8 18.5l-1 2.5M12.5 18.5l-1 2.5M17 18.5l-1 2.5"/>',
  snow: '<path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9"/>',
  storm: '<path d="M7 14a4 4 0 0 1-.5-7.97A6 6 0 0 1 18 6a4 4 0 0 1 .5 8"/><path d="M12.5 11l-3.5 5.5h4.5L11 22"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
  leaf: '<path d="M5 19C5 10 10 5 20 5c0 10-5 15-14 15"/><path d="M5 19l9-9"/>',
  wave: '<path d="M2.5 9c2-2 3.5-2 5.5 0s3.5 2 5.5 0 3.5-2 5.5 0M2.5 15c2-2 3.5-2 5.5 0s3.5 2 5.5 0 3.5-2 5.5 0"/>',
};
export const SPRITE = `<svg xmlns="http://www.w3.org/2000/svg" width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false"><defs>${Object.entries(P).map(([k, v]) => `<symbol id="i-${k}" viewBox="0 0 24 24">${v}</symbol>`).join('')}</defs></svg>`;
export const ico = (name, cls = '') => `<svg class="ico${cls ? ' ' + cls : ''}" aria-hidden="true" focusable="false"><use href="#i-${name}"></use></svg>`;
