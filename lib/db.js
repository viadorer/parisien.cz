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
    await sql`CREATE TABLE IF NOT EXISTS messages (
      id         SERIAL PRIMARY KEY,
      name       TEXT NOT NULL,
      email      TEXT NOT NULL,
      message    TEXT NOT NULL,
      lang       TEXT NOT NULL DEFAULT 'fr',
      ip_hash    TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`;
    const [{ n }] = await sql`SELECT count(*)::int AS n FROM posts`;
    if (n === 0) {
      for (const p of SEED_POSTS) {
        await sql`INSERT INTO posts
          (slug, title_cs, title_fr, excerpt_cs, excerpt_fr, body_cs, body_fr, cover_url, published_at)
          VALUES (${p.slug}, ${p.title_cs}, ${p.title_fr}, ${p.excerpt_cs}, ${p.excerpt_fr},
                  ${p.body_cs}, ${p.body_fr}, ${p.cover_url}, ${p.published_at})
          ON CONFLICT (slug) DO NOTHING`;
      }
    }
    return true;
  })().catch((e) => { ready = undefined; throw e; });
  return ready;
}
