# parisien.cz

Dvojjazyčný (FR/CS) školní projekt o Paříži a cestování. Statické stránky generované buildem + Vercel Functions + Neon Postgres + Cloudflare R2.

## Jak to funguje
- `data/*.json` – obsah (muzea, místa, čtvrti, gastronomie, recepty, kultura, výuka, galerie) a `data/articles/*.json` (články). Každá položka je ve FR i CS, fotky mají autora a licenci (Wikimedia Commons).
- `npm run build` (`scripts/build.mjs`) vygeneruje `dist/fr/*` a `dist/cs/*`, sitemap, robots a `lib/articles.generated.js` (úvodní články pro databázi).
- `api/posts.js` články, `api/article.js` server-side vykreslený článek (SEO), `api/events.js` živý kalendář (open data Ville de Paris, ODbL), `api/contact.js` formulář, `api/admin.js` správa.
- `/admin` – články (FR+CS, kategorie, autor, kredit fotky, zdroje), zprávy a návrhy článků od studentů, nahrávání obrázků do R2.
- `scripts/commons.mjs` – hledání fotek na Commons s ověřenou licencí (CC0 / PD / CC BY / CC BY-SA).

## Studentské účty
- Registrace jen s **kódem pozvánky** (admin → karta Studenti → Vytvořit; kód platí jednou). Bez e-mailové služby: reset hesla dělá admin („Nové heslo“).
- Student píše články ve FR/CS (`/fr/compte`, `/cs/compte`), ukládá koncepty a odesílá je ke schválení. Zveřejnit je může jen admin (karta Články → Schválit / Zamítnout s poznámkou).
- Pod článkem je jen přezdívka, ne e-mail. Hesla jsou hashovaná (scrypt), po 8 chybách se účet na 15 min zamkne, účet lze smazat.
- Testy lokálně: PGlite (viz `globalThis.__PZ_SQL` v `lib/db.js`).

## Nastavení na Vercelu
1. **Neon:** Project → Storage → Create → Neon (Marketplace). Nastaví `DATABASE_URL`; tabulky se vytvoří samy a naplní se 16 články.
2. **Environment Variables:** `ADMIN_PASSWORD` (min. 8 znaků), `SESSION_SECRET` (náhodný řetězec), `R2_*` podle `.env.example`.
3. **R2 CORS** (bucket → Settings → CORS), aby šlo nahrávat z `/admin`:
   ```json
   [{"AllowedOrigins":["https://www.parisien.cz","https://parisien.cz"],"AllowedMethods":["PUT"],"AllowedHeaders":["content-type"],"MaxAgeSeconds":3600}]
   ```
4. Redeploy. `/admin` → přihlášení.

Bez DB/R2 web funguje (články se berou ze seed dat), jen formulář a administrace hlásí, co chybí.

## Fotky
Fotky se zatím načítají přímo z Wikimedia Commons (standardní šířky miniatur). Pro stabilitu je lepší je zrcadlit do R2/Vercelu. Všechny autory a licence najdete na `/fr/credits` a `/cs/credits`.

Formát textu článků: odstavce oddělené prázdným řádkem, `## Nadpis`, `**tučně**`, `- odrážky`, `[text](https://…)`. HTML se nepodporuje.
