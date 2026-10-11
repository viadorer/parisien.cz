// parisien.cz – klient: menu, počasí, živý kalendář, články, galerie, kvíz, formulář
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const lang = document.body.dataset.lang === 'cs' ? 'cs' : 'fr';
  const L = (fr, cs) => (lang === 'cs' ? cs : fr);
  const loc = lang === 'cs' ? 'cs-CZ' : 'fr-FR';

  const el = (tag, attrs = {}, ...kids) => {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) { if (v == null || v === false) continue; if (k === 'class') n.className = v; else n.setAttribute(k, v); }
    for (const k of kids.flat()) if (k != null && k !== false) n.append(k instanceof Node ? k : document.createTextNode(k));
    return n;
  };
  const safeUrl = (u) => (/^(https:\/\/|\/images\/)/.test(u || '') ? u : '');
  const pick = (o) => (o && (o[lang] || o[lang === 'cs' ? 'fr' : 'cs'])) || '';
  const fmtDay = (iso, opts) => new Date(iso).toLocaleDateString(loc, { timeZone: 'Europe/Paris', ...opts });

  // ---------- jazyk (zapamatovat volbu) ----------
  $$('[data-set-lang]').forEach((a) => a.addEventListener('click', () => { try { localStorage.setItem('pz-lang', a.dataset.setLang); } catch {} }));
  try { localStorage.setItem('pz-lang', lang); } catch {}

  // ---------- úroveň CEFR ----------
  const LV = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
  const lvGet = () => { try { const v = localStorage.getItem('pz-level'); return LV.includes(v) ? v : ''; } catch { return ''; } };
  const lvSet = (v) => { try { v ? localStorage.setItem('pz-level', v) : localStorage.removeItem('pz-level'); } catch {} };
  const effLevel = (l) => l;                                               // každá úroveň má vlastní verzi; chybějící se nahradí nejbližší
  const tierOf = (l) => (l && LV.indexOf(l) <= LV.indexOf('B1') ? 'easy' : 'full');
  const applyTier = () => { document.body.dataset.tier = tierOf(lvGet()); };
  applyTier();
  const lvSel = $('#level-select');
  if (lvSel) {
    lvSel.value = lvGet();
    lvSel.addEventListener('change', () => { lvSet(lvSel.value); applyTier(); document.dispatchEvent(new CustomEvent('pzlevel')); });
  }
  document.addEventListener('pzlevel', () => { if (lvSel) lvSel.value = lvGet(); });
  // vybere verzi nejblíž dané úrovni
  const pickVersion = (versions, want) => {
    const w = LV.indexOf(effLevel(want));
    if (w < 0) return versions.find((v) => v.level === 'B2') || versions[versions.length - 1];
    return [...versions].sort((a, b) => Math.abs(LV.indexOf(a.level) - w) - Math.abs(LV.indexOf(b.level) - w) || LV.indexOf(a.level) - LV.indexOf(b.level))[0];
  };

  // ---------- hlavička ----------
  const header = $('header');
  const onScroll = () => {
    const far = window.scrollY > 100;
    header.classList.toggle('scrolled', far);
  };
  addEventListener('scroll', onScroll, { passive: true }); onScroll();

  const toggle = $('.menu-toggle'), nav = $('#nav');
  toggle?.addEventListener('click', () => { const o = nav.classList.toggle('open'); toggle.setAttribute('aria-expanded', String(o)); });
  const closeSubs = (except) => $$('.has-sub').forEach((li) => { if (li !== except) { li.classList.remove('open'); li.querySelector('button').setAttribute('aria-expanded', 'false'); } });
  $$('.has-sub > button').forEach((b) => b.addEventListener('click', (e) => {
    e.stopPropagation();
    const li = b.parentElement, open = !li.classList.contains('open');
    closeSubs(li); li.classList.toggle('open', open); b.setAttribute('aria-expanded', String(open));
  }));
  document.addEventListener('click', () => closeSubs());
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { closeSubs(); nav.classList.remove('open'); toggle?.setAttribute('aria-expanded', 'false'); } });
  nav.addEventListener('click', (e) => { if (e.target.closest('a')) { nav.classList.remove('open'); toggle?.setAttribute('aria-expanded', 'false'); closeSubs(); } });

  // ---------- počasí a datum v Paříži (Open-Meteo, bez klíče) ----------
  const WMO = (c) => {
    if (c === 0) return ['☀️', L('ciel dégagé', 'jasno')];
    if (c <= 2) return ['⛅', L('partiellement nuageux', 'polojasno')];
    if (c === 3) return ['☁️', L('couvert', 'zataženo')];
    if (c <= 48) return ['🌫️', L('brouillard', 'mlha')];
    if (c <= 57) return ['🌦️', L('bruine', 'mrholení')];
    if (c <= 67) return ['🌧️', L('pluie', 'déšť')];
    if (c <= 77) return ['❄️', L('neige', 'sníh')];
    if (c <= 82) return ['🌧️', L('averses', 'přeháňky')];
    if (c <= 86) return ['🌨️', L('averses de neige', 'sněhové přeháňky')];
    return ['⛈️', L('orage', 'bouřka')];
  };
  const weather = $('#weather');
  if (weather) {
    const now = $('#now-date');
    const tick = () => { if (now) now.textContent = new Date().toLocaleString(loc, { timeZone: 'Europe/Paris', weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }); };
    tick(); setInterval(tick, 30000);
    const sW = el('span', { class: 'now-item' }), sA = el('span', { class: 'now-item' }), sS = el('span', { class: 'now-item' });
    weather.replaceChildren(sW, sA, sS);
    const num = (n, d = 2) => n.toLocaleString(loc, { minimumFractionDigits: d, maximumFractionDigits: d });
    fetch('https://api.open-meteo.com/v1/forecast?latitude=48.8566&longitude=2.3522&current=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min&timezone=Europe%2FParis&forecast_days=1')
      .then((r) => r.json()).then((d) => {
        const [icon, label] = WMO(d.current.weather_code);
        sW.replaceChildren(el('span', { class: 'w-icon', 'aria-hidden': 'true' }, icon), el('strong', {}, `${Math.round(d.current.temperature_2m)} °C`),
          ` ${L('à Paris', 'v Paříži')} · ${label} · ${Math.round(d.daily.temperature_2m_min[0])}°/${Math.round(d.daily.temperature_2m_max[0])}°`);
      }).catch(() => sW.remove());
    fetch('https://air-quality-api.open-meteo.com/v1/air-quality?latitude=48.8566&longitude=2.3522&current=european_aqi')
      .then((r) => r.json()).then((d) => {
        const v = d.current?.european_aqi; if (v == null) throw 0;
        const bands = [[20, L('très bon', 'výborná')], [40, L('bon', 'dobrá')], [60, L('moyen', 'přijatelná')], [80, L('médiocre', 'špatná')], [100, L('mauvais', 'velmi špatná')], [Infinity, L('très mauvais', 'extrémně špatná')]];
        sA.replaceChildren(el('span', { class: 'w-icon', 'aria-hidden': 'true' }, '🍃'), L('Air : ', 'Ovzduší: '), el('strong', {}, bands.find(([m]) => v <= m)[1]), ` (EAQI ${Math.round(v)})`);
      }).catch(() => sA.remove());
    fetch('/api/live?what=seine').then((r) => r.json()).then(({ data }) => {
      sS.replaceChildren(el('span', { class: 'w-icon', 'aria-hidden': 'true' }, '🌊'), L('Seine, Austerlitz : ', 'Seina, Austerlitz: '), el('strong', {}, `${num(data.levelM)} m`),
        data.deltaM != null ? ` (${data.deltaM >= 0 ? '+' : '−'}${num(Math.abs(data.deltaM))} m / 24 h)` : '');
    }).catch(() => sS.remove());
  }

  // ---------- kalendář akcí ----------
  const dateRange = (e) => {
    const a = e.start, b = e.end;
    if (!a) return '';
    const s = fmtDay(a, { day: 'numeric', month: 'short' }), t = b ? fmtDay(b, { day: 'numeric', month: 'short', year: 'numeric' }) : '';
    const same = b && fmtDay(a, { dateStyle: 'short' }) === fmtDay(b, { dateStyle: 'short' });
    if (same || !b) return fmtDay(a, { weekday: 'short', day: 'numeric', month: 'long' });
    return `${L('du', '')} ${s} ${L('au', '–')} ${t}`.trim();
  };
  const priceLabel = (p) => ({ gratuit: L('Gratuit', 'Zdarma'), 'gratuit sous condition': L('Gratuit sous conditions', 'Zdarma za podmínek'), payant: L('Payant', 'Placené') }[p] || '');
  const eventCard = (e) => {
    const href = safeUrl(e.url);
    const img = safeUrl(e.cover);
    return el('article', { class: 'event' },
      img ? el('figure', { class: 'photo' }, el('img', { src: img, alt: e.coverAlt || '', loading: 'lazy' }), e.coverCredit ? el('figcaption', { class: 'credit' }, `© ${e.coverCredit}`) : null) : el('div', { class: 'event-noimg' }),
      el('div', { class: 'event-body' },
        el('div', { class: 'event-meta' }, ...(e.tags || []).slice(0, 2).map((t) => el('span', { class: 'tag' }, t)), e.price ? el('span', { class: `tag price ${e.price === 'gratuit' ? 'free' : ''}` }, priceLabel(e.price)) : null),
        el('h3', {}, href ? el('a', { href, target: '_blank', rel: 'noopener' }, e.title) : e.title),
        el('p', { class: 'event-date' }, dateRange(e)),
        el('p', { class: 'event-place' }, [e.place, e.zip && `${e.zip} Paris`].filter(Boolean).join(' · ')),
        e.lead ? el('p', { class: 'event-lead' }, e.lead) : null));
  };
  const loadEvents = async (params) => {
    const r = await fetch(`/api/events?${new URLSearchParams(params)}`);
    if (!r.ok) throw new Error('events');
    return r.json();
  };
  const evMsg = (txt) => el('p', { class: 'muted' }, txt);

  const homeEv = $('#home-events');
  if (homeEv) {
    loadEvents({ when: 'week', limit: homeEv.dataset.limit || 6 })
      .then((d) => homeEv.replaceChildren(...(d.events.length ? d.events.map(eventCard) : [evMsg(L('Aucun événement trouvé.', 'Žádné akce nenalezeny.'))])))
      .catch(() => homeEv.replaceChildren(evMsg(L('L’agenda est momentanément indisponible.', 'Kalendář je momentálně nedostupný.'))));
  }
  const evBox = $('#events');
  if (evBox) {
    const form = $('#ev-filters'), more = $('#ev-more'), count = $('#ev-count');
    let offset = 0, total = 0, busy = false;
    const run = async (append) => {
      if (busy) return; busy = true;
      if (!append) { offset = 0; evBox.replaceChildren(evMsg(L('Chargement…', 'Načítám…'))); }
      const f = new FormData(form);
      const params = { when: f.get('when'), limit: 24, offset };
      for (const k of ['cat', 'q']) if (f.get(k)) params[k] = f.get(k);
      if (f.get('free')) params.free = '1';
      try {
        const d = await loadEvents(params);
        total = d.total; offset += d.events.length;
        const cards = d.events.map(eventCard);
        if (!append) evBox.replaceChildren(...(cards.length ? cards : [evMsg(L('Aucun événement ne correspond à ces filtres.', 'Filtrům neodpovídá žádná akce.'))]));
        else evBox.append(...cards);
        count.textContent = L(`${total} événement(s)`, `Nalezeno akcí: ${total}`);
        more.hidden = offset >= total;
      } catch { evBox.replaceChildren(evMsg(L('L’agenda est momentanément indisponible.', 'Kalendář je momentálně nedostupný.'))); more.hidden = true; }
      busy = false;
    };
    let t; form.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => run(false), 300); });
    form.addEventListener('submit', (e) => { e.preventDefault(); run(false); });
    more.addEventListener('click', () => run(true));
    run(false);
  }

  // ---------- články ----------
  const CAT = { paris: L('Paris', 'Paříž'), voyage: L('Voyages', 'Cestování'), langue: L('Langue', 'Jazyk') };
  const lvTag = (l, multi) => (l ? el('span', { class: `tag lvl lvl-${l}` }, l) : null);
  const postCard = (group) => {
    const want = lvGet();
    const p = pickVersion(group, want);
    const multi = group.length > 1;
    return el('article', { class: 'card' },
      safeUrl(p.cover) ? el('figure', { class: 'photo' }, el('img', { src: p.cover, alt: '', loading: 'lazy' }), p.coverCredit ? el('figcaption', { class: 'credit' }, `© ${p.coverCredit.text}`) : null) : null,
      el('div', { class: 'card-body' },
        el('div', { class: 'post-meta' }, el('span', { class: 'tag' }, CAT[p.category] || p.category), ' ', lvTag(p.level, multi), ' ', el('time', { datetime: p.date }, fmtDay(p.date, { day: 'numeric', month: 'long', year: 'numeric' }))),
        el('h3', {}, pick(p.title)),
        el('p', {}, pick(p.excerpt)),
        multi ? el('div', { class: 'level-chips', 'aria-label': L('Niveaux disponibles', 'Dostupné úrovně') }, ...group.map((v) => el('a', { href: `/${lang}/article/${encodeURIComponent(v.slug)}`, class: v.slug === p.slug ? 'on' : '', 'data-level': v.level }, v.level))) : null,
        el('a', { class: 'read-more', href: `/${lang}/article/${encodeURIComponent(p.slug)}` }, L('Lire l’article', 'Číst článek'))));
  };
  const groupPosts = (posts) => {
    const map = new Map();
    for (const p of posts) { const k = p.base || p.slug; (map.get(k) || map.set(k, []).get(k)).push(p); }
    return [...map.values()].map((g) => g.sort((a, b) => LV.indexOf(a.level) - LV.indexOf(b.level)));
  };
  const postLists = [];   // {box, cat, limit, data}
  const renderList = (l) => {
    if (!l.data) return;
    const groups = groupPosts(l.data).slice(0, l.limit || 100);
    l.box.replaceChildren(...(groups.length ? groups.map(postCard) : [evMsg(L('Aucun article pour le moment.', 'Zatím tu nejsou žádné články.'))]));
  };
  const loadPosts = async (box, cat, limit) => {
    const l = { box, cat, limit: Number(limit) || 0, data: null }; postLists.push(l);
    try {
      const r = await fetch(`/api/posts?${new URLSearchParams({ ...(cat ? { cat } : {}), limit: '100' })}`);
      if (!r.ok) throw new Error();
      l.data = (await r.json()).posts; renderList(l);
    } catch { box.replaceChildren(evMsg(L('Impossible de charger les articles.', 'Články se nepodařilo načíst.'))); }
  };
  document.addEventListener('pzlevel', () => postLists.forEach(renderList));
  const hp = $('#home-posts'); if (hp) loadPosts(hp, '', hp.dataset.limit || 3);
  const vp = $('#voyage-posts'); if (vp) loadPosts(vp, vp.dataset.cat);
  const bp = $('#blog-posts');
  if (bp) {
    const initial = new URLSearchParams(location.search).get('cat') || '';
    loadPosts(bp, initial);
    $$('#blog-filters .chip').forEach((b) => {
      b.setAttribute('aria-pressed', String(b.dataset.cat === initial));
      b.addEventListener('click', () => { $$('#blog-filters .chip').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); const i = postLists.findIndex((l) => l.box === bp); if (i >= 0) postLists.splice(i, 1); loadPosts(bp, b.dataset.cat); });
    });
  }

  // ---------- stránka článku: verze podle úrovně ----------
  const sw = $('.level-switch');
  if (sw) {
    const links = $$('a[data-level]', sw), cur = links.find((a) => a.getAttribute('aria-current') === 'page');
    const want = lvGet();
    if (want && cur) {
      const best = pickVersion(links.map((a) => ({ level: a.dataset.level, a })), want);
      if (best && best.a !== cur) location.replace(best.a.href);
    }
    links.forEach((a) => a.addEventListener('click', () => { lvSet(a.dataset.level); applyTier(); }));
  }

  // ---------- galerie + lightbox ----------
  const gal = $('#gallery');
  if (gal || $('#student-gallery')) {
    if (gal) $$('.filters .chip[data-filter]').forEach((b) => b.addEventListener('click', () => {
      $$('.filters .chip').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      $$('.g-item', gal).forEach((f) => { f.hidden = b.dataset.filter !== 'all' && f.dataset.cat !== b.dataset.filter; });
    }));
    const dlg = el('dialog', { class: 'lightbox', 'aria-label': L('Photo agrandie', 'Zvětšená fotografie') });
    const img = el('img', { alt: '' }), cap = el('p', { class: 'lb-cap' }), cred = el('a', { target: '_blank', rel: 'noopener' });
    const close = el('button', { type: 'button', class: 'lb-close', 'aria-label': L('Fermer', 'Zavřít') }, '×');
    dlg.append(close, img, cap, cred); document.body.append(dlg);
    close.addEventListener('click', () => dlg.close());
    dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
    document.addEventListener('click', (e) => {
      const a = e.target.closest('.gallery-grid a[data-full]'); if (!a) return;
      e.preventDefault();
      img.src = a.dataset.full; img.alt = a.dataset.caption; cap.textContent = a.dataset.caption;
      cred.textContent = a.dataset.credit; cred.href = a.dataset.page; dlg.showModal();
    });
  }

  // ---------- výuka: položky podle úrovně ----------
  const lvItems = $$('[data-lvl]');
  if (lvItems.length) {
    const note = $('#learn-level-note');
    let showAll = false;
    const apply = () => {
      const w = lvGet(); let hidden = 0;
      lvItems.forEach((e) => { const hide = !showAll && w && LV.indexOf(e.dataset.lvl) > LV.indexOf(w); e.classList.toggle('lvl-hidden', Boolean(hide)); if (hide) hidden++; });
      if (!note) return;
      if (!w) { note.replaceChildren(); return; }
      note.replaceChildren(L(`Niveau choisi : ${w}. `, `Zvolená úroveň: ${w}. `), hidden ? L(`${hidden} éléments plus difficiles sont masqués. `, `Skryto ${hidden} těžších položek. `) : '',
        Object.assign(el('button', { class: 'show-all', type: 'button' }, showAll ? L('Masquer les plus difficiles', 'Skrýt těžší') : L('Tout afficher', 'Zobrazit vše')), { onclick: () => { showAll = !showAll; apply(); } }));
    };
    apply(); document.addEventListener('pzlevel', () => { showAll = false; apply(); });
  }

  // ---------- fotky studentů ----------
  const sg = $('#student-gallery');
  if (sg) {
    fetch('/api/gallery').then((r) => r.json()).then(({ items }) => {
      if (!items?.length) { sg.closest('section').hidden = true; return; }
      sg.replaceChildren(...items.filter((g) => safeUrl(g.url)).map((g) => {
        const cap = pick(g.title) || g.place || '';
        const credit = [g.author && `© ${g.author}`, g.credit, g.place].filter(Boolean).join(' · ');
        return el('figure', { class: 'photo g-item' },
          el('a', { href: g.url, 'data-full': g.url, 'data-caption': cap, 'data-credit': credit, 'data-page': g.url }, el('img', { src: g.url, alt: cap, loading: 'lazy' })),
          el('figcaption', {}, cap, credit ? el('span', { class: 'credit-inline' }, credit) : null));
      }));
    }).catch(() => { sg.closest('section').hidden = true; });
  }

  // ---------- mapa ----------
  const mapEl = $('#map');
  if (mapEl) {
    const start = () => {
      if (!window.L || !window.L.map) return setTimeout(start, 100);
      const LF = window.L;
      const { types, points, routes = [] } = JSON.parse($('#map-data').textContent);
      const map = LF.map(mapEl, { scrollWheelZoom: false, preferCanvas: true }).setView([48.8566, 2.3522], 12);
      LF.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' }).addTo(map);
      map.on('focus', () => map.scrollWheelZoom.enable()); map.on('blur', () => map.scrollWheelZoom.disable());
      const layers = {}, markers = [];
      for (const k of Object.keys(types)) layers[k] = LF.layerGroup().addTo(map);
      layers.events = LF.layerGroup();
      const popup = (title, text, href, label) => {
        const box = el('div', { class: 'map-pop' }, el('strong', {}, title));
        if (label) box.append(el('br'), el('small', {}, label));
        if (text) box.append(el('p', {}, text));
        if (href) box.append(el('a', { href, ...(href.startsWith('https://') ? { target: '_blank', rel: 'noopener' } : {}) }, L('Voir la fiche →', 'Zobrazit podrobnosti →')));
        return box;
      };
      for (const p of points) {
        const m = LF.circleMarker([p.lat, p.lon], { radius: 8, color: '#fff', weight: 2, fillColor: types[p.t].color, fillOpacity: 0.95 }).bindPopup(popup(p.n, p.d, p.h, types[p.t].label));
        m.addTo(layers[p.t]); markers.push({ m, p });
      }
      let evLoaded = false;
      const loadEv = () => {
        if (evLoaded) return; evLoaded = true;
        fetch('/api/events?when=week&limit=48').then((r) => r.json()).then(({ events }) => {
          for (const e of events) {
            if (e.lat == null || e.lon == null) continue;
            LF.circleMarker([e.lat, e.lon], { radius: 6, color: '#fff', weight: 2, fillColor: '#000', fillOpacity: 0.9 })
              .bindPopup(popup(e.title, `${dateRange(e)}${e.place ? ' · ' + e.place : ''}`, safeUrl(e.url), L('Événement', 'Akce'))).addTo(layers.events);
          }
        }).catch(() => {});
      };
      // živá a otevřená data (Vélib', fontány, osvěžení, koupání)
      const COOL = { 'Brumisateur': L('Brumisateur', 'Mlžítko'), 'Piscine': L('Piscine', 'Bazén'), 'Baignade extérieure': L('Baignade extérieure', 'Venkovní koupání'), 'Ombrière pérenne': L('Ombrière (zone d’ombre)', 'Stínící konstrukce') };
      const liveCfg = {
        velib: { color: (r) => (!r[7] || r[3] === 0 ? '#b3262e' : r[3] <= 3 ? '#e08a00' : '#1c7a3d'), radius: 6, refresh: 60000,
          pop: (r) => popup(r[2], r[7] ? `${r[3]} ${L('vélos', 'kol')} (${r[4]} ${L('méca.', 'mech.')}, ${r[5]} ${L('élec.', 'elektro')}) · ${r[6]} ${L('places libres', 'volných stání')}` : L('Station hors service', 'Stanice mimo provoz'), '', L('Vélib’ · en direct', 'Vélib’ · živě')) },
        fountains: { color: () => '#1e90ff', radius: 4, pop: (r) => popup(L('Fontaine à boire', 'Pítná fontána'), r[3], '', L('Eau potable gratuite', 'Pitná voda zdarma')) },
        cool: { color: () => '#17a2b8', radius: 5, pop: (r) => popup(r[3] || COOL[r[2]] || r[2], r[4], '', `${COOL[r[2]] || r[2]}${r[5] ? ' · ' + L('payant', 'placené') : ''}`) },
        swim: { color: () => '#0057b8', radius: 10, pop: (r) => popup(r[2], L('Site de baignade aménagé dans la Seine pendant l’été. Vérifiez l’ouverture et la qualité de l’eau sur paris.fr avant d’y aller.', 'Vybavené místo ke koupání v Seině v létě. Před cestou si na paris.fr ověřte otevření a kvalitu vody.'), 'https://www.paris.fr/pages/la-baignade-dans-la-seine', L('Baignade en Seine', 'Koupání v Seině')) },
      };
      const loaded = {};
      const loadLive = async (k) => {
        const cfg = liveCfg[k], fill = async () => {
          const { data } = await (await fetch(`/api/live?what=${k}`)).json();
          layers[k].clearLayers();
          for (const r of data) LF.circleMarker([r[0], r[1]], { radius: cfg.radius, color: '#fff', weight: 1.5, fillColor: cfg.color(r), fillOpacity: 0.92 }).bindPopup(() => cfg.pop(r)).addTo(layers[k]);
        };
        if (loaded[k]) return; loaded[k] = true;
        layers[k] = LF.layerGroup().addTo(map);
        try { await fill(); } catch { loaded[k] = false; map.removeLayer(layers[k]); return; }
        if (cfg.refresh) setInterval(() => { if (map.hasLayer(layers[k])) fill().catch(() => {}); }, cfg.refresh);
      };
      $$('#map-filters .map-chip').forEach((b) => b.addEventListener('click', () => {
        if (b.dataset.live) {
          const on = b.getAttribute('aria-pressed') !== 'true';
          b.setAttribute('aria-pressed', String(on));
          if (on) loadLive(b.dataset.layer).then(() => { if (layers[b.dataset.layer] && !map.hasLayer(layers[b.dataset.layer])) layers[b.dataset.layer].addTo(map); });
          else if (layers[b.dataset.layer]) map.removeLayer(layers[b.dataset.layer]);
          return;
        }
        const on = b.getAttribute('aria-pressed') !== 'true';
        b.setAttribute('aria-pressed', String(on));
        const g = layers[b.dataset.layer];
        if (on) { g.addTo(map); if (b.dataset.layer === 'events') loadEv(); } else map.removeLayer(g);
      }));
      // trasy
      const routeSel = $('#route-select'), routeList = $('#route-list');
      if (routeSel) {
        let routeLayer = null;
        const drawRoute = (id) => {
          if (routeLayer) { map.removeLayer(routeLayer); routeLayer = null; }
          routeList.hidden = true; routeList.replaceChildren();
          const r = routes.find((x) => x.id === id); if (!r) return;
          routeLayer = LF.layerGroup().addTo(map);
          LF.polyline(r.stops.map((s) => [s.lat, s.lon]), { color: '#b3262e', weight: 4, opacity: 0.8, dashArray: '8 6' }).addTo(routeLayer);
          r.stops.forEach((s, i) => LF.marker([s.lat, s.lon], { icon: LF.divIcon({ className: 'route-num', html: String(i + 1), iconSize: [26, 26] }) }).bindPopup(popup(`${i + 1}. ${s.n}`, s.d, '', r.title)).addTo(routeLayer));
          map.fitBounds(LF.latLngBounds(r.stops.map((s) => [s.lat, s.lon])), { padding: [40, 40] });
          routeList.replaceChildren(...r.stops.map((s) => el('li', {}, el('strong', {}, s.n), s.d ? ` — ${s.d}` : ''))); routeList.hidden = false;
        };
        routeSel.addEventListener('change', () => drawRoute(routeSel.value));
        const pre = new URLSearchParams(location.search).get('route');
        if (pre && routes.some((x) => x.id === pre)) { routeSel.value = pre; drawRoute(pre); }
      }
      $('#map-q').addEventListener('input', (e) => {
        const q = e.target.value.trim().toLowerCase();
        for (const { m, p } of markers) {
          const hit = !q || p.n.toLowerCase().includes(q);
          m.setStyle({ fillOpacity: hit ? 0.95 : 0.12, opacity: hit ? 1 : 0.2 });
          if (hit && q && markers.filter((x) => x.p.n.toLowerCase().includes(q)).length === 1) { map.setView([p.lat, p.lon], 15); m.openPopup(); }
        }
      });
    };
    start();
  }

  // ---------- kvíz ----------
  const quizBox = $('#quiz');
  if (quizBox) {
    let all = []; try { all = JSON.parse($('#quiz-data').textContent); } catch {}
    let data = all, i = 0, score = 0;
    const pickQuiz = () => { const w = lvGet(); const f = w ? all.filter((q) => !q.level || LV.indexOf(q.level) <= LV.indexOf(w)) : all; data = f.length >= 5 ? f : all; i = 0; score = 0; };
    pickQuiz();
    const render = () => {
      if (!data.length) return;
      if (i >= data.length) {
        quizBox.replaceChildren(el('p', { class: 'quiz-score' }, L(`Score : ${score} / ${data.length}`, `Výsledek: ${score} / ${data.length}`)),
          el('button', { class: 'btn-primary', type: 'button', onclick: () => { i = 0; score = 0; render(); } }, L('Recommencer', 'Znovu')));
        return;
      }
      const q = data[i], opts = pick(q.options) ? (q.options[lang] || q.options.fr) : [];
      const fb = el('p', { class: 'quiz-fb', role: 'status' });
      const next = el('button', { class: 'btn-primary', type: 'button', hidden: true }, i + 1 < data.length ? L('Question suivante', 'Další otázka') : L('Résultat', 'Výsledek'));
      next.addEventListener('click', () => { i++; render(); });
      const list = el('div', { class: 'quiz-opts' }, ...opts.map((o, k) => {
        const b = el('button', { type: 'button', class: 'quiz-opt' }, o);
        b.addEventListener('click', () => {
          $$('.quiz-opt', list).forEach((x, n) => { x.disabled = true; if (n === q.answer) x.classList.add('ok'); });
          if (k === q.answer) score++; else b.classList.add('ko');
          fb.textContent = (k === q.answer ? L('Bravo ! ', 'Správně! ') : L('Pas tout à fait. ', 'Ne tak docela. ')) + pick(q.explain);
          next.hidden = false;
        });
        return b;
      }));
      quizBox.replaceChildren(el('p', { class: 'quiz-n' }, `${i + 1} / ${data.length}`), el('h3', {}, pick(q.q)), list, fb, next);
    };
    render();
    document.addEventListener('pzlevel', () => { pickQuiz(); render(); });
  }

  // ---------- audio (Web Speech API, francouzský hlas prohlížeče) ----------
  const hasTTS = 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
  let frVoice = null, playToken = 0;
  const showAudio = () => { if (hasTTS && frVoice) $$('.speak-btn[hidden], [data-dlg-play][hidden], [data-listen][hidden]').forEach((b) => { b.hidden = false; }); };
  if (hasTTS) {
    const pick = () => { const v = speechSynthesis.getVoices(); frVoice = v.find((x) => /^fr[-_]FR/i.test(x.lang)) || v.find((x) => /^fr/i.test(x.lang)) || null; showAudio(); };
    pick(); speechSynthesis.addEventListener?.('voiceschanged', pick);
  }
  const stopSpeech = () => { playToken++; if (hasTTS) speechSynthesis.cancel(); $$('.is-playing').forEach((b) => b.classList.remove('is-playing')); };
  const speakQueue = (items, rate, btn) => {
    if (!hasTTS) return;
    stopSpeech(); const my = playToken; btn?.classList.add('is-playing');
    const next = (i) => {
      if (my !== playToken || i >= items.length) { if (my === playToken) btn?.classList.remove('is-playing'); return; }
      const u = new SpeechSynthesisUtterance(items[i]); u.lang = 'fr-FR'; if (frVoice) u.voice = frVoice; u.rate = rate; u.onend = () => next(i + 1); u.onerror = () => next(i + 1);
      speechSynthesis.speak(u);
    };
    next(0);
  };
  document.addEventListener('click', (e) => {
    const b = e.target.closest('.speak-btn'); if (!b) return;
    e.preventDefault(); e.stopPropagation(); speakQueue([b.dataset.speak], 0.9, b);
  });
  $$('[data-listen]').forEach((bar) => {
    let items = []; try { items = JSON.parse($('#fr-text', bar).textContent).split(/\n{2,}/).map((x) => x.trim()).filter(Boolean); } catch {}
    const play = $('[data-act="play"]', bar), speed = $('[data-speed]', bar);
    play.addEventListener('click', () => { if (play.classList.contains('is-playing')) stopSpeech(); else speakQueue(items, Number(speed.value) || 0.9, play); });
    $('[data-act="stop"]', bar).addEventListener('click', stopSpeech);
  });
  addEventListener('pagehide', stopSpeech);

  // ---------- Můj sešit (localStorage) ----------
  const DK = 'pz-deck';
  const deckGet = () => { try { const d = JSON.parse(localStorage.getItem(DK) || '[]'); return Array.isArray(d) ? d : []; } catch { return []; } };
  const deckSet = (d) => { try { localStorage.setItem(DK, JSON.stringify(d.slice(0, 1000))); } catch {} };
  const syncAddButtons = () => { const have = new Set(deckGet().map((c) => c.fr)); $$('.add-card').forEach((b) => { const on = have.has(b.dataset.fr); b.setAttribute('aria-pressed', String(on)); b.textContent = on ? '✓' : '＋'; }); };
  document.addEventListener('click', (e) => {
    const b = e.target.closest('.add-card'); if (!b) return;
    e.preventDefault(); e.stopPropagation();
    const d = deckGet(), i = d.findIndex((c) => c.fr === b.dataset.fr);
    if (i >= 0) d.splice(i, 1); else d.push({ fr: b.dataset.fr, cs: b.dataset.cs, box: 1, due: 0 });
    deckSet(d); syncAddButtons();
  });
  syncAddButtons();
  const deckEl = $('#deck');
  if (deckEl) {
    const DAY = 864e5, GAP = { 1: 0, 2: 1 * DAY, 3: 3 * DAY, 4: 7 * DAY };
    let mode = 'list';
    const render = () => {
      const d = deckGet();
      if (!d.length) { deckEl.replaceChildren(el('p', {}, L('Votre carnet est vide. Cliquez sur ＋ à côté d’un mot (vocabulaire, dialogues, expressions) pour l’ajouter.', 'Sešit je prázdný. Kliknutím na ＋ vedle slova (slovíčka, dialogy, výrazy) ho přidáte.'))); return; }
      const due = d.filter((c) => (c.due || 0) <= Date.now());
      const bar = el('div', { class: 'filters' },
        Object.assign(el('button', { class: 'chip', type: 'button', 'aria-pressed': String(mode === 'list') }, L(`Liste (${d.length})`, `Seznam (${d.length})`)), { onclick: () => { mode = 'list'; render(); } }),
        Object.assign(el('button', { class: 'chip', type: 'button', 'aria-pressed': String(mode === 'review') }, L(`Réviser (${due.length})`, `Opakovat (${due.length})`)), { onclick: () => { mode = 'review'; render(); } }),
        Object.assign(el('button', { class: 'chip', type: 'button' }, L('Exporter (CSV)', 'Exportovat (CSV)')), { onclick: () => {
          const csv = ['francais;cesky', ...d.map((c) => `"${c.fr.replace(/"/g, '""')}";"${c.cs.replace(/"/g, '""')}"`)].join('\n');
          const a = el('a', { href: URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })), download: 'parisien-carnet.csv' }); document.body.append(a); a.click(); a.remove(); } }));
      if (mode === 'list') {
        deckEl.replaceChildren(bar, el('table', { class: 'vocab' }, el('thead', {}, el('tr', {}, el('th', {}, L('Français', 'Francouzsky')), el('th', {}, L('Tchèque', 'Česky')), el('th', {}))),
          el('tbody', {}, ...d.map((c) => el('tr', {}, el('td', { lang: 'fr' }, c.fr, ' ', hasTTS ? el('button', { class: 'speak-btn', type: 'button', 'data-speak': c.fr, 'aria-label': 'Écouter' }, '🔊') : null), el('td', {}, c.cs),
            el('td', {}, Object.assign(el('button', { class: 'chip', type: 'button' }, L('Retirer', 'Odebrat')), { onclick: () => { deckSet(deckGet().filter((x) => x.fr !== c.fr)); render(); } })))))),
          el('p', {}, Object.assign(el('button', { class: 'show-all', type: 'button' }, L('Vider le carnet', 'Vymazat sešit')), { onclick: () => { if (confirm(L('Vider tout le carnet ?', 'Opravdu vymazat celý sešit?'))) { deckSet([]); render(); } } })));
        return;
      }
      if (!due.length) { deckEl.replaceChildren(bar, el('p', { class: 'quiz-score' }, L('Bravo ! Rien à réviser pour le moment.', 'Výborně! Teď není co opakovat.'))); return; }
      const c = due[0]; let flipped = false;
      const card = el('div', { class: 'flash' }), body = el('div', { class: 'flash-face', lang: 'fr' }, c.fr);
      const actions = el('div', { class: 'acct-actions' });
      const draw = () => {
        body.textContent = flipped ? c.cs : c.fr; body.lang = flipped ? 'cs' : 'fr';
        actions.replaceChildren(...(flipped ? [
          Object.assign(el('button', { class: 'btn-primary', type: 'button' }, L('Je savais', 'Věděl(a) jsem')), { onclick: () => grade(true) }),
          Object.assign(el('button', { class: 'btn-primary light-on-dark', type: 'button' }, L('À revoir', 'Znovu')), { onclick: () => grade(false) })] : [
          Object.assign(el('button', { class: 'btn-primary', type: 'button' }, L('Voir la réponse', 'Zobrazit odpověď')), { onclick: () => { flipped = true; draw(); } }),
          hasTTS ? Object.assign(el('button', { class: 'chip', type: 'button' }, '🔊'), { onclick: () => speakQueue([c.fr], 0.9) }) : null]));
      };
      const grade = (ok) => { const d2 = deckGet(), t = d2.find((x) => x.fr === c.fr); if (t) { t.box = ok ? Math.min(4, (t.box || 1) + 1) : 1; t.due = Date.now() + GAP[t.box]; deckSet(d2); } render(); };
      card.append(body); draw(); deckEl.replaceChildren(bar, card, actions);
    };
    render();
  }

  // ---------- obecný kvíz (porozumění, dialogy) ----------
  const mountQuiz = (box, questions, startLang) => {
    let ql = startLang, i = 0, score = 0;
    const pk = (o) => (o && (o[ql] || o.fr || o.cs)) || '';
    const opts = (q) => (q.options[ql] && q.options[ql].length ? q.options[ql] : q.options.fr || q.options.cs || []);
    const draw = () => {
      const langBtn = Object.assign(el('button', { class: 'chip', type: 'button' }, ql === 'fr' ? 'FR → CS' : 'CS → FR'), { onclick: () => { ql = ql === 'fr' ? 'cs' : 'fr'; draw(); } });
      if (i >= questions.length) { box.replaceChildren(el('p', { class: 'quiz-score' }, L(`Résultat : ${score} / ${questions.length}`, `Výsledek: ${score} / ${questions.length}`)), Object.assign(el('button', { class: 'chip', type: 'button' }, L('Recommencer', 'Znovu')), { onclick: () => { i = 0; score = 0; draw(); } })); return; }
      const q = questions[i], fb = el('p', { class: 'quiz-fb', role: 'status' });
      const next = el('button', { class: 'chip', type: 'button', hidden: true }, i + 1 < questions.length ? L('Question suivante', 'Další otázka') : L('Résultat', 'Výsledek'));
      next.addEventListener('click', () => { i++; draw(); });
      const list = el('div', { class: 'quiz-opts' }, ...opts(q).map((o, k) => {
        const b = el('button', { type: 'button', class: 'quiz-opt' }, o);
        b.addEventListener('click', () => {
          $$('.quiz-opt', list).forEach((x, n) => { x.disabled = true; if (n === q.answer) x.classList.add('ok'); });
          if (k === q.answer) score++; else b.classList.add('ko');
          fb.textContent = (k === q.answer ? L('Bravo ! ', 'Správně! ') : L('Pas tout à fait. ', 'Ne tak docela. ')) + pk(q.explain); next.hidden = false;
        });
        return b;
      }));
      box.replaceChildren(el('div', { class: 'quiz-top' }, el('span', { class: 'quiz-n' }, `${i + 1} / ${questions.length}`), langBtn), el('h4', { class: 'quiz-q' }, pk(q.q)), list, fb, next);
    };
    draw();
  };
  const cq = $('#cq');
  if (cq) { try { mountQuiz(cq, JSON.parse($('#cq-data').textContent), cq.dataset.lang === 'cs' ? 'fr' : 'fr'); } catch {} }
  $$('.dlg').forEach((d) => {
    const mq = $('.mini-quiz', d); let mounted = false;
    d.addEventListener('toggle', () => { if (d.open && mq && !mounted) { mounted = true; try { mountQuiz(mq, JSON.parse($('.quiz-json', d).textContent), 'fr'); } catch {} } });
    $('[data-dlg-trans]', d)?.addEventListener('click', (e) => { const on = d.dataset.showTrans !== '1'; d.dataset.showTrans = on ? '1' : '0'; e.currentTarget.setAttribute('aria-pressed', String(on)); });
    $('[data-dlg-play]', d)?.addEventListener('click', (e) => { const b = e.currentTarget; if (b.classList.contains('is-playing')) stopSpeech(); else speakQueue($$('.dlg-line .fr', d).map((x) => x.textContent), 0.9, b); });
  });

  // ---------- výrazy: filtr typ + hledání ----------
  const exprList = $('#expr-list');
  if (exprList) {
    let type = '', q = '';
    const norm = (t) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const apply = () => $$('.expr', exprList).forEach((c) => { c.classList.toggle('expr-hidden', Boolean((type && c.dataset.type !== type) || (q && !norm(c.dataset.search).includes(q)))); });
    $$('#expr-filters .chip').forEach((b) => b.addEventListener('click', () => { type = b.dataset.type; $$('#expr-filters .chip').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); apply(); }));
    $('#expr-q')?.addEventListener('input', (e) => { q = norm(e.target.value.trim()); apply(); });
  }

  // ---------- hledání na webu ----------
  const sf = $('#search-form');
  if (sf) {
    const input = $('#site-search'), out = $('#search-results'), cnt = $('#search-count');
    let index = null;
    const norm = (t) => String(t).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const run = () => {
      const terms = norm(input.value).split(/\s+/).filter((t) => t.length > 1);
      if (!index || !terms.length) { out.replaceChildren(); cnt.textContent = ''; return; }
      const scored = index.map((e) => { const t = norm(e.t), x = norm(e.x || ''); let s = 0; for (const w of terms) { if (t.includes(w)) s += 5; else if (x.includes(w)) s += 1; else return null; } return { e, s }; }).filter(Boolean).sort((a, b) => b.s - a.s).slice(0, 40);
      cnt.textContent = L(`${scored.length} résultat(s)`, `Nalezeno: ${scored.length}`);
      out.replaceChildren(...scored.map(({ e }) => el('li', {}, el('a', { href: e.u }, e.t), ' ', el('span', { class: 'tag' }, e.k), e.d ? el('p', {}, e.d) : null)));
    };
    fetch(`/search-index-${lang}.json`).then((r) => r.json()).then((d) => { index = d; run(); }).catch(() => { cnt.textContent = L('Index indisponible.', 'Index není dostupný.'); });
    input.addEventListener('input', run); sf.addEventListener('submit', (e) => e.preventDefault());
    const qs = new URLSearchParams(location.search).get('q'); if (qs) input.value = qs; input.focus();
  }

  // ---------- výraz dne (úvodní stránka) ----------
  const exprDay = $('#expr-day');
  if (exprDay) {
    fetch('/data/expressions.json').then((r) => r.json()).then((all) => {
      const w = lvGet(); const pool = all.filter((e) => !w || LV.indexOf(e.level) <= LV.indexOf(w));
      const list = pool.length ? pool : all; if (!list.length) return;
      const day = Math.floor(Date.now() / 864e5), e = list[day % list.length];
      exprDay.replaceChildren(el('div', { class: 'expr-day' },
        el('span', { class: 'kicker-small' }, L('Expression du jour', 'Výraz dne')), ' ', el('span', { class: `tag lvl lvl-${e.level}` }, e.level),
        el('h3', { lang: 'fr' }, e.fr, ' ', hasTTS ? el('button', { class: 'speak-btn', type: 'button', 'data-speak': e.fr, 'aria-label': 'Écouter' }, '🔊') : null),
        el('p', {}, (e.meaning && (e.meaning[lang] || e.meaning.fr)) || ''),
        e.example ? el('p', { class: 'tip' }, el('em', { lang: 'fr' }, e.example.fr), el('br'), e.example.cs) : null,
        el('a', { class: 'read-more', href: `/${lang}/expressions` }, L('Toutes les expressions →', 'Všechny výrazy →'))));
      showAudio();
    }).catch(() => {});
  }

  // ---------- formulář ----------
  const form = $('#contact-form');
  if (form) {
    const status = $('#form-status');
    const kind = form.elements.kind;
    if (new URLSearchParams(location.search).get('type') === 'story') kind.value = 'story';
    const ph = () => { form.elements.message.placeholder = kind.value === 'story'
      ? L('Votre récit (titre, texte, une idée de photo — et dites-nous dans quelle langue vous écrivez)', 'Váš příběh (název, text, nápad na fotku — a napište, v jakém jazyce píšete)')
      : L('Votre message', 'Vaše zpráva'); };
    kind.addEventListener('change', ph); ph();
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = form.querySelector('button[type=submit]');
      const d = Object.fromEntries(new FormData(form));
      status.className = '';
      if (!d.name.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(d.email) || d.message.trim().length < 3) {
        status.textContent = L('Merci de remplir correctement tous les champs.', 'Vyplňte prosím správně všechna pole.'); status.className = 'err'; return;
      }
      btn.disabled = true; status.textContent = L('Envoi…', 'Odesílám…');
      try {
        const r = await fetch('/api/contact', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...d, lang }) });
        if (r.status === 429) throw new Error('rate');
        if (!r.ok) throw new Error('fail');
        form.reset(); ph(); status.textContent = L('Merci ! Nous vous répondrons bientôt.', 'Děkujeme! Brzy se vám ozveme.'); status.className = 'ok';
      } catch (err) {
        status.textContent = err.message === 'rate' ? L('Trop de messages. Réessayez dans une heure.', 'Příliš mnoho zpráv. Zkuste to za hodinu.') : L('L’envoi a échoué. Réessayez plus tard.', 'Odeslání se nepovedlo. Zkuste to později.'); status.className = 'err';
      } finally { btn.disabled = false; }
    });
  }

  // ---------- animace čísel ----------
  const box = $('.highlight-box');
  if (box && 'IntersectionObserver' in window && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    new IntersectionObserver((entries, obs) => entries.forEach((en) => {
      if (!en.isIntersecting) return;
      obs.disconnect();
      $$('.number', box).forEach((n) => {
        const target = n.textContent, m = target.match(/^([\d.]+)(.*)$/); if (!m) return;
        const num = parseFloat(m[1]); let t0 = null;
        const step = (ts) => { t0 ??= ts; const k = Math.min((ts - t0) / 1500, 1); n.textContent = k < 1 ? Math.floor(k * num) + m[2] : target; if (k < 1) requestAnimationFrame(step); };
        requestAnimationFrame(step);
      });
    }), { threshold: 0.3 }).observe(box);
  }
})();
