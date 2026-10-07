// Jednoduché admin přihlášení: heslo z env + podepsaná HttpOnly cookie.
import { createHmac, timingSafeEqual } from 'node:crypto';

const COOKIE = 'pz_admin';
const TTL = 60 * 60 * 24 * 7; // 7 dní

const password = () => process.env.ADMIN_PASSWORD || '';
const secret = () => process.env.SESSION_SECRET || `pz:${password()}`;
const sign = (payload) => createHmac('sha256', secret()).update(payload).digest('base64url');

export const authConfigured = () => password().length >= 8;

export function checkPassword(input) {
  const a = Buffer.from(String(input));
  const b = Buffer.from(password());
  return authConfigured() && a.length === b.length && timingSafeEqual(a, b);
}

export function sessionCookie() {
  const exp = String(Math.floor(Date.now() / 1000) + TTL);
  return `${COOKIE}=${exp}.${sign(exp)}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${TTL}`;
}

export const clearCookie = () => `${COOKIE}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`;

export function isAuthed(req) {
  if (!authConfigured()) return false;
  const m = /(?:^|;\s*)pz_admin=([^;]+)/.exec(req.headers.cookie || '');
  if (!m) return false;
  const [exp, sig] = m[1].split('.');
  if (!exp || !sig || Number(exp) < Date.now() / 1000) return false;
  const good = Buffer.from(sign(exp));
  const got = Buffer.from(sig);
  return good.length === got.length && timingSafeEqual(good, got);
}
