// POST /api/contact  { name, email, message, lang, website }  (website = honeypot)
import { createHash } from 'node:crypto';
import { sql, hasDb, ensureSchema } from '../lib/db.js';
import { send, readJson, clientIp, str } from '../lib/http.js';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' });
  try {
    const b = await readJson(req);
    if (b.website) return send(res, 200, { ok: true }); // bot – tváříme se, že je OK

    const name = str(b.name, 100);
    const email = str(b.email, 200);
    const message = str(b.message, 4000);
    const lang = b.lang === 'cs' ? 'cs' : 'fr';
    if (!name || !EMAIL.test(email) || message.length < 3) return send(res, 400, { error: 'invalid' });
    if (!hasDb) return send(res, 503, { error: 'unavailable' });

    await ensureSchema();
    const ipHash = createHash('sha256').update(`${clientIp(req)}|${process.env.SESSION_SECRET || 'pz'}`).digest('hex').slice(0, 32);
    const [{ n }] = await sql`SELECT count(*)::int AS n FROM messages WHERE ip_hash = ${ipHash} AND created_at > now() - interval '1 hour'`;
    if (n >= 5) return send(res, 429, { error: 'rate' });

    await sql`INSERT INTO messages (name, email, message, lang, ip_hash) VALUES (${name}, ${email}, ${message}, ${lang}, ${ipHash})`;
    return send(res, 200, { ok: true });
  } catch (e) {
    console.error('contact', e);
    return send(res, 500, { error: 'Server error' });
  }
}
