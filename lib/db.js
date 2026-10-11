// Neon Postgres (serverless driver). Schéma se vytvoří samo při prvním použití.
import { neon } from '@neondatabase/serverless';
import { SEED_POSTS, SEED_VERSION } from './seed.js';

const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;

// globalThis.__PZ_SQL umožňuje lokální testy s vestavěným Postgresem (PGlite).
export const hasDb = Boolean(url || globalThis.__PZ_SQL);
export const sql = globalThis.__PZ_SQL ?? (url ? neon(url) : null);

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
    await sql`CREATE TABLE IF NOT EXISTS users (
      id           SERIAL PRIMARY KEY,
      email        TEXT UNIQUE NOT NULL,
      display_name TEXT NOT NULL,
      pass_hash    TEXT NOT NULL,
      role         TEXT NOT NULL DEFAULT 'student',
      status       TEXT NOT NULL DEFAULT 'active',
      failed_count INT NOT NULL DEFAULT 0,
      locked_until TIMESTAMPTZ,
      note         TEXT NOT NULL DEFAULT '',
      created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
      last_login   TIMESTAMPTZ
    )`;
    await sql`CREATE TABLE IF NOT EXISTS invites (
      code       TEXT PRIMARY KEY,
      note       TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      expires_at TIMESTAMPTZ NOT NULL,
      used_by    INT,
      used_at    TIMESTAMPTZ
    )`;
    await sql`ALTER TABLE posts ADD COLUMN IF NOT EXISTS level TEXT NOT NULL DEFAULT ''`;
    await sql`ALTER TABLE posts ADD COLUMN IF NOT EXISTS base_slug TEXT NOT NULL DEFAULT ''`;
    await sql`ALTER TABLE posts ADD COLUMN IF NOT EXISTS glossary TEXT NOT NULL DEFAULT '[]'`;
    await sql`ALTER TABLE posts ADD COLUMN IF NOT EXISTS questions TEXT NOT NULL DEFAULT '[]'`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS public_slug TEXT`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT NOT NULL DEFAULT ''`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS show_profile BOOLEAN NOT NULL DEFAULT TRUE`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS show_class BOOLEAN NOT NULL DEFAULT FALSE`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS class_name TEXT NOT NULL DEFAULT ''`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS sig_text TEXT NOT NULL DEFAULT ''`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_hidden BOOLEAN NOT NULL DEFAULT FALSE`;
    await sql`ALTER TABLE users ALTER COLUMN show_profile SET DEFAULT FALSE`;
    await sql`CREATE TABLE IF NOT EXISTS reports (
      id         SERIAL PRIMARY KEY,
      kind       TEXT NOT NULL,
      target     TEXT NOT NULL,
      reason     TEXT NOT NULL,
      note       TEXT NOT NULL DEFAULT '',
      reporter   TEXT NOT NULL,
      status     TEXT NOT NULL DEFAULT 'open',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`;
    await sql`UPDATE users SET public_slug = lower(regexp_replace(display_name, '[^a-zA-Z0-9]+', '-', 'g')) || '-' || id WHERE public_slug IS NULL`;
    await sql`ALTER TABLE posts ADD COLUMN IF NOT EXISTS place TEXT NOT NULL DEFAULT ''`;
    await sql`ALTER TABLE posts ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION`;
    await sql`ALTER TABLE posts ADD COLUMN IF NOT EXISTS lon DOUBLE PRECISION`;
    await sql`CREATE TABLE IF NOT EXISTS reactions (
      post_slug  TEXT NOT NULL,
      user_id    INT NOT NULL,
      kind       TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (post_slug, user_id, kind)
    )`;
    await sql`CREATE TABLE IF NOT EXISTS postcards (
      id         SERIAL PRIMARY KEY,
      user_id    INT NOT NULL,
      photo_id   TEXT NOT NULL,
      message    TEXT NOT NULL,
      lang       TEXT NOT NULL DEFAULT 'fr',
      status     TEXT NOT NULL DEFAULT 'submitted',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`;
    await sql`CREATE TABLE IF NOT EXISTS corrections (
      id         SERIAL PRIMARY KEY,
      post_id    INT NOT NULL,
      user_id    INT NOT NULL,
      lang       TEXT NOT NULL DEFAULT 'fr',
      original   TEXT NOT NULL,
      suggestion TEXT NOT NULL,
      note       TEXT NOT NULL DEFAULT '',
      status     TEXT NOT NULL DEFAULT 'pending',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`;
    await sql`CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)`;
    await sql`ALTER TABLE posts ADD COLUMN IF NOT EXISTS author_user_id INT`;
    await sql`ALTER TABLE posts ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'published'`;
    await sql`ALTER TABLE posts ADD COLUMN IF NOT EXISTS review_note TEXT NOT NULL DEFAULT ''`;
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
    await sql`CREATE TABLE IF NOT EXISTS gallery (
      id         SERIAL PRIMARY KEY,
      title_fr   TEXT NOT NULL DEFAULT '',
      title_cs   TEXT NOT NULL DEFAULT '',
      author     TEXT NOT NULL DEFAULT '',
      place      TEXT NOT NULL DEFAULT '',
      image_url  TEXT NOT NULL,
      credit     TEXT NOT NULL DEFAULT '',
      published  BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`;
    await sql`ALTER TABLE messages ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'message'`;
    // Úvodní články: při změně obsahu (SEED_VERSION) se doplní chybějící a existujícím se doplní jen úroveň/slovníček.
    const [pv] = await sql`SELECT value FROM meta WHERE key = 'profiles_private_v1'`;
    if (!pv) { await sql`UPDATE users SET show_profile = FALSE`; await sql`INSERT INTO meta (key, value) VALUES ('profiles_private_v1', '1') ON CONFLICT (key) DO NOTHING`; }
    const [m] = await sql`SELECT value FROM meta WHERE key = 'seed_version'`;
    if (m?.value !== SEED_VERSION) {
      const have = new Set((await sql`SELECT slug FROM posts`).map((r) => r.slug));
      for (const p of SEED_POSTS) {
        if (!have.has(p.slug)) {
          await sql`INSERT INTO posts
            (slug, category, author, level, base_slug, glossary, questions, title_cs, title_fr, excerpt_cs, excerpt_fr, body_cs, body_fr, cover_url, cover_credit, cover_credit_url, sources, published_at)
            VALUES (${p.slug}, ${p.category}, ${p.author}, ${p.level}, ${p.base_slug}, ${p.glossary}, ${p.questions}, ${p.title_cs}, ${p.title_fr}, ${p.excerpt_cs}, ${p.excerpt_fr},
                    ${p.body_cs}, ${p.body_fr}, ${p.cover_url}, ${p.cover_credit}, ${p.cover_credit_url}, ${p.sources}, ${p.published_at})
            ON CONFLICT (slug) DO NOTHING`;
        } else {
          await sql`UPDATE posts SET level = ${p.level}, base_slug = ${p.base_slug}, glossary = ${p.glossary} WHERE slug = ${p.slug} AND level = ''`;
          await sql`UPDATE posts SET questions = ${p.questions} WHERE slug = ${p.slug} AND questions = '[]'`;
        }
      }
      await sql`INSERT INTO meta (key, value) VALUES ('seed_version', ${SEED_VERSION}) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`;
    }
    const [{ c }] = await sql`SELECT count(*)::int AS c FROM posts WHERE cover_url LIKE 'https://commons.wikimedia.org/%'`;
    if (c > 0) {
      for (const p of SEED_POSTS) {
        if (p.cover_url.startsWith('/images/')) {
          await sql`UPDATE posts SET cover_url = ${p.cover_url} WHERE slug = ${p.slug} AND cover_url LIKE 'https://commons.wikimedia.org/%'`;
        }
      }
    }
    return true;
  })().catch((e) => { ready = undefined; throw e; });
  return ready;
}
