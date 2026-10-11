// Studentské účty.  POST /api/account?action=register|login|logout|posts|save|delete|upload|change-password|delete-account  ·  GET ?action=me
import { sql, hasDb, ensureSchema } from '../lib/db.js';
import { hashPassword, verifyPassword, userCookie, clearUserCookie, currentUser, strongEnough } from '../lib/users.js';
import { presignUpload, r2Configured } from '../lib/r2.js';
import { send, readJson, str, slugify } from '../lib/http.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const URLISH = /^(https:\/\/)[^\s"'<>]*$/;
const CATS = ['voyage', 'paris', 'langue'];
const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const noStore = { 'Cache-Control': 'no-store' };
const pub = (p) => ({ id: p.id, slug: p.slug, level: p.level, place: p.place, category: p.category, status: p.status, review_note: p.review_note, title_fr: p.title_fr, title_cs: p.title_cs,
  excerpt_fr: p.excerpt_fr, excerpt_cs: p.excerpt_cs, body_fr: p.body_fr, body_cs: p.body_cs, cover_url: p.cover_url, cover_credit: p.cover_credit, updated_at: p.updated_at });

export default async function handler(req, res) {
  const action = new URL(req.url, 'http://x').searchParams.get('action') || '';
  try {
    if (!hasDb) return send(res, 503, { error: 'unavailable', db: false }, noStore);
    await ensureSchema();

    if (action === 'me') {
      const u = await currentUser(req);
      if (!u) return send(res, 200, { user: null, r2: r2Configured }, noStore);
      const f = (await sql`SELECT public_slug, bio, show_profile, show_class, class_name, sig_text FROM users WHERE id = ${u.id}`)[0] || {};
      return send(res, 200, { user: { name: u.display_name, email: u.email, slug: f.public_slug || '', bio: f.bio || '', showProfile: f.show_profile !== false, showClass: Boolean(f.show_class), className: f.class_name || '', sig: f.sig_text || '' }, r2: r2Configured }, noStore);
    }
    if (req.method !== 'POST' || !String(req.headers['content-type'] || '').includes('application/json')) return send(res, 405, { error: 'Method not allowed' }, noStore);
    const b = await readJson(req);

    // ---- registrace pozvánkou ----
    if (action === 'register') {
      const email = str(b.email, 200).toLowerCase(), name = str(b.name, 40), code = str(b.code, 20).toUpperCase().replace(/\s/g, '');
      if (!EMAIL.test(email) || name.length < 2 || !strongEnough(b.password)) return send(res, 400, { error: 'invalid' }, noStore);
      const inv = (await sql`SELECT code, note FROM invites WHERE code = ${code} AND used_by IS NULL AND expires_at > now()`)[0];
      if (!inv) { await sleep(600); return send(res, 403, { error: 'code' }, noStore); }
      if ((await sql`SELECT 1 FROM users WHERE email = ${email}`).length) return send(res, 409, { error: 'exists' }, noStore);
      const hash = await hashPassword(b.password);
      const u = (await sql`INSERT INTO users (email, display_name, pass_hash, note, class_name) VALUES (${email}, ${name}, ${hash}, ${inv.code}, ${str(inv.note, 60)}) RETURNING id`)[0];
      await sql`UPDATE users SET public_slug = ${(slugify(name) || 'autor') + '-' + u.id} WHERE id = ${u.id}`;
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
        category: CATS.includes(b.category) ? b.category : 'voyage', level: LEVELS.includes(b.level) ? b.level : '', place: str(b.place, 80) };
      if (b.submit && !p.level) return send(res, 400, { error: 'level' }, noStore);
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
          cover_url=${p.cover_url}, cover_credit=${p.cover_credit}, category=${p.category}, level=${p.level}, place=${p.place}, lat=CASE WHEN place = ${p.place} THEN lat ELSE NULL END, lon=CASE WHEN place = ${p.place} THEN lon ELSE NULL END, status=${status}, published=false, review_note='', updated_at=now() WHERE id=${id} RETURNING *`;
        return send(res, 200, { post: pub(r[0]) }, noStore);
      }
      const slug = `${slugify(p.title_fr || p.title_cs).slice(0, 60) || 'clanek'}-${Math.random().toString(36).slice(2, 7)}`;
      const r = await sql`INSERT INTO posts (slug, category, level, place, base_slug, author, author_user_id, title_fr, title_cs, excerpt_fr, excerpt_cs, body_fr, body_cs, cover_url, cover_credit, status, published, published_at)
        VALUES (${slug}, ${p.category}, ${p.level}, ${p.place}, ${slug}, ${user.display_name}, ${user.id}, ${p.title_fr}, ${p.title_cs}, ${p.excerpt_fr}, ${p.excerpt_cs}, ${p.body_fr}, ${p.body_cs}, ${p.cover_url}, ${p.cover_credit}, ${status}, false, now()) RETURNING *`;
      return send(res, 200, { post: pub(r[0]) }, noStore);
    }

    if (action === 'profile-save') {
      const bio = str(b.bio, 300), sig = str(b.sig, 30);
      await sql`UPDATE users SET bio = ${bio}, sig_text = ${sig}, show_profile = ${b.showProfile !== false}, show_class = ${Boolean(b.showClass)} WHERE id = ${user.id}`;
      return send(res, 200, { ok: true }, noStore);
    }
    if (action === 'corrections-inbox') {
      const rows = await sql`SELECT c.id, c.lang, c.original, c.suggestion, c.note, c.created_at, p.title_fr, p.title_cs, p.slug, u.display_name AS who
        FROM corrections c JOIN posts p ON p.id = c.post_id JOIN users u ON u.id = c.user_id
        WHERE p.author_user_id = ${user.id} AND c.status = 'pending' ORDER BY c.created_at DESC LIMIT 50`;
      return send(res, 200, { corrections: rows }, noStore);
    }
    if (action === 'correction-decide') {
      const c = (await sql`SELECT c.*, p.author_user_id, p.body_fr, p.body_cs FROM corrections c JOIN posts p ON p.id = c.post_id WHERE c.id = ${Number(b.id)}`)[0];
      if (!c || c.author_user_id !== user.id || c.status !== 'pending') return send(res, 404, { error: 'notfound' }, noStore);
      if (b.decision !== 'accept') { await sql`UPDATE corrections SET status = 'declined' WHERE id = ${c.id}`; return send(res, 200, { ok: true }, noStore); }
      const col = c.lang === 'cs' ? 'body_cs' : 'body_fr', body = c[col] || '';
      if (!body.includes(c.original)) { await sql`UPDATE corrections SET status = 'declined' WHERE id = ${c.id}`; return send(res, 409, { error: 'notfound' }, noStore); }
      const next = body.replace(c.original, c.suggestion);
      if (c.lang === 'cs') await sql`UPDATE posts SET body_cs = ${next}, updated_at = now() WHERE id = ${c.post_id}`;
      else await sql`UPDATE posts SET body_fr = ${next}, updated_at = now() WHERE id = ${c.post_id}`;
      await sql`UPDATE corrections SET status = 'accepted' WHERE id = ${c.id}`;
      return send(res, 200, { ok: true }, noStore);
    }
    if (action === 'my-postcards') {
      return send(res, 200, { postcards: await sql`SELECT id, photo_id, message, lang, status, created_at FROM postcards WHERE user_id = ${user.id} ORDER BY created_at DESC LIMIT 30` }, noStore);
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
      await sql`DELETE FROM reactions WHERE user_id = ${user.id}`;
      await sql`DELETE FROM postcards WHERE user_id = ${user.id}`;
      await sql`DELETE FROM corrections WHERE user_id = ${user.id}`;
      await sql`DELETE FROM users WHERE id = ${user.id}`;
      return send(res, 200, { ok: true }, { ...noStore, 'Set-Cookie': clearUserCookie() });
    }
    return send(res, 400, { error: 'unknown' }, noStore);
  } catch (e) {
    console.error('account', action, e);
    return send(res, 500, { error: 'server' }, noStore);
  }
}
