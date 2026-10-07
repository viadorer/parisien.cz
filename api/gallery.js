// Veřejná galerie fotek studentů (správa v /admin).  GET /api/gallery
import { sql, hasDb, ensureSchema } from '../lib/db.js';
import { send } from '../lib/http.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return send(res, 405, { error: 'Method not allowed' });
  const cache = { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' };
  if (!hasDb) return send(res, 200, { items: [] }, cache);
  try {
    await ensureSchema();
    const rows = await sql`SELECT id, title_fr, title_cs, author, place, image_url, credit, created_at FROM gallery WHERE published ORDER BY created_at DESC LIMIT 200`;
    return send(res, 200, { items: rows.map((r) => ({ id: r.id, title: { fr: r.title_fr, cs: r.title_cs }, author: r.author, place: r.place, url: r.image_url, credit: r.credit })) }, cache);
  } catch (e) {
    console.error('gallery', e);
    return send(res, 500, { error: 'Server error' });
  }
}
