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
  const safeUrl = (u) => (/^https:\/\//.test(u || '') ? u : '');
  const pick = (o) => (o && (o[lang] || o[lang === 'cs' ? 'fr' : 'cs'])) || '';
  const fmtDay = (iso, opts) => new Date(iso).toLocaleDateString(loc, { timeZone: 'Europe/Paris', ...opts });

  // ---------- jazyk (zapamatovat volbu) ----------
  $$('[data-set-lang]').forEach((a) => a.addEventListener('click', () => { try { localStorage.setItem('pz-lang', a.dataset.setLang); } catch {} }));
  try { localStorage.setItem('pz-lang', lang); } catch {}

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
    fetch('https://api.open-meteo.com/v1/forecast?latitude=48.8566&longitude=2.3522&current=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min&timezone=Europe%2FParis&forecast_days=1')
      .then((r) => r.json()).then((d) => {
        const [icon, label] = WMO(d.current.weather_code);
        weather.replaceChildren(el('span', { class: 'w-icon', 'aria-hidden': 'true' }, icon),
          el('strong', {}, `${Math.round(d.current.temperature_2m)} °C`),
          el('span', {}, ` ${L('à Paris', 'v Paříži')} · ${label} · ${Math.round(d.daily.temperature_2m_min[0])}°/${Math.round(d.daily.temperature_2m_max[0])}°`));
      }).catch(() => weather.remove());
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
  const postCard = (p) => el('article', { class: 'card' },
    safeUrl(p.cover) ? el('figure', { class: 'photo' }, el('img', { src: p.cover, alt: '', loading: 'lazy' }), p.coverCredit ? el('figcaption', { class: 'credit' }, `© ${p.coverCredit.text}`) : null) : null,
    el('div', { class: 'card-body' },
      el('div', { class: 'post-meta' }, el('span', { class: 'tag' }, CAT[p.category] || p.category), ' ', el('time', { datetime: p.date }, fmtDay(p.date, { day: 'numeric', month: 'long', year: 'numeric' }))),
      el('h3', {}, pick(p.title)),
      el('p', {}, pick(p.excerpt)),
      el('a', { class: 'read-more', href: `/${lang}/article/${encodeURIComponent(p.slug)}` }, L('Lire l’article', 'Číst článek'))));
  const loadPosts = async (box, cat, limit) => {
    try {
      const r = await fetch(`/api/posts?${new URLSearchParams({ ...(cat ? { cat } : {}), ...(limit ? { limit } : {}) })}`);
      if (!r.ok) throw new Error();
      const { posts } = await r.json();
      box.replaceChildren(...(posts.length ? posts.map(postCard) : [evMsg(L('Aucun article pour le moment.', 'Zatím tu nejsou žádné články.'))]));
    } catch { box.replaceChildren(evMsg(L('Impossible de charger les articles.', 'Články se nepodařilo načíst.'))); }
  };
  const hp = $('#home-posts'); if (hp) loadPosts(hp, '', hp.dataset.limit || 3);
  const vp = $('#voyage-posts'); if (vp) loadPosts(vp, vp.dataset.cat);
  const bp = $('#blog-posts');
  if (bp) {
    const initial = new URLSearchParams(location.search).get('cat') || '';
    loadPosts(bp, initial);
    $$('#blog-filters .chip').forEach((b) => {
      b.setAttribute('aria-pressed', String(b.dataset.cat === initial));
      b.addEventListener('click', () => { $$('#blog-filters .chip').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); loadPosts(bp, b.dataset.cat); });
    });
  }

  // ---------- galerie + lightbox ----------
  const gal = $('#gallery');
  if (gal) {
    $$('.filters .chip[data-filter]').forEach((b) => b.addEventListener('click', () => {
      $$('.filters .chip').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      $$('.g-item', gal).forEach((f) => { f.hidden = b.dataset.filter !== 'all' && f.dataset.cat !== b.dataset.filter; });
    }));
    const dlg = el('dialog', { class: 'lightbox', 'aria-label': L('Photo agrandie', 'Zvětšená fotografie') });
    const img = el('img', { alt: '' }), cap = el('p', { class: 'lb-cap' }), cred = el('a', { target: '_blank', rel: 'noopener' });
    const close = el('button', { type: 'button', class: 'lb-close', 'aria-label': L('Fermer', 'Zavřít') }, '×');
    dlg.append(close, img, cap, cred); document.body.append(dlg);
    close.addEventListener('click', () => dlg.close());
    dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
    gal.addEventListener('click', (e) => {
      const a = e.target.closest('a[data-full]'); if (!a) return;
      e.preventDefault();
      img.src = a.dataset.full; img.alt = a.dataset.caption; cap.textContent = a.dataset.caption;
      cred.textContent = a.dataset.credit; cred.href = a.dataset.page; dlg.showModal();
    });
  }

  // ---------- kvíz ----------
  const quizBox = $('#quiz');
  if (quizBox) {
    let data = []; try { data = JSON.parse($('#quiz-data').textContent); } catch {}
    let i = 0, score = 0;
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
