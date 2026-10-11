#!/usr/bin/env node
// Orientační měření čitelnosti francouzského textu (NENÍ náhradou za posouzení učitelem).
//   node scripts/readability.mjs                → všechny články v data/articles (+ data/articles-levels)
// Metriky: délka věty, délka slov, podíl dlouhých slov, Kandel–Moles (francouzská verze Fleschova indexu).
import { readFileSync, readdirSync, existsSync } from 'node:fs';
const ROOT = new URL('..', import.meta.url).pathname;

export function analyze(text) {
  const clean = String(text).replace(/^## .*$/gm, '').replace(/\*\*/g, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/^- /gm, '');
  const sentences = clean.split(/(?<=[.!?…:])\s+|\n+/).map((s) => s.trim()).filter((s) => s.split(/\s+/).length > 1);
  const words = clean.toLowerCase().match(/[a-zàâäçéèêëîïôöùûüÿœæ'-]+/g) || [];
  const syl = (w) => Math.max(1, (w.replace(/e$/, '').match(/[aeiouyàâäéèêëîïôöùûüÿœæ]+/g) || []).length);
  const asl = words.length / Math.max(sentences.length, 1);
  const asw = words.reduce((n, w) => n + syl(w), 0) / Math.max(words.length, 1);
  const long = words.filter((w) => w.replace(/[-']/g, '').length >= 9).length / Math.max(words.length, 1);
  const km = 207 - 1.015 * asl - 73.6 * asw;
  return { words: words.length, sentences: sentences.length, asl: +asl.toFixed(1), longPct: +(long * 100).toFixed(1), km: Math.round(km) };
}
// hrubé pásmo podle Kandel–Moles + délky věty (orientační!)
export function band({ km, asl }) {
  if (asl <= 8 && km >= 80) return 'A1';
  if (asl <= 12 && km >= 65) return 'A2';
  if (asl <= 17 && km >= 50) return 'B1';
  if (asl <= 23 && km >= 35) return 'B2';
  return 'C1+';
}
if (process.argv[1] === new URL(import.meta.url).pathname) {
  const dirs = ['data/articles', 'data/articles-levels'].filter((d) => existsSync(`${ROOT}${d}`));
  const rows = [];
  for (const d of dirs) for (const f of readdirSync(`${ROOT}${d}`).filter((x) => x.endsWith('.json'))) {
    const j = JSON.parse(readFileSync(`${ROOT}${d}/${f}`, 'utf8'));
    const a = analyze(j.body_fr || '');
    rows.push({ file: f.replace('.json', ''), level: j.level || '(orig)', ...a, odhad: band(a) });
  }
  console.table(rows);
}
