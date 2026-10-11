import { sql, hasDb, ensureSchema } from './db.js';
import { SEED_POSTS } from './seed.js';

export const CATEGORIES = ['paris', 'voyage', 'langue'];
export const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

const parseSources = (s) => { try { const a = JSON.parse(s || '[]'); return Array.isArray(a) ? a.filter((x) => /^https:\/\//.test(x)) : []; } catch { return []; } };

const parseGlossary = (s) => { try { const a = JSON.parse(s || '[]'); return Array.isArray(a) ? a.filter((g) => g && g.fr && g.cs).slice(0, 40) : []; } catch { return []; } };

const parseQuestions = (s) => { try { const a = JSON.parse(s || '[]'); return Array.isArray(a) ? a.filter((q) => q && q.q && q.options && Number.isInteger(q.answer)).slice(0, 10) : []; } catch { return []; } };

export const normalize = (r) => ({
  questions: parseQuestions(r.questions),
  slug: r.slug,
  level: r.level || '',
  base: r.base_slug || r.slug,
  glossary: parseGlossary(r.glossary),
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

/** Všechny zveřejněné verze jednoho článku (originál + zjednodušené), seřazené podle úrovně. */
export async function getVersions(base) {
  let rows;
  if (hasDb) {
    await ensureSchema();
    rows = await sql`SELECT * FROM posts WHERE published AND published_at <= now() AND (slug = ${base} OR base_slug = ${base})`;
  } else {
    rows = SEED_POSTS.filter((p) => p.slug === base || p.base_slug === base);
  }
  return rows.map(normalize).sort((a, b) => LEVELS.indexOf(a.level) - LEVELS.indexOf(b.level));
}
