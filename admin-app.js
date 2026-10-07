// parisien.cz – administrace článků (CS/FR), nahrávání obrázků do R2
(() => {
  const $ = (s) => document.querySelector(s);
  const el = (tag, attrs = {}, ...kids) => {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) if (v != null) n.setAttribute(k, v);
    for (const k of kids.flat()) n.append(k instanceof Node ? k : document.createTextNode(k));
    return n;
  };
  const toastEl = $('#toast');
  let toastTimer;
  const toast = (msg, err) => {
    toastEl.textContent = msg; toastEl.className = err ? 'err' : ''; toastEl.style.display = 'block';
    clearTimeout(toastTimer); toastTimer = setTimeout(() => (toastEl.style.display = 'none'), 3500);
  };

  async function call(action, body) {
    const opts = body === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
    const r = await fetch(`/api/admin?action=${action}`, opts);
    const data = await r.json().catch(() => ({}));
    if (r.status === 401 && action !== 'login') { await init(); throw new Error('Přihlášení vypršelo.'); }
    if (!r.ok) throw new Error(data.error || `Chyba ${r.status}`);
    return data;
  }
  const guard = (fn) => async (...a) => { try { await fn(...a); } catch (e) { toast(e.message, true); } };

  let me = {}, posts = [];

  async function init() {
    me = await call('me');
    const warn = [];
    if (!me.configured) warn.push('Chybí proměnná ADMIN_PASSWORD (min. 8 znaků). Přihlášení je vypnuté.');
    if (!me.db) warn.push('Není připojená databáze (DATABASE_URL). Web zobrazuje jen úvodní články, úpravy nejsou možné.');
    if (me.authed && !me.r2) warn.push('R2 není nastavené: obrázek zatím vložte jako URL (nahrávání souboru je vypnuté).');
    $('#status').replaceChildren(...warn.map((w) => el('div', { class: 'box warn' }, w)));
    $('#login').hidden = me.authed || !me.configured;
    $('#app').hidden = !me.authed;
    $('#logout').hidden = !me.authed;
    $('#f-upload').disabled = !me.r2;
    $('#g-upload').disabled = !me.r2;
    $('#list').hidden = !me.db;
    if (me.authed && me.db) await loadPosts();
  }

  async function loadPosts() {
    posts = (await call('list', {})).posts;
    renderList();
  }

  function renderList() {
    const box = $('#list');
    box.replaceChildren(
      el('div', { class: 'row' }, el('h2', { style: 'margin:0 auto 0 0' }, `Články (${posts.length})`),
        Object.assign(el('button', { class: 'btn', type: 'button' }, '+ Nový článek'), { onclick: () => openEditor() })),
      ...posts.map((p) => el('div', { class: 'item' },
        p.cover_url ? el('img', { class: 'thumb', src: p.cover_url, alt: '' }) : el('div', { class: 'thumb' }),
        el('div', { class: 'grow' },
          el('strong', {}, p.title_fr || p.title_cs || p.slug), ' ',
          el('span', { class: p.published ? 'badge' : 'badge draft' }, p.published ? 'publikováno' : 'koncept'),
          el('br'),
          el('small', {}, `${new Date(p.published_at).toLocaleDateString('cs-CZ')} · ${p.category} · /fr/article/${p.slug} · ${p.title_fr ? 'FR' : '–'} ${p.title_cs ? 'CS' : '–'}`)),
        el('a', { href: `/fr/article/${p.slug}`, target: '_blank', rel: 'noopener' }, 'Zobrazit'),
        Object.assign(el('button', { class: 'btn sec', type: 'button' }, 'Upravit'), { onclick: () => openEditor(p) }),
        Object.assign(el('button', { class: 'btn danger', type: 'button' }, 'Smazat'), {
          onclick: guard(async () => {
            if (!confirm(`Opravdu smazat „${p.title_fr || p.title_cs}“?`)) return;
            await call('delete', { id: p.id }); toast('Smazáno.'); await loadPosts();
          }),
        }))),
    );
  }

  const toLocalInput = (iso) => { const d = new Date(iso); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };
  function setPreview(url) { const i = $('#f-preview'); i.hidden = !url; if (url) i.src = url; }

  function openEditor(p) {
    const f = $('#editor');
    f.hidden = false;
    $('#editor-title').textContent = p ? 'Upravit článek' : 'Nový článek';
    $('#f-id').value = p?.id ?? '';
    $('#f-slug').value = p?.slug ?? '';
    $('#f-date').value = toLocalInput(p?.published_at ?? new Date().toISOString());
    $('#f-pub').checked = p ? p.published : true;
    $('#f-cover').value = p?.cover_url ?? '';
    $('#f-cat').value = p?.category ?? 'paris';
    $('#f-author').value = p?.author ?? '';
    $('#f-credit').value = p?.cover_credit ?? '';
    $('#f-credit-url').value = p?.cover_credit_url ?? '';
    $('#f-sources').value = (() => { try { return JSON.parse(p?.sources || '[]').join('\n'); } catch { return ''; } })();
    setPreview(p?.cover_url);
    for (const k of ['title', 'ex', 'body']) {
      const src = { title: 'title', ex: 'excerpt', body: 'body' }[k];
      for (const l of ['fr', 'cs']) $(`#f-${k}-${l}`).value = p?.[`${src}_${l}`] ?? '';
    }
    f.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  $('#editor').addEventListener('submit', guard(async (e) => {
    e.preventDefault();
    const btn = e.submitter; btn.disabled = true;
    try {
      const { post } = await call('save', {
        id: $('#f-id').value || null, slug: $('#f-slug').value,
        published: $('#f-pub').checked, published_at: new Date($('#f-date').value).toISOString(),
        cover_url: $('#f-cover').value.trim(), category: $('#f-cat').value, author: $('#f-author').value,
        cover_credit: $('#f-credit').value, cover_credit_url: $('#f-credit-url').value, sources: $('#f-sources').value,
        title_fr: $('#f-title-fr').value, title_cs: $('#f-title-cs').value,
        excerpt_fr: $('#f-ex-fr').value, excerpt_cs: $('#f-ex-cs').value,
        body_fr: $('#f-body-fr').value, body_cs: $('#f-body-cs').value,
      });
      toast('Uloženo.'); await loadPosts(); openEditor(post);
    } finally { btn.disabled = false; }
  }));
  $('#cancel').onclick = () => { $('#editor').hidden = true; };
  $('#f-cover').addEventListener('input', (e) => setPreview(e.target.value.trim()));

  // Zmenšení v prohlížeči (max 1600 px, JPEG) → nahrání přímo do R2 přes předpodepsané URL.
  async function shrink(file) {
    if (file.type === 'image/webp' && file.size < 400_000) return file;
    const bmp = await createImageBitmap(file);
    const s = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas');
    c.width = Math.round(bmp.width * s); c.height = Math.round(bmp.height * s);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    return new Promise((res) => c.toBlob((b) => res(b), 'image/jpeg', 0.82));
  }
  $('#f-upload').onclick = () => $('#f-file').click();
  $('#f-file').addEventListener('change', guard(async (e) => {
    const file = e.target.files[0]; e.target.value = '';
    if (!file) return;
    const btn = $('#f-upload'); btn.disabled = true; btn.textContent = 'Nahrávám…';
    try {
      const blob = await shrink(file);
      const { uploadUrl, publicUrl } = await call('upload', { contentType: blob.type, size: blob.size });
      const r = await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': blob.type }, body: blob });
      if (!r.ok) throw new Error('Nahrání do R2 selhalo (zkontrolujte CORS bucketu, viz README).');
      $('#f-cover').value = publicUrl; setPreview(publicUrl); toast('Obrázek nahrán.');
    } finally { btn.disabled = !me.r2; btn.textContent = 'Nahrát do R2'; }
  }));

  // zprávy z kontaktního formuláře
  async function loadMessages() {
    const box = $('#tab-messages');
    if (!me.db) return box.replaceChildren('Databáze není připojena.');
    const { messages } = await call('messages', {});
    box.replaceChildren(el('h2', { style: 'margin-top:0' }, `Zprávy (${messages.length})`),
      ...messages.map((m) => el('div', { class: 'msg' },
        el('strong', {}, m.name), ' ', el('a', { href: `mailto:${m.email}` }, m.email), ' ',
        el('small', {}, `${new Date(m.created_at).toLocaleString('cs-CZ')} · ${m.lang.toUpperCase()} · ${m.kind === 'story' ? 'NÁVRH ČLÁNKU' : 'zpráva'}`), el('br'), m.message, el('br'),
        Object.assign(el('button', { class: 'btn danger', type: 'button', style: 'margin-top:6px;padding:3px 10px' }, 'Smazat'), {
          onclick: guard(async () => { if (confirm('Smazat zprávu?')) { await call('delete-message', { id: m.id }); await loadMessages(); } }),
        }))));
  }
  document.querySelectorAll('.tabs button').forEach((b) => b.addEventListener('click', guard(async () => {
    document.querySelectorAll('.tabs button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    $('#tab-posts').hidden = b.dataset.tab !== 'posts';
    $('#tab-messages').hidden = b.dataset.tab !== 'messages';
    $('#tab-gallery').hidden = b.dataset.tab !== 'gallery';
    if (b.dataset.tab === 'messages') await loadMessages();
    if (b.dataset.tab === 'gallery') await loadGallery();
  })));

  // ---------- galerie studentů ----------
  let gItems = [];
  const gPreview = (u) => { const i = $('#g-preview'); i.hidden = !u; if (u) i.src = u; };
  async function loadGallery() {
    if (!me.db) return $('#g-list').replaceChildren('Databáze není připojena.');
    gItems = (await call('gallery-list', {})).items; renderGallery();
  }
  function renderGallery() {
    $('#g-list').replaceChildren(
      el('div', { class: 'row' }, el('h2', { style: 'margin:0 auto 0 0' }, `Fotogalerie (${gItems.length})`),
        Object.assign(el('button', { class: 'btn', type: 'button' }, '+ Nová fotka'), { onclick: () => openGallery() })),
      ...gItems.map((g) => el('div', { class: 'item' },
        el('img', { class: 'thumb', src: g.image_url, alt: '' }),
        el('div', { class: 'grow' }, el('strong', {}, g.title_fr || g.title_cs || '(bez popisku)'), ' ',
          el('span', { class: g.published ? 'badge' : 'badge draft' }, g.published ? 'zveřejněno' : 'skryto'), el('br'),
          el('small', {}, [g.author, g.place].filter(Boolean).join(' · '))),
        Object.assign(el('button', { class: 'btn sec', type: 'button' }, 'Upravit'), { onclick: () => openGallery(g) }),
        Object.assign(el('button', { class: 'btn danger', type: 'button' }, 'Smazat'), {
          onclick: guard(async () => { if (!confirm('Smazat fotku?')) return; await call('gallery-delete', { id: g.id }); toast('Smazáno.'); await loadGallery(); }),
        }))));
  }
  function openGallery(g) {
    $('#g-editor').hidden = false;
    $('#g-title').textContent = g ? 'Upravit fotku' : 'Nová fotka';
    $('#g-id').value = g?.id ?? ''; $('#g-image').value = g?.image_url ?? ''; gPreview(g?.image_url);
    $('#g-title-fr').value = g?.title_fr ?? ''; $('#g-title-cs').value = g?.title_cs ?? '';
    $('#g-author').value = g?.author ?? ''; $('#g-place').value = g?.place ?? ''; $('#g-credit').value = g?.credit ?? '';
    $('#g-pub').checked = g ? g.published : true;
    $('#g-editor').scrollIntoView({ behavior: 'smooth' });
  }
  $('#g-editor').addEventListener('submit', guard(async (e) => {
    e.preventDefault();
    await call('gallery-save', { id: $('#g-id').value || null, image_url: $('#g-image').value.trim(), title_fr: $('#g-title-fr').value, title_cs: $('#g-title-cs').value,
      author: $('#g-author').value, place: $('#g-place').value, credit: $('#g-credit').value, published: $('#g-pub').checked });
    toast('Uloženo.'); $('#g-editor').hidden = true; await loadGallery();
  }));
  $('#g-cancel').onclick = () => { $('#g-editor').hidden = true; };
  $('#g-image').addEventListener('input', (e) => gPreview(e.target.value.trim()));
  $('#g-upload').onclick = () => $('#g-file').click();
  $('#g-file').addEventListener('change', guard(async (e) => {
    const file = e.target.files[0]; e.target.value = ''; if (!file) return;
    const btn = $('#g-upload'); btn.disabled = true; btn.textContent = 'Nahrávám…';
    try {
      const blob = await shrink(file);
      const { uploadUrl, publicUrl } = await call('upload', { contentType: blob.type, size: blob.size });
      const r = await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': blob.type }, body: blob });
      if (!r.ok) throw new Error('Nahrání do R2 selhalo (zkontrolujte CORS bucketu, viz README).');
      $('#g-image').value = publicUrl; gPreview(publicUrl); toast('Obrázek nahrán.');
    } finally { btn.disabled = !me.r2; btn.textContent = 'Nahrát do R2'; }
  }));

  $('#login-form').addEventListener('submit', guard(async (e) => {
    e.preventDefault();
    await call('login', { password: $('#pw').value });
    $('#pw').value = ''; await init();
  }));
  $('#logout').onclick = guard(async () => { await call('logout', {}); await init(); });

  init().catch((e) => toast(e.message, true));
})();
