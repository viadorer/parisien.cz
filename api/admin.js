// Admin API (jedna funkce, akce přes ?action=).
//   login | logout | me | list | save | delete | upload | messages | delete-message | gallery-* | review | invites-create/list/delete | users-list | user-status | user-reset | user-delete
import { sql, hasDb, ensureSchema } from '../lib/db.js';
import { authConfigured, checkPassword, sessionCookie, clearCookie, isAuthed } from '../lib/auth.js';
import { presignUpload, r2Configured } from '../lib/r2.js';
import { send, readJson, str, slugify } from '../lib/http.js';
import { hashPassword, newCode } from '../lib/users.js';
import { randomBytes } from 'node:crypto';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const URLISH = /^(https:\/\/|\/images\/)[^\s"'<>]*$/;

export default async function handler(req, res) {
  const q = new URL(req.url, 'http://x').searchParams;
  const action = q.get('action') || '';
  const noStore = { 'Cache-Control': 'no-store' };

  try {
    if (action === 'me') {
      return send(res, 200, {
        authed: isAuthed(req),
        configured: authConfigured(),
        db: hasDb,
        r2: r2Configured,
      }, noStore);
    }

    // Všechno ostatní jsou POST s JSON tělem (ochrana proti CSRF spolu se SameSite=Strict).
    if (req.method !== 'POST' || !String(req.headers['content-type'] || '').includes('application/json')) {
      return send(res, 405, { error: 'Method not allowed' }, noStore);
    }
    const body = await readJson(req);

    if (action === 'login') {
      if (!authConfigured()) return send(res, 503, { error: 'ADMIN_PASSWORD není nastaveno (min. 8 znaků).' }, noStore);
      if (!checkPassword(body.password)) {
        await sleep(800);
        return send(res, 401, { error: 'Špatné heslo.' }, noStore);
      }
      return send(res, 200, { ok: true }, { ...noStore, 'Set-Cookie': sessionCookie() });
    }
    if (action === 'logout') return send(res, 200, { ok: true }, { ...noStore, 'Set-Cookie': clearCookie() });

    if (!isAuthed(req)) return send(res, 401, { error: 'Nepřihlášen.' }, noStore);
    if (action === 'upload') {
      if (!r2Configured) return send(res, 503, { error: 'R2 není nastaveno (viz README).' }, noStore);
      return send(res, 200, await presignUpload({ contentType: body.contentType, size: Number(body.size) }), noStore);
    }
    if (!hasDb) return send(res, 503, { error: 'Databáze (DATABASE_URL) není připojena.' }, noStore);
    await ensureSchema();

    if (action === 'list') {
      return send(res, 200, { posts: await sql`SELECT * FROM posts ORDER BY published_at DESC` }, noStore);
    }

    if (action === 'save') {
      const p = {
        id: Number(body.id) || null,
        title_cs: str(body.title_cs, 200), title_fr: str(body.title_fr, 200),
        excerpt_cs: str(body.excerpt_cs, 500), excerpt_fr: str(body.excerpt_fr, 500),
        body_cs: str(body.body_cs, 30000), body_fr: str(body.body_fr, 30000),
        cover_url: str(body.cover_url, 500),
        cover_credit: str(body.cover_credit, 200), cover_credit_url: str(body.cover_credit_url, 500),
        category: ['paris', 'voyage', 'langue'].includes(body.category) ? body.category : 'paris',
        author: str(body.author, 100),
        sources: JSON.stringify(String(body.sources || '').split('\n').map((x) => x.trim()).filter((x) => /^https:\/\//.test(x)).slice(0, 20)),
        published: body.published !== false,
        published_at: body.published_at && !isNaN(Date.parse(body.published_at)) ? new Date(body.published_at).toISOString() : new Date().toISOString(),
      };
      if (!p.title_cs && !p.title_fr) return send(res, 400, { error: 'Vyplňte alespoň jeden nadpis (CS nebo FR).' }, noStore);
      if (p.cover_url && !URLISH.test(p.cover_url)) return send(res, 400, { error: 'Obrázek musí být https:// URL.' }, noStore);
      const slug = slugify(str(body.slug, 80) || p.title_fr || p.title_cs) || `clanek-${Date.now()}`;

      if (p.id) {
        const rows = await sql`UPDATE posts SET slug=${slug}, title_cs=${p.title_cs}, title_fr=${p.title_fr},
          excerpt_cs=${p.excerpt_cs}, excerpt_fr=${p.excerpt_fr}, body_cs=${p.body_cs}, body_fr=${p.body_fr},
          cover_url=${p.cover_url}, cover_credit=${p.cover_credit}, cover_credit_url=${p.cover_credit_url}, category=${p.category}, author=${p.author}, sources=${p.sources}, status=CASE WHEN ${p.published} THEN 'published' ELSE status END, published=${p.published}, published_at=${p.published_at}, updated_at=now()
          WHERE id=${p.id} RETURNING *`;
        return rows[0] ? send(res, 200, { post: rows[0] }, noStore) : send(res, 404, { error: 'Článek neexistuje.' }, noStore);
      }
      const rows = await sql`INSERT INTO posts (slug, title_cs, title_fr, excerpt_cs, excerpt_fr, body_cs, body_fr, cover_url, cover_credit, cover_credit_url, category, author, sources, published, published_at)
        VALUES (${slug}, ${p.title_cs}, ${p.title_fr}, ${p.excerpt_cs}, ${p.excerpt_fr}, ${p.body_cs}, ${p.body_fr}, ${p.cover_url}, ${p.cover_credit}, ${p.cover_credit_url}, ${p.category}, ${p.author}, ${p.sources}, ${p.published}, ${p.published_at})
        RETURNING *`;
      return send(res, 200, { post: rows[0] }, noStore);
    }

    if (action === 'review') {
      const id = Number(body.id);
      const rows = body.decision === 'publish'
        ? await sql`UPDATE posts SET status='published', published=true, published_at=now(), review_note='' WHERE id=${id} RETURNING id`
        : await sql`UPDATE posts SET status='rejected', published=false, review_note=${str(body.note, 500)} WHERE id=${id} RETURNING id`;
      return rows[0] ? send(res, 200, { ok: true }, noStore) : send(res, 404, { error: 'Článek neexistuje.' }, noStore);
    }
    if (action === 'invites-create') {
      const count = Math.min(Math.max(Number(body.count) || 1, 1), 60), days = Math.min(Math.max(Number(body.days) || 30, 1), 180), note = str(body.note, 100);
      const codes = [];
      for (let i = 0; i < count; i++) {
        const code = newCode();
        await sql`INSERT INTO invites (code, note, expires_at) VALUES (${code}, ${note}, now() + ${days + ' days'}::interval)`;
        codes.push(code);
      }
      return send(res, 200, { codes }, noStore);
    }
    if (action === 'invites-list') {
      return send(res, 200, { invites: await sql`SELECT code, note, created_at, expires_at, used_at, used_by FROM invites ORDER BY created_at DESC LIMIT 300` }, noStore);
    }
    if (action === 'invites-delete') {
      await sql`DELETE FROM invites WHERE code = ${str(body.code, 20)} AND used_by IS NULL`;
      return send(res, 200, { ok: true }, noStore);
    }
    if (action === 'users-list') {
      return send(res, 200, { users: await sql`SELECT u.id, u.email, u.display_name, u.status, u.note, u.created_at, u.last_login,
        (SELECT count(*)::int FROM posts p WHERE p.author_user_id = u.id) AS posts FROM users u ORDER BY u.created_at DESC` }, noStore);
    }
    if (action === 'user-status') {
      await sql`UPDATE users SET status = ${body.status === 'disabled' ? 'disabled' : 'active'} WHERE id = ${Number(body.id)}`;
      return send(res, 200, { ok: true }, noStore);
    }
    if (action === 'user-reset') {
      const temp = randomBytes(9).toString('base64url');   // 12 znaků, zobrazí se jen jednou
      const r = await sql`UPDATE users SET pass_hash = ${await hashPassword(temp)}, failed_count = 0, locked_until = NULL WHERE id = ${Number(body.id)} RETURNING id`;
      return r[0] ? send(res, 200, { password: temp }, noStore) : send(res, 404, { error: 'Uživatel neexistuje.' }, noStore);
    }
    if (action === 'user-delete') {
      const id = Number(body.id);
      await sql`DELETE FROM posts WHERE author_user_id = ${id} AND status <> 'published'`;
      await sql`UPDATE posts SET author_user_id = NULL WHERE author_user_id = ${id}`;
      await sql`DELETE FROM users WHERE id = ${id}`;
      return send(res, 200, { ok: true }, noStore);
    }
    if (action === 'delete') {
      await sql`DELETE FROM posts WHERE id = ${Number(body.id)}`;
      return send(res, 200, { ok: true }, noStore);
    }
    if (action === 'gallery-list') {
      return send(res, 200, { items: await sql`SELECT * FROM gallery ORDER BY created_at DESC` }, noStore);
    }
    if (action === 'gallery-save') {
      const g = { id: Number(body.id) || null, title_fr: str(body.title_fr, 200), title_cs: str(body.title_cs, 200), author: str(body.author, 100),
        place: str(body.place, 120), image_url: str(body.image_url, 500), credit: str(body.credit, 200), published: body.published !== false };
      if (!URLISH.test(g.image_url)) return send(res, 400, { error: 'Obrázek musí být https:// URL (nebo nahraný soubor).' }, noStore);
      if (g.id) {
        const rows = await sql`UPDATE gallery SET title_fr=${g.title_fr}, title_cs=${g.title_cs}, author=${g.author}, place=${g.place}, image_url=${g.image_url}, credit=${g.credit}, published=${g.published} WHERE id=${g.id} RETURNING *`;
        return rows[0] ? send(res, 200, { item: rows[0] }, noStore) : send(res, 404, { error: 'Položka neexistuje.' }, noStore);
      }
      const rows = await sql`INSERT INTO gallery (title_fr, title_cs, author, place, image_url, credit, published) VALUES (${g.title_fr}, ${g.title_cs}, ${g.author}, ${g.place}, ${g.image_url}, ${g.credit}, ${g.published}) RETURNING *`;
      return send(res, 200, { item: rows[0] }, noStore);
    }
    if (action === 'gallery-delete') {
      await sql`DELETE FROM gallery WHERE id = ${Number(body.id)}`;
      return send(res, 200, { ok: true }, noStore);
    }
    if (action === 'messages') {
      return send(res, 200, { messages: await sql`SELECT id, name, email, message, kind, lang, created_at FROM messages ORDER BY created_at DESC LIMIT 200` }, noStore);
    }
    if (action === 'delete-message') {
      await sql`DELETE FROM messages WHERE id = ${Number(body.id)}`;
      return send(res, 200, { ok: true }, noStore);
    }
    return send(res, 400, { error: 'Neznámá akce.' }, noStore);
  } catch (e) {
    if (e?.code === '23505') return send(res, 409, { error: 'Článek se stejným slugem už existuje.' }, noStore);
    console.error('admin', action, e);
    return send(res, 500, { error: 'Chyba serveru.' }, noStore);
  }
}
