// Neon Postgres (serverless driver). Schéma se vytvoří samo při prvním použití.
import { neon } from '@neondatabase/serverless';
import { SEED_POSTS } from './seed.js';

const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;

export const hasDb = Boolean(url);
export const sql = hasDb ? neon(url) : null;

let ready;
export function ensureSchema() {
  if (!hasDb) return Promise.resolve(false);
  ready ??= (async () => {
    await sql`CREATE TABLE IF NOT EXISTS posts (
      id           SERIAL PRIMARY KEY,
      slug         TEXT UNIQUE NOT NULL,
      title_cs     TEXT NOT NULL DEFAULT '',
      title_fr     TEXT NOT NULL DEFAULT '',
      excerpt_cs   TEXT NOT NULL DEFAULT '',
      excerpt_fr   TEXT NOT NULL DEFAULT '',
      body_cs      TEXT NOT NULL DEFAULT '',
      body_fr      TEXT NOT NULL DEFAULT '',
      cover_url    TEXT NOT NULL DEFAULT '',
      published    BOOLEAN NOT NULL DEFAULT TRUE,
      published_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
    )`;
    await sql`ALTER TABLE posts ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'paris'`;
    await sql`ALTER TABLE posts ADD COLUMN IF NOT EXISTS author TEXT NOT NULL DEFAULT ''`;
    await sql`ALTER TABLE posts ADD COLUMN IF NOT EXISTS cover_credit TEXT NOT NULL DEFAULT ''`;
    await sql`ALTER TABLE posts ADD COLUMN IF NOT EXISTS cover_credit_url TEXT NOT NULL DEFAULT ''`;
    await sql`ALTER TABLE posts ADD COLUMN IF NOT EXISTS sources TEXT NOT NULL DEFAULT '[]'`;
    await sql`CREATE TABLE IF NOT EXISTS messages (
      id         SERIAL PRIMARY KEY,
      name       TEXT NOT NULL,
      email      TEXT NOT NULL,
      message    TEXT NOT NULL,
      kind       TEXT NOT NULL DEFAULT 'message',
      lang       TEXT NOT NULL DEFAULT 'fr',
      ip_hash    TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`;
    await sql`ALTER TABLE messages ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'message'`;
    const [{ n }] = await sql`SELECT count(*)::int AS n FROM posts`;
    if (n === 0) {
      for (const p of SEED_POSTS) {
        await sql`INSERT INTO posts
          (slug, category, author, title_cs, title_fr, excerpt_cs, excerpt_fr, body_cs, body_fr, cover_url, cover_credit, cover_credit_url, sources, published_at)
          VALUES (${p.slug}, ${p.category}, ${p.author}, ${p.title_cs}, ${p.title_fr}, ${p.excerpt_cs}, ${p.excerpt_fr},
                  ${p.body_cs}, ${p.body_fr}, ${p.cover_url}, ${p.cover_credit}, ${p.cover_credit_url}, ${p.sources}, ${p.published_at})
          ON CONFLICT (slug) DO NOTHING`;
      }
    }
    return true;
  })().catch((e) => { ready = undefined; throw e; });
  return ready;
}
