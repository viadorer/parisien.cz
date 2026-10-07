# parisien.cz

Dvojjazyčný (FR/CS) školní projekt o Paříži. Statický web + Vercel Functions + Neon Postgres + Cloudflare R2.

## Struktura
- `index.html`, `post.html`, `styles.css`, `app.js`, `i18n.js` – veřejný web (obsah v `i18n.js`, články z DB)
- `admin.html`, `admin-app.js` – správa článků (`/admin`)
- `api/posts.js` (veřejné čtení), `api/contact.js` (formulář), `api/admin.js` (přihlášení, CRUD, upload)
- `lib/` – DB (schéma se vytvoří samo a naplní se 3 úvodními články), auth, R2

## Nastavení na Vercelu
1. **Neon:** Project → Storage → Create → Neon (Marketplace). Nastaví `DATABASE_URL`.
2. **Environment Variables:** `ADMIN_PASSWORD` (min. 8 znaků), `SESSION_SECRET` (náhodný řetězec), `R2_*` podle `.env.example`.
3. **R2 CORS** (bucket → Settings → CORS), aby šlo nahrávat z `/admin`:
   ```json
   [{"AllowedOrigins":["https://www.parisien.cz","https://parisien.cz"],"AllowedMethods":["PUT"],"AllowedHeaders":["content-type"],"MaxAgeSeconds":3600}]
   ```
4. Redeploy. Pak `/admin` → přihlášení → články (FR + CS) a obrázky.
5. Volitelně nahrajte obrázky webu do R2: `npm run migrate-images`.

Bez DB/R2 web funguje (zobrazí úvodní články), jen formulář a administrace hlásí, co chybí.

Formát článků: odstavce oddělené prázdným řádkem, `## Nadpis`, `**tučně**`. HTML se nepodporuje.
