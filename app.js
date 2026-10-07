// parisien.cz – veřejný frontend (jazyk, vykreslení obsahu, články, formulář)
(() => {
  const { ui, places, dishes, pastries, cafes, stage, museums, recipes, vocab } = window.PZ;
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

    fill('#places', places.map((p) => el('article', { class: 'card' },
      el('img', { src: p.img, alt: pick(p.alt), loading: 'lazy', width: 1100, height: 733 }),
      el('div', { class: 'card-body' }, el('h3', {}, pick(p.name)), el('p', {}, pick(p.text))))));
    fill('#dishes', dishes[lang].map((x) => el('li', {}, x)));
    fill('#pastries', pastries[lang].map((x) => el('li', {}, x)));
    fill('#cafes', cafes.map((x) => el('li', {}, x)));
    fill('#stage', stage[lang].map((x) => el('li', {}, x)));
    fill('#museums', museums.map((m) => el('article', { class: 'panel museum' },
      el('span', { class: 'tag' }, pick(m.tag)), el('h3', {}, pick(m.name)), el('p', {}, pick(m.text)))));
    fill('#recipes', recipes.map((r) => el('article', { class: 'panel recipe' },
      el('div', { class: 'recipe-head' }, el('h3', {}, pick(r.name)),
        el('span', { class: 'tag' }, `${pick(r.level)} · ${r.minutes} ${t('recipes.time')}`)),
      el('h4', {}, t('recipes.ing')), el('ul', {}, ...r.ing[lang].map((x) => el('li', {}, x))),
      el('h4', {}, t('recipes.steps')), el('ol', {}, ...r.steps[lang].map((x) => el('li', {}, x))))));
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
    box.replaceChildren(...posts.map((p) => el('article', { class: 'card' },
      safeSrc(p.cover) ? el('img', { src: p.cover, alt: '', loading: 'lazy', width: 1100, height: 733 }) : null,
      el('div', { class: 'card-body' },
        el('time', { datetime: p.date }, fmtDate(p.date)),
        el('h3', {}, titleOf(p)),
        el('p', {}, pick(p.excerpt)),
        el('a', { class: 'more', href: `/clanek/${encodeURIComponent(p.slug)}` }, t('blog.read'))))));
  }

  let post = null, postState = 'loading';
  function renderPost() {
    const box = $('#article');
    if (!box) return;
    if (postState === 'notfound') {
      document.title = 'parisien.cz';
      return box.replaceChildren(el('p', {}, t('blog.notfound')), el('a', { href: '/#articles', class: 'more' }, t('blog.back')));
    }
    if (!post) return;
    const title = titleOf(post);
    document.title = `${title} – parisien.cz`;
    $('meta[name="description"]').setAttribute('content', pick(post.excerpt));
    const missing = !post.body[lang];
    box.replaceChildren(
      safeSrc(post.cover) ? el('img', { class: 'article-cover', src: post.cover, alt: '', width: 1100, height: 733 }) : null,
      el('time', { datetime: post.date }, fmtDate(post.date)),
      el('h1', {}, title),
      missing ? el('p', { class: 'note' }, t('blog.notrans')) : null,
      ...renderBody(post.body[lang] || post.body[lang === 'cs' ? 'fr' : 'cs']),
      el('p', {}, el('a', { href: '/#articles', class: 'more' }, t('blog.back'))));
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
  const toggle = $('.menu-toggle'), nav = $('#nav');
  if (toggle) {
    toggle.addEventListener('click', () => { const o = nav.classList.toggle('open'); toggle.setAttribute('aria-expanded', String(o)); });
    nav.addEventListener('click', (e) => { if (e.target.closest('a')) { nav.classList.remove('open'); toggle.setAttribute('aria-expanded', 'false'); } });
  }
  const header = $('.site-header');
  const onScroll = () => header.classList.toggle('scrolled', window.scrollY > 40);
  addEventListener('scroll', onScroll, { passive: true }); onScroll();

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
