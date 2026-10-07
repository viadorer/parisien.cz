// Studentské účty: hesla (scrypt), přihlašovací cookie (HMAC), pomocné funkce.
import { scrypt as _scrypt, randomBytes, timingSafeEqual, createHmac } from 'node:crypto';
import { promisify } from 'node:util';
import { sql } from './db.js';

const scrypt = promisify(_scrypt);
const COOKIE = 'pz_user';
const TTL = 60 * 60 * 24 * 14; // 14 dní
const secret = () => process.env.SESSION_SECRET || `pz:${process.env.ADMIN_PASSWORD || ''}`;
const sign = (p) => createHmac('sha256', `user:${secret()}`).update(p).digest('base64url');

export async function hashPassword(pw) {
  const salt = randomBytes(16);
  const h = await scrypt(pw, salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$${salt.toString('base64')}$${h.toString('base64')}`;
}
export async function verifyPassword(pw, stored) {
  const [alg, s, h] = String(stored).split('$');
  if (alg !== 'scrypt' || !s || !h) return false;
  const want = Buffer.from(h, 'base64');
  const got = await scrypt(pw, Buffer.from(s, 'base64'), want.length, { N: 16384, r: 8, p: 1 });
  return got.length === want.length && timingSafeEqual(got, want);
}

export const userCookie = (id) => {
  const exp = Math.floor(Date.now() / 1000) + TTL;
  const payload = `${id}.${exp}`;
  return `${COOKIE}=${payload}.${sign(payload)}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${TTL}`;
};
export const clearUserCookie = () => `${COOKIE}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`;

/** Vrátí přihlášeného (aktivního) uživatele nebo null. */
export async function currentUser(req) {
  const m = /(?:^|;\s*)pz_user=([^;]+)/.exec(req.headers.cookie || '');
  if (!m) return null;
  const [id, exp, sig] = m[1].split('.');
  if (!id || !exp || !sig || Number(exp) < Date.now() / 1000) return null;
  const good = Buffer.from(sign(`${id}.${exp}`)), got = Buffer.from(sig);
  if (good.length !== got.length || !timingSafeEqual(good, got)) return null;
  const rows = await sql`SELECT id, email, display_name, role, status FROM users WHERE id = ${Number(id)}`;
  return rows[0] && rows[0].status === 'active' ? rows[0] : null;
}

export const newCode = () => {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // bez matoucích znaků
  const b = randomBytes(8);
  return [...b].map((x) => A[x % A.length]).join('').replace(/(.{4})(.{4})/, '$1-$2');
};
export const strongEnough = (pw) => typeof pw === 'string' && pw.length >= 10 && pw.length <= 200;
