#!/usr/bin/env node
// Vyhledání fotek na Wikimedia Commons s ověřenou licencí (CC0 / PD / CC BY / CC BY-SA).
//   node scripts/commons.mjs search "Tour Eiffel" [limit]   → kandidáti (seřazeno, jen povolené licence)
//   node scripts/commons.mjs info "File:Název.jpg"          → jeden záznam v konečném formátu
// Záznam: { file, url, page, author, license, licenseUrl, desc, width, height }
const API = 'https://commons.wikimedia.org/w/api.php';
const OK = /^(cc0|public domain|pd|cc[- ]by(?!-nc)(?!-nd)|cc[- ]by-sa|attribution)/i;
const strip = (h = '') => String(h).replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/\s+/g, ' ').trim();

function toEntry(p) {
  const ii = p.imageinfo?.[0]; if (!ii) return null;
  const m = ii.extmetadata || {};
  const license = strip(m.LicenseShortName?.value || '');
  const name = p.title.replace(/^File:/, '');
  return {
    file: p.title,
    url: `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(name.replace(/ /g, '_'))}?width=1200`,
    page: ii.descriptionurl,
    author: strip(m.Artist?.value || '') || 'Unknown',
    license,
    licenseUrl: strip(m.LicenseUrl?.value || ''),
    desc: strip(m.ImageDescription?.value || '').slice(0, 300),
    width: ii.width, height: ii.height, mime: ii.mime,
    allowed: OK.test(license) && m.NonFree?.value !== 'true',
  };
}
async function q(params) {
  const u = new URL(API);
  for (const [k, v] of Object.entries({ action: 'query', format: 'json', prop: 'imageinfo', iiprop: 'url|extmetadata|size|mime', ...params })) u.searchParams.set(k, v);
  const r = await fetch(u, { headers: { 'User-Agent': 'parisien.cz-school-project/1.0 (info@parisien.cz)' } });
  return (await r.json()).query?.pages || {};
}
const [cmd, arg, lim] = process.argv.slice(2);
if (cmd === 'search') {
  const pages = await q({ generator: 'search', gsrnamespace: 6, gsrsearch: `${arg} filetype:bitmap`, gsrlimit: Number(lim) || 20 });
  const out = Object.values(pages).sort((a, b) => a.index - b.index).map(toEntry).filter((e) => e && e.allowed && e.mime === 'image/jpeg' && e.width >= 1400);
  console.log(JSON.stringify(out.map(({ allowed, mime, ...e }) => e), null, 1));
} else if (cmd === 'info') {
  const title = arg.startsWith('File:') ? arg : `File:${arg}`;
  const e = Object.values(await q({ titles: title }))[0] && toEntry(Object.values(await q({ titles: title }))[0]);
  if (!e) { console.error('Soubor nenalezen'); process.exit(1); }
  if (!e.allowed) { console.error('NEPOVOLENÁ LICENCE:', e.license); process.exit(2); }
  const { allowed, mime, ...rest } = e; console.log(JSON.stringify(rest, null, 1));
} else { console.error('Použití: search "<dotaz>" [limit] | info "File:…"'); process.exit(1); }
