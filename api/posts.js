// Veřejné čtení článků.  GET /api/posts            → výpis
//                        GET /api/posts?slug=xyz   → detail
import { sql, hasDb, ensureSchema } from '../lib/db.js';
import { SEED_POSTS } from '../lib/seed.js';
import { send } from '../lib/http.js';

const pub = (r) => ({
  slug: r.slug,
  title: { cs: r.title_cs, fr: r.title_fr },
  excerpt: { cs: r.excerpt_cs, fr: r.excerpt_fr },
  body: { cs: r.body_cs, fr: r.body_fr },
  cover: r.cover_url,
  date: r.published_at,
});

export default async function handler(req, res) {
  if (req.method !== 'GET') return send(res, 405, { error: 'Method not allowed' });
  const slug = new URL(req.url, 'http://x').searchParams.get('slug');
  const cache = { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' };

  try {
    let rows;
    if (hasDb) {
      await ensureSchema();
      rows = slug
        ? await sql`SELECT * FROM posts WHERE slug = ${slug} AND published AND published_at <= now()`
        : await sql`SELECT * FROM posts WHERE published AND published_at <= now() ORDER BY published_at DESC LIMIT 100`;
    } else {
      rows = SEED_POSTS.filter((p) => !slug || p.slug === slug).sort((a, b) => b.published_at.localeCompare(a.published_at));
    }
    if (slug) return rows[0] ? send(res, 200, pub(rows[0]), cache) : send(res, 404, { error: 'Not found' });
    return send(res, 200, { posts: rows.map(pub) }, cache);
  } catch (e) {
    console.error('posts', e);
    return send(res, 500, { error: 'Server error' });
  }
}
