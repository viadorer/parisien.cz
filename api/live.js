// Živá a otevřená data pro mapu a úvodní lištu (zdroje: Ville de Paris – opendata.paris.fr (ODbL), Hub'Eau).
//   /api/live?what=velib | fountains | cool | swim | seine
import { send } from '../lib/http.js';

const OD = 'https://opendata.paris.fr/api/explore/v2.1/catalog/datasets';
const get = async (url) => {
  const r = await fetch(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(9000) });
  if (!r.ok) throw new Error(`upstream ${r.status}`);
  return r.json();
};
const exp = (ds, params) => `${OD}/${ds}/exports/json?${new URLSearchParams(params)}`;
const r5 = (n) => Math.round(n * 1e5) / 1e5;

const LAYERS = {
  // [lat, lon, název, kola celkem, mechanická, elektrická, volná stání, v provozu]
  velib: { ttl: 60, run: async () => (await get(exp('velib-disponibilite-en-temps-reel', { select: 'name,numbikesavailable,numdocksavailable,mechanical,ebike,coordonnees_geo,is_renting' })))
    .filter((s) => s.coordonnees_geo).map((s) => [r5(s.coordonnees_geo.lat), r5(s.coordonnees_geo.lon), s.name, s.numbikesavailable, s.mechanical, s.ebike, s.numdocksavailable, s.is_renting === 'OUI' ? 1 : 0]) },
  // [lat, lon, typ, ulice]
  fountains: { ttl: 86400, run: async () => (await get(exp('fontaines-a-boire', { select: 'type_objet,voie,geo_point_2d', where: "dispo='OUI'" })))
    .filter((f) => f.geo_point_2d).map((f) => [r5(f.geo_point_2d.lat), r5(f.geo_point_2d.lon), f.type_objet, f.voie || '']) },
  // [lat, lon, typ, název, adresa, placené]
  cool: { ttl: 86400, run: async () => (await get(exp('ilots-de-fraicheur-equipements-activites', { select: 'nom,type,adresse,payant,geo_point_2d', where: "type in ('Brumisateur','Piscine','Baignade extérieure','Ombrière pérenne')" })))
    .filter((c) => c.geo_point_2d).map((c) => [r5(c.geo_point_2d.lat), r5(c.geo_point_2d.lon), c.type, c.nom || '', (c.adresse || '').trim(), c.payant === 'Oui' ? 1 : 0]) },
  // [lat, lon, název]
  swim: { ttl: 3600, run: async () => (await get(`${OD}/traces_cheminement_vers_les_sites_de_baignade_en_seine/records?limit=20`)).results
    .filter((s) => s.geo_point_2d).map((s) => [r5(s.geo_point_2d.lat), r5(s.geo_point_2d.lon), s.name]) },
  // hladina Seiny: Paříž–Austerlitz (Hub'Eau, stanice F700000103), v mm → m
  seine: { ttl: 300, run: async () => {
    const base = 'https://hubeau.eaufrance.fr/api/v2/hydrometrie/observations_tr?code_entite=F700000103&grandeur_hydro=H&size=1&sort=desc&fields=date_obs,resultat_obs';
    const now = await get(base);
    const dayAgo = new Date(Date.now() - 24 * 3600e3).toISOString().replace(/\.\d+Z$/, 'Z');
    const before = await get(`${base}&date_fin_obs=${encodeURIComponent(dayAgo)}`);
    const a = now.data?.[0], b = before.data?.[0];
    if (!a) throw new Error('no data');
    return { levelM: a.resultat_obs / 1000, at: a.date_obs, deltaM: b ? (a.resultat_obs - b.resultat_obs) / 1000 : null, station: 'Paris – Austerlitz' };
  } },
};

export default async function handler(req, res) {
  if (req.method !== 'GET') return send(res, 405, { error: 'Method not allowed' });
  const what = new URL(req.url, 'http://x').searchParams.get('what');
  const L = LAYERS[what];
  if (!L) return send(res, 400, { error: 'unknown' });
  try {
    return send(res, 200, { data: await L.run() }, { 'Cache-Control': `public, s-maxage=${L.ttl}, stale-while-revalidate=${L.ttl * 5}` });
  } catch (e) {
    console.error('live', what, e);
    return send(res, 502, { error: 'upstream' });
  }
}
