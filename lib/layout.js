// Sdílená kostra stránek (hlavička s rozbalovacím menu, patička). Používá ji build i api/article.js.
export const SITE = 'https://www.parisien.cz';
export const LANGS = ['fr', 'cs'];

// Wikimedia při hotlinku povoluje jen standardní šířky miniatur.
const STD = [330, 500, 960, 1280, 1920];
export const std = (w) => STD.find((x) => x >= Number(w)) ?? 1920;
export const stdUrl = (html) => html.replace(/\?width=(\d+)/g, (m, w) => `?width=${std(w)}`);

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const pick = (o, lang) => (typeof o === 'string' ? o : (o && (o[lang] || o[lang === 'cs' ? 'fr' : 'cs'])) || '');

// Menu: 4 rozbalovací skupiny + 3 samostatné položky
export const NAV = [
  { label: { fr: 'Paris', cs: 'Paříž' }, items: [
    { href: '/paris', label: { fr: 'Lieux & monuments', cs: 'Místa a památky' } },
    { href: '/paris#quartiers', label: { fr: 'Quartiers', cs: 'Čtvrti' } },
    { href: '/carte', label: { fr: 'Carte interactive', cs: 'Interaktivní mapa' } },
    { href: '/webcams', label: { fr: 'Webcams', cs: 'Webkamery' } },
    { href: '/galerie', label: { fr: 'Galerie photo', cs: 'Fotogalerie' } },
  ] },
  { label: { fr: 'Culture', cs: 'Kultura' }, items: [
    { href: '/musees', label: { fr: 'Musées', cs: 'Muzea' } },
    { href: '/culture', label: { fr: 'Spectacles & littérature', cs: 'Divadlo, hudba, literatura' } },
    { href: '/evenements', label: { fr: 'Agenda des événements', cs: 'Kalendář akcí' } },
  ] },
  { label: { fr: 'Savourer', cs: 'Chutě' }, items: [
    { href: '/gastronomie', label: { fr: 'Gastronomie', cs: 'Gastronomie' } },
    { href: '/gastronomie#cafes', label: { fr: 'Cafés & boissons', cs: 'Kavárny a nápoje' } },
    { href: '/recettes', label: { fr: 'Recettes', cs: 'Recepty' } },
  ] },
  { label: { fr: 'Apprendre', cs: 'Učit se' }, items: [
    { href: '/apprendre', label: { fr: 'Vocabulaire & phrases', cs: 'Slovíčka a fráze' } },
    { href: '/apprendre#faux-amis', label: { fr: 'Faux amis FR–CZ', cs: 'Falešní přátelé FR–CZ' } },
    { href: '/apprendre#quiz', label: { fr: 'Quiz', cs: 'Kvíz' } },
  ] },
  { href: '/voyages', label: { fr: 'Voyages', cs: 'Cestování' } },
  { href: '/blog', label: { fr: 'Blog', cs: 'Blog' } },
  { href: '/compte', label: { fr: 'Mon espace', cs: 'Můj účet' } },
  { href: '/contact', label: { fr: 'Contact', cs: 'Kontakt' } },
];

const UIS = {
  fr: { skip: 'Aller au contenu', menu: 'Menu', rights: 'Projet scolaire, cours de français.', credits: 'Crédits photo',
        data: 'Agenda : données Ville de Paris (opendata.paris.fr, licence ODbL). Photos : Wikimedia Commons. Carte : © contributeurs OpenStreetMap. Vélib’, fontaines, Seine : Ville de Paris, Hub’Eau.' },
  cs: { skip: 'Přejít na obsah', menu: 'Menu', rights: 'Školní projekt, kurz francouzštiny.', credits: 'Zdroje fotografií',
        data: 'Kalendář: data Ville de Paris (opendata.paris.fr, licence ODbL). Fotografie: Wikimedia Commons. Mapa: © přispěvatelé OpenStreetMap. Vélib’, fontány, Seina: Ville de Paris, Hub’Eau.' },
};
export const ui = (lang) => UIS[lang];

const u = (lang, href) => `/${lang}${href === '/' ? '' : href}`;

