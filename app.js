// parisien.cz – veřejný frontend (jazyk, vykreslení obsahu, články, formulář)
(() => {
  const { ui, places, dishes, pastries, cafes, stage, museums, recipes, vocab } = window.PZ;
  const gallery = [places[0], places[1], places[2], places[3],
    { img: '/images/toits.jpg', alt: { fr: 'Les toits de Paris', cs: 'Pařížské střechy' } },
    { img: '/images/hero.jpg', alt: { fr: 'Vue sur Paris depuis Montmartre', cs: 'Pohled na Paříž z Montmartru' } }];
  const $ = (s, r = document) => r.querySelector(s);

  // ---------- jazyk ----------
  const store = { get: () => { try { return localStorage.getItem('pz-lang'); } catch { return null; } },
                  set: (v) => { try { localStorage.setItem('pz-lang', v); } catch {} } };
  const fromUrl = new URLSearchParams(location.search).get('lang');
  let lang = [fromUrl, store.get()].find((l) => l === 'fr' || l === 'cs')
    || (/^(cs|sk)/i.test(navigator.language || '') ? 'cs' : 'fr');
  const t = (k) => ui[lang][k] ?? ui.fr[k] ?? k;

  // ---------- pomocné ----------
  const el = (tag, attrs = {}, ...kids) => {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null) continue;
      if (k === 'class') n.className = v; else n.setAttribute(k, v);
    }
    for (const k of kids.flat()) n.append(k instanceof Node ? k : document.createTextNode(k));
    return n;
  };
  const fill = (id, items) => { const n = $(id); if (n) n.replaceChildren(...items); };
  const safeSrc = (u) => (/^(https:\/\/|\/)/.test(u || '') ? u : '');
  const fmtDate = (iso) => new Date(iso).toLocaleDateString(lang === 'cs' ? 'cs-CZ' : 'fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  const pick = (o) => (o && (o[lang] || o[lang === 'cs' ? 'fr' : 'cs'])) || '';

  // Bezpečné "markdown": odstavce, ## nadpis, **tučně** – bez HTML, takže bez XSS.
  function inline(text) {
    return text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean)
      .map((p) => (p.startsWith('**') && p.endsWith('**') ? el('strong', {}, p.slice(2, -2)) : p));
  }
  function renderBody(text) {
    return String(text || '').split(/\n{2,}/).map((blk) => blk.trim()).filter(Boolean)
      .map((blk) => (blk.startsWith('## ') ? el('h2', {}, ...inline(blk.slice(3))) : el('p', {}, ...inline(blk))));
  }

  // ---------- statický obsah ----------
  function renderStatic() {
    document.documentElement.lang = lang;
    document.querySelectorAll('[data-i18n]').forEach((n) => { n.textContent = t(n.dataset.i18n); });
    document.querySelectorAll('[data-i18n-ph]').forEach((n) => { n.placeholder = t(n.dataset.i18nPh); });
    document.querySelectorAll('.lang button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === lang)));
    $('#year') && ($('#year').textContent = new Date().getFullYear());
    if (!$('#places')) return;

    document.title = t('meta.title');
    $('meta[name="description"]').setAttribute('content', t('meta.desc'));

    fill('#places', places.map((p) => el('div', { class: 'place' },
      el('div', { class: 'place-image' }, el('img', { src: p.img, alt: pick(p.alt), loading: 'lazy' })),
      el('div', { class: 'place-info' }, el('h3', {}, pick(p.name)), el('p', {}, pick(p.text))))));
    fill('#gallery', gallery.map((g) => el('img', { src: g.img, alt: pick(g.alt), loading: 'lazy' })));
    fill('#dishes', dishes[lang].map((x) => el('li', {}, x)));
    fill('#pastries', pastries[lang].map((x) => el('li', {}, x)));
    fill('#cafes', cafes.map((x) => el('li', {}, x)));
    fill('#stage', stage[lang].map((x) => el('li', {}, x)));
    fill('#museums', museums.map((m) => el('div', { class: 'museum-item' },
      el('div', { class: 'museum-info' }, el('span', { class: 'museum-tag' }, pick(m.tag)), el('h3', {}, pick(m.name)), el('p', {}, pick(m.text))))));
    fill('#recipes', recipes.map((r) => el('div', { class: 'recipe-card' },
      el('div', { class: 'recipe-header' }, el('h3', {}, pick(r.name)),
        el('span', { class: 'recipe-difficulty' }, `${pick(r.level)} · ${r.minutes} ${t('recipes.time')}`)),
      el('div', { class: 'recipe-ingredients' }, el('h4', {}, t('recipes.ing')), el('ul', {}, ...r.ing[lang].map((x) => el('li', {}, x)))),
      el('div', { class: 'recipe-instructions' }, el('h4', {}, t('recipes.steps')), el('ol', {}, ...r.steps[lang].map((x) => el('li', {}, x)))))));
    fill('#vocab', vocab.map(([fr, cs]) => el('tr', {}, el('td', { lang: 'fr' }, fr), el('td', { lang: 'cs' }, cs))));
  }

  // ---------- články ----------
  async function api(url) {
    const r = await fetch(url);
    if (!r.ok) throw Object.assign(new Error(String(r.status)), { status: r.status });
    return r.json();
  }
  let posts = null, postsError = false;

  function titleOf(p) { return pick(p.title); }

  function renderPosts() {
    const box = $('#posts');
    if (!box) return;
    if (postsError) return box.replaceChildren(el('p', { class: 'muted' }, t('blog.error')));
    if (!posts) return;
    if (!posts.length) return box.replaceChildren(el('p', { class: 'muted' }, t('blog.empty')));
    box.replaceChildren(...posts.map((p) => el('article', { class: 'blog-post' },
      el('div', { class: 'post-date' }, fmtDate(p.date)),
      el('h3', {}, titleOf(p)),
      el('div', { class: 'post-excerpt' }, el('p', {}, pick(p.excerpt))),
      el('a', { class: 'read-more', href: `/clanek/${encodeURIComponent(p.slug)}` }, t('blog.read')))));
  }

  let post = null, postState = 'loading';
  function renderPost() {
    const box = $('#article');
    if (!box) return;
    if (postState === 'notfound') {
      document.title = 'parisien.cz';
      return box.replaceChildren(el('p', {}, t('blog.notfound')), el('a', { href: '/#blog', class: 'read-more' }, t('blog.back')));
    }
    if (!post) return;
    const title = titleOf(post);
    document.title = `${title} – parisien.cz`;
    $('meta[name="description"]').setAttribute('content', pick(post.excerpt));
    const missing = !post.body[lang];
    box.replaceChildren(
      safeSrc(post.cover) ? el('img', { class: 'article-cover', src: post.cover, alt: '', }) : null,
      el('div', { class: 'post-date' }, fmtDate(post.date)),
      el('h1', {}, title),
      missing ? el('p', { class: 'note' }, t('blog.notrans')) : null,
      ...renderBody(post.body[lang] || post.body[lang === 'cs' ? 'fr' : 'cs']),
      el('p', {}, el('a', { href: '/#blog', class: 'read-more' }, t('blog.back'))));
  }

  // ---------- formulář ----------
  function setupForm() {
    const form = $('#contact-form');
    if (!form) return;
    const status = $('#form-status');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = form.querySelector('button[type=submit]');
      const data = Object.fromEntries(new FormData(form));
      status.className = '';
      if (!data.name.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(data.email) || data.message.trim().length < 3) {
        status.textContent = t('contact.invalid'); status.className = 'err'; return;
      }
      btn.disabled = true; status.textContent = t('contact.sending');
      try {
        const r = await fetch('/api/contact', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...data, lang }) });
        if (r.status === 429) throw new Error('rate');
        if (!r.ok) throw new Error('fail');
        form.reset(); status.textContent = t('contact.ok'); status.className = 'ok';
      } catch (err) {
        status.textContent = err.message === 'rate' ? t('contact.rate') : t('contact.err'); status.className = 'err';
      } finally { btn.disabled = false; }
    });
  }

  // ---------- start ----------
  function renderAll() { renderStatic(); renderPosts(); renderPost(); }

  document.querySelectorAll('.lang button').forEach((b) => b.addEventListener('click', () => {
    lang = b.dataset.lang; store.set(lang); renderAll();
  }));
  const header = $('header');
  const onScroll = () => {
    const far = window.scrollY > 100;
    header.style.padding = far ? '10px 5%' : '20px 5%';
    header.style.backgroundColor = far ? 'rgba(255, 255, 255, 0.98)' : 'rgba(255, 255, 255, 0.95)';
    header.style.boxShadow = far ? '0 2px 15px rgba(0, 0, 0, 0.1)' : '0 2px 10px rgba(0, 0, 0, 0.05)';
  };
  addEventListener('scroll', onScroll, { passive: true });

  // karusel "À visiter"
  const strip = $('.places');
  $('.places-prev')?.addEventListener('click', () => strip.scrollBy({ left: -320, behavior: 'smooth' }));
  $('.places-next')?.addEventListener('click', () => strip.scrollBy({ left: 320, behavior: 'smooth' }));

  // animace čísel v "À propos"
  const box = $('.highlight-box');
  if (box && 'IntersectionObserver' in window && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    new IntersectionObserver((entries, obs) => entries.forEach((en) => {
      if (!en.isIntersecting) return;
      obs.disconnect();
      box.querySelectorAll('.number').forEach((n) => {
        const target = n.textContent, m = target.match(/^([\d.]+)(.*)$/); if (!m) return;
        const num = parseFloat(m[1]); let t0 = null;
        const step = (ts) => { t0 ??= ts; const k = Math.min((ts - t0) / 1500, 1);
          n.textContent = k < 1 ? Math.floor(k * num) + m[2] : target; if (k < 1) requestAnimationFrame(step); };
        requestAnimationFrame(step);
      });
    }), { threshold: 0.3 }).observe(box);
  }

  renderAll(); setupForm();

  if ($('#posts')) {
    api('/api/posts').then((d) => { posts = d.posts; }).catch(() => { postsError = true; }).finally(renderPosts);
  }
  if ($('#article')) {
    const slug = decodeURIComponent(location.pathname.split('/').filter(Boolean).pop() || '');
    api(`/api/posts?slug=${encodeURIComponent(slug)}`)
      .then((p) => { post = p; })
      .catch(() => { postState = 'notfound'; })
      .finally(renderPost);
  }
})();
