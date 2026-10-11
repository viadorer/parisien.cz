#!/usr/bin/env node
// Zkopíruje témata „Paříž“ z data/quak-export/*.json do projektu Quak a zaregistruje je v src/data/index.ts.
// Idempotentní (opakované spuštění nic nezdvojí). NECOMMITUJE a NENASAZUJE nic.
//   node scripts/sync-quak.mjs [cesta-k-quak] [--dry]
import { readFileSync, writeFileSync, copyFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const args = process.argv.slice(2);
const dry = args.includes('--dry');
const QUAK = args.find((a) => !a.startsWith('--')) || join(ROOT, '..', 'quak');
const SRC = join(ROOT, 'data/quak-export');
const GROUP = 'Paříž (parisien.cz)';
const META = {
  'pariz-orientace': ['Paříž: orientace a doprava', 'TrainFront', 'Metro, RER, směry, nádraží a ptaní na cestu.'],
  'pariz-kavarna-jidlo': ['Paříž: kavárna, pekárna, trh', 'UtensilsCrossed', 'Objednávání, pečivo, trh a pařížská gastronomie.'],
  'pariz-kultura': ['Paříž: kultura a památky', 'Landmark', 'Muzea, památky, divadlo a umění.'],
  'pariz-zivot': ['Paříž: bydlení, studium a záležitosti', 'House', 'Ubytování, studium ve Francii, lékárna, pošta a zdvořilost.'],
  'pariz-vyrazy': ['Paříž: výrazy a hovorová řeč', 'MessagesSquare', 'Idiomy, verlan a fráze, které se v Paříži opravdu říkají.'],
};
const ids = Object.keys(META).filter((id) => existsSync(join(SRC, `${id}.json`)));
if (!ids.length) { console.error('Žádná témata v data/quak-export'); process.exit(1); }
const index = join(QUAK, 'src/data/index.ts');
if (!existsSync(index)) { console.error('Nenalezen', index); process.exit(1); }
const camel = (id) => id.replace(/-(\w)/g, (_, c) => c.toUpperCase());

// 1) kontrola formátu
for (const id of ids) {
  const rows = JSON.parse(readFileSync(join(SRC, `${id}.json`), 'utf8'));
  rows.forEach((r, i) => {
    if (!Array.isArray(r) || !['w', 'p'].includes(r[0]) || r.slice(1, 4).some((x) => typeof x !== 'string' || !x.trim()) || !['A1', 'A2', 'B1', 'B2'].includes(r[4])) throw new Error(`${id}: řádek ${i} má špatný formát`);
    if (r[5]?.ex && (!Array.isArray(r[5].ex) || r[5].ex.length !== 3)) throw new Error(`${id}: řádek ${i} má špatné ex`);
  });
  console.log(`✓ ${id}: ${rows.length} řádků`);
}

// 2) kopie souborů
if (!dry) for (const id of ids) copyFileSync(join(SRC, `${id}.json`), join(QUAK, `src/data/topics/${id}.json`));

// 3) registrace v index.ts
let s = readFileSync(index, 'utf8');
const BEG_I = '// parisien.cz:imports:begin', END_I = '// parisien.cz:imports:end';
const BEG_D = '  // parisien.cz:decks:begin', END_D = '  // parisien.cz:decks:end';
const imports = `${BEG_I}\n${ids.map((id) => `import ${camel(id)} from "./topics/${id}.json";`).join('\n')}\n${END_I}\n`;
const decks = `${BEG_D}\n${ids.map((id) => `  { topic: { id: "${id}", name: ${JSON.stringify(META[id][0])}, icon: ${JSON.stringify(META[id][1])}, group: ${JSON.stringify(GROUP)}, description: ${JSON.stringify(META[id][2])}, langs: ["fr"] } satisfies Topic, items: deck("${id}", ${camel(id)} as Row[]) },`).join('\n')}\n${END_D}\n`;
const replaceBlock = (txt, beg, end, block) => { const a = txt.indexOf(beg); const b = txt.indexOf(end); return a >= 0 && b > a ? txt.slice(0, a) + block.trimEnd() + txt.slice(b + end.length) : null; };
let n = replaceBlock(s, BEG_I, END_I, imports);
if (n === null) { const anchor = 'import urady from "./topics/urady.json";\n'; if (!s.includes(anchor)) throw new Error('Nenalezena kotva importů'); n = s.replace(anchor, anchor + imports); }
s = n;
if (!s.includes(JSON.stringify(GROUP))) {
  if (!s.includes('"Práce a společnost"] as const;')) throw new Error('Nenalezen konec GROUPS');
  s = s.replace('"Práce a společnost"] as const;', `"Práce a společnost", ${JSON.stringify(GROUP)}] as const;`);
}
n = replaceBlock(s, BEG_D, END_D, decks);
if (n === null) { const anchor = '  t("urady", "Úřady, banka a právo", "Landmark", "Práce a společnost", "Dokumenty, účet, pojištění, daně.", urady),\n'; if (!s.includes(anchor)) throw new Error('Nenalezena kotva decků'); n = s.replace(anchor, anchor + '\n' + decks); }
s = n;
if (!dry) writeFileSync(index, s);
console.log(dry ? '(dry run – nic nezapsáno)' : `Zapsáno do ${QUAK}`);
