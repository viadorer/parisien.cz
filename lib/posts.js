import { sql, hasDb, ensureSchema } from './db.js';
import { SEED_POSTS } from './seed.js';

export const CATEGORIES = ['paris', 'voyage', 'langue'];

const parseSources = (s) => { try { const a = JSON.parse(s || '[]'); return Array.isArray(a) ? a.filter((x) => /^https:\/\//.test(x)) : []; } catch { return []; } };

export const normalize = (r) => ({
  slug: r.slug,
  category: r.category || 'paris',
  author: r.author || '',
  title: { cs: r.title_cs, fr: r.title_fr },
  excerpt: { cs: r.excerpt_cs, fr: r.excerpt_fr },
  body: { cs: r.body_cs, fr: r.body_fr },
  cover: r.cover_url,
  coverCredit: r.cover_credit ? { text: r.cover_credit, url: r.cover_credit_url } : null,
  sources: parseSources(r.sources),
  date: r.published_at,
});

export async function getPosts({ cat, limit = 100 } = {}) {
  let rows;
  if (hasDb) {
    await ensureSchema();
    rows = cat
      ? await sql`SELECT * FROM posts WHERE published AND published_at <= now() AND category = ${cat} ORDER BY published_at DESC LIMIT ${limit}`
      : await sql`SELECT * FROM posts WHERE published AND published_at <= now() ORDER BY published_at DESC LIMIT ${limit}`;
  } else {
    rows = SEED_POSTS.filter((p) => !cat || p.category === cat).sort((a, b) => b.published_at.localeCompare(a.published_at)).slice(0, limit);
  }
  return rows.map(normalize);
}

export async function getPost(slug) {
  if (hasDb) {
    await ensureSchema();
    const rows = await sql`SELECT * FROM posts WHERE slug = ${slug} AND published AND published_at <= now()`;
    return rows[0] ? normalize(rows[0]) : null;
  }
  const p = SEED_POSTS.find((x) => x.slug === slug);
  return p ? normalize(p) : null;
}