function navHtml(lang) {
  return NAV.map((n, i) => {
    if (n.href) return `<li><a href="${u(lang, n.href)}">${esc(pick(n.label, lang))}</a></li>`;
    return `<li class="has-sub"><button type="button" aria-expanded="false" aria-controls="sub${i}">${esc(pick(n.label, lang))} <span aria-hidden="true">▾</span></button>
<ul class="sub" id="sub${i}">${n.items.map((c) => `<li><a href="${u(lang, c.href)}">${esc(pick(c.label, lang))}</a></li>`).join('')}</ul></li>`;
  }).join('\n');
}

/** Vrátí celé HTML stránky. path = cesta bez jazyka ('/', '/musees', '/article/slug'). */
export function layout({ lang, path, title, description, body, image, head = '', bodyClass = '', noindex = false }) {
  const other = lang === 'fr' ? 'cs' : 'fr';
  const canon = `${SITE}${u(lang, path)}`;
  const t = ui(lang);
  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${canon}">
<link rel="alternate" hreflang="fr" href="${SITE}${u('fr', path)}">
<link rel="alternate" hreflang="cs" href="${SITE}${u('cs', path)}">
<link rel="alternate" hreflang="x-default" href="${SITE}${u('fr', path)}">
${noindex ? '<meta name="robots" content="noindex">' : ''}
<meta property="og:type" content="website">
<meta property="og:site_name" content="parisien.cz">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${canon}">
<meta property="og:locale" content="${lang === 'cs' ? 'cs_CZ' : 'fr_FR'}">
${image ? `<meta property="og:image" content="${esc(image)}">` : ''}
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/images/logo.png">
<link rel="stylesheet" href="/styles.css">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600;700&family=Playfair+Display:wght@400;500;600;700&display=swap" rel="stylesheet">
${head}
</head>
<body class="${bodyClass}" data-lang="${lang}" data-path="${esc(path)}">
<a class="skip" href="#main">${esc(t.skip)}</a>
<header>
  <a class="logo-container" href="${u(lang, '/')}"><img src="/images/logo.png" alt="parisien.cz" class="logo"><span class="site-name">parisien.cz</span></a>
  <button class="menu-toggle" type="button" aria-expanded="false" aria-controls="nav" aria-label="${esc(t.menu)}"><span></span><span></span><span></span></button>
  <nav id="nav" aria-label="${esc(t.menu)}"><ul>
${navHtml(lang)}
  </ul></nav>
  <div class="lang" role="group" aria-label="Langue / Jazyk">
    <a href="${u('fr', path)}" hreflang="fr" lang="fr" data-set-lang="fr" aria-current="${lang === 'fr'}">FR</a><a href="${u('cs', path)}" hreflang="cs" lang="cs" data-set-lang="cs" aria-current="${lang === 'cs'}">CS</a>
  </div>
</header>
<main id="main">
${body}
</main>
<footer>
  <div class="container"><div class="footer-content">
    <div class="footer-logo"><img src="/images/logo.png" alt="parisien.cz" class="footer-logo-img"></div>
    <div class="footer-links">
      ${NAV.flatMap((n) => (n.items ? n.items.slice(0, 1) : [n])).map((n) => `<a href="${u(lang, n.href)}">${esc(pick(n.label, lang))}</a>`).join('\n      ')}
      <a href="${u(lang, '/credits')}">${esc(t.credits)}</a>
    </div>
    <div class="footer-copyright"><p>&copy; ${new Date().getFullYear()} parisien.cz · ${esc(t.rights)}</p><p>${esc(t.data)}</p></div>
  </div></div>
</footer>
<script src="/app.js" defer></script>
</body>
</html>`;
}

// Fotka s kreditem (Wikimedia Commons). Vrací <figure>.
export function figure(photo, { alt = '', cls = '', sizes = '', width = 1200, lazy = true } = {}) {
  if (!photo?.url) return '';
  const src = photo.url.replace(/width=\d+/, `width=${std(width)}`);
  const credit = `${photo.author || ''} · ${photo.license || ''}`.replace(/^ · | · $/g, '');
  return `<figure class="photo ${cls}"><img src="${esc(src)}" alt="${esc(alt)}"${lazy ? ' loading="lazy"' : ''}${sizes ? ` sizes="${sizes}"` : ''}><figcaption class="credit"><a href="${esc(photo.page || '#')}" target="_blank" rel="noopener">© ${esc(credit)}</a></figcaption></figure>`;
}
