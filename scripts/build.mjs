#!/usr/bin/env node
// Build: data/*.json → dist/{fr,cs}/*.html (statické, SEO) + lib/articles.generated.js (úvodní články pro DB).
import { readFileSync, writeFileSync, mkdirSync, rmSync, cpSync, existsSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { layout, esc, pick, figure, SITE, stdUrl, std } from '../lib/layout.js';

const ROOT = new URL('..', import.meta.url).pathname;
const OUT = `${ROOT}dist`;
const rd = (f, fallback) => { try { return JSON.parse(readFileSync(`${ROOT}data/${f}`, 'utf8')); } catch { return fallback; } };

const sitePhotos = rd('site-photos.json', {});
const museums = rd('museums.json', []);
const places = rd('places.json', []);
const quartiers = rd('quartiers.json', []);
const food = rd('food.json', {});
const recipes = rd('recipes.json', []);
const culture = rd('culture.json', {});
const learn = rd('learn.json', {});
const gallery = rd('gallery.json', []);
const coords = rd('coords.json', {});

// ---------- místní kopie fotek (scripts/mirror-photos.mjs) ----------
const photoId = (file) => createHash('sha1').update(file).digest('hex').slice(0, 10);
const hasLocal = (file) => existsSync(`${ROOT}images/photos/${photoId(file)}.jpg`) && existsSync(`${ROOT}images/photos/${photoId(file)}-s.jpg`);
const localByName = new Map();   // název souboru v URL → id
const registerPhoto = (o) => { if (o.file && o.url && hasLocal(o.file)) localByName.set(o.url.split('/').pop().split('?')[0], photoId(o.file)); };
const localize = (html) => html.replace(/https:\/\/commons\.wikimedia\.org\/wiki\/Special:FilePath\/([^"'\s<>)]*?(?:\([^"'\s<>)]*\))*[^"'\s<>)]*?)\?width=(\d+)/g, (m, name, w) => {
  const id = localByName.get(name.replace(/&#39;/g, "'")); return id ? `/images/photos/${id}${Number(w) <= 960 ? '-s' : ''}.jpg` : m;
});

// ---------- články → úvodní data pro DB ----------
const articles = existsSync(`${ROOT}data/articles`)
  ? readdirSync(`${ROOT}data/articles`).filter((f) => f.endsWith('.json')).map((f) => JSON.parse(readFileSync(`${ROOT}data/articles/${f}`, 'utf8')))
  : [];
const seed = articles.map((a) => ({
  slug: a.slug, category: a.category || 'paris', author: a.author || 'Rédaction parisien.cz', published_at: a.published_at,
  title_fr: a.title_fr || '', title_cs: a.title_cs || '', excerpt_fr: a.excerpt_fr || '', excerpt_cs: a.excerpt_cs || '',
  body_fr: a.body_fr || '', body_cs: a.body_cs || '',
  cover_url: a.photo?.url ? (hasLocal(a.photo.file) ? `/images/photos/${photoId(a.photo.file)}.jpg` : a.photo.url.replace(/width=\d+/, `width=${std(960)}`)) : '', cover_credit: a.photo ? `${a.photo.author} · ${a.photo.license}` : '', cover_credit_url: a.photo?.page || '',
  sources: JSON.stringify(a.sources || []),
}));
writeFileSync(`${ROOT}lib/articles.generated.js`, `// GENEROVÁNO scripts/build.mjs z data/articles/*.json – needitovat ručně.\nexport default ${JSON.stringify(seed, null, 1)};\n`);

// ---------- pomocné ----------
const ph = (o) => o?.photo;
const li = (arr) => `<ul>${(arr || []).map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`;
const link = (url, label) => (url ? `<a class="read-more" href="${esc(url)}" target="_blank" rel="noopener">${esc(label)}</a>` : '');
const allPhotos = [];
const collect = (obj) => {
  if (!obj || typeof obj !== 'object') return;
  if (obj.license && obj.page && obj.url) { allPhotos.push(obj); registerPhoto(obj); return; }
  for (const v of Object.values(obj)) collect(v);
};

const pages = {};   // path → (lang) => { title, description, body, image?, head?, bodyClass? }
const head = (lang, id, title, lead) => `<section class="page-head dark"><div class="container"><h1>${esc(title)}</h1>${lead ? `<p class="lead">${esc(lead)}</p>` : ''}</div></section>`;
const sec = (cls, inner, id = '') => `<section${id ? ` id="${id}"` : ''} class="section ${cls}"><div class="container">${inner}</div></section>`;

// ======================= ACCUEIL =======================
pages['/'] = (lang) => {
  const L = (fr, cs) => (lang === 'cs' ? cs : fr);
  const hero = sitePhotos.hero;
  const tiles = [
    ['/paris', L('Paris', 'Paříž'), L('Monuments, quartiers, histoire', 'Památky, čtvrti, historie'), sitePhotos.eiffel],
    ['/musees', L('Musées', 'Muzea'), L('Louvre, Orsay, Orangerie…', 'Louvre, Orsay, Orangerie…'), sitePhotos.louvre],
    ['/evenements', L('Agenda', 'Kalendář akcí'), L('Concerts, expos, spectacles : en direct', 'Koncerty, výstavy, představení: živě'), sitePhotos.notredame],
    ['/gastronomie', L('Gastronomie', 'Gastronomie'), L('Pain, pâtisseries, cafés, marchés', 'Pečivo, dezerty, kavárny, trhy'), ph(food.pastries?.find(ph)) || sitePhotos.toits],
    ['/apprendre', L('Apprendre', 'Učit se'), L('Vocabulaire, faux amis, quiz', 'Slovíčka, falešní přátelé, kvíz'), sitePhotos.montmartre],
    ['/voyages', L('Voyages', 'Cestování'), L('Récits, conseils, idées d’escapades', 'Příběhy, rady, tipy na výlety'), ph(places.find((p) => p.id?.includes('versailles'))) || ph(places[0])],
  ];
  const body = `
<section id="hero">
  <div class="hero-slideshow"><div class="slide active" style="background-image:url('${esc(hero?.url || '')}')"></div></div>
  <div class="hero-content">
    <h1>${esc(L('Paris, vu par des étudiants de français', 'Paříž očima studentů francouzštiny'))}</h1>
    <p>${esc(L('Monuments, saveurs, mots et histoires de la capitale — en français et en tchèque.', 'Památky, chutě, slova a příběhy hlavního města — francouzsky i česky.'))}</p>
    <a href="#explorer" class="btn-primary">${esc(L('Explorer le site', 'Prozkoumat web'))}</a>
  </div>
  ${hero ? `<a class="hero-credit" href="${esc(hero.page)}" target="_blank" rel="noopener">© ${esc(hero.author)} · ${esc(hero.license)}</a>` : ''}
</section>

<section class="now-strip"><div class="container">
  <div id="weather" class="weather" data-lang="${lang}" aria-live="polite"></div>
  <div class="now-date" id="now-date"></div>
</div></section>

${sec('', `<h2>${esc(L('Pourquoi ce site ?', 'Proč tento web?'))}</h2>
<div class="content-wrapper"><div class="text-content">
<p>${esc(L('parisien.cz est né dans notre cours de français : nous voulions apprendre la langue en parlant de ce qui nous fait rêver. Chaque page existe en français et en tchèque, pour lire, comparer et apprendre.', 'parisien.cz vznikl v našem kurzu francouzštiny: chtěli jsme se učit jazyk tak, že budeme mluvit o tom, o čem sníme. Každá stránka existuje francouzsky i česky, abyste mohli číst, srovnávat a učit se.'))}</p>
<p>${esc(L('Les textes sont rédigés à partir de sources vérifiées (liens en bas de chaque article), les photos viennent de Wikimedia Commons sous licence libre, et l’agenda est alimenté en direct par les données ouvertes de la Ville de Paris. Un travail d’étudiants : si vous voyez une erreur, dites-le-nous !', 'Texty vycházejí z ověřených zdrojů (odkazy najdete pod každým článkem), fotografie pocházejí z Wikimedia Commons pod svobodnou licencí a kalendář se plní živě z otevřených dat města Paříže. Je to práce studentů: pokud objevíte chybu, napište nám!'))}</p>
</div>
<div class="highlight-box">
<div class="stat"><span class="number">2.1M</span><span class="label">${esc(L('habitants (ville de Paris)', 'obyvatel (město Paříž)'))}</span></div>
<div class="stat"><span class="number">105 km²</span><span class="label">${esc(L('de superficie', 'rozloha'))}</span></div>
<div class="stat"><span class="number">1889</span><span class="label">${esc(L('inauguration de la tour Eiffel', 'otevření Eiffelovy věže'))}</span></div>
</div></div>`, 'a-propos')}

${sec('dark', `<h2>${esc(L('À l’affiche cette semaine', 'Tento týden v Paříži'))}</h2>
<p class="lead">${esc(L('Concerts, expositions, théâtre : l’agenda officiel de la Ville de Paris, en direct.', 'Koncerty, výstavy, divadlo: oficiální kalendář města Paříže, živě.'))}</p>
<div id="home-events" class="events-grid" data-limit="6" data-lang="${lang}" aria-live="polite"></div>
<p class="center"><a class="btn-primary light" href="/${lang}/evenements">${esc(L('Tout l’agenda', 'Celý kalendář'))}</a></p>`, 'agenda')}

${sec('', `<h2>${esc(L('Explorer', 'Prozkoumat'))}</h2>
<div class="tiles">${tiles.map(([href, t, d, p]) => `<a class="tile" href="/${lang}${href}">${p ? `<img src="${esc(p.url.replace(/width=\d+/, 'width=700'))}" alt="" loading="lazy">` : ''}<span class="tile-text"><strong>${esc(t)}</strong><small>${esc(d)}</small></span></a>`).join('')}</div>`, 'explorer')}

${sec('grey', `<h2>${esc(L('Derniers articles', 'Nejnovější články'))}</h2>
<div id="home-posts" class="cards-grid" data-limit="3" data-lang="${lang}" aria-live="polite"></div>
<p class="center"><a class="btn-primary dark-btn" href="/${lang}/blog">${esc(L('Tous les articles', 'Všechny články'))}</a></p>`, 'articles')}

${sec('dark', `<h2>${esc(L('Vous avez voyagé ? Racontez-le !', 'Cestovali jste? Napište o tom!'))}</h2>
<p class="narrow">${esc(L('Ce site n’est pas seulement sur Paris : nous publions aussi les récits de voyage des étudiants, en français et en tchèque. Quelques lignes, une photo à vous, un conseil pratique : proposez votre article.', 'Tento web není jen o Paříži: publikujeme také cestopisy studentů, francouzsky i česky. Pár řádků, vaše vlastní fotka, praktická rada: navrhněte svůj článek.'))}</p>
<a class="btn-primary light" href="/${lang}/contact?type=story#form">${esc(L('Proposer un article', 'Navrhnout článek'))}</a>
<a class="btn-primary light" href="/${lang}/article/carnet-de-voyage-guide">${esc(L('Guide d’écriture', 'Návod, jak psát'))}</a>`, 'voyages-cta')}`;
  return { title: L('parisien.cz – Paris vu par des étudiants de français', 'parisien.cz – Paříž očima studentů francouzštiny'),
    description: L('Projet scolaire bilingue : monuments, musées, gastronomie, agenda en direct, vocabulaire et récits de voyage.', 'Dvojjazyčný školní projekt: památky, muzea, gastronomie, živý kalendář akcí, slovíčka a cestopisy.'),
    body, image: hero?.url };
};

// ======================= PARIS =======================
pages['/paris'] = (lang) => {
  const L = (fr, cs) => (lang === 'cs' ? cs : fr);
  const row = (p, i) => `<article class="place-row${i % 2 ? ' rev' : ''}" id="${esc(p.id)}">
  ${figure(p.photo, { alt: pick(p.name, lang), width: 1280 })}
  <div class="place-text"><h3>${esc(pick(p.name, lang))}</h3><span class="museum-tag">${esc(pick(p.area, lang))}</span>
  <p>${esc(pick(p.intro, lang))}</p><p>${esc(pick(p.history, lang))}</p>
  ${p.facts ? li(p.facts[lang]) : ''}
  <p class="tip"><strong>${esc(L('Conseil', 'Tip'))} :</strong> ${esc(pick(p.tip, lang))}</p>
  ${link(p.url, L('Site officiel', 'Oficiální web'))}</div></article>`;
  const q = (x) => `<article class="card">${figure(x.photo, { alt: pick(x.name, lang), width: 700 })}<div class="card-body"><span class="museum-tag">${esc(x.arr || '')}</span><h3>${esc(pick(x.name, lang))}</h3>
  <p><em>${esc(pick(x.vibe, lang))}</em></p><p>${esc(pick(x.intro, lang))}</p>${x.doAndSee ? li(x.doAndSee[lang]) : ''}
  <p class="tip"><strong>${esc(L('À table', 'K jídlu'))} :</strong> ${esc(pick(x.foodTip, lang))}</p></div></article>`;
  return {
    title: L('Paris : monuments et quartiers – parisien.cz', 'Paříž: památky a čtvrti – parisien.cz'),
    description: L('Tour Eiffel, Notre-Dame, Montmartre, Versailles : les lieux incontournables et les quartiers de Paris, avec histoire et conseils.', 'Eiffelovka, Notre-Dame, Montmartre, Versailles: nejdůležitější místa a pařížské čtvrti s historií a radami.'),
    body: head(lang, 'paris', L('Lieux & monuments', 'Místa a památky'), L('Quatorze lieux pour comprendre Paris.', 'Čtrnáct míst, která pomohou pochopit Paříž.'))
      + sec('', places.map(row).join(''))
      + sec('grey', `<h2>${esc(L('Quartiers', 'Čtvrti'))}</h2><p class="lead">${esc(L('Paris est une ville de villages : chaque quartier a son caractère.', 'Paříž je město vesnic: každá čtvrť má svůj charakter.'))}</p><div class="cards-grid">${quartiers.map(q).join('')}</div>`, 'quartiers'),
  };
};

// ======================= MUSÉES =======================
pages['/musees'] = (lang) => {
  const L = (fr, cs) => (lang === 'cs' ? cs : fr);
  const card = (m) => `<article class="card museum" id="${esc(m.id)}">${figure(m.photo, { alt: pick(m.name, lang), width: 800 })}<div class="card-body">
  <span class="museum-tag">${esc(pick(m.kind, lang))} · ${esc(m.district || '')}${m.founded ? ` · ${esc(m.founded)}` : ''}</span><h3>${esc(pick(m.name, lang))}</h3>
  <p>${esc(pick(m.intro, lang))}</p>${m.highlights ? li(m.highlights[lang]) : ''}
  <p class="tip"><strong>${esc(L('Conseil', 'Tip'))} :</strong> ${esc(pick(m.tip, lang))}</p>${link(m.url, L('Site officiel (horaires, tarifs)', 'Oficiální web (otevírací doba, vstupné)'))}</div></article>`;
  return {
    title: L('Musées de Paris – parisien.cz', 'Muzea v Paříži – parisien.cz'),
    description: L('Louvre, Orsay, Orangerie, Rodin, Picasso… douze musées parisiens présentés avec leurs collections phares.', 'Louvre, Orsay, Orangerie, Rodin, Picasso… dvanáct pařížských muzeí a jejich nejznámější sbírky.'),
    body: head(lang, 'musees', L('Musées de Paris', 'Pařížská muzea'), L('Douze musées pour commencer. Horaires et tarifs changent : vérifiez toujours sur le site officiel.', 'Dvanáct muzeí na začátek. Otevírací doba a ceny se mění: vždy je ověřte na oficiálním webu.'))
      + sec('', `<div class="cards-grid">${museums.map(card).join('')}</div>`),
  };
};

// ======================= GALERIE =======================
pages['/galerie'] = (lang) => {
  const L = (fr, cs) => (lang === 'cs' ? cs : fr);
  const cats = { monuments: ['Monuments', 'Památky'], 'ponts-seine': ['Seine & ponts', 'Seina a mosty'], quartiers: ['Quartiers', 'Čtvrti'], musees: ['Musées', 'Muzea'], gastronomie: ['Gastronomie', 'Gastronomie'], parcs: ['Parcs', 'Parky'], 'metro-transport': ['Métro & transports', 'Metro a doprava'], nuit: ['Paris la nuit', 'Paříž v noci'], 'cinema-culture': ['Cinéma & culture', 'Kino a kultura'] };
  const present = Object.keys(cats).filter((c) => gallery.some((g) => g.category === c));
  return {
    title: L('Galerie photo de Paris – parisien.cz', 'Fotogalerie Paříže – parisien.cz'),
    description: L('Paris en photos libres de droits (Wikimedia Commons) : monuments, Seine, quartiers, musées, gastronomie.', 'Paříž na svobodných fotografiích (Wikimedia Commons): památky, Seina, čtvrti, muzea, gastronomie.'),
    body: head(lang, 'galerie', L('Galerie photo', 'Fotogalerie'), L('De vraies photos, sous licence libre. Cliquez pour agrandir ; l’auteur est indiqué sous chaque image.', 'Skutečné fotografie pod svobodnou licencí. Kliknutím zvětšíte; autor je uveden pod každým obrázkem.'))
      + sec('', `<div class="filters" role="group" aria-label="${esc(L('Catégories', 'Kategorie'))}"><button class="chip" data-filter="all" aria-pressed="true">${esc(L('Tout', 'Vše'))}</button>${present.map((c) => `<button class="chip" data-filter="${c}" aria-pressed="false">${esc(cats[c][lang === 'cs' ? 1 : 0])}</button>`).join('')}</div>
<div class="gallery-grid" id="gallery">${gallery.map((g) => `<figure class="photo g-item" data-cat="${esc(g.category)}"><a href="${esc(g.photo.url.replace(/width=\d+/, 'width=1600'))}" data-full="${esc(g.photo.url.replace(/width=\d+/, 'width=1600'))}" data-caption="${esc(pick(g.caption, lang))}" data-credit="© ${esc(g.photo.author)} · ${esc(g.photo.license)}" data-page="${esc(g.photo.page)}"><img src="${esc(g.photo.url.replace(/width=\d+/, 'width=600'))}" alt="${esc(pick(g.caption, lang))}" loading="lazy"></a><figcaption>${esc(pick(g.caption, lang))}<a class="credit-inline" href="${esc(g.photo.page)}" target="_blank" rel="noopener">© ${esc(g.photo.author)} · ${esc(g.photo.license)}</a></figcaption></figure>`).join('')}</div>`)
      + sec('grey', `<h2>${esc(L('Photos des étudiants', 'Fotky studentů'))}</h2><p class="lead">${esc(L('Nos propres photos de Paris et de nos voyages.', 'Naše vlastní fotky z Paříže a z cest.'))}</p><div class="gallery-grid" id="student-gallery"></div>`, 'etudiants'),
  };
};

// ======================= GASTRONOMIE =======================
pages['/gastronomie'] = (lang) => {
  const L = (fr, cs) => (lang === 'cs' ? cs : fr);
  const item = (x) => `<article class="card">${figure(x.photo, { alt: pick(x.name, lang), width: 600 })}<div class="card-body"><h3>${esc(pick(x.name, lang))}</h3><p>${esc(pick(x.text, lang))}</p></div></article>`;
  const cafe = (c) => `<article class="card">${figure(c.photo, { alt: pick(c.name, lang), width: 600 })}<div class="card-body"><span class="museum-tag">${esc(pick(c.area, lang) || '')}${c.since ? ` · ${L('depuis', 'od')} ${esc(c.since)}` : ''}</span><h3>${esc(pick(c.name, lang))}</h3><p>${esc(pick(c.text, lang))}</p>${link(c.url, L('Site', 'Web'))}</div></article>`;
  const drinks = food.drinks || {};
  const dk = { wine: L('Le vin', 'Víno'), beer: L('La bière', 'Pivo'), coffee: L('Le café', 'Káva'), aperitif: L('L’apéritif', 'Aperitiv') };
  return {
    title: L('Gastronomie parisienne – parisien.cz', 'Pařížská gastronomie – parisien.cz'),
    description: L('Baguette, pâtisseries, plats classiques, marchés, cafés mythiques et art de l’apéro : la gastronomie à Paris.', 'Bageta, dezerty, klasická jídla, trhy, legendární kavárny a umění aperitivu: gastronomie v Paříži.'),
    body: head(lang, 'gastro', L('Gastronomie parisienne', 'Pařížská gastronomie'), L('Du pain du matin à l’apéro du soir.', 'Od ranního pečiva po večerní aperitiv.'))
      + (food.boulangerie ? sec('', `<h2>${esc(L('La boulangerie', 'Pekárna'))}</h2><div class="narrow rich"><p>${esc(pick(food.boulangerie, lang))}</p></div>`) : '')
      + sec('grey', `<h2>${esc(L('Plats classiques', 'Klasická jídla'))}</h2><div class="cards-grid">${(food.dishes || []).map(item).join('')}</div>`, 'plats')
      + sec('', `<h2>${esc(L('Pâtisseries', 'Cukrářské speciality'))}</h2><div class="cards-grid">${(food.pastries || []).map(item).join('')}</div>`, 'patisseries')
      + sec('dark', `<h2>${esc(L('Marchés', 'Trhy'))}</h2><div class="grid-2 plain">${(food.markets || []).map((m) => `<div class="panel-dark"><h3>${esc(pick(m.name, lang))}</h3><span class="museum-tag">${esc(pick(m.area, lang))}</span><p>${esc(pick(m.text, lang))}</p></div>`).join('')}</div>`, 'marches')
      + sec('', `<h2>${esc(L('Cafés mythiques', 'Legendární kavárny'))}</h2><div class="cards-grid">${(food.cafes || []).map(cafe).join('')}</div>`, 'cafes')
      + sec('grey', `<h2>${esc(L('Boissons', 'Nápoje'))}</h2><div class="grid-2 plain">${Object.keys(dk).filter((k) => drinks[k]).map((k) => `<div class="panel-light"><h3>${esc(dk[k])}</h3><p>${esc(pick(drinks[k], lang))}</p></div>`).join('')}</div>
${food.etiquette ? `<h3 class="mt">${esc(L('Au restaurant : cinq réflexes', 'V restauraci: pět pravidel'))}</h3>${li(food.etiquette[lang])}` : ''}`, 'boissons'),
  };
};

// ======================= RECETTES =======================
pages['/recettes'] = (lang) => {
  const L = (fr, cs) => (lang === 'cs' ? cs : fr);
  const card = (r) => `<article class="card recipe-full" id="${esc(r.id)}">${figure(r.photo, { alt: pick(r.name, lang), width: 800 })}<div class="card-body">
  <div class="recipe-header"><h3>${esc(pick(r.name, lang))}</h3><span class="recipe-difficulty">${esc(pick(r.level, lang))} · ${esc(r.minutes)} min · ${esc(r.servings || 4)} ${esc(L('pers.', 'os.'))}</span></div>
  <h4>${esc(L('Ingrédients', 'Suroviny'))}</h4>${li(r.ingredients?.[lang])}
  <h4>${esc(L('Préparation', 'Postup'))}</h4><ol>${(r.steps?.[lang] || []).map((s) => `<li>${esc(s)}</li>`).join('')}</ol>
  ${r.tip ? `<p class="tip"><strong>${esc(L('Astuce', 'Tip'))} :</strong> ${esc(pick(r.tip, lang))}</p>` : ''}
  ${r.vocab?.length ? `<h4>${esc(L('Vocabulaire de la recette', 'Slovíčka z receptu'))}</h4><p class="chips">${r.vocab.map((v) => `<span class="chip static"><b>${esc(v.fr)}</b> · ${esc(v.cs)}</span>`).join('')}</p>` : ''}</div></article>`;
  return {
    title: L('Recettes françaises – parisien.cz', 'Francouzské recepty – parisien.cz'),
    description: L('Croque-monsieur, soupe à l’oignon, quiche, crêpes : des recettes classiques avec le vocabulaire de cuisine.', 'Croque-monsieur, cibulačka, quiche, crêpes: klasické recepty se slovíčky z kuchyně.'),
    body: head(lang, 'recettes', L('Recettes', 'Recepty'), L('Cuisiner, c’est aussi apprendre : chaque recette a son vocabulaire.', 'Vaření je i učení: ke každému receptu patří slovíčka.'))
      + sec('', `<div class="cards-grid wide">${recipes.map(card).join('')}</div>`),
  };
};

// ======================= CULTURE =======================
pages['/culture'] = (lang) => {
  const L = (fr, cs) => (lang === 'cs' ? cs : fr);
  const card = (x) => `<article class="card">${figure(x.photo, { alt: pick(x.name, lang), width: 700 })}<div class="card-body"><span class="museum-tag">${esc(pick(x.kind, lang) || '')}${x.area ? ` · ${esc(pick(x.area, lang))}` : ''}</span><h3>${esc(pick(x.name, lang))}</h3><p>${esc(pick(x.text, lang))}</p>${link(x.url, L('Site officiel', 'Oficiální web'))}</div></article>`;
  const group = (title, arr, id, cls = '') => (arr?.length ? sec(cls, `<h2>${esc(title)}</h2><div class="cards-grid">${arr.map(card).join('')}</div>`, id) : '');
  const annual = culture.annual || [];
  return {
    title: L('Culture à Paris – parisien.cz', 'Kultura v Paříži – parisien.cz'),
    description: L('Opéra, théâtres, littérature, cinéma, musique et grands rendez-vous annuels : la vie culturelle parisienne.', 'Opera, divadla, literatura, kino, hudba a velké každoroční akce: kulturní život Paříže.'),
    body: head(lang, 'culture', L('Culture à Paris', 'Kultura v Paříži'), pick(culture.intro, lang))
      + group(L('Scènes', 'Scény'), culture.stage, 'scenes')
      + group(L('Littérature', 'Literatura'), culture.literature, 'litterature', 'grey')
      + group(L('Cinéma', 'Kino'), culture.cinema, 'cinema')
      + group(L('Musique', 'Hudba'), culture.music, 'musique', 'grey')
      + (annual.length ? sec('dark', `<h2>${esc(L('Les rendez-vous de l’année', 'Akce během roku'))}</h2><p class="lead">${esc(L('Dates exactes : consultez le site officiel ou l’agenda en direct.', 'Přesná data najdete na oficiálním webu nebo v živém kalendáři.'))} <a href="/${lang}/evenements">${esc(L('Agenda →', 'Kalendář →'))}</a></p>
<div class="timeline">${annual.map((a) => `<article class="tl-item"><span class="tl-when">${esc(pick(a.when, lang))}</span><h3>${esc(pick(a.name, lang))}</h3><p>${esc(pick(a.text, lang))}</p>${link(a.url, L('Plus d’infos', 'Více informací'))}</article>`).join('')}</div>`, 'annuel') : ''),
  };
};

// ======================= ÉVÉNEMENTS =======================
pages['/evenements'] = (lang) => {
  const L = (fr, cs) => (lang === 'cs' ? cs : fr);
  const cats = [['', L('Tout', 'Vše')], ['concert', L('Concerts', 'Koncerty')], ['theatre', L('Théâtre', 'Divadlo')], ['expo', L('Expositions', 'Výstavy')], ['danse', L('Danse', 'Tanec')], ['enfants', L('Enfants', 'Děti')], ['conference', L('Conférences', 'Přednášky')], ['atelier', L('Ateliers', 'Dílny')], ['sport', 'Sport'], ['festival', 'Festivals']];
  return {
    title: L('Agenda : que faire à Paris – parisien.cz', 'Kalendář: co dělat v Paříži – parisien.cz'),
    description: L('L’agenda en direct de la Ville de Paris : concerts, expositions, théâtre, ateliers. Filtrez par date, type et gratuité.', 'Živý kalendář města Paříže: koncerty, výstavy, divadlo, dílny. Filtrujte podle data, typu a ceny.'),
    body: head(lang, 'events', L('Agenda de Paris', 'Kalendář Paříže'), L('Données officielles de la Ville de Paris, mises à jour en continu.', 'Oficiální data města Paříže, průběžně aktualizovaná.'))
      + sec('', `<form id="ev-filters" class="ev-filters" data-lang="${lang}">
<label>${esc(L('Période', 'Období'))}<select name="when"><option value="today">${esc(L('Aujourd’hui', 'Dnes'))}</option><option value="week" selected>${esc(L('7 jours', '7 dní'))}</option><option value="month">${esc(L('30 jours', '30 dní'))}</option></select></label>
<label>${esc(L('Type', 'Typ'))}<select name="cat">${cats.map(([v, l]) => `<option value="${v}">${esc(l)}</option>`).join('')}</select></label>
<label class="check"><input type="checkbox" name="free" value="1"> ${esc(L('Gratuit', 'Zdarma'))}</label>
<label class="grow">${esc(L('Recherche', 'Hledat'))}<input type="search" name="q" maxlength="80" placeholder="${esc(L('jazz, Louvre, enfants…', 'jazz, Louvre, děti…'))}"></label>
</form>
<p id="ev-count" class="muted" aria-live="polite"></p>
<div id="events" class="events-grid" aria-live="polite"></div>
<p class="center"><button id="ev-more" class="btn-primary dark-btn" hidden>${esc(L('Voir plus', 'Zobrazit další'))}</button></p>
<p class="note">${esc(L('Source : Ville de Paris, « Que faire à Paris ? » – opendata.paris.fr, licence ODbL. Vérifiez toujours les horaires et la réservation sur le site de l’organisateur.', 'Zdroj: Ville de Paris, „Que faire à Paris ?“ – opendata.paris.fr, licence ODbL. Čas a rezervaci vždy ověřte u pořadatele.'))}</p>`),
  };
};

// ======================= APPRENDRE =======================
pages['/apprendre'] = (lang) => {
  const L = (fr, cs) => (lang === 'cs' ? cs : fr);
  const themes = learn.themes || [];
  return {
    title: L('Apprendre le français – parisien.cz', 'Učíme se francouzsky – parisien.cz'),
    description: L('Vocabulaire par thème, faux amis français–tchèque, conseils de prononciation et quiz sur Paris.', 'Slovíčka podle témat, falešní přátelé francouzština–čeština, rady k výslovnosti a kvíz o Paříži.'),
    body: head(lang, 'learn', L('Apprendre le français', 'Učíme se francouzsky'), L('Vocabulaire utile, pièges à éviter et un petit quiz.', 'Užitečná slovíčka, pasti, kterým se vyhnout, a malý kvíz.'))
      + sec('', `<h2>${esc(L('Vocabulaire par thème', 'Slovíčka podle témat'))}</h2><div class="accordion">${themes.map((t, i) => `<details${i === 0 ? ' open' : ''}><summary>${esc(pick(t.title, lang))}</summary><table class="vocab"><thead><tr><th>${esc(L('Français', 'Francouzsky'))}</th><th>${esc(L('Tchèque', 'Česky'))}</th></tr></thead><tbody>${(t.items || []).map((it) => `<tr><td lang="fr">${esc(it.fr)}${it.note ? `<small>${esc(pick(it.note, lang))}</small>` : ''}</td><td lang="cs">${esc(it.cs)}</td></tr>`).join('')}</tbody></table></details>`).join('')}</div>`, 'vocabulaire')
      + sec('grey', `<h2>${esc(L('Faux amis français–tchèque', 'Falešní přátelé francouzština–čeština'))}</h2><p class="lead">${esc(L('Des mots qui se ressemblent… mais qui ne veulent pas dire la même chose.', 'Slova, která se podobají… ale neznamenají totéž.'))}</p>
<div class="cards-grid small">${(learn.fauxAmis || []).map((f) => `<article class="card"><div class="card-body"><h3 lang="fr">${esc(f.fr)}</h3><p><strong>FR :</strong> ${esc(pick(f.frMeaning, lang))}</p><p><strong>CS :</strong> „${esc(f.csLooks)}“ = ${esc(pick(f.csMeaning, lang) || f.csMeaning?.cs || '')}</p>${f.example ? `<p class="tip"><em>${esc(f.example.fr)}</em><br>${esc(f.example.cs)}</p>` : ''}</div></article>`).join('')}</div>`, 'faux-amis')
      + sec('', `<h2>${esc(L('Conseils', 'Rady'))}</h2>${learn.tips ? li(learn.tips[lang]) : ''}`, 'conseils')
      + sec('dark', `<h2>${esc(L('Quiz', 'Kvíz'))}</h2><div id="quiz" data-lang="${lang}"></div><script type="application/json" id="quiz-data">${JSON.stringify(learn.quiz || []).replace(/</g, '\\u003c')}</script>`, 'quiz'),
  };
};

// ======================= VOYAGES =======================
pages['/voyages'] = (lang) => {
  const L = (fr, cs) => (lang === 'cs' ? cs : fr);
  return {
    title: L('Voyages : récits et conseils – parisien.cz', 'Cestování: příběhy a rady – parisien.cz'),
    description: L('Récits de voyage, escapades autour de Paris, conseils pratiques et articles écrits par des étudiants.', 'Cestopisy, výlety z Paříže, praktické rady a články psané studenty.'),
    body: head(lang, 'voyages', L('Voyages', 'Cestování'), L('Paris, mais pas seulement : récits, itinéraires et conseils.', 'Paříž, ale nejen ona: příběhy, trasy a rady.'))
      + sec('', `<div id="voyage-posts" class="cards-grid" data-cat="voyage" data-lang="${lang}" aria-live="polite"></div>`)
      + sec('grey', `<h2>${esc(L('Idées de sujets', 'Náměty na články'))}</h2>
<ul class="ideas">${[
        [L('Un week-end dans une ville française', 'Víkend ve francouzském městě'), L('Strasbourg, Lyon, Nice, Bordeaux… vos découvertes', 'Štrasburk, Lyon, Nice, Bordeaux… vaše objevy')],
        [L('Un échange scolaire ou Erasmus', 'Výměnný pobyt nebo Erasmus'), L('Ce que vous auriez aimé savoir avant de partir', 'Co byste byli rádi věděli před odjezdem')],
        [L('Un voyage de classe', 'Školní výlet'), L('Itinéraire, budget raisonné, anecdotes vérifiées', 'Trasa, rozumný rozpočet, ověřené příhody')],
        [L('Une adresse coup de cœur', 'Oblíbené místo'), L('Café, librairie, parc, marché : pourquoi ce lieu ?', 'Kavárna, knihkupectví, park, trh: proč právě toto místo?')],
        [L('Un mot, une rencontre', 'Slovo, setkání'), L('Une expérience linguistique drôle ou marquante', 'Jazyková zkušenost, veselá nebo nezapomenutelná')],
      ].map(([a, b]) => `<li><strong>${esc(a)}</strong><span>${esc(b)}</span></li>`).join('')}</ul>
<p><a class="btn-primary dark-btn" href="/${lang}/contact?type=story#form">${esc(L('Proposer un article', 'Navrhnout článek'))}</a> <a class="read-more" href="/${lang}/article/carnet-de-voyage-guide">${esc(L('Lire le guide d’écriture', 'Přečíst návod, jak psát'))}</a></p>`),
  };
};

// ======================= BLOG =======================
pages['/blog'] = (lang) => {
  const L = (fr, cs) => (lang === 'cs' ? cs : fr);
  return {
    title: L('Blog – parisien.cz', 'Blog – parisien.cz'),
    description: L('Articles approfondis sur Paris, les voyages et la langue française, en français et en tchèque.', 'Podrobné články o Paříži, cestování a francouzštině ve francouzštině i češtině.'),
    body: head(lang, 'blog', L('Blog', 'Blog'), L('Articles documentés, avec sources.', 'Zdokumentované články se zdroji.'))
      + sec('', `<div class="filters" id="blog-filters"><button class="chip" data-cat="" aria-pressed="true">${esc(L('Tout', 'Vše'))}</button><button class="chip" data-cat="paris" aria-pressed="false">${esc(L('Paris', 'Paříž'))}</button><button class="chip" data-cat="voyage" aria-pressed="false">${esc(L('Voyages', 'Cestování'))}</button><button class="chip" data-cat="langue" aria-pressed="false">${esc(L('Langue', 'Jazyk'))}</button></div>
<div id="blog-posts" class="cards-grid" data-lang="${lang}" aria-live="polite"></div>`),
  };
};

// ======================= CONTACT =======================
pages['/contact'] = (lang) => {
  const L = (fr, cs) => (lang === 'cs' ? cs : fr);
  return {
    title: L('Contact – parisien.cz', 'Kontakt – parisien.cz'),
    description: L('Une question, une correction, un récit de voyage à proposer ? Écrivez-nous.', 'Dotaz, oprava nebo cestopis k publikaci? Napište nám.'),
    body: head(lang, 'contact', L('Contactez-nous', 'Napište nám'), L('Une question, une correction, un récit de voyage ?', 'Dotaz, oprava, cestopis?'))
      + sec('dark', `<div class="contact-wrapper"><div class="contact-info"><p>${esc(L('Choisissez « Proposer un article » pour nous envoyer un récit de voyage : nous le relirons avec vous avant publication. N’envoyez que des textes et des photos dont vous êtes l’auteur.', 'Zvolte „Navrhnout článek“, pokud nám chcete poslat cestopis: před zveřejněním si ho s vámi projdeme. Posílejte jen texty a fotografie, jejichž jste autory.'))}</p><p class="email">info@parisien.cz</p>
<p class="note">${esc(L('Votre nom, votre e-mail et votre message sont enregistrés uniquement pour pouvoir vous répondre.', 'Jméno, e-mail a zprávu ukládáme jen proto, abychom vám mohli odpovědět.'))}</p></div>
<form class="contact-form" id="contact-form" data-lang="${lang}" novalidate>
<div class="form-group"><label class="sr" for="c-kind">${esc(L('Sujet', 'Téma'))}</label><select id="c-kind" name="kind"><option value="message">${esc(L('Message', 'Zpráva'))}</option><option value="story">${esc(L('Proposer un article', 'Navrhnout článek'))}</option></select></div>
<div class="form-group"><label class="sr" for="c-name">${esc(L('Votre nom', 'Vaše jméno'))}</label><input type="text" id="c-name" name="name" maxlength="100" autocomplete="name" placeholder="${esc(L('Votre nom', 'Vaše jméno'))}"></div>
<div class="form-group"><label class="sr" for="c-email">E-mail</label><input type="email" id="c-email" name="email" maxlength="200" autocomplete="email" placeholder="${esc(L('Votre e-mail', 'Váš e-mail'))}"></div>
<div class="form-group"><label class="sr" for="c-msg">Message</label><textarea id="c-msg" name="message" maxlength="20000" placeholder="${esc(L('Votre message', 'Vaše zpráva'))}"></textarea></div>
<input class="hp" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">
<button type="submit" class="btn-primary">${esc(L('Envoyer', 'Odeslat'))}</button><p id="form-status" role="status"></p></form></div>`, 'form'),
  };
};

// ======================= CARTE =======================
const firstSentence = (o, lang) => { const t = pick(o, lang); const m = t.match(/^(.{40,170}?[.!?])(\s|$)/); return m ? m[1] : t.slice(0, 150); };
pages['/carte'] = (lang) => {
  const L = (fr, cs) => (lang === 'cs' ? cs : fr);
  const types = {
    place: [L('Monuments', 'Památky'), '#111111', '/paris'], museum: [L('Musées', 'Muzea'), '#b3262e', '/musees'], quartier: [L('Quartiers', 'Čtvrti'), '#6a5acd', '/paris#quartiers'],
    cafe: [L('Cafés', 'Kavárny'), '#c27c0e', '/gastronomie#cafes'], market: [L('Marchés', 'Trhy'), '#2e8b57', '/gastronomie#marches'],
    stage: [L('Scènes', 'Scény'), '#1f6feb', '/culture#scenes'], literature: [L('Littérature', 'Literatura'), '#8e44ad', '/culture#litterature'], cinema: [L('Cinéma', 'Kino'), '#d6336c', '/culture#cinema'],
  };
  const groups = [['place', 'places', places], ['museum', 'museums', museums], ['quartier', 'quartiers', quartiers], ['cafe', 'cafes', food.cafes], ['market', 'markets', food.markets],
    ['stage', 'stage', culture.stage], ['literature', 'literature', culture.literature], ['cinema', 'cinema', culture.cinema]];
  const points = [];
  for (const [type, key, arr] of groups) for (const it of arr || []) {
    const c = coords[`${key}:${it.id}`]; if (!c?.lat || c.check) continue;
    const base = types[type][2].split('#')[0];
    const hash = type === 'place' || type === 'museum' ? `#${it.id}` : (types[type][2].includes('#') ? types[type][2].slice(types[type][2].indexOf('#')) : '');
    points.push({ t: type, n: pick(it.name, lang), lat: c.lat, lon: c.lon, d: firstSentence(it.intro || it.text || it.vibe, lang), h: `/${lang}${base}${hash}` });
  }
  const liveTypes = [['velib', L('Vélib’ (en direct)', 'Vélib’ (živě)'), '#1c7a3d'], ['fountains', L('Fontaines à boire', 'Pítné fontány'), '#1e90ff'], ['cool', L('Fraîcheur (brumisateurs, piscines…)', 'Osvěžení (mlžítka, bazény…)'), '#17a2b8'], ['swim', L('Baignade en Seine', 'Koupání v Seině'), '#0057b8']];
  const liveChips = liveTypes.map(([k, label, color]) => `<button class="chip map-chip" data-layer="${k}" data-live="1" aria-pressed="false"><i style="background:${color}"></i>${esc(label)}</button>`).join('');
  const chips = Object.entries(types).map(([k, [label, color]]) => `<button class="chip map-chip" data-layer="${k}" aria-pressed="true"><i style="background:${color}"></i>${esc(label)}</button>`).join('')
    + liveChips + `<button class="chip map-chip" data-layer="events" aria-pressed="false"><i style="background:#000;border:2px solid #fff;box-shadow:0 0 0 1px #000"></i>${esc(L('Événements de la semaine', 'Akce tento týden'))}</button>`;
  return {
    title: L('Carte interactive de Paris – parisien.cz', 'Interaktivní mapa Paříže – parisien.cz'),
    description: L('Tous les lieux du site sur une carte : monuments, musées, cafés, marchés, scènes et les événements de la semaine.', 'Všechna místa z webu na jedné mapě: památky, muzea, kavárny, trhy, scény a akce tohoto týdne.'),
    head: `<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=" crossorigin=""><script defer src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=" crossorigin=""></script>`,
    body: head(lang, 'carte', L('Carte interactive', 'Interaktivní mapa'), L('Tous les lieux du site, plus l’agenda de la semaine. Cliquez sur un point pour lire la fiche.', 'Všechna místa z webu a kalendář tohoto týdne. Kliknutím na bod otevřete podrobnosti.'))
      + sec('', `<div class="map-tools"><div class="filters" id="map-filters" role="group" aria-label="${esc(L('Couches', 'Vrstvy'))}">${chips}</div>
<label class="map-search"><span class="sr">${esc(L('Chercher un lieu', 'Hledat místo'))}</span><input type="search" id="map-q" placeholder="${esc(L('Chercher un lieu…', 'Hledat místo…'))}"></label></div>
<div id="map" class="map" role="application" aria-label="${esc(L('Carte de Paris', 'Mapa Paříže'))}"></div>
<p class="note">${esc(L('Fond de carte : © contributeurs OpenStreetMap. Événements, Vélib’, fontaines, brumisateurs, piscines et sites de baignade : Ville de Paris (opendata.paris.fr, ODbL). Disponibilité Vélib’ mise à jour chaque minute.', 'Podkladová mapa: © přispěvatelé OpenStreetMap. Akce, Vélib’, fontány, mlžítka, bazény a místa ke koupání: Ville de Paris (opendata.paris.fr, ODbL). Dostupnost Vélib’ se aktualizuje každou minutu.'))}</p>
<noscript><p>${esc(L('La carte nécessite JavaScript.', 'Mapa vyžaduje JavaScript.'))}</p></noscript>
<script type="application/json" id="map-data">${JSON.stringify({ types: Object.fromEntries(Object.entries(types).map(([k, v]) => [k, { label: v[0], color: v[1] }])), points }).replace(/</g, '\\u003c')}</script>`),
  };
};

// ======================= COMPTE =======================
pages['/compte'] = (lang) => {
  const L = (fr, cs) => (lang === 'cs' ? cs : fr);
  return {
    title: L('Mon espace – parisien.cz', 'Můj účet – parisien.cz'),
    description: L('Espace des étudiants : écrire et proposer un article de voyage.', 'Prostor pro studenty: napište a navrhněte cestopisný článek.'),
    head: '<script defer src="/account.js"></script>',
    body: head(lang, 'compte', L('Mon espace', 'Můj účet'), L('Pour les étudiants du cours : écrivez vos articles, nous les relisons ensemble avant publication.', 'Pro studenty kurzu: pište své články, před zveřejněním je společně projdeme.'))
      + sec('', `<div id="acct" data-lang="${lang}"><noscript>${esc(L('Cet espace nécessite JavaScript.', 'Tento prostor vyžaduje JavaScript.'))}</noscript></div>
<aside class="privacy"><h3>${esc(L('Vos données', 'Vaše údaje'))}</h3>
<ul>
<li>${esc(L('Nous enregistrons : votre adresse e-mail, le prénom ou pseudonyme que vous choisissez, un mot de passe chiffré (que nous ne pouvons pas lire) et vos articles.', 'Ukládáme: váš e-mail, jméno nebo přezdívku, kterou si zvolíte, zašifrované heslo (nemůžeme ho přečíst) a vaše články.'))}</li>
<li>${esc(L('Finalité : vous permettre d’écrire et publier des articles sur ce site scolaire. Aucune publicité, aucune revente, aucun pistage.', 'Účel: umožnit vám psát a publikovat články na tomto školním webu. Žádná reklama, žádný prodej, žádné sledování.'))}</li>
<li>${esc(L('Sous vos articles publiés, seul le prénom ou pseudonyme apparaît, jamais l’e-mail. Utilisez un pseudonyme si vous préférez.', 'Pod zveřejněnými články se objeví jen jméno nebo přezdívka, nikdy e-mail. Raději použijte přezdívku.'))}</li>
<li>${esc(L('Vous pouvez supprimer votre compte à tout moment depuis cette page : vos brouillons sont effacés, vos articles publiés restent sous votre pseudonyme (demandez-nous leur retrait si vous le souhaitez).', 'Účet můžete kdykoli smazat na této stránce: koncepty se smažou, zveřejněné články zůstanou pod přezdívkou (o jejich stažení nás můžete požádat).'))}</li>
<li>${esc(L('Mineurs : l’inscription se fait par l’école, avec l’accord des responsables légaux. N’indiquez jamais de données personnelles d’autres personnes (noms complets, adresses, numéros de téléphone) dans vos textes et n’utilisez que vos propres photos.', 'Nezletilí: registraci zajišťuje škola se souhlasem zákonných zástupců. V textech nikdy neuvádějte osobní údaje jiných osob (celá jména, adresy, telefony) a používejte jen vlastní fotografie.'))}</li>
</ul></aside>`),
  };
};

// ======================= WEBCAMS =======================
pages['/webcams'] = (lang) => {
  const L = (fr, cs) => (lang === 'cs' ? cs : fr);
  const cams = [
    ['https://www.skylinewebcams.com/en/webcam/france/ile-de-france/paris/tour-eiffel.html', L('Tour Eiffel (HD)', 'Eiffelova věž (HD)'), L('La tour Eiffel en direct, avec accéléré et météo.', 'Eiffelova věž živě, s časosběrem a počasím.')],
    ['https://www.skylinewebcams.com/en/webcam/france/ile-de-france/paris/paris-tour-eiffel.html', L('Paris – Tour Eiffel', 'Paříž – Eiffelova věž'), L('Une autre vue de la tour, avec la météo parisienne.', 'Jiný pohled na věž, s pařížským počasím.')],
    ['https://www.skylinewebcams.com/en/webcam/france/ile-de-france/paris/panorama.html', L('Panorama de Paris', 'Panorama Paříže'), L('Tour Eiffel, Sacré-Cœur et La Défense dans le même cadre.', 'Eiffelova věž, Sacré-Cœur a La Défense v jednom záběru.')],
    ['https://www.skylinewebcams.com/en/webcam/france/ile-de-france/paris/trocadero.html', L('Trocadéro', 'Trocadéro'), L('Le palais de Chaillot et la tour Eiffel derrière.', 'Palais de Chaillot a za ním Eiffelova věž.')],
    ['https://www.skylinewebcams.com/en/webcam/france/ile-de-france/paris.html', L('Toutes les caméras de Paris', 'Všechny kamery z Paříže'), L('Liste complète : Notre-Dame, la Seine, le Sacré-Cœur…', 'Úplný seznam: Notre-Dame, Seina, Sacré-Cœur…')],
  ];
  return {
    title: L('Webcams de Paris – parisien.cz', 'Webkamery z Paříže – parisien.cz'),
    description: L('Les meilleures webcams en direct de Paris : tour Eiffel, Trocadéro, panorama.', 'Nejlepší živé webkamery z Paříže: Eiffelova věž, Trocadéro, panorama.'),
    body: head(lang, 'webcams', L('Webcams de Paris', 'Webkamery z Paříže'), L('Paris en direct, sur les sites de leurs opérateurs.', 'Paříž živě, na webech jejich provozovatelů.'))
      + sec('', `<div class="cards-grid small">${cams.map(([u, t, d]) => `<article class="card"><div class="card-body"><h3>${esc(t)}</h3><p>${esc(d)}</p><a class="read-more" href="${esc(u)}" target="_blank" rel="noopener">${esc(L('Voir la caméra →', 'Zobrazit kameru →'))}</a></div></article>`).join('')}</div>
<p class="note">${esc(L('Ces flux appartiennent à leurs opérateurs (ici SkylineWebcams). Leurs conditions interdisent de reproduire ou d’intégrer le flux ailleurs sans autorisation écrite : c’est pourquoi nous renvoyons vers leurs pages au lieu de les intégrer. Le site est un projet scolaire sans lien commercial avec eux.', 'Tyto přenosy patří jejich provozovatelům (zde SkylineWebcams). Jejich podmínky zakazují přenos kopírovat nebo vkládat jinam bez písemného souhlasu, proto na ně odkazujeme místo vkládání. Web je školní projekt bez obchodního vztahu k nim.'))}</p>`),
  };
};

// ======================= CRÉDITS =======================
pages['/credits'] = (lang) => {
  const L = (fr, cs) => (lang === 'cs' ? cs : fr);
  const seen = new Map();
  for (const p of allPhotos) if (!seen.has(p.page)) seen.set(p.page, p);
  const rows = [...seen.values()].sort((a, b) => a.file.localeCompare(b.file));
  return {
    title: L('Crédits photo – parisien.cz', 'Zdroje fotografií – parisien.cz'),
    description: L('Auteurs et licences de toutes les photographies du site.', 'Autoři a licence všech fotografií na webu.'),
    body: head(lang, 'credits', L('Crédits photo', 'Zdroje fotografií'), L('Toutes les photos viennent de Wikimedia Commons ; l’agenda utilise les images fournies par les organisateurs via la Ville de Paris.', 'Všechny fotografie pocházejí z Wikimedia Commons; kalendář používá obrázky od pořadatelů poskytnuté městem Paříží.'))
      + sec('', `<table class="vocab credits"><thead><tr><th>${esc(L('Fichier', 'Soubor'))}</th><th>${esc(L('Auteur', 'Autor'))}</th><th>${esc(L('Licence', 'Licence'))}</th></tr></thead><tbody>${rows.map((p) => `<tr><td><a href="${esc(p.page)}" target="_blank" rel="noopener">${esc(p.file.replace(/^File:/, ''))}</a></td><td>${esc(p.author)}</td><td>${p.licenseUrl ? `<a href="${esc(p.licenseUrl)}" target="_blank" rel="noopener">${esc(p.license)}</a>` : esc(p.license)}</td></tr>`).join('')}</tbody></table>`),
  };
};

// ---------- zápis ----------
for (const d of [museums, places, quartiers, food, recipes, culture, gallery, sitePhotos, articles]) collect(d);
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
const urls = [];
for (const lang of ['fr', 'cs']) {
  for (const [path, fn] of Object.entries(pages)) {
    const p = fn(lang);
    const html = localize(stdUrl(layout({ lang, path, title: p.title, description: p.description, body: p.body, image: p.image, head: p.head || '' })));
    const file = path === '/' ? `${OUT}/${lang}/index.html` : `${OUT}/${lang}${path}.html`;
    mkdirSync(file.replace(/\/[^/]+$/, ''), { recursive: true });
    writeFileSync(file, html);
    urls.push(`/${lang}${path === '/' ? '' : path}`);
  }
}
// kořen: výběr jazyka
writeFileSync(`${OUT}/index.html`, `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><title>parisien.cz</title><meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="alternate" hreflang="fr" href="${SITE}/fr"><link rel="alternate" hreflang="cs" href="${SITE}/cs"><link rel="alternate" hreflang="x-default" href="${SITE}/fr">
<script>try{var l=localStorage.getItem('pz-lang')||(/^(cs|sk)/i.test(navigator.language||'')?'cs':'fr');location.replace('/'+(l==='cs'?'cs':'fr')+location.search+location.hash)}catch(e){location.replace('/fr')}</script>
<noscript><meta http-equiv="refresh" content="0;url=/fr"></noscript></head><body style="font-family:sans-serif;text-align:center;padding:4rem"><p><a href="/fr">Français</a> · <a href="/cs">Čeština</a></p></body></html>`);
// sitemap + robots
const slugs = articles.map((a) => a.slug);
const all = [...urls, ...['fr', 'cs'].flatMap((l) => slugs.map((s) => `/${l}/article/${s}`))];
writeFileSync(`${OUT}/sitemap.xml`, `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${all.map((u) => `<url><loc>${SITE}${u}</loc></url>`).join('\n')}\n</urlset>\n`);
writeFileSync(`${OUT}/robots.txt`, `User-agent: *\nDisallow: /admin\nDisallow: /api/\nSitemap: ${SITE}/sitemap.xml\n`);
// statika
for (const f of ['styles.css', 'app.js', 'account.js', 'admin.html', 'admin-app.js']) cpSync(`${ROOT}${f}`, `${OUT}/${f}`);
cpSync(`${ROOT}images`, `${OUT}/images`, { recursive: true });
console.log(`build ok: ${urls.length} stránek, ${articles.length} článků, ${new Set(allPhotos.map((p) => p.page)).size} fotek`);
