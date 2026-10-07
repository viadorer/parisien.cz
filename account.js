// parisien.cz – studentský prostor (přihlášení, registrace s kódem, editor článků)
(() => {
  const root = document.getElementById('acct');
  if (!root) return;
  const lang = root.dataset.lang === 'cs' ? 'cs' : 'fr';
  const L = (fr, cs) => (lang === 'cs' ? cs : fr);
  const el = (tag, attrs = {}, ...kids) => {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) { if (v == null || v === false) continue; if (k === 'class') n.className = v; else if (k === 'value') n.value = v; else n.setAttribute(k, v); }
    for (const k of kids.flat()) if (k != null && k !== false) n.append(k instanceof Node ? k : document.createTextNode(k));
    return n;
  };
  const ERR = {
    code: L('Code d’invitation invalide, expiré ou déjà utilisé.', 'Kód pozvánky je neplatný, prošlý nebo už použitý.'),
    exists: L('Cette adresse e-mail est déjà inscrite.', 'Tento e-mail je už zaregistrovaný.'),
    invalid: L('Vérifiez les champs : nom (2 caractères min.), e-mail valide, mot de passe de 10 caractères minimum.', 'Zkontrolujte pole: jméno (min. 2 znaky), platný e-mail a heslo alespoň 10 znaků.'),
    credentials: L('E-mail ou mot de passe incorrect.', 'Nesprávný e-mail nebo heslo.'),
    locked: L('Trop d’essais. Réessayez dans 15 minutes.', 'Příliš mnoho pokusů. Zkuste to za 15 minut.'),
    weak: L('Mot de passe trop court (10 caractères minimum).', 'Heslo je příliš krátké (min. 10 znaků).'),
    title: L('Ajoutez au moins un titre.', 'Přidejte alespoň název.'),
    body: L('Ajoutez un texte avant de l’envoyer.', 'Před odesláním přidejte text.'),
    credit: L('Indiquez l’auteur de la photo (par ex. « photo personnelle »).', 'Uveďte autora fotografie (např. „vlastní fotografie“).'),
    published: L('Cet article est déjà publié : contactez-nous pour le modifier.', 'Tento článek je už zveřejněný: pro úpravu nás kontaktujte.'),
    r2: L('Le téléversement d’images n’est pas encore activé.', 'Nahrávání obrázků zatím není zapnuto.'),
    auth: L('Session expirée, reconnectez-vous.', 'Přihlášení vypršelo, přihlaste se znovu.'),
    unavailable: L('Service momentanément indisponible.', 'Služba je momentálně nedostupná.'),
  };
  const STATUS = { draft: L('Brouillon', 'Koncept'), submitted: L('En relecture', 'Ke schválení'), rejected: L('À corriger', 'K opravě'), published: L('Publié', 'Zveřejněno') };
  const msg = (c) => ERR[c] || L('Une erreur est survenue.', 'Došlo k chybě.');

  async function api(action, body) {
    const r = await fetch(`/api/account?action=${action}`, body === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw Object.assign(new Error(msg(d.error)), { code: d.error, status: r.status });
    return d;
  }
  const status = el('p', { class: 'acct-status', role: 'status' });
  const flash = (t, ok) => { status.textContent = t; status.className = `acct-status ${ok ? 'ok' : 'err'}`; };
  const field = (id, label, attrs = {}) => el('div', { class: 'form-group' }, el('label', { for: id, class: 'acct-label' }, label), attrs.tag === 'textarea' ? el('textarea', { id, ...attrs.a }) : el('input', { id, ...attrs.a }));

  // ---------- nepřihlášený ----------
  function viewAuth() {
    let mode = 'login';
    const box = el('div', { class: 'acct-box' });
    const render = () => {
      const isReg = mode === 'register';
      const form = el('form', { novalidate: '' },
        isReg ? field('a-code', L('Code d’invitation (donné par votre enseignant)', 'Kód pozvánky (od vašeho učitele)'), { a: { autocomplete: 'off', required: '', placeholder: 'XXXX-XXXX' } }) : null,
        isReg ? field('a-name', L('Prénom ou pseudonyme (affiché sous vos articles)', 'Jméno nebo přezdívka (zobrazí se pod články)'), { a: { maxlength: 40, required: '' } }) : null,
        field('a-email', 'E-mail', { a: { type: 'email', autocomplete: 'email', required: '' } }),
        field('a-pw', L(isReg ? 'Mot de passe (10 caractères minimum)' : 'Mot de passe', isReg ? 'Heslo (min. 10 znaků)' : 'Heslo'), { a: { type: 'password', autocomplete: isReg ? 'new-password' : 'current-password', required: '' } }),
        el('button', { class: 'btn-primary', type: 'submit' }, isReg ? L('Créer mon compte', 'Vytvořit účet') : L('Se connecter', 'Přihlásit se')));
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const v = (id) => form.querySelector('#' + id)?.value ?? '';
        const btn = form.querySelector('button'); btn.disabled = true;
        try {
          await api(isReg ? 'register' : 'login', isReg ? { code: v('a-code'), name: v('a-name'), email: v('a-email'), password: v('a-pw') } : { email: v('a-email'), password: v('a-pw') });
          await start();
        } catch (er) { flash(er.message, false); btn.disabled = false; }
      });
      box.replaceChildren(
        el('div', { class: 'filters' },
          ...[['login', L('Se connecter', 'Přihlášení')], ['register', L('Créer un compte', 'Vytvořit účet')]].map(([m, t]) => {
            const b = el('button', { class: 'chip', type: 'button', 'aria-pressed': String(mode === m) }, t);
            b.addEventListener('click', () => { mode = m; status.textContent = ''; render(); }); return b;
          })),
        isReg ? el('p', { class: 'note' }, L('L’inscription est réservée aux étudiants du cours : il faut un code d’invitation de votre enseignant.', 'Registrace je jen pro studenty kurzu: potřebujete kód pozvánky od učitele.')) : null,
        form, status);
    };
    render();
    root.replaceChildren(box);
  }

  // ---------- přihlášený ----------
  async function viewHome(user, r2) {
    const { posts } = await api('posts', {});
    const list = el('div', { class: 'acct-list' });
    const editorBox = el('div');
    const head = el('div', { class: 'acct-head' }, el('h2', {}, L(`Bonjour, ${user.name}`, `Ahoj, ${user.name}`)),
      el('div', {},
        Object.assign(el('button', { class: 'chip', type: 'button' }, L('Nouvel article', '+ Nový článek')), { onclick: () => openEditor() }), ' ',
        Object.assign(el('button', { class: 'chip', type: 'button' }, L('Déconnexion', 'Odhlásit')), { onclick: async () => { await api('logout', {}); await start(); } })));

    posts.forEach((p) => list.append(el('div', { class: 'acct-post' },
      el('div', { class: 'grow' }, el('strong', {}, p.title_fr || p.title_cs), ' ', el('span', { class: `tag ${p.status === 'published' ? 'free' : ''}` }, STATUS[p.status] || p.status),
        p.status === 'rejected' && p.review_note ? el('p', { class: 'acct-note' }, `${L('Remarque de l’enseignant', 'Poznámka učitele')} : ${p.review_note}`) : null),
      p.status === 'published' ? el('a', { class: 'read-more', href: `/${lang}/article/${p.slug}` }, L('Voir', 'Zobrazit')) : el('span', {},
        Object.assign(el('button', { class: 'chip', type: 'button' }, L('Modifier', 'Upravit')), { onclick: () => openEditor(p) }), ' ',
        Object.assign(el('button', { class: 'chip', type: 'button' }, L('Supprimer', 'Smazat')), { onclick: async () => { if (!confirm(L('Supprimer cet article ?', 'Smazat tento článek?'))) return; try { await api('delete', { id: p.id }); await start(); } catch (e) { flash(e.message, false); } } })))));
    if (!posts.length) list.append(el('p', { class: 'muted' }, L('Vous n’avez pas encore d’article. Cliquez sur « Nouvel article ».', 'Zatím nemáte žádný článek. Klikněte na „Nový článek“.')));

    function openEditor(p) {
      const v = (k) => p?.[k] ?? '';
      const f = el('form', { class: 'acct-editor', novalidate: '' },
        el('h3', {}, p ? L('Modifier l’article', 'Upravit článek') : L('Nouvel article', 'Nový článek')),
        el('p', { class: 'note' }, L('Écrivez dans la langue que vous maîtrisez le mieux ; l’autre version est facultative (nous pouvons la préparer ensemble). Format : paragraphes séparés par une ligne vide, « ## Titre » pour un intertitre, **gras**, « - » pour une liste. Pas de HTML.', 'Pište v jazyce, který ovládáte nejlépe; druhá verze je volitelná (můžeme ji připravit společně). Formát: odstavce oddělené prázdným řádkem, „## Nadpis“ pro mezititulek, **tučně**, „- “ pro seznam. Bez HTML.')),
        el('div', { class: 'form-group' }, el('label', { class: 'acct-label', for: 'e-cat' }, L('Rubrique', 'Rubrika')),
          el('select', { id: 'e-cat' }, ...[['voyage', L('Voyages', 'Cestování')], ['paris', L('Paris', 'Paříž')], ['langue', L('Langue', 'Jazyk')]].map(([k, t]) => el('option', { value: k, ...(v('category') === k ? { selected: '' } : {}) }, t)))),
        el('div', { class: 'acct-cols' },
          el('div', {}, el('h4', {}, 'Français'), field('e-tfr', 'Titre', { a: { maxlength: 200, value: v('title_fr') } }), field('e-xfr', 'Résumé (1–2 phrases)', { tag: 'textarea', a: { maxlength: 400, rows: 3 } }), field('e-bfr', 'Texte', { tag: 'textarea', a: { rows: 14 } })),
          el('div', {}, el('h4', {}, 'Čeština'), field('e-tcs', 'Název', { a: { maxlength: 200, value: v('title_cs') } }), field('e-xcs', 'Perex (1–2 věty)', { tag: 'textarea', a: { maxlength: 400, rows: 3 } }), field('e-bcs', 'Text', { tag: 'textarea', a: { rows: 14 } }))),
        el('h4', {}, L('Photo de couverture (facultatif)', 'Titulní fotka (volitelné)')),
        el('p', { class: 'note' }, L('Uniquement une photo prise par vous (ou sous licence libre avec mention de l’auteur). Pas de personnes reconnaissables sans leur accord.', 'Jen vlastní fotografie (nebo se svobodnou licencí a uvedením autora). Žádné rozpoznatelné osoby bez jejich souhlasu.')),
        el('div', { class: 'form-group' }, el('label', { class: 'acct-label', for: 'e-cover' }, 'URL (https://)'), el('input', { id: 'e-cover', type: 'url', value: v('cover_url') })),
        r2 ? el('div', { class: 'form-group' }, el('input', { id: 'e-file', type: 'file', accept: 'image/jpeg,image/png,image/webp' })) : null,
        field('e-credit', L('Auteur de la photo / licence', 'Autor fotografie / licence'), { a: { maxlength: 200, value: v('cover_credit'), placeholder: L('photo personnelle — Prénom', 'vlastní fotografie — jméno') } }),
        el('div', { class: 'acct-actions' },
          el('button', { class: 'btn-primary', type: 'button', 'data-submit': '0' }, L('Enregistrer le brouillon', 'Uložit koncept')), ' ',
          el('button', { class: 'btn-primary light-on-dark', type: 'button', 'data-submit': '1' }, L('Envoyer pour relecture', 'Odeslat ke schválení')), ' ',
          el('button', { class: 'chip', type: 'button', id: 'e-close' }, L('Fermer', 'Zavřít'))));
      f.querySelector('#e-xfr').value = v('excerpt_fr'); f.querySelector('#e-xcs').value = v('excerpt_cs');
      f.querySelector('#e-bfr').value = v('body_fr'); f.querySelector('#e-bcs').value = v('body_cs');
      f.querySelector('#e-close').onclick = () => editorBox.replaceChildren();
      const file = f.querySelector('#e-file');
      file?.addEventListener('change', async () => {
        const fl = file.files[0]; if (!fl) return;
        try {
          flash(L('Téléversement…', 'Nahrávám…'), true);
          const bmp = await createImageBitmap(fl), sc = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
          const c = document.createElement('canvas'); c.width = Math.round(bmp.width * sc); c.height = Math.round(bmp.height * sc);
          c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
          const blob = await new Promise((res) => c.toBlob(res, 'image/jpeg', 0.82));
          const { uploadUrl, publicUrl } = await api('upload', { contentType: blob.type, size: blob.size });
          const put = await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': blob.type }, body: blob });
          if (!put.ok) throw new Error(L('Le téléversement a échoué.', 'Nahrání se nepovedlo.'));
          f.querySelector('#e-cover').value = publicUrl; flash(L('Photo téléversée.', 'Fotka nahrána.'), true);
        } catch (er) { flash(er.message, false); }
      });
      f.querySelectorAll('[data-submit]').forEach((b) => b.addEventListener('click', async () => {
        const g = (id) => f.querySelector('#' + id).value;
        b.disabled = true;
        try {
          await api('save', { id: p?.id, submit: b.dataset.submit === '1', category: g('e-cat'), title_fr: g('e-tfr'), title_cs: g('e-tcs'), excerpt_fr: g('e-xfr'), excerpt_cs: g('e-xcs'),
            body_fr: g('e-bfr'), body_cs: g('e-bcs'), cover_url: g('e-cover').trim(), cover_credit: g('e-credit') });
          flash(b.dataset.submit === '1' ? L('Envoyé ! Votre enseignant va le relire.', 'Odesláno! Učitel článek projde.') : L('Brouillon enregistré.', 'Koncept uložen.'), true);
          await start(true);
        } catch (er) { flash(er.message, false); b.disabled = false; }
      }));
      editorBox.replaceChildren(f); f.scrollIntoView({ behavior: 'smooth' });
    }

    const pw = el('details', { class: 'acct-more' }, el('summary', {}, L('Mon compte', 'Můj účet')),
      el('form', { novalidate: '' }, el('h4', {}, L('Changer le mot de passe', 'Změnit heslo')),
        field('p-cur', L('Mot de passe actuel', 'Současné heslo'), { a: { type: 'password', autocomplete: 'current-password' } }),
        field('p-new', L('Nouveau mot de passe (10 caractères min.)', 'Nové heslo (min. 10 znaků)'), { a: { type: 'password', autocomplete: 'new-password' } }),
        el('button', { class: 'chip', type: 'submit' }, L('Changer', 'Změnit'))),
      el('form', { novalidate: '' }, el('h4', {}, L('Supprimer mon compte', 'Smazat účet')),
        field('d-pw', L('Mot de passe (confirmation)', 'Heslo (potvrzení)'), { a: { type: 'password', autocomplete: 'current-password' } }),
        el('button', { class: 'chip', type: 'submit' }, L('Supprimer définitivement', 'Smazat natrvalo'))));
    const [fChange, fDelete] = pw.querySelectorAll('form');
    fChange.addEventListener('submit', async (e) => { e.preventDefault(); try { await api('change-password', { current: fChange.querySelector('#p-cur').value, next: fChange.querySelector('#p-new').value }); fChange.reset(); flash(L('Mot de passe modifié.', 'Heslo změněno.'), true); } catch (er) { flash(er.message, false); } });
    fDelete.addEventListener('submit', async (e) => { e.preventDefault(); if (!confirm(L('Supprimer définitivement votre compte et vos brouillons ?', 'Opravdu natrvalo smazat účet a koncepty?'))) return; try { await api('delete-account', { password: fDelete.querySelector('#d-pw').value }); await start(); } catch (er) { flash(er.message, false); } });

    root.replaceChildren(head, status, list, editorBox, pw);
  }

  async function start(keep) {
    try {
      const me = await api('me');
      if (me.user) { const s = status.textContent, c = status.className; await viewHome(me.user, me.r2); if (keep) { status.textContent = s; status.className = c; } } else viewAuth();
    } catch (e) { root.replaceChildren(el('p', { class: 'muted' }, e.status === 503 ? ERR.unavailable : e.message)); }
  }
  start();
})();
