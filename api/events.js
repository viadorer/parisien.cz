// Kalendář akcí v Paříži – proxy na open data Ville de Paris („Que faire à Paris ?“, licence ODbL).
//   GET /api/events?when=today|week|month  &cat=concert|theatre|expo|enfants|sport|conference|atelier|danse|festival
//                   &free=1  &q=text  &limit=24  &offset=0
import { send } from '../lib/http.js';

const BASE = 'https://opendata.paris.fr/api/explore/v2.1/catalog/datasets/que-faire-a-paris-/records';
const CATS = { concert: 'Concert', theatre: 'Théâtre', expo: 'Expo', enfants: 'Enfants', sport: 'Sport', conference: 'Conférence', atelier: 'Atelier', danse: 'Danse', festival: 'Festival' };
const FIELDS = 'id,title,lead_text,url,date_start,date_end,date_description,cover_url,cover_alt,cover_credit,address_name,address_street,address_zipcode,lat_lon,price_type,qfap_tags';
const ymd = (d) => d.toISOString().slice(0, 10);
const strip = (s) => String(s ?? '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();

export default async function handler(req, res) {
  if (req.method !== 'GET') return send(res, 405, { error: 'Method not allowed' });
  const q = new URL(req.url, 'http://x').searchParams;
  const cat = CATS[q.get('cat')];
  const days = { today: 0, week: 7, month: 30 }[q.get('when')] ?? 7;
  const limit = Math.min(Math.max(parseInt(q.get('limit'), 10) || 24, 1), 48);
  const offset = Math.max(parseInt(q.get('offset'), 10) || 0, 0);

  const today = new Date();
  const end = new Date(today.getTime() + days * 864e5);
  const where = ['date_end >= now()'];
  if (cat === 'Expo') where.push("qfap_tags like 'Expo'");            // výstavy: i ty, které už běží
  else {
    where.push(`date_start >= date'${ymd(today)}'`, `date_start <= date'${ymd(end)}'`);
    if (cat) where.push(`qfap_tags like '${cat}'`);
  }
  if (q.get('free') === '1') where.push("price_type = 'gratuit'");

  const url = new URL(BASE);
  url.searchParams.set('select', FIELDS);
  url.searchParams.set('where', where.join(' AND '));
  url.searchParams.set('order_by', cat === 'Expo' ? 'date_end' : 'date_start');
  url.searchParams.set('limit', String(limit));
  url.searchParams.set('offset', String(offset));
  const text = (q.get('q') || '').trim().slice(0, 80).replace(/["'\\]/g, '');
  if (text) url.searchParams.set('q', text);

  try {
    const r = await fetch(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(8000) });
    if (!r.ok) throw new Error(`upstream ${r.status}`);
    const d = await r.json();
    const events = (d.results || []).map((e) => ({
      id: e.id, title: strip(e.title), lead: strip(e.lead_text).slice(0, 220),
      url: /^https:\/\//.test(e.url || '') ? e.url : '',
      start: e.date_start, end: e.date_end, dateText: strip(e.date_description),
      cover: /^https:\/\//.test(e.cover_url || '') ? e.cover_url : '', coverAlt: strip(e.cover_alt), coverCredit: strip(e.cover_credit),
      place: strip(e.address_name), street: strip(e.address_street), zip: e.address_zipcode || '',
      lat: e.lat_lon?.lat ?? null, lon: e.lat_lon?.lon ?? null,
      price: e.price_type || '', tags: String(e.qfap_tags || '').split(';').filter(Boolean),
    }));
    return send(res, 200, { total: d.total_count ?? events.length, events, source: 'Ville de Paris – opendata.paris.fr (ODbL)' },
      { 'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=3600' });
  } catch (e) {
    console.error('events', e);
    return send(res, 502, { error: 'upstream' });
  }
}
