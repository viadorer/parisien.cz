// Komunita: autoři, pochvaly, pohlednice, návrhy oprav, mapa cest.
//   GET  ?action=authors | postcards | trips | reactions&slug=…
//   POST ?action=react | postcard-create | correction-create
import { sql, hasDb, ensureSchema } from '../lib/db.js';
import { currentUser } from '../lib/users.js';
import { send, readJson, str } from '../lib/http.js';
import { getStudentPosts } from '../lib/posts.js';

const KINDS = ['utile', 'merci', 'inspirant'];
const noStore = { 'Cache-Control': 'no-store' };
const short = { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' };

export default async function handler(req, res) {
  const q = new URL(req.url, 'http://x').searchParams;
  const action = q.get('action') || '';
  try {
    if (!hasDb) return send(res, 200, { authors: [], postcards: [], trips: [], counts: {}, mine: [] }, short);
    await ensureSchema();

    // ---------- veřejné čtení ----------
    if (req.method === 'GET') {
      if (action === 'authors') {
        const rows = await sql`SELECT u.public_slug AS slug, u.display_name AS name, u.bio, u.sig_text AS sig, u.class_name, u.show_class, count(p.id)::int AS posts
          FROM users u JOIN posts p ON p.author_user_id = u.id AND p.published
          WHERE u.show_profile AND u.status = 'active' GROUP BY u.id ORDER BY max(p.published_at) DESC LIMIT 60`;
        return send(res, 200, { authors: rows.map((r) => ({ slug: r.slug, name: r.name, sig: r.sig, className: r.show_class ? r.class_name : '', posts: r.posts })) }, short);
      }
      if (action === 'recent') {
        return send(res, 200, { posts: (await getStudentPosts({ limit: 12 })).map((p) => ({ slug: p.slug, title: p.title, excerpt: p.excerpt, level: p.level, category: p.category, author: p.author, authorSlug: p.authorSlug, date: p.date, cover: p.cover, coverCredit: p.coverCredit })) }, short);
      }
      if (action === 'postcards') {
        const rows = await sql`SELECT c.id, c.photo_id, c.message, c.lang, c.created_at, u.display_name AS name, u.public_slug AS slug, u.show_profile, u.sig_text AS sig
          FROM postcards c JOIN users u ON u.id = c.user_id WHERE c.status = 'published' AND u.status = 'active' ORDER BY c.created_at DESC LIMIT 60`;
        return send(res, 200, { postcards: rows.map((r) => ({ id: r.id, photo: r.photo_id, message: r.message, lang: r.lang, date: r.created_at, name: r.name, slug: r.show_profile ? r.slug : '', sig: r.sig })) }, short);
      }
      if (action === 'trips') {
        const rows = await sql`SELECT p.slug, p.place, p.lat, p.lon, p.title_fr, p.title_cs, p.author FROM posts p WHERE p.published AND p.author_user_id IS NOT NULL AND p.lat IS NOT NULL ORDER BY p.published_at DESC LIMIT 200`;
        return send(res, 200, { trips: rows.map((r) => ({ slug: r.slug, place: r.place, lat: r.lat, lon: r.lon, title: { fr: r.title_fr, cs: r.title_cs }, author: r.author })) }, short);
      }
      if (action === 'reactions') {
        const slug = str(q.get('slug'), 120);
        const rows = await sql`SELECT kind, count(*)::int AS n FROM reactions WHERE post_slug = ${slug} GROUP BY kind`;
        const counts = Object.fromEntries(KINDS.map((k) => [k, rows.find((r) => r.kind === k)?.n || 0]));
        const u = await currentUser(req);
        const mine = u ? (await sql`SELECT kind FROM reactions WHERE post_slug = ${slug} AND user_id = ${u.id}`).map((r) => r.kind) : [];
        return send(res, 200, { counts, mine, authed: Boolean(u) }, noStore);
      }
      return send(res, 400, { error: 'unknown' }, noStore);
    }

    // ---------- zápisy (jen přihlášení studenti) ----------
    if (req.method !== 'POST' || !String(req.headers['content-type'] || '').includes('application/json')) return send(res, 405, { error: 'Method not allowed' }, noStore);
    const u = await currentUser(req);
    if (!u) return send(res, 401, { error: 'auth' }, noStore);
    const b = await readJson(req);

    if (action === 'react') {
      const slug = str(b.slug, 120), kind = b.kind;
      if (!KINDS.includes(kind)) return send(res, 400, { error: 'kind' }, noStore);
      if (!(await sql`SELECT 1 FROM posts WHERE slug = ${slug} AND published`).length) return send(res, 404, { error: 'notfound' }, noStore);
      const had = (await sql`SELECT 1 FROM reactions WHERE post_slug = ${slug} AND user_id = ${u.id} AND kind = ${kind}`).length;
      if (had) await sql`DELETE FROM reactions WHERE post_slug = ${slug} AND user_id = ${u.id} AND kind = ${kind}`;
      else await sql`INSERT INTO reactions (post_slug, user_id, kind) VALUES (${slug}, ${u.id}, ${kind})`;
      const rows = await sql`SELECT kind, count(*)::int AS n FROM reactions WHERE post_slug = ${slug} GROUP BY kind`;
      const mine = (await sql`SELECT kind FROM reactions WHERE post_slug = ${slug} AND user_id = ${u.id}`).map((r) => r.kind);
      return send(res, 200, { counts: Object.fromEntries(KINDS.map((k) => [k, rows.find((r) => r.kind === k)?.n || 0])), mine }, noStore);
    }

    if (action === 'postcard-create') {
      const photo = str(b.photo, 20), message = str(b.message, 280), lang = b.lang === 'cs' ? 'cs' : 'fr';
      if (!/^[0-9a-f]{10}$/.test(photo) || message.length < 3) return send(res, 400, { error: 'invalid' }, noStore);
      const [{ n }] = await sql`SELECT count(*)::int AS n FROM postcards WHERE user_id = ${u.id} AND created_at > now() - interval '1 day'`;
      if (n >= 5) return send(res, 429, { error: 'rate' }, noStore);
      await sql`INSERT INTO postcards (user_id, photo_id, message, lang) VALUES (${u.id}, ${photo}, ${message}, ${lang})`;
      return send(res, 200, { ok: true }, noStore);
    }

    if (action === 'correction-create') {
      const slug = str(b.slug, 120), lang = b.lang === 'cs' ? 'cs' : 'fr';
      const original = str(b.original, 300), suggestion = str(b.suggestion, 300), note = str(b.note, 200);
      if (!original || !suggestion || original === suggestion) return send(res, 400, { error: 'invalid' }, noStore);
      const post = (await sql`SELECT id, author_user_id, body_fr, body_cs FROM posts WHERE slug = ${slug} AND published AND author_user_id IS NOT NULL`)[0];
      if (!post) return send(res, 404, { error: 'notfound' }, noStore);
      if (post.author_user_id === u.id) return send(res, 400, { error: 'own' }, noStore);
      if (!(lang === 'cs' ? post.body_cs : post.body_fr).includes(original)) return send(res, 400, { error: 'notintext' }, noStore);
      const [{ n }] = await sql`SELECT count(*)::int AS n FROM corrections WHERE user_id = ${u.id} AND created_at > now() - interval '1 day'`;
      if (n >= 10) return send(res, 429, { error: 'rate' }, noStore);
      await sql`INSERT INTO corrections (post_id, user_id, lang, original, suggestion, note) VALUES (${post.id}, ${u.id}, ${lang}, ${original}, ${suggestion}, ${note})`;
      return send(res, 200, { ok: true }, noStore);
    }
    return send(res, 400, { error: 'unknown' }, noStore);
  } catch (e) {
    console.error('community', action, e);
    return send(res, 500, { error: 'server' }, noStore);
  }
}
