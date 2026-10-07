// Server-side vykreslený článek (SEO + náhledy při sdílení).  /fr/article/:slug a /cs/article/:slug  → /api/article?lang=&slug=
import { layout, esc, pick, figure, SITE } from '../lib/layout.js';
import { toHtml } from '../lib/markup.js';
import { getPost, getPosts } from '../lib/posts.js';

const CAT = {
  fr: { paris: 'Paris', voyage: 'Voyages', langue: 'Langue' },
  cs: { paris: 'Paříž', voyage: 'Cestování', langue: 'Jazyk' },
};
const T = {
  fr: { back: '← Tous les articles', sources: 'Sources', by: 'Par', notrans: 'Cet article n’est pas encore traduit en français ; voici la version tchèque.', more: 'À lire aussi', nf: 'Article introuvable', nfp: 'Cet article n’existe pas ou n’est plus publié.' },
  cs: { back: '← Všechny články', sources: 'Zdroje', by: 'Autor', notrans: 'Tento článek zatím nemá český překlad, zobrazuje se francouzská verze.', more: 'Přečtěte si také', nf: 'Článek nenalezen', nfp: 'Tento článek neexistuje nebo už není zveřejněný.' },
};
const fmt = (iso, lang) => new Date(iso).toLocaleDateString(lang === 'cs' ? 'cs-CZ' : 'fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

export default async function handler(req, res) {
  const q = new URL(req.url, 'http://x').searchParams;
  const lang = q.get('lang') === 'cs' ? 'cs' : 'fr';
  const slug = q.get('slug') || '';
  const t = T[lang];
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  try {
    const post = await getPost(slug);
    if (!post) {
      res.statusCode = 404;
      return res.end(layout({ lang, path: `/article/${slug}`, title: `${t.nf} – parisien.cz`, description: t.nfp, noindex: true,
        body: `<article class="article"><h1>${esc(t.nf)}</h1><p>${esc(t.nfp)}</p><p><a class="read-more" href="/${lang}/blog">${esc(t.back)}</a></p></article>` }));
    }
    const title = pick(post.title, lang);
    const missing = !post.body[lang];
    const body = post.body[lang] || post.body[lang === 'cs' ? 'fr' : 'cs'];
    const cover = post.cover ? { url: post.cover, author: '', license: '', page: post.coverCredit?.url } : null;
    const related = (await getPosts({ cat: post.category, limit: 4 })).filter((p) => p.slug !== slug).slice(0, 3);

    const html = layout({
      lang, path: `/article/${slug}`, title: `${title} – parisien.cz`, description: pick(post.excerpt, lang),
      image: post.cover ? post.cover.replace(/width=\d+/, 'width=1280') : undefined,
      bodyClass: 'page-article',
      head: `<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@type': 'Article', headline: title, datePublished: post.date, inLanguage: lang, author: { '@type': 'Organization', name: post.author || 'parisien.cz' }, image: post.cover || undefined, mainEntityOfPage: `${SITE}/${lang}/article/${slug}` }).replace(/</g, '\\u003c')}</script>`,
      body: `<article class="article">
  <a class="read-more" href="/${lang}/blog">${esc(t.back)}</a>
  <div class="post-meta"><span class="tag">${esc(CAT[lang][post.category] || post.category)}</span> <time datetime="${esc(post.date)}">${esc(fmt(post.date, lang))}</time>${post.author ? ` · ${esc(t.by)} ${esc(post.author)}` : ''}</div>
  <h1>${esc(title)}</h1>
  ${post.cover ? `<figure class="photo article-cover"><img src="${esc(post.cover)}" alt=""><figcaption class="credit">${post.coverCredit ? `<a href="${esc(post.coverCredit.url || '#')}" target="_blank" rel="noopener">© ${esc(post.coverCredit.text)}</a>` : ''}</figcaption></figure>` : ''}
  ${missing ? `<p class="note">${esc(t.notrans)}</p>` : ''}
  <div class="article-body">${toHtml(body)}</div>
  ${post.sources.length ? `<aside class="sources"><h2>${esc(t.sources)}</h2><ul>${post.sources.map((s) => `<li><a href="${esc(s)}" target="_blank" rel="noopener">${esc(s.replace(/^https:\/\/(www\.)?/, '').slice(0, 80))}</a></li>`).join('')}</ul></aside>` : ''}
  ${related.length ? `<section class="related"><h2>${esc(t.more)}</h2><div class="blog-posts">${related.map((p) => `<article class="blog-post"><div class="post-date">${esc(fmt(p.date, lang))}</div><h3><a href="/${lang}/article/${esc(p.slug)}">${esc(pick(p.title, lang))}</a></h3></article>`).join('')}</div></section>` : ''}
</article>`,
    });
    res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=600');
    return res.end(html);
  } catch (e) {
    console.error('article', e);
    res.statusCode = 500;
    return res.end('Server error');
  }
}
