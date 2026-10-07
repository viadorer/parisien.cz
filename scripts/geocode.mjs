#!/usr/bin/env node
// Zjistí souřadnice míst z data/*.json přes OpenStreetMap Nominatim (max 1 dotaz/s) → data/coords.json
// Data © OpenStreetMap contributors (ODbL).
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
const ROOT = new URL('..', import.meta.url).pathname;
const rd = (f) => JSON.parse(readFileSync(`${ROOT}data/${f}`, 'utf8'));
const out = existsSync(`${ROOT}data/coords.json`) ? rd('coords.json') : {};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const culture = rd('culture.json'), food = rd('food.json');
const groups = [['museums', rd('museums.json')], ['places', rd('places.json')], ['quartiers', rd('quartiers.json')],
  ['cafes', food.cafes], ['markets', food.markets], ['stage', culture.stage], ['literature', culture.literature], ['cinema', culture.cinema]];
const BBOX = { lat: [48.78, 48.95], lon: [2.2, 2.5] };   // Paříž a těsné okolí
const EXTRA = { versailles: 'Château de Versailles' };
for (const [g, arr] of groups) for (const it of arr || []) {
  const key = `${g}:${it.id}`;
  if (out[key]?.lat || (it.lat && it.lon && g === 'places' && it.id !== 'versailles' && !it.id.includes('versailles'))) {
    if (!out[key] && it.lat) out[key] = { lat: it.lat, lon: it.lon, src: 'data' };
    continue;
  }
  const raw = typeof it.name === 'string' ? it.name : it.name.fr;
  const name = EXTRA[it.id] || raw.replace(/\s*\(.*?\)/g, '').replace(/^(Librairie|Les|Le|La) (bouquinistes des quais de Seine)/i, 'Bouquinistes des quais de la Seine');
  const q = /versailles/i.test(name) ? name : `${name}, Paris, France`;
  let j = [];
  for (let a = 0; a < 4; a++) {
    const r = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(q)}`, { headers: { 'User-Agent': 'parisien.cz-school-project/1.0 (info@parisien.cz)' } });
    if (r.ok) { j = await r.json(); break; }
    console.log('  http', r.status, 'zkouším znovu'); await sleep(5000 * (a + 1));
  }
  if (j[0]) {
    const lat = +j[0].lat, lon = +j[0].lon;
    const inside = /versailles/i.test(name) || (lat > BBOX.lat[0] && lat < BBOX.lat[1] && lon > BBOX.lon[0] && lon < BBOX.lon[1]);
    out[key] = { lat: +lat.toFixed(5), lon: +lon.toFixed(5), src: 'osm', ...(inside ? {} : { check: true }), found: j[0].display_name.slice(0, 80) };
  } else out[key] = { check: true, missing: true };
  console.log(key, out[key].check ? 'CHECK' : 'ok', out[key].found || '');
  await sleep(1100);
}
writeFileSync(`${ROOT}data/coords.json`, JSON.stringify(out, null, 1));
console.log('hotovo', Object.keys(out).length);
