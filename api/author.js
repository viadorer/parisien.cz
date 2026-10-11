// Profil autora (studenta): jméno, podpis, o mně, články.  /fr/auteur/:slug a /cs/auteur/:slug → /api/author?lang=&slug=
import { layout, esc, pick } from '../lib/layout.js';
import { sql, hasDb, ensureSchema } from '../lib/db.js';
import { getStudentPosts } from '../lib/posts.js';

const T = {
  fr: { posts: 'Articles', since: 'Membre depuis', class: 'Classe', none: 'Pas encore d’article publié.', back: '← La communauté', nf: 'Profil introuvable', nfp: 'Ce profil n’existe pas ou n’est pas public.', about: 'À propos', reads: 'Lire' },
  cs: { posts: 'Články', since: 'Členem od', class: 'Třída', none: 'Zatím žádný zveřejněný článek.', back: '← Komunita', nf: 'Profil nenalezen', nfp: 'Tento profil neexistuje nebo není veřejný.', about: 'O mně', reads: 'Číst' },
};
const CAT = { fr: { paris: 'Paris', voyage: 'Voyages', langue: 'Langue' }, cs: { paris: 'Paříž', voyage: 'Cestování', langue: 'Jazyk' } };
const initials = (n) => String(n).split(/\s+/).map((x) => x[0]).join('').slice(0, 2).toUpperCase();

export default async function handler(req, res) {
  const q = new URL(req.url, 'http://x').searchParams;
  const lang = q.get('lang') === 'cs' ? 'cs' : 'fr';
  const slug = String(q.get('slug') || '').slice(0, 80);
  const t = T[lang];
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  const notFound = () => {
    res.statusCode = 404;
    return res.end(layout({ lang, path: `/auteur/${slug}`, title: `${t.nf} – parisien.cz`, description: t.nfp, noindex: true,
      body: `<article class="article"><h1>${esc(t.nf)}</h1><p>${esc(t.nfp)}</p><p><a class="read-more" href="/${lang}/komunita">${esc(t.back)}</a></p></article>` }));
  };
  try {
    if (!hasDb) return notFound();
    await ensureSchema();
    const u = (await sql`SELECT id, display_name, bio, sig_text, class_name, show_class, created_at FROM users WHERE public_slug = ${slug} AND show_profile AND status = 'active'`)[0];
    if (!u) return notFound();
    const posts = await getStudentPosts({ userId: u.id, limit: 50 });
    const [{ n }] = await sql`SELECT count(*)::int AS n FROM reactions r JOIN posts p ON p.slug = r.post_slug WHERE p.author_user_id = ${u.id}`;
    const since = new Date(u.created_at).toLocaleDateString(lang === 'cs' ? 'cs-CZ' : 'fr-FR', { month: 'long', year: 'numeric' });
    const sig = u.sig_text || u.display_name;
    const body = `<article class="article profile">
  <a class="read-more" href="/${lang}/komunita">${esc(t.back)}</a>
  <header class="profile-head"><div class="avatar" aria-hidden="true">${esc(initials(u.display_name))}</div>
    <div><h1>${esc(u.display_name)}</h1>
    <p class="muted">${u.show_class && u.class_name ? `${esc(t.class)} ${esc(u.class_name)} · ` : ''}${esc(t.since)} ${esc(since)} · ${posts.length} ${esc(t.posts.toLowerCase())} · ${n} ${lang === 'cs' ? 'reakcí' : 'réactions'}</p></div></header>
  ${u.bio ? `<h2>${esc(t.about)}</h2><p class="profile-bio">${esc(u.bio)}</p>` : ''}
  <div class="signature profile-sig"><div class="sig-name">${esc(sig)}</div></div>
  <h2>${esc(t.posts)}</h2>
  ${posts.length ? `<div class="blog-posts">${posts.map((p) => `<article class="blog-post"><div class="post-date">${esc(CAT[lang][p.category] || p.category)}${p.level ? ` · ${esc(p.level)}` : ''} · ${esc(new Date(p.date).toLocaleDateString(lang === 'cs' ? 'cs-CZ' : 'fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }))}</div><h3><a href="/${lang}/article/${esc(p.slug)}">${esc(pick(p.title, lang))}</a></h3><div class="post-excerpt"><p>${esc(pick(p.excerpt, lang))}</p></div></article>`).join('')}</div>` : `<p class="muted">${esc(t.none)}</p>`}
</article>`;
    res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
    return res.end(layout({ lang, path: `/auteur/${slug}`, title: `${u.display_name} – parisien.cz`, description: u.bio || `${u.display_name} – ${t.posts}`, body, bodyClass: 'page-article' }));
  } catch (e) {
    console.error('author', e);
    res.statusCode = 500;
    return res.end('Server error');
  }
}
