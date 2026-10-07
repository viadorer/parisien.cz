// Studentské účty.  POST /api/account?action=register|login|logout|posts|save|delete|upload|change-password|delete-account  ·  GET ?action=me
import { sql, hasDb, ensureSchema } from '../lib/db.js';
import { hashPassword, verifyPassword, userCookie, clearUserCookie, currentUser, strongEnough } from '../lib/users.js';
import { presignUpload, r2Configured } from '../lib/r2.js';
import { send, readJson, str, slugify } from '../lib/http.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const URLISH = /^(https:\/\/)[^\s"'<>]*$/;
const CATS = ['voyage', 'paris', 'langue'];
const noStore = { 'Cache-Control': 'no-store' };
const pub = (p) => ({ id: p.id, slug: p.slug, category: p.category, status: p.status, review_note: p.review_note, title_fr: p.title_fr, title_cs: p.title_cs,
  excerpt_fr: p.excerpt_fr, excerpt_cs: p.excerpt_cs, body_fr: p.body_fr, body_cs: p.body_cs, cover_url: p.cover_url, cover_credit: p.cover_credit, updated_at: p.updated_at });

export default async function handler(req, res) {
  const action = new URL(req.url, 'http://x').searchParams.get('action') || '';
  try {
    if (!hasDb) return send(res, 503, { error: 'unavailable', db: false }, noStore);
    await ensureSchema();

    if (action === 'me') {
      const u = await currentUser(req);
      return send(res, 200, { user: u ? { name: u.display_name, email: u.email } : null, r2: r2Configured }, noStore);
    }
    if (req.method !== 'POST' || !String(req.headers['content-type'] || '').includes('application/json')) return send(res, 405, { error: 'Method not allowed' }, noStore);
    const b = await readJson(req);

    // ---- registrace pozvánkou ----
    if (action === 'register') {
      const email = str(b.email, 200).toLowerCase(), name = str(b.name, 40), code = str(b.code, 20).toUpperCase().replace(/\s/g, '');
      if (!EMAIL.test(email) || name.length < 2 || !strongEnough(b.password)) return send(res, 400, { error: 'invalid' }, noStore);
      const inv = (await sql`SELECT code FROM invites WHERE code = ${code} AND used_by IS NULL AND expires_at > now()`)[0];
      if (!inv) { await sleep(600); return send(res, 403, { error: 'code' }, noStore); }
      if ((await sql`SELECT 1 FROM users WHERE email = ${email}`).length) return send(res, 409, { error: 'exists' }, noStore);
      const hash = await hashPassword(b.password);
      const u = (await sql`INSERT INTO users (email, display_name, pass_hash, note) VALUES (${email}, ${name}, ${hash}, ${inv.code}) RETURNING id`)[0];
      const used = await sql`UPDATE invites SET used_by = ${u.id}, used_at = now() WHERE code = ${inv.code} AND used_by IS NULL RETURNING code`;
      if (!used.length) { await sql`DELETE FROM users WHERE id = ${u.id}`; return send(res, 403, { error: 'code' }, noStore); }
      return send(res, 200, { ok: true }, { ...noStore, 'Set-Cookie': userCookie(u.id) });
    }

    // ---- přihlášení ----
    if (action === 'login') {
      const email = str(b.email, 200).toLowerCase();
      const u = (await sql`SELECT * FROM users WHERE email = ${email}`)[0];
      const locked = u?.locked_until && new Date(u.locked_until) > new Date();
      const ok = u && !locked && u.status === 'active' && await verifyPassword(String(b.password || ''), u.pass_hash);
      if (!ok) {
        if (u && !locked) {
          const n = u.failed_count + 1;
          await sql`UPDATE users SET failed_count = ${n}, locked_until = ${n >= 8 ? new Date(Date.now() + 15 * 60e3).toISOString() : null} WHERE id = ${u.id}`;
        }
        await sleep(700);
        return send(res, locked ? 429 : 401, { error: locked ? 'locked' : 'credentials' }, noStore);
      }
      await sql`UPDATE users SET failed_count = 0, locked_until = NULL, last_login = now() WHERE id = ${u.id}`;
      return send(res, 200, { ok: true }, { ...noStore, 'Set-Cookie': userCookie(u.id) });
    }
    if (action === 'logout') return send(res, 200, { ok: true }, { ...noStore, 'Set-Cookie': clearUserCookie() });

    const user = await currentUser(req);
    if (!user) return send(res, 401, { error: 'auth' }, noStore);

    if (action === 'posts') {
      const rows = await sql`SELECT * FROM posts WHERE author_user_id = ${user.id} ORDER BY updated_at DESC`;
      return send(res, 200, { posts: rows.map(pub) }, noStore);
    }

    if (action === 'save') {
      const id = Number(b.id) || null;
      const p = { title_fr: str(b.title_fr, 200), title_cs: str(b.title_cs, 200), excerpt_fr: str(b.excerpt_fr, 400), excerpt_cs: str(b.excerpt_cs, 400),
        body_fr: str(b.body_fr, 20000), body_cs: str(b.body_cs, 20000), cover_url: str(b.cover_url, 500), cover_credit: str(b.cover_credit, 200),
        category: CATS.includes(b.category) ? b.category : 'voyage' };
      if (!p.title_fr && !p.title_cs) return send(res, 400, { error: 'title' }, noStore);
      if (p.cover_url && !URLISH.test(p.cover_url)) return send(res, 400, { error: 'cover' }, noStore);
      if (p.cover_url && !p.cover_credit) return send(res, 400, { error: 'credit' }, noStore);
      const status = b.submit ? 'submitted' : 'draft';
      if (b.submit && !(p.body_fr || p.body_cs)) return send(res, 400, { error: 'body' }, noStore);
      if (id) {
        const own = (await sql`SELECT status FROM posts WHERE id = ${id} AND author_user_id = ${user.id}`)[0];
        if (!own) return send(res, 404, { error: 'notfound' }, noStore);
        if (own.status === 'published') return send(res, 409, { error: 'published' }, noStore);
        const r = await sql`UPDATE posts SET title_fr=${p.title_fr}, title_cs=${p.title_cs}, excerpt_fr=${p.excerpt_fr}, excerpt_cs=${p.excerpt_cs}, body_fr=${p.body_fr}, body_cs=${p.body_cs},
          cover_url=${p.cover_url}, cover_credit=${p.cover_credit}, category=${p.category}, status=${status}, published=false, review_note='', updated_at=now() WHERE id=${id} RETURNING *`;
        return send(res, 200, { post: pub(r[0]) }, noStore);
      }
      const slug = `${slugify(p.title_fr || p.title_cs).slice(0, 60) || 'clanek'}-${Math.random().toString(36).slice(2, 7)}`;
      const r = await sql`INSERT INTO posts (slug, category, author, author_user_id, title_fr, title_cs, excerpt_fr, excerpt_cs, body_fr, body_cs, cover_url, cover_credit, status, published, published_at)
        VALUES (${slug}, ${p.category}, ${user.display_name}, ${user.id}, ${p.title_fr}, ${p.title_cs}, ${p.excerpt_fr}, ${p.excerpt_cs}, ${p.body_fr}, ${p.body_cs}, ${p.cover_url}, ${p.cover_credit}, ${status}, false, now()) RETURNING *`;
      return send(res, 200, { post: pub(r[0]) }, noStore);
    }

    if (action === 'delete') {
      const r = await sql`DELETE FROM posts WHERE id = ${Number(b.id)} AND author_user_id = ${user.id} AND status <> 'published' RETURNING id`;
      return send(res, r.length ? 200 : 404, r.length ? { ok: true } : { error: 'notfound' }, noStore);
    }

    if (action === 'upload') {
      if (!r2Configured) return send(res, 503, { error: 'r2' }, noStore);
      return send(res, 200, await presignUpload({ contentType: b.contentType, size: Number(b.size), folder: `students/${user.id}` }), noStore);
    }

    if (action === 'change-password') {
      const u = (await sql`SELECT pass_hash FROM users WHERE id = ${user.id}`)[0];
      if (!(await verifyPassword(String(b.current || ''), u.pass_hash))) { await sleep(600); return send(res, 403, { error: 'credentials' }, noStore); }
      if (!strongEnough(b.next)) return send(res, 400, { error: 'weak' }, noStore);
      await sql`UPDATE users SET pass_hash = ${await hashPassword(b.next)} WHERE id = ${user.id}`;
      return send(res, 200, { ok: true }, noStore);
    }

    if (action === 'delete-account') {
      const u = (await sql`SELECT pass_hash FROM users WHERE id = ${user.id}`)[0];
      if (!(await verifyPassword(String(b.password || ''), u.pass_hash))) { await sleep(600); return send(res, 403, { error: 'credentials' }, noStore); }
      await sql`DELETE FROM posts WHERE author_user_id = ${user.id} AND status <> 'published'`;
      await sql`UPDATE posts SET author_user_id = NULL WHERE author_user_id = ${user.id}`;   // zveřejněné články zůstanou pod přezdívkou
      await sql`DELETE FROM users WHERE id = ${user.id}`;
      return send(res, 200, { ok: true }, { ...noStore, 'Set-Cookie': clearUserCookie() });
    }
    return send(res, 400, { error: 'unknown' }, noStore);
  } catch (e) {
    console.error('account', action, e);
    return send(res, 500, { error: 'server' }, noStore);
  }
}
