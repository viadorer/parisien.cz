#!/usr/bin/env node
// Stáhne všechny fotky z data/*.json z Wikimedia Commons (pomalu, po jedné) a uloží je do images/photos/
// ve dvou velikostech: <id>.jpg (1600 px) a <id>-s.jpg (640 px). <id> = sha1(název souboru)[0..10].
// Použití: node scripts/mirror-photos.mjs <složka-pro-surové-soubory>
import { readFileSync, readdirSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const ROOT = new URL('..', import.meta.url).pathname;
const RAW = process.argv[2];
if (!RAW) { console.error('Chybí složka pro surové soubory'); process.exit(1); }
mkdirSync(RAW, { recursive: true });
mkdirSync(`${ROOT}images/photos`, { recursive: true });

const photos = new Map();
const walk = (o) => {
  if (Array.isArray(o)) return o.forEach(walk);
  if (o && typeof o === 'object') {
    if (o.url && o.license && o.page && o.file) photos.set(o.file, o);
    else Object.values(o).forEach(walk);
  }
};
for (const f of readdirSync(`${ROOT}data`).filter((x) => x.endsWith('.json'))) walk(JSON.parse(readFileSync(`${ROOT}data/${f}`, 'utf8')));
for (const f of readdirSync(`${ROOT}data/articles`)) walk(JSON.parse(readFileSync(`${ROOT}data/articles/${f}`, 'utf8')));

const id = (file) => createHash('sha1').update(file).digest('hex').slice(0, 10);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const UA = 'parisien.cz-school-project/1.0 (https://www.parisien.cz; info@parisien.cz) one-time mirror of CC-licensed images';
console.log(`${photos.size} fotek`);
let done = 0, failed = [];
for (const [file, p] of photos) {
  const out = `${ROOT}images/photos/${id(file)}.jpg`;
  if (existsSync(out) && existsSync(out.replace('.jpg', '-s.jpg'))) { done++; continue; }
  const raw = `${RAW}/${id(file)}.jpg`;
  let ok = false;
  for (let attempt = 0; attempt < 6 && !ok; attempt++) {
    try {
      const r = await fetch(p.url.replace(/width=\d+/, 'width=1920'), { headers: { 'User-Agent': UA }, redirect: 'follow' });
      if (r.status === 429) { const wait = (Number(r.headers.get('retry-after')) || 20 * (attempt + 1)) * 1000; console.log('429, čekám', wait / 1000, 's'); await sleep(wait); continue; }
      if (!r.ok || !(r.headers.get('content-type') || '').startsWith('image')) throw new Error(`HTTP ${r.status}`);
      writeFileSync(raw, Buffer.from(await r.arrayBuffer())); ok = true;
    } catch (e) { console.log('chyba', file, e.message); await sleep(5000); }
  }
  if (!ok) { failed.push(file); continue; }
  execFileSync('sips', ['-Z', '1600', '-s', 'format', 'jpeg', '-s', 'formatOptions', '74', raw, '--out', out], { stdio: 'ignore' });
  execFileSync('sips', ['-Z', '640', '-s', 'format', 'jpeg', '-s', 'formatOptions', '72', raw, '--out', out.replace('.jpg', '-s.jpg')], { stdio: 'ignore' });
  done++;
  if (done % 10 === 0) console.log(`${done}/${photos.size}`);
  await sleep(2500);
}
console.log(`HOTOVO ${done}/${photos.size}, selhalo: ${failed.length}`);
failed.forEach((f) => console.log('  -', f));
