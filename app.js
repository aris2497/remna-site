// Remna: interfejs aplikacji.
(function () {
  'use strict';
  const R = window.Remna;
  const I = window.RemnaI18n;
  const N = window.RemnaNative;
  const t = I.t;
  const $ = (sel) => document.querySelector(sel);
  const storage = (() => { try { localStorage.setItem('remna-test', '1'); localStorage.removeItem('remna-test'); return localStorage; } catch (e) { const m = {}; return { getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, removeItem: (k) => { delete m[k]; } }; } })();

  const source = window.RemnaData.makeSource(window.REMNA_CONFIG, {
    Remna: R, fetch: window.fetch.bind(window), platform: N.isNative ? 'android' : 'web', lang: () => I.getLang(),
  });
  const favorites = R.makeFavorites(storage);
  // Statystyki: wyłącznik w „Więcej” (zapamiętany) i „Nie śledź” w przeglądarce
  const dnt = navigator.doNotTrack === '1' || window.doNotTrack === '1';
  const statsAllowed = () => !dnt && storage.getItem('remna-statystyki') !== 'nie';
  source.setStatsCheck(statsAllowed);
  const alerts = R.makeAlerts(storage);
  const recent = R.makeRecent(storage);              // ostatnie wyszukiwania (podpowiedzi pod polem)
  const searchMemory = R.makeSearchMemory(storage);  // „Szukasz tego nie pierwszy raz. Zapisać jako alert?”
  const wide = window.matchMedia ? window.matchMedia('(min-width: 960px)') : { matches: false, addEventListener() {} };

  const state = {
    filters: loadFilters(),
    page: 0,
    items: [],
    total: null,
    approx: false,
    loading: false,
    error: false,
    seq: 0,
    view: 'search',
    draft: null,
    detailId: null,
    sheetGroup: null,   // mały arkusz z jedną grupą filtrów (null = wszystkie)
    editAlert: null,    // id alertu, którego wyszukiwanie właśnie zmieniamy
  };

  // --- Pomocnicze -----------------------------------------------------------
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function loadFilters() {
    try { return R.normalizeFilters(JSON.parse(storage.getItem('remna-filtry'))); } catch (e) { return R.defaultFilters(); }
  }
  function saveFilters() { storage.setItem('remna-filtry', JSON.stringify(state.filters)); syncUrl(); }

  // --- Adres strony: wyszukiwanie i oferta do udostępnienia (tylko wersja webowa) ---------
  const WEB = !N.isNative && window.history && window.URLSearchParams;
  function pageUrl(extra) {
    const params = new URLSearchParams();
    for (const [k, v] of R.filtersToParams(state.filters)) params.set(k, v);
    for (const [k, v] of Object.entries(extra || {})) params.set(k, v);
    const qs = params.toString();
    return location.pathname + (qs ? '?' + qs : '');
  }
  function syncUrl() {
    if (!WEB) return;
    const extra = state.detailId ? { o: state.detailId } : {};
    try { history.replaceState(history.state, '', pageUrl(extra)); } catch (e) { /* np. podgląd z pliku */ }
  }
  /** Link do oferty, którym można się podzielić (zawsze adres wersji webowej). */
  function offerLink(id) {
    const base = window.REMNA_CONFIG.webUrl || (location.origin + location.pathname);
    return base + '?o=' + encodeURIComponent(id);
  }
  function countryName(code) { const v = t('country.' + code); return v === 'country.' + code ? code : v; }
  function fmtDate(iso) {
    if (!iso) return '';
    try { return new Intl.DateTimeFormat(I.localeOf(I.getLang()), { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso)); } catch (e) { return iso.slice(0, 10); }
  }
  function isNew(p) { return p.first_seen_at && (Date.now() - Date.parse(p.first_seen_at)) < 3 * 86400000; }
  function fiberName(id) { const f = R.FIBERS.find((x) => x.id === id); return f ? (f[I.getLang()] || f.en) : id; }

  let toastTimer = null;
  function toast(msg, actionLabel, action) {
    const el = $('#toast');
    el.innerHTML = '<span>' + esc(msg) + '</span>' + (actionLabel ? '<button type="button">' + esc(actionLabel) + '</button>' : '');
    el.hidden = false;
    if (actionLabel) el.querySelector('button').onclick = () => { el.hidden = true; action(); };
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, actionLabel ? 5000 : 2200);
  }

  // --- Tłumaczenia statycznego HTML ---------------------------------------------
  function applyI18n() {
    document.documentElement.lang = I.getLang();
    document.title = 'Remna – Deadstock Fabrics';   // nazwa aplikacji (jak w Google Play), w każdym języku ta sama
    document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
    document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => { el.placeholder = t(el.dataset.i18nPlaceholder); });
    document.querySelectorAll('[data-i18n-aria]').forEach((el) => { el.setAttribute('aria-label', t(el.dataset.i18nAria)); });
    $('#q').setAttribute('aria-label', t('tab.search'));
    // strony kategorii są po angielsku i po polsku
    $('#guide-fabrics').href = 'https://remnafabrics.com/' + (I.getLang() === 'pl' ? 'pl/tkaniny/' : 'fabrics/');
    $('#lang').value = I.getLang();
  }

  // --- Przyciski grup filtrów pod wyszukiwarką: Materiał ▾ Kolor ▾ Cena/m ▾ … ----------------
  // Każdy otwiera mały arkusz z tą jedną grupą. Ustawiona grupa pokazuje wybór („Jedwab, Wełna”) i ✕ obok;
  // ustawione stoją na początku, żeby było je widać bez przewijania.
  const ROW_GROUPS = ['material', 'colors', 'price', 'stock', 'pattern', 'weight', 'width', 'shops', 'newDays'];
  const CARET = '<svg class="caret" viewBox="0 0 24 24" aria-hidden="true"><path d="m7 10 5 5 5-5"/></svg>';
  function groupSummary(f, group) {
    const labels = activeChips(f).filter((c) => c.group === group).map((c) => c.text);
    if (!labels.length) return '';
    return labels.length > 2 ? labels.slice(0, 2).join(', ') + ' +' + (labels.length - 2) : labels.join(', ');
  }
  function renderQuick() {
    const f = state.filters;
    const on = ROW_GROUPS.filter((g) => R.groupActive(f, g));
    const off = ROW_GROUPS.filter((g) => !on.includes(g));
    $('#quick').innerHTML = on.concat(off).map((g) => {
      const active = on.includes(g);
      const label = active ? groupSummary(f, g) : t('row.' + g);
      const dot = g === 'colors' && active ? f.colors.slice(0, 3).map((id) => {
        const c = R.COLORS.find((x) => x.id === id);
        return c ? `<span class="dot" style="background:${c.hex}"></span>` : '';
      }).join('') : '';
      return `<span class="fchip${active ? ' on' : ''}"><button type="button" class="fchip-main" data-group="${g}" aria-haspopup="dialog">` +
        `${dot}<span class="fchip-label">${esc(label)}</span>${CARET}</button>` +
        (active ? `<button type="button" class="fchip-x" data-cleargroup="${g}" aria-label="${esc(t('filters.remove', label))}">✕</button>` : '') +
        '</span>';
    }).join('');
  }
  $('#quick').addEventListener('click', (e) => {
    const x = e.target.closest('[data-cleargroup]');
    if (x) { setFilters(R.clearGroup(state.filters, x.dataset.cleargroup)); return; }
    const b = e.target.closest('[data-group]');
    if (b) openFilters(b.dataset.group);
  });

  function renderSort() {
    $('#sort').innerHTML = R.SORTS.map((s) => `<option value="${s}">${esc(t('sort.' + s))}</option>`).join('');
    $('#sort').value = state.filters.sort;
  }
  $('#sort').addEventListener('change', (e) => setFilters(Object.assign({}, state.filters, { sort: e.target.value })));

  /** Nowe filtry. opts.fromBox = zmiana z pola wyszukiwania (bez niego słowa wyłączonych filtrów znikają z pola).
   *  opts.keepSpell = zostaw podpowiedź pisowni (przy pokazaniu poprawionych wyników). */
  function setFilters(f, opts) {
    const o = opts || {};
    let n = R.normalizeFilters(f);
    if (!o.fromBox) {
      n = R.dropOffFilterWords(n);
      if ($('#q').value.trim() !== n.q) { $('#q').value = n.q; $('#q-clear').hidden = !n.q; }
      state.typed = R.extractFilters(n.q, true);
    }
    if (!o.keepSpell) state.spell = null;
    state.filters = n;
    saveFilters();
    // Ktoś szuka: powitanie znika (i nie wraca). Zakończone wyszukiwanie (nie w trakcie pisania) trafia do ostatnich.
    if (R.isSearch(n)) {
      hideIntro();
      if (!o.typing) { recent.add(n); searchMemory.bump(n); }
    }
    renderQuick();
    renderFilterBadge();
    renderActive();
    renderSide();
    renderEditBanner();
    $('#sort').value = state.filters.sort;
    // Nowe wyniki zaczynają się od góry listy (inaczej po przewinięciu widać środek nowej listy).
    if (window.scrollY > 0) window.scrollTo(0, 0);
    runSearch(true);
  }

  function renderFilterBadge() {
    const n = R.countActive(state.filters);
    const b = $('#filter-count');
    b.hidden = !n;
    b.textContent = n;
  }

  // --- Wyszukiwanie -----------------------------------------------------------
  let qTimer = null;
  $('#q').value = state.filters.q;
  $('#q-clear').hidden = !state.filters.q;
  // Słowa z pola, które ostatnio włączyły filtry (żeby wiedzieć, co jest nowe, a co zostało usunięte z pola)
  state.typed = R.extractFilters(state.filters.q, true);
  /** Tekst z wyszukiwarki → filtry: kolory, materiały i wzór („gold silk”) włączają filtry (chipy), a tekst zostaje w polu.
   *  Nowe słowo zastępuje inny filtr tego samego rodzaju; wtedy krótka informacja („Kolor zmieniony na Złoty”). */
  function filtersFromSearchBox(final, text) {
    const r = R.applySearchText(state.filters, text == null ? $('#q').value : text, state.typed, final);
    state.typed = r.typed;
    if (r.changed.length) toast(r.changed.map((c) => t('search.changed.' + c.field, c.ids.map((id) => filterValueName(c.field, id)).join(', '))).join(' · '));
    return r.filters;
  }
  function filterValueName(field, id) {
    const lang = I.getLang();
    if (field === 'colors') { const c = R.COLORS.find((x) => x.id === id); return c ? (c[lang] || c.en) : id; }
    if (field === 'fibers') return fiberName(id);
    return t(id === 'plain' ? 'filters.patternPlain' : 'filters.patternPatterned');
  }
  $('#q').addEventListener('input', () => {
    $('#q-clear').hidden = !$('#q').value;
    clearTimeout(qTimer);
    qTimer = setTimeout(() => setFilters(filtersFromSearchBox(false), { fromBox: true, typing: true }), 350);
  });
  $('#search-form').addEventListener('submit', (e) => {
    e.preventDefault();
    clearTimeout(qTimer);
    hideSuggest();
    $('#q').blur();
    setFilters(filtersFromSearchBox(true), { fromBox: true });
  });
  $('#q-clear').addEventListener('click', () => {
    $('#q').value = '';
    $('#q-clear').hidden = true;
    setFilters(filtersFromSearchBox(true, ''), { fromBox: true });
    $('#q').focus();
  });

  // --- Podpowiedzi pod polem: ostatnie wyszukiwania (puste pole) i dokończenie słowa (w trakcie pisania) ---------
  // Dokończenie pokazuje też, który filtr włączy (np. „jedwab → Materiał: Jedwab”).
  let suggestItems = [];   // [{type: 'recent'|'term', filters?, text?}]
  let suggestActive = -1;
  const CLOCK = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M12 8v4l2.5 2"/></svg>';
  function renderSuggest() {
    const el = $('#suggest');
    const text = $('#q').value;
    const lang = I.getLang();
    const items = [];
    const html = [];
    if (!text.trim()) {
      const list = recent.list().slice(0, 6);
      if (list.length) {
        html.push(`<div class="sg-head"><span>${esc(t('search.recent'))}</span><button type="button" class="text-btn small" data-sg-clear>${esc(t('search.clearRecent'))}</button></div>`);
        for (const r of list) {
          html.push(`<div class="sg-row"><button type="button" class="sg-item" role="option" data-sg="${items.length}">${CLOCK}<span>${esc(R.describeFilters(r.filters, lang, shopsById()))}</span></button>` +
            `<button type="button" class="icon-btn sg-del" data-sg-del="${items.length}" aria-label="${esc(t('search.removeRecent'))}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg></button></div>`);
          items.push({ type: 'recent', filters: r.filters });
        }
      }
    } else {
      const terms = R.suggest(text, lang, 6);
      if (terms.length) {
        html.push(`<div class="sg-head"><span>${esc(t('search.suggestions'))}</span></div>`);
        for (const s of terms) {
          const hint = s.kind ? filterValueName(s.kind, s.id) : '';
          html.push(`<div class="sg-row"><button type="button" class="sg-item" role="option" data-sg="${items.length}"><span>${esc(s.text)}</span>` +
            (hint ? `<span class="sg-hint">${esc(hint)}</span>` : '') + '</button></div>');
          items.push({ type: 'term', text: s.text });
        }
      }
    }
    suggestItems = items;
    suggestActive = -1;
    el.innerHTML = html.join('');
    el.hidden = !items.length;
  }
  function hideSuggest() { $('#suggest').hidden = true; suggestActive = -1; }
  function pickSuggest(i) {
    const it = suggestItems[i];
    if (!it) return;
    hideSuggest();
    clearTimeout(qTimer);
    if (it.type === 'recent') {
      $('#q').value = it.filters.q || '';
      $('#q-clear').hidden = !it.filters.q;
      $('#q').blur();
      setFilters(Object.assign({}, it.filters));
    } else {
      $('#q').value = it.text + ' ';
      $('#q-clear').hidden = false;
      setFilters(filtersFromSearchBox(false), { fromBox: true });
      $('#q').focus();
    }
  }
  $('#q').addEventListener('focus', renderSuggest);
  $('#q').addEventListener('input', renderSuggest);
  $('#q').addEventListener('blur', () => setTimeout(() => { if (document.activeElement !== $('#q')) hideSuggest(); }, 150));
  $('#q').addEventListener('keydown', (e) => {
    if ($('#suggest').hidden || !suggestItems.length) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const n = suggestItems.length;
      suggestActive = e.key === 'ArrowDown' ? (suggestActive + 1) % n : (suggestActive - 1 + n) % n;
      $('#suggest').querySelectorAll('.sg-item').forEach((b, i) => b.setAttribute('aria-selected', String(i === suggestActive)));
    } else if (e.key === 'Enter' && suggestActive >= 0) {
      e.preventDefault();
      pickSuggest(suggestActive);
    } else if (e.key === 'Escape') {
      e.stopPropagation();
      hideSuggest();
    }
  });
  // mousedown zamiast click: inaczej pole traci fokus i lista znika, zanim kliknięcie dojdzie
  $('#suggest').addEventListener('mousedown', (e) => e.preventDefault());
  $('#suggest').addEventListener('click', (e) => {
    const del = e.target.closest('[data-sg-del]');
    if (del) { recent.remove(suggestItems[Number(del.dataset.sgDel)].filters); renderSuggest(); return; }
    if (e.target.closest('[data-sg-clear]')) { recent.clear(); renderSuggest(); return; }
    const b = e.target.closest('[data-sg]');
    if (b) pickSuggest(Number(b.dataset.sg));
  });

  // --- Włączone filtry: lista do przycisków grup i do „usuń jeden filtr” przy braku wyników ----------
  /** [{group, field, id, text}] — każdy ustawiony filtr z podpisem jak w arkuszu. */
  function activeChips(f) {
    const chips = [];
    const lang = I.getLang();
    const add = (group, field, id, text) => chips.push({ group, field, id, text });
    if (f.kind !== 'all') add('material', 'kind', f.kind, t('filters.kind.' + f.kind));
    for (const id of f.fibers) add('material', 'fibers', id, fiberName(id));
    if (f.purity) add('material', 'purity', '', f.purity === 100 ? t('filters.purity100') : t('filters.purityMin', f.purity));
    if (f.noSynthetic) add('material', 'noSynthetic', '', t('filters.noSynthetic'));
    for (const id of f.colors) { const c = R.COLORS.find((x) => x.id === id); if (c) add('colors', 'colors', id, c[lang] || c.en); }
    if (f.pattern) add('pattern', 'pattern', f.pattern, filterValueName('pattern', f.pattern));
    if (f.maxPrice) add('price', 'maxPrice', '', t('filters.upTo', f.maxPrice));
    if (f.minStock) add('stock', 'minStock', '', t('filters.fromStock', f.minStock));
    if (f.stockKnown) add('stock', 'stockKnown', '', t('filters.stockKnown'));
    if (f.weightMin != null || f.weightMax != null) {
      const preset = R.weightPreset(f.weightMin, f.weightMax);
      add('weight', 'weight', '', preset ? t('filters.weight.' + preset) : R.weightLabel(f.weightMin, f.weightMax));
    }
    if (f.minWidth) add('width', 'minWidth', '', t('filters.fromWidth', f.minWidth));
    for (const c of f.countries) add('shops', 'countries', c, countryName(c));
    const shopName = Object.fromEntries(source.shops.map((s) => [s.id, s.name]));
    for (const id of f.shops) add('shops', 'shops', id, shopName[id] || id);
    if (f.newDays) add('newDays', 'newDays', '', t('filters.new' + f.newDays));
    return chips;
  }
  /** Filtry bez jednego z nich (z activeChips). */
  function withoutChip(filters, c) {
    const f = Object.assign({}, filters);
    if (c.field === 'kind') f.kind = 'all';
    else if (c.field === 'weight') { f.weightMin = null; f.weightMax = null; }
    else if (c.field === 'noSynthetic' || c.field === 'stockKnown') f[c.field] = false;
    else if (Array.isArray(f[c.field])) f[c.field] = f[c.field].filter((x) => x !== c.id);
    else f[c.field] = null;   // pattern, purity, maxPrice, minWidth, minStock, newDays
    return R.normalizeFilters(f);
  }
  function renderActive() {
    $('#clear-filters').hidden = !R.countActive(state.filters);
  }
  function clearAllFilters() {
    setFilters(Object.assign(R.defaultFilters(), { q: state.filters.q, sort: state.filters.sort }));
  }
  $('#clear-filters').addEventListener('click', clearAllFilters);

  // --- Literówki: „Czy chodziło o…?” / „Wyniki dla…” ---------------------------------
  let spellerPromise = null;
  function getSpeller() {
    if (!spellerPromise) {
      spellerPromise = window.fetch('data/words.json').then((r) => (r.ok ? r.json() : [])).catch(() => [])
        .then((words) => R.makeSpeller(Array.isArray(words) ? words : []));
    }
    return spellerPromise;
  }
  const FEW_RESULTS = 5;
  /** Po wynikach z wpisanym tekstem: 0 wyników → od razu poprawione wyniki; mniej niż 5 → podpowiedź, gdy poprawka da więcej. */
  async function checkSpelling(seq, res) {
    const f = state.filters;
    if (!R.textQuery(f) || f.q === state.noSpellFor || res.total == null || res.total >= FEW_RESULTS) return;
    const speller = await getSpeller();
    const fixed = speller.correct(f.q);
    if (!fixed || seq !== state.seq) return;
    const cf = R.applySearchText(f, fixed, state.typed, true);
    if (res.total === 0) {
      const res2 = await source.search(cf.filters, 0);
      if (seq !== state.seq || !res2.items.length) return;
      const original = f.q;
      $('#q').value = fixed;
      state.typed = cf.typed;
      state.filters = cf.filters;
      saveFilters(); renderQuick(); renderFilterBadge(); renderActive();
      state.spell = { mode: 'showing', text: fixed, original };
      state.items = res2.items;
      state.total = res2.total;
      state.approx = res2.approx && res2.total != null && res2.total > 1000;
      state.hasMore = res2.hasMore != null ? res2.hasMore : res2.items.length === R.PAGE_SIZE;
      source.track('search', { query: fixed, detail: 'poprawka z: ' + original + '; wyniki ' + (res2.total == null ? '?' : res2.total) });
    } else {
      const n = await source.countNew(cf.filters, null);
      if (seq !== state.seq || !(n > res.total)) return;
      state.spell = { mode: 'suggest', text: fixed };
    }
    renderResults();
  }
  function renderSpell() {
    const el = $('#spell');
    const s = state.spell;
    el.hidden = !s;
    if (!s) { el.innerHTML = ''; return; }
    const link = (cls, text) => `<button type="button" class="link-btn ${cls}">${esc(text)}</button>`;
    el.innerHTML = s.mode === 'showing'
      ? `${esc(t('search.showingFor'))} <strong>${esc(s.text)}</strong>. ${esc(t('search.insteadFor'))} ${link('spell-original', (I.getLang() === 'pl' ? '„' : '“') + s.original + (I.getLang() === 'pl' ? '”' : '”'))}`
      : `${esc(t('search.didYouMean'))} ${link('spell-fix', s.text)}?`;
  }
  $('#spell').addEventListener('click', (e) => {
    const s = state.spell;
    if (!s) return;
    if (e.target.closest('.spell-fix')) {
      $('#q').value = s.text;
      setFilters(filtersFromSearchBox(true, s.text), { fromBox: true });
    } else if (e.target.closest('.spell-original')) {
      state.noSpellFor = s.original;   // „szukaj jednak tak, jak wpisałam”
      $('#q').value = s.original;
      setFilters(filtersFromSearchBox(true, s.original), { fromBox: true });
    }
  });

  async function runSearch(reset) {
    const seq = ++state.seq;
    if (reset) { state.page = 0; state.items = []; state.total = null; }
    state.loading = true;
    state.error = false;
    renderResults();
    try {
      const res = await source.search(state.filters, state.page);
      if (seq !== state.seq) return;
      if (reset && (state.filters.q || R.countActive(state.filters))) {
        source.track('search', { query: state.filters.q || null, detail: 'wyniki ' + (res.total == null ? '?' : res.total) + '; filtry ' + R.countActive(state.filters) });
      }
      state.items = reset ? res.items : state.items.concat(res.items);
      state.total = res.total;
      state.approx = res.approx && res.total != null && res.total > 1000;
      state.hasMore = res.hasMore != null ? res.hasMore : res.items.length === R.PAGE_SIZE;
      if (reset && !state.spell) {
        const spelled = checkSpelling(seq, res).catch(() => {});
        if (!res.items.length) await spelled;   // bez wyników: zamiast pustej strony od razu poprawione wyniki
      }
      if (reset && seq === state.seq) maybeNudge();
    } catch (e) {
      if (seq !== state.seq) return;
      state.error = true;
    } finally {
      if (seq === state.seq) { state.loading = false; renderResults(); if (reset) loadSideCounts(); }
    }
  }

  /** „zostało 25 m” (bez powtarzania długości jedynego kuponu, którą pokazuje cena). */
  function stockText(p) {
    if (p.stock_m == null) return '';
    const s = Number(p.stock_m);
    if (p.price_unit === 'piece' && p.piece_length_m && Math.abs(s - Number(p.piece_length_m)) < 0.01) return '';
    return t('card.stock', s);
  }
  // Mało metrów (do 3 m): napis na zdjęciu, bo przy deadstocku ilość decyduje, czy projekt się zmieści
  const LOW_STOCK_M = 3;
  function lowStock(p) { const st = stockText(p); return st && Number(p.stock_m) <= LOW_STOCK_M ? st : ''; }
  function labelLine(p) {
    const bits = [];
    const comp = R.compositionText(p, I.getLang());
    if (comp) bits.push(comp);
    if (p.width_cm) bits.push(Math.round(p.width_cm) + ' cm');
    if (p.weight_gsm) bits.push(Math.round(p.weight_gsm) + ' g/m²');
    const st = stockText(p);
    if (st && !lowStock(p)) bits.push(st);
    return bits.join(' · ');
  }
  /** Cena na karcie: za metr w euro (sklepy z innych krajów: ≈ przeliczona, oryginał w szczegółach);
   *  bez znanej jednostki: „Cena w sklepie” bez liczby (mała liczba za 10 cm myliła się z ceną za metr). */
  function cardPrice(p) {
    const pr = R.priceParts(p, I.getLang());
    let price;
    if (pr.unit === 'per_m') {
      const main = pr.eur ? '≈ ' + pr.eur : pr.main;
      price = `${esc(main)}<small>${esc(t('card.perM'))}</small>` + (pr.piece ? ` <small>· ${esc(t('card.piece', pr.piece))}</small>` : '');
    } else if (pr.unit === 'leather') price = `${esc(pr.main)} <small>${esc(t('card.priceUnknown'))}</small>`;
    else price = `<span class="see-shop">${esc(t('card.priceSeeShop'))}</span>`;
    if (pr.plusVat && pr.unit === 'per_m') price += ` <small class="vat">${esc(t('price.plusVat'))}</small>`;
    return price;
  }

  function cardHtml(p, opts) {
    const o = opts || {};
    const shop = source.shopById(p.shop_id);
    const price = cardPrice(p);
    // w wynikach przy filtrze koloru: zdjęcie wariantu w tym kolorze (ulubione: zdjęcie główne)
    const src = R.pickImage(p, o.favorites ? null : state.filters);
    const img = src
      ? `<img src="${esc(R.imageUrl(src, 480))}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">`
      : `<span class="noimg">Remna</span>`;
    const isGone = o.gone || liveGone(p.id);
    const gone = isGone ? `<span class="flag gone">${esc(t('fav.gone'))}</span>` : (isNew(p) ? `<span class="flag">${esc(t('card.new'))}</span>` : '');
    const low = !isGone && p.kind !== 'leather' ? lowStock(p) : '';
    const label = labelLine(p);
    return `<article class="card" data-id="${esc(p.id)}" tabindex="0" aria-label="${esc(R.displayTitle(p.title))}">
      <div class="ph">${img}${gone}${low ? `<span class="flag low">${esc(low)}</span>` : ''}
        <button type="button" class="fav" data-fav="${esc(p.id)}" aria-pressed="${favorites.has(p.id)}" aria-label="${esc(t('detail.save'))}">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/></svg>
        </button>
      </div>
      <div class="title">${esc(R.displayTitle(p.title))}</div>
      <div class="price">${price}</div>
      <div class="shop">${esc(shop ? shop.name : p.shop_id)}${shop && shop.country ? ' · ' + esc(countryName(shop.country)) : ''}</div>
      ${label ? `<div class="label">${esc(label)}</div>` : ''}
    </article>`;
  }

  function skeletons(n) {
    return Array.from({ length: n }, () => '<div class="card skeleton" aria-hidden="true"><div class="ph"></div><div class="bar" style="width:90%"></div><div class="bar" style="width:40%"></div></div>').join('');
  }

  function renderResults() {
    const el = $('#results');
    el.setAttribute('aria-busy', state.loading ? 'true' : 'false');
    renderSpell();
    if (state.error && !state.items.length) {
      el.innerHTML = `<div class="empty"><strong>${esc(t('results.error'))}</strong><button type="button" class="ghost-btn" id="retry">${esc(t('results.retry'))}</button></div>`;
      $('#retry').onclick = () => runSearch(true);
      $('#result-count').textContent = '';
      $('#load-more').hidden = true;
      return;
    }
    if (!state.items.length && state.loading) {
      el.innerHTML = skeletons(6);
      $('#result-count').textContent = t('results.loading');
      $('#load-more').hidden = true;
      return;
    }
    if (!state.items.length) {
      // Puste wyniki: z filtrami → „usuń jeden filtr” (z liczbą wyników bez niego); zawsze: „Daj znać, gdy się pojawi”
      const alertCta = `<div class="empty-alert"><button type="button" class="primary-btn" id="empty-alert">` +
        `${BELL}<span>${esc(t('results.alertCta'))}</span></button><p>${esc(t('results.alertCtaHint'))}</p></div>`;
      if (R.countActive(state.filters)) {
        el.innerHTML = `<div class="empty"><strong>${esc(t('results.emptyFilters'))}</strong>` +
          `<div class="relax" id="relax" hidden><p>${esc(t('results.relaxLead'))}</p><div class="relax-list"></div></div>` +
          `<button type="button" class="ghost-btn" id="empty-clear">${esc(t('results.clearFilters'))}</button>${alertCta}</div>`;
        $('#empty-clear').onclick = clearAllFilters;
        loadRelax(state.seq);
      } else if (state.filters.q) {
        el.innerHTML = `<div class="empty"><strong>${esc(t('results.emptyQuery', state.filters.q))}</strong>${esc(t('results.emptyQueryHint'))}${alertCta}</div>`;
      } else {
        el.innerHTML = `<div class="empty"><strong>${esc(t('results.empty'))}</strong>${esc(t('results.emptyHint'))}</div>`;
      }
      if ($('#empty-alert')) $('#empty-alert').onclick = saveAlert;
      $('#result-count').textContent = t('results.count', 0);
      $('#load-more').hidden = true;
      return;
    }
    // przed pierwszą ofertą bez części wybranych cech: podpis (całą szerokością siatki)
    el.innerHTML = state.items.map((p, i) => (p._unknown && !(i && state.items[i - 1]._unknown)
      ? `<p class="unknown-divider">${esc(t('results.unknownDivider'))}</p>` : '') + cardHtml(p)).join('') + (state.loading ? skeletons(2) : '');
    $('#result-count').textContent = state.total == null ? '' : (state.approx ? t('results.countApprox', state.total) : t('results.count', state.total));
    $('#load-more').hidden = state.loading || !state.hasMore;
  }

  const BELL = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15z"/><path d="M10 20a2 2 0 0 0 4 0"/></svg>';
  /** Brak wyników: dla każdego ustawionego filtra liczba ofert bez niego (najwięcej na górze, bez zer). */
  async function loadRelax(seq) {
    const f = state.filters;
    const chips = activeChips(f).slice(0, 8);
    const counts = await Promise.all(chips.map((c) => source.countNew(withoutChip(f, c), null).catch(() => 0)));
    if (seq !== state.seq || !$('#relax')) return;
    const rows = chips.map((c, i) => ({ c, n: counts[i] })).filter((x) => x.n > 0).sort((a, b) => b.n - a.n);
    if (!rows.length) return;
    $('#relax .relax-list').innerHTML = rows.map(({ c, n }, i) =>
      `<button type="button" class="relax-item" data-relax="${i}"><span>✕ ${esc(c.text)}</span><em>${esc(t('results.count', n))}</em></button>`).join('');
    $('#relax').hidden = false;
    $('#relax').onclick = (e) => {
      const b = e.target.closest('[data-relax]');
      if (b) setFilters(withoutChip(f, rows[Number(b.dataset.relax)].c));
    };
  }

  $('#load-more').addEventListener('click', () => { state.page += 1; runSearch(false); });

  // Kliknięcia w karty (wyniki i ulubione)
  function onGridClick(e) {
    const favBtn = e.target.closest('[data-fav]');
    if (favBtn) {
      e.stopPropagation();
      const id = favBtn.dataset.fav;
      const p = state.items.find((x) => x.id === id) || favorites.list().find((x) => x.id === id);
      if (p) toggleFavorite(p);
      return;
    }
    const card = e.target.closest('.card[data-id]');
    if (card) openDetail(card.dataset.id);
  }
  $('#results').addEventListener('click', onGridClick);
  $('#fav-list').addEventListener('click', onGridClick);
  function onGridKey(e) {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('.card[data-id]')) {
      e.preventDefault();
      openDetail(e.target.dataset.id);
    }
  }
  $('#results').addEventListener('keydown', onGridKey);
  $('#fav-list').addEventListener('keydown', onGridKey);

  function toggleFavorite(p) {
    const on = favorites.toggle(p);
    if (on) source.track('fav_add', { product_id: p.id, shop_id: p.shop_id });
    document.querySelectorAll(`[data-fav="${CSS.escape(p.id)}"]`).forEach((b) => b.setAttribute('aria-pressed', on));
    if (state.detailId === p.id) $('#detail-fav').setAttribute('aria-pressed', on);
    toast(t(on ? 'toast.favAdded' : 'toast.favRemoved'));
    if (state.view === 'favorites') renderFavorites();
  }

  // --- Szczegóły oferty -------------------------------------------------------
  let detailProduct = null;
  // Wynik sprawdzenia w sklepie na czas tej sesji: id -> {s: 'available'|'soldout'|'gone'|null, at}
  const liveStatus = {};
  const LIVE_TTL = 5 * 60 * 1000;
  function liveGone(id) { const x = liveStatus[id]; return !!x && (x.s === 'soldout' || x.s === 'gone'); }
  function renderLive(id) {
    const el = $('#detail-live');
    if (!el || state.detailId !== id) return;
    const x = liveStatus[id];
    const s = x && 's' in x ? x.s : 'checking';
    if (s === null) { el.hidden = true; return; }
    el.hidden = false;
    el.className = 'live live-' + s;
    el.textContent = t('live.' + s);
    placeRelated(id);
  }
  async function verifyLive(p) {
    const id = p.id;
    const prev = liveStatus[id];
    if (prev && prev.pending) return;
    if (prev && 's' in prev && Date.now() - prev.at < LIVE_TTL) { renderLive(id); return; }
    liveStatus[id] = { pending: true, at: Date.now() };
    renderLive(id);
    const s = await source.checkLive(p);
    liveStatus[id] = { s, at: Date.now() };
    renderLive(id);
    if (s === null) return;
    if (favorites.has(id)) {
      favorites.update(s === 'available' ? { id, available: true, removed_at: null }
        : { id, available: false, removed_at: s === 'gone' ? new Date().toISOString() : null });
    }
    if (s !== 'available') {
      const card = document.querySelector(`#results .card[data-id="${CSS.escape(id)}"]`);
      const item = state.items.find((x) => x.id === id);
      if (card && item) card.outerHTML = cardHtml(item);
      if (state.view === 'favorites') renderFavorites();
    }
  }
  async function openDetail(id, opts) {
    const o = opts || {};
    if (WEB && !o.fromHistory) {
      try { history[o.replace ? 'replaceState' : 'pushState']({ o: id }, '', pageUrl({ o: id })); } catch (e) { /* bez historii */ }
    }
    hideIntro();
    if (R.isSearch(state.filters)) recent.add(state.filters);   // wyszukiwanie, z którego coś otwarto, warto pamiętać
    const quick = state.items.find((x) => x.id === id) || favorites.list().find((x) => x.id === id) || relatedItems.get(id);
    source.track('detail', { product_id: id, shop_id: id.split(':')[0] });
    state.detailId = id;
    detailProduct = quick || null;
    if (quick) { renderDetail(quick); verifyLive(quick); }
    $('#detail').hidden = false;
    document.body.style.overflow = 'hidden';
    try {
      const full = await source.details(id);
      if (full && state.detailId === id) {
        detailProduct = full;
        renderDetail(full);
        favorites.update(slim(full));
        if (!quick) verifyLive(full);
      }
    } catch (e) { /* zostaje szybki podgląd */ }
  }
  function slim(p) {
    const o = {};
    for (const k of R.LIST_FIELDS.split(',')) o[k] = p[k];
    o.removed_at = p.removed_at || null;
    return o;
  }

  function renderDetail(p) {
    const lang = I.getLang();
    const shop = source.shopById(p.shop_id);
    const pr = R.priceParts(p, lang);
    let priceHtml;
    if (pr.unit === 'per_m') {
      priceHtml = `<div class="big">${esc(pr.main)} <small>${esc(t('detail.perM'))}</small>${pr.plusVat ? ` <small class="vat">${esc(t('price.plusVat'))}</small>` : ''}</div>`;
      if (pr.piece) priceHtml += `<div class="sub">${esc(t('detail.piece', pr.piece, pr.total))}</div>`;
      if (pr.eur) priceHtml += `<div class="sub">${esc(t('detail.perMEur', pr.eur))}</div>`;
    } else {
      priceHtml = `<div class="sub">${esc(t('detail.priceFrom'))}</div><div class="big">${esc(pr.main)}${pr.plusVat ? ` <small class="vat">${esc(t('price.plusVat'))}</small>` : ''}</div>`;
      if (p.kind !== 'leather') priceHtml += `<div class="sub">${esc(t('detail.priceUnknownUnit'))}</div>`;
    }
    const comp = R.compositionText(p, lang);
    const missing = `<span class="missing">${esc(t('detail.unknown'))}</span>`;
    const rows = [
      [t('detail.composition'), comp ? esc(comp) : (p.kind === 'leather' ? esc(t('detail.leather')) : missing)],
      [t('detail.pattern'), p.pattern ? esc(t(p.pattern === 'plain' ? 'detail.patternPlain' : 'detail.patternPatterned')) : missing],
      [t('detail.width'), p.width_cm ? esc(Math.round(p.width_cm) + ' cm') : missing],
      [t('detail.weight'), p.weight_gsm ? esc(Math.round(p.weight_gsm) + ' g/m²') : missing],
      [t('detail.stock'), p.stock_m != null ? esc(t('detail.stockValue', Number(p.stock_m))) : (p.kind === 'leather' ? esc(t('detail.stockLeather')) : missing)],
      [t('detail.shop'), shop ? esc(shop.name + (shop.country ? ' · ' + countryName(shop.country) : '')) : esc(p.shop_id)],
    ];
    if (p.first_seen_at) rows.push([t('detail.firstSeen'), esc(fmtDate(p.first_seen_at))]);
    const heroSrc = R.pickImage(p, state.view === 'search' ? state.filters : null);
    const img = heroSrc ? `<img src="${esc(R.imageUrl(heroSrc, 1200))}" alt="" referrerpolicy="no-referrer">` : '';
    $('#detail-body').innerHTML = `
      <div class="detail-hero">${img}</div>
      <div class="detail-main">
        <div>
          <h1>${esc(R.displayTitle(p.title))}</h1>
          <div class="detail-shop">${shop ? esc(shop.name) : ''}</div>
        </div>
        <p class="live" id="detail-live" role="status" hidden></p>
        <div class="price-box">${priceHtml}</div>
        <dl class="specs">${rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${v}</dd>`).join('')}</dl>
        ${''/* opisu sklepu nie pokazujemy: to tekst sklepu (prawo autorskie); pełny opis jest pod „View in shop” */}
        <p class="open-note">${esc(t('detail.openNote'))}</p>
        <div class="related" id="detail-related"></div>
      </div>`;
    loadRelated(p);
    $('#detail-open').href = R.shopUrl(p.url, N.isNative ? 'android' : 'web');
    $('#detail-fav').setAttribute('aria-pressed', favorites.has(p.id));
    $('#detail-body').scrollTop = 0;
    renderLive(p.id);
  }
  // Pod ofertą: podobne tkaniny i więcej z tego sklepu (gdy oferta wyprzedana, podobne idą na górę)
  const relatedCache = new Map();   // id oferty -> Promise<{similar, shop}>
  const relatedItems = new Map();   // id -> oferta z pasków (żeby otworzyć ją od razu)
  function loadRelated(p) {
    if (!relatedCache.has(p.id)) {
      relatedCache.set(p.id, Promise.all([
        source.similar(p).catch(() => []),
        source.fromShop(p).catch(() => []),
      ]).then(([similar, shop]) => ({ similar, shop })));
      if (relatedCache.size > 30) relatedCache.delete(relatedCache.keys().next().value);
    }
    relatedCache.get(p.id).then((r) => {
      if (state.detailId !== p.id || !$('#detail-related')) return;
      const shop = source.shopById(p.shop_id);
      const strip = (title, list) => (list.length ? `<section class="strip"><h2>${esc(title)}</h2><div class="strip-row">` +
        list.map((x) => {
          relatedItems.set(x.id, x);
          const src = R.pickImage(x, null);
          return `<button type="button" class="rel-card" data-open="${esc(x.id)}">` +
            `<span class="rel-ph">${src ? `<img src="${esc(R.imageUrl(src, 240))}" alt="" loading="lazy" referrerpolicy="no-referrer">` : ''}</span>` +
            `<span class="rel-price">${cardPrice(x)}</span><span class="rel-title">${esc(R.displayTitle(x.title))}</span></button>`;
        }).join('') + '</div></section>' : '');
      $('#detail-related').innerHTML = strip(t('detail.similar'), r.similar) + strip(t('detail.moreFrom', shop ? shop.name : p.shop_id), r.shop);
      placeRelated(p.id);
    });
  }
  /** Wyprzedana albo zniknęła: podobne tkaniny zaraz pod nazwą, zamiast na dole. */
  function placeRelated(id) {
    const rel = $('#detail-related');
    const box = document.querySelector('#detail-body .price-box');
    if (!rel || !box) return;
    if (liveGone(id)) box.parentNode.insertBefore(rel, box);
  }
  $('#detail-body').addEventListener('click', (e) => {
    const b = e.target.closest('[data-open]');
    if (b) openDetail(b.dataset.open, { replace: true });
  });

  function closeDetail(opts) {
    const wasOpen = !$('#detail').hidden;
    $('#detail').hidden = true;
    document.body.style.overflow = '';
    state.detailId = null;
    if (WEB && wasOpen && !(opts && opts.fromHistory)) {
      if (history.state && history.state.o) history.back();   // wraca do listy (popstate niżej nic już nie robi)
      else syncUrl();
    }
  }
  $('#detail-close').addEventListener('click', () => closeDetail());
  if (WEB) {
    window.addEventListener('popstate', (e) => {
      const id = e.state && e.state.o;
      if (!id && !$('#detail').hidden) closeDetail({ fromHistory: true });
      else if (id && $('#detail').hidden) openDetail(id, { fromHistory: true });
    });
  }
  // Udostępnij: systemowe okno udostępniania (telefon) albo skopiowanie linku
  $('#detail-share').addEventListener('click', async () => {
    if (!detailProduct) return;
    const url = offerLink(detailProduct.id);
    const title = R.displayTitle(detailProduct.title);
    source.track('share', { product_id: detailProduct.id, shop_id: detailProduct.shop_id });
    if (navigator.share) {
      try { await navigator.share({ title, text: t('share.text', title), url }); return; } catch (e) { if (e && e.name === 'AbortError') return; }
    }
    try { await navigator.clipboard.writeText(url); toast(t('toast.linkCopied')); }
    catch (e) { window.prompt(t('share.copyPrompt'), url); }
  });
  $('#detail-fav').addEventListener('click', () => { if (detailProduct) toggleFavorite(slim(detailProduct)); });
  $('#detail-open').addEventListener('click', (e) => {
    e.preventDefault();
    if (detailProduct) {
      source.track('shop_click', { product_id: detailProduct.id, shop_id: detailProduct.shop_id });
      N.openExternal(R.shopUrl(detailProduct.url, N.isNative ? 'android' : 'web'));
    }
  });

  // --- Arkusz filtrów -----------------------------------------------------------
  /** n = liczba ofert z tą opcją (szara opcja przy 0, chyba że wybrana); null = bez liczby. */
  function chip(attr, value, label, pressed, extra, disabled, n) {
    const off = disabled || (n === 0 && !pressed);
    const count = n != null ? `<span class="n">${esc(I.fmtNum(n, I.getLang()))}</span>` : '';
    return `<button type="button" class="chip" data-${attr}="${esc(value)}" aria-pressed="${pressed}"${off ? ' disabled' : ''}>${extra || ''}${esc(label)}${count}</button>`;
  }
  // Arkusz filtrów: najczęściej używane filtry na górze, objaśnienia schowane pod (i), długie listy skrócone („+ N więcej”).
  const FIBER_TOP = ['silk', 'wool', 'linen', 'cotton', 'viscose', 'cashmere', 'polyester'];
  const COLOR_TOP = ['black', 'white', 'cream', 'beige', 'grey', 'blue', 'green', 'red'];
  const openInfo = new Set();     // grupy z rozwiniętym objaśnieniem
  const expanded = new Set();     // grupy z rozwiniętą pełną listą
  const INFO_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><path d="M12 7.6v.1"/></svg>';
  /** Nagłówek grupy: tytuł, opcjonalnie (i) z objaśnieniem i „Zaznacz wszystkie”; pod nim objaśnienie, gdy rozwinięte. */
  function groupHead(titleKey, opts = {}) {
    const id = opts.id || titleKey;
    const open = openInfo.has(id);
    const info = opts.info ? `<button type="button" class="info-btn" data-info="${esc(id)}" aria-expanded="${open}" aria-label="${esc(t('filters.about'))}">${INFO_ICON}</button>` : '';
    let sel = '';
    if (opts.selectAll) {
      const { field, ids, selected } = opts.selectAll;
      const all = ids.length > 0 && ids.every((x) => selected.includes(x));
      sel = `<button type="button" class="text-btn small" data-selectall="${field}" data-ids="${esc(ids.join(','))}" data-on="${all ? '0' : '1'}">` +
        `${esc(t(all ? 'filters.selectNone' : 'filters.selectAll'))}</button>`;
    }
    return `<div class="fgroup-head"><div class="fgroup-title"><h3>${esc(t(titleKey))}</h3>${info}</div>${sel}</div>` +
      (opts.info && open ? `<p class="hint">${esc(opts.info)}</p>` : '');
  }
  /** Lista z najczęstszymi pozycjami na początku; reszta po „+ N więcej” (zaznaczone są zawsze widoczne). */
  function shortList(id, items, top, isOn, render) {
    const isOpen = expanded.has(id);
    const first = top.map((k) => items.find((x) => x.id === k)).filter(Boolean);
    const rest = items.filter((x) => !top.includes(x.id));
    const shown = isOpen ? first.concat(rest) : first.concat(rest.filter(isOn));
    const hidden = rest.length - rest.filter(isOn).length;
    const more = isOpen ? `<button type="button" class="chip more-chip" data-expand="${id}">${esc(t('filters.less'))}</button>`
      : hidden > 0 ? `<button type="button" class="chip more-chip" data-expand="${id}">${esc(t('filters.moreN', hidden))}</button>` : '';
    return shown.map(render).join('') + more;
  }

  // Suwak gramatury: przesuwanie nie przerysowuje grup (żeby nie zgubić uchwytu), tylko podpis i wypełnienie.
  // root = arkusz albo kolumna z filtrami (suwak może być w obu naraz, więc bez id).
  let weightCustomOpen = false;
  function syncWeightSlider(root, changed) {
    const lo = root.querySelector('.w-min'), hi = root.querySelector('.w-max');
    if (!lo || !hi) return null;
    const W_MAX = R.WEIGHT_SLIDER_MAX, STEP = R.WEIGHT_STEP;
    let a = Number(lo.value), b = Number(hi.value);
    if (a > b - STEP) { if (changed === lo) a = b - STEP; else b = a + STEP; }
    a = Math.max(0, a); b = Math.min(W_MAX, b);
    lo.value = a; hi.value = b;
    root.querySelector('.w-fill').style.left = (a / W_MAX * 100) + '%';
    root.querySelector('.w-fill').style.right = ((W_MAX - b) / W_MAX * 100) + '%';
    const min = a > 0 ? a : null, max = b < W_MAX ? b : null;
    root.querySelector('.w-label').textContent = R.weightLabel(min, max) || ('0–' + W_MAX + '+ g/m²');
    // na wierzchu ten uchwyt, którym ostatnio ruszano (gdy oba są w jednym miejscu)
    lo.style.zIndex = changed === lo ? 3 : 2; hi.style.zIndex = changed === hi ? 3 : 2;
    return { min, max };
  }

  /**
   * Grupy filtrów jako HTML. only = jedna grupa (mały arkusz) albo null (wszystkie).
   * counts = wynik source.facetCounts (liczby przy opcjach; 0 = opcja wyszarzona) albo null.
   */
  function filterGroupsHtml(f, only, counts) {
    const lang = I.getLang();
    const show = (g) => !only || only === g;
    const cnt = (facet, key) => (counts && counts[facet] ? (counts[facet][key] || 0) : null);
    const html = [];
    if (show('material')) {
      html.push(`<div class="fgroup">${groupHead('filters.kind')}<div class="chips">` +
        ['all', 'fabric', 'leather'].map((k) => chip('kind', k, t('filters.kind.' + k), f.kind === k, '', false, k === 'all' ? null : cnt('kind', k))).join('') + '</div></div>');
      const fibers = R.FIBERS.filter((x) => x.id !== 'leather');
      html.push(`<div class="fgroup">${groupHead('filters.fibers', { selectAll: { field: 'fibers', ids: fibers.map((x) => x.id), selected: f.fibers } })}<div class="chips">` +
        shortList('fibers', fibers, FIBER_TOP, (x) => f.fibers.includes(x.id), (x) => chip('fiber', x.id, x[lang] || x.en, f.fibers.includes(x.id), '', false, cnt('fibers', x.id))) + '</div></div>');
    }
    if (show('colors')) {
      html.push(`<div class="fgroup">${groupHead('filters.colors', { info: t('filters.colorsNote'), selectAll: { field: 'colors', ids: R.COLORS.map((c) => c.id), selected: f.colors } })}<div class="chips">` +
        shortList('colors', R.COLORS, COLOR_TOP, (c) => f.colors.includes(c.id),
          (c) => chip('color', c.id, c[lang] || c.en, f.colors.includes(c.id), `<span class="dot" style="background:${c.hex}"></span>`, false, cnt('colors', c.id))) + '</div></div>');
    }
    if (show('price')) {
      html.push(`<div class="fgroup">${groupHead('filters.maxPrice', { info: t('filters.priceNote') })}<div class="chips">` +
        chip('price', '', t('filters.any'), !f.maxPrice) +
        R.MAX_PRICE_STEPS.map((v) => chip('price', v, t('filters.upTo', v), f.maxPrice === v, '', false, cnt('price', v))).join('') + '</div></div>');
    }
    if (show('pattern')) {
      html.push(`<div class="fgroup">${groupHead('filters.pattern', { info: t('filters.patternNote') })}<div class="chips">` +
        chip('pattern', '', t('filters.patternAny'), !f.pattern) +
        chip('pattern', 'plain', t('filters.patternPlain'), f.pattern === 'plain', '', false, cnt('pattern', 'plain')) +
        chip('pattern', 'patterned', t('filters.patternPatterned'), f.pattern === 'patterned', '', false, cnt('pattern', 'patterned')) + '</div></div>');
    }
    if (show('weight')) {
      // Gramatura (g/m²): gotowe przedziały albo własny zakres suwakiem
      const wSet = f.weightMin != null || f.weightMax != null;
      const wPreset = R.weightPreset(f.weightMin, f.weightMax);
      const wCustom = weightCustomOpen || (wSet && !wPreset);
      const W_MAX = R.WEIGHT_SLIDER_MAX;
      html.push(`<div class="fgroup weight-group">${groupHead('filters.weight', { info: t('filters.weightNote') })}<div class="chips">` +
        chip('weight', '', t('filters.any'), !wSet && !weightCustomOpen) +
        Object.keys(R.WEIGHT_RANGES).map((k) => chip('weight', k, t('filters.weight.' + k), !wCustom && wPreset === k, '', false, cnt('weight', k))).join('') +
        chip('weight', 'custom', t('filters.weight.custom'), wCustom) +
        `</div>` +
        (wCustom ? `<div class="wrange-box">
          <div class="wrange-label w-label">${esc(R.weightLabel(f.weightMin, f.weightMax) || '0–' + W_MAX + '+ g/m²')}</div>
          <div class="wrange">
            <div class="wtrack"><div class="wfill w-fill"></div></div>
            <input type="range" class="w-min" min="0" max="${W_MAX}" step="${R.WEIGHT_STEP}" value="${f.weightMin || 0}" aria-label="${esc(t('filters.weightMinAria'))}">
            <input type="range" class="w-max" min="0" max="${W_MAX}" step="${R.WEIGHT_STEP}" value="${f.weightMax == null ? W_MAX : f.weightMax}" aria-label="${esc(t('filters.weightMaxAria'))}">
          </div>
          <div class="wrange-scale"><span>0</span><span>200</span><span>400</span><span>${W_MAX}+</span></div>
        </div>` : '') + '</div>');
    }
    if (show('width')) {
      html.push(`<div class="fgroup">${groupHead('filters.minWidth')}<div class="chips">` +
        chip('width', '', t('filters.anyWidth'), !f.minWidth) +
        R.MIN_WIDTH_STEPS.map((v) => chip('width', v, t('filters.fromWidth', v), f.minWidth === v, '', false, cnt('width', v))).join('') + '</div></div>');
    }
    if (show('material')) {
      // Skład: udział wybranego materiału i „bez syntetyków” (bez materiału: krótka wskazówka zostaje widoczna)
      const purityOff = !f.fibers.length;
      html.push(`<div class="fgroup">${groupHead('filters.composition', { info: t('filters.compositionNote') })}` +
        (purityOff ? `<p class="hint">${esc(t('filters.purityPick'))}</p>` : '') +
        `<div class="chips${purityOff ? ' disabled' : ''}">` +
        chip('purity', '', t('filters.purityAny'), !f.purity, '', purityOff) +
        R.PURITY_STEPS.map((v) => chip('purity', v, v === 100 ? t('filters.purity100') : t('filters.purityMin', v), f.purity === v, '', purityOff)).join('') +
        `</div><div class="chips">` + chip('nosynth', '1', t('filters.noSynthetic'), f.noSynthetic) + '</div></div>');
    }
    if (show('stock')) {
      html.push(`<div class="fgroup">${groupHead('filters.minStock', { info: t('filters.stockNote') })}<div class="chips">` +
        chip('stock', '', t('filters.any'), !f.minStock) +
        R.MIN_STOCK_STEPS.map((v) => chip('stock', v, t('filters.fromStock', v), f.minStock === v, '', false, cnt('stock', v))).join('') +
        `</div><div class="chips">` + chip('stockknown', '1', t('filters.stockKnown'), f.stockKnown) + '</div></div>');
    }
    if (show('newDays')) {
      html.push(`<div class="fgroup">${groupHead('filters.newDays')}<div class="chips">` +
        chip('new', '', t('filters.newAny'), !f.newDays) +
        [1, 7, 30].map((d) => chip('new', d, t('filters.new' + d), f.newDays === d, '', false, cnt('newDays', d))).join('') + '</div></div>');
    }
    if (show('shops')) {
      // Sklepy pogrupowane według krajów: kraj = wszystkie jego sklepy (także przyszłe), wybory się sumują
      const byCountry = source.shopsByCountry;
      const countries = Object.keys(byCountry).sort((a, b) => countryName(a).localeCompare(countryName(b)));
      const shopName = Object.fromEntries(source.shops.map((s) => [s.id, s.name]));
      const grouped = new Set(countries.flatMap((c) => byCountry[c] || []));
      const loose = source.shops.filter((s) => !grouped.has(s.id)).map((s) => s.id);
      const shopCount = (id) => cnt('shops', id);
      const shopChips = (ids, whole) => ids.slice().sort((a, b) => (shopName[a] || a).localeCompare(shopName[b] || b))
        .map((id) => chip('shop', id, shopName[id] || id, whole || f.shops.includes(id), '', false, shopCount(id))).join('');
      html.push(`<div class="fgroup">${groupHead('filters.shops')}` +
        `<div class="chips">${chip('shop', '', t('filters.anyShop'), !f.countries.length && !f.shops.length)}</div>` +
        countries.map((c) => {
          const on = f.countries.includes(c);
          const ids = byCountry[c] || [];
          const n = counts && counts.shops ? ids.reduce((s, id) => s + (counts.shops[id] || 0), 0) : null;
          // nazwy sklepów schowane, dopóki ktoś ich nie rozwinie (albo nie wybrał pojedynczego sklepu z tego kraju)
          const open = expanded.has('country:' + c) || ids.some((id) => f.shops.includes(id));
          return `<div class="shop-country"><div class="country-row"><button type="button" class="country-head" data-country="${esc(c)}" aria-pressed="${on}">` +
            `<span class="tick" aria-hidden="true"></span>${esc(countryName(c))}${n != null ? `<span class="n">${esc(I.fmtNum(n, lang))}</span>` : ''}</button>` +
            `<button type="button" class="text-btn small" data-expand="country:${esc(c)}" aria-expanded="${open}">` +
            `${esc(open ? t('filters.less') : t('filters.showShops', ids.length))}</button></div>` +
            (open ? `<div class="chips">${shopChips(ids, on)}</div>` : '') + '</div>';
        }).join('') +
        (loose.length ? `<div class="chips">${shopChips(loose, false)}</div>` : '') +
        '</div>');
    }
    return html.join('');
  }

  /**
   * Kliknięcie w grupach filtrów (arkusz albo kolumna). Zwraca {f} z nowymi filtrami, {redraw: true} gdy zmienił się
   * tylko wygląd (rozwinięcie listy, objaśnienie, własny zakres gramatury) albo null.
   */
  function filterClick(e, filters) {
    const f = Object.assign({}, filters);
    const sa = e.target.closest('[data-selectall]');
    if (sa) {
      f[sa.dataset.selectall] = sa.dataset.on === '1' ? sa.dataset.ids.split(',').filter(Boolean) : [];
      return { f: R.normalizeFilters(f) };
    }
    const ib = e.target.closest('[data-info]');
    const xb = e.target.closest('[data-expand]');
    if (ib || xb) {
      const [set, key] = ib ? [openInfo, ib.dataset.info] : [expanded, xb.dataset.expand];
      if (set.has(key)) set.delete(key); else set.add(key);
      return { redraw: true, focusInfo: ib ? key : null };
    }
    const ch = e.target.closest('.country-head');
    if (ch) return { f: R.normalizeFilters(R.toggleCountry(f, ch.dataset.country, source.shopsByCountry)) };
    const b = e.target.closest('.chip');
    if (!b || b.disabled) return null;
    const toggle = (arr, v) => (arr.includes(v) ? arr.filter((x) => x !== v) : arr.concat(v));
    if (b.dataset.kind) f.kind = b.dataset.kind;
    else if (b.dataset.fiber) f.fibers = toggle(f.fibers, b.dataset.fiber);
    else if ('purity' in b.dataset) f.purity = b.dataset.purity ? Number(b.dataset.purity) : null;
    else if (b.dataset.nosynth) f.noSynthetic = !f.noSynthetic;
    else if ('stock' in b.dataset) f.minStock = b.dataset.stock ? Number(b.dataset.stock) : null;
    else if ('pattern' in b.dataset) f.pattern = b.dataset.pattern || null;
    else if ('weight' in b.dataset) {
      const k = b.dataset.weight;
      if (k === 'custom') { weightCustomOpen = true; return { redraw: true }; }
      if (!k) { f.weightMin = null; f.weightMax = null; weightCustomOpen = false; }
      else { const [lo, hi] = R.WEIGHT_RANGES[k]; f.weightMin = lo || null; f.weightMax = hi; weightCustomOpen = false; }
    }
    else if (b.dataset.stockknown) f.stockKnown = !f.stockKnown;
    else if (b.dataset.color) f.colors = toggle(f.colors, b.dataset.color);
    else if ('price' in b.dataset) f.maxPrice = b.dataset.price ? Number(b.dataset.price) : null;
    else if ('width' in b.dataset) f.minWidth = b.dataset.width ? Number(b.dataset.width) : null;
    else if ('new' in b.dataset) f.newDays = b.dataset.new ? Number(b.dataset.new) : null;
    // pusty chip = „Dowolny sklep” (czyści kraje i sklepy)
    else if ('shop' in b.dataset) {
      if (!b.dataset.shop) { f.countries = []; f.shops = []; }
      else Object.assign(f, R.toggleShop(f, b.dataset.shop, source.shopsByCountry));
    }
    else return null;
    return { f: R.normalizeFilters(f) };
  }

  // Liczby przy opcjach: jedno zapytanie na stan filtrów, zapamiętane (zmiana i powrót nie pyta bazy drugi raz)
  const countsCache = new Map();
  function loadCounts(filters) {
    const key = R.filtersKey(R.dropOffFilterWords(filters));
    if (!countsCache.has(key)) {
      const p = source.facetCounts(R.dropOffFilterWords(filters)).catch(() => null);
      countsCache.set(key, p);
      p.then((c) => { if (!c) countsCache.delete(key); });
      if (countsCache.size > 40) countsCache.delete(countsCache.keys().next().value);
    }
    return countsCache.get(key);
  }

  // --- Arkusz filtrów (wszystkie grupy albo jedna, z przycisku pod wyszukiwarką) ---------------
  function renderFilterSheet(focusInfo) {
    const body = $('#filters-body');
    const y = body.scrollTop;
    const key = R.filtersKey(state.draft);
    body.innerHTML = filterGroupsHtml(state.draft, state.sheetGroup, state.sheetCountsFor === key ? state.sheetCounts : null);
    body.scrollTop = y;
    $('#filters-title').textContent = state.sheetGroup ? t('row.' + state.sheetGroup) : t('filters.title');
    syncWeightSlider(body, null);
    if (focusInfo) { const nb = body.querySelector(`[data-info="${focusInfo}"]`); if (nb) nb.focus(); }
    updateApplyCount();
  }
  $('#filters-body').addEventListener('input', (e) => {
    if (!e.target.matches('.w-min, .w-max')) return;
    const r = syncWeightSlider($('#filters-body'), e.target);
    state.draft.weightMin = r.min;
    state.draft.weightMax = r.max;
    updateApplyCount();
  });

  let countTimer = null, countSeq = 0;
  /** Liczba na przycisku „Pokaż N” i liczby przy opcjach (po chwili bez zmian, żeby nie pytać przy każdym kliknięciu). */
  function updateApplyCount() {
    $('#filters-apply').textContent = t('filters.show', null);
    clearTimeout(countTimer);
    const seq = ++countSeq;
    const draft = state.draft;
    countTimer = setTimeout(async () => {
      const key = R.filtersKey(draft);
      const counts = await loadCounts(draft);
      if (seq !== countSeq) return;
      if (counts && counts.total != null) {
        $('#filters-apply').textContent = t('filters.show', counts.total);
        if (state.sheetCountsFor !== key) {
          state.sheetCounts = counts;
          state.sheetCountsFor = key;
          const body = $('#filters-body');
          const y = body.scrollTop;
          body.innerHTML = filterGroupsHtml(state.draft, state.sheetGroup, counts);
          body.scrollTop = y;
          syncWeightSlider(body, null);
        }
        return;
      }
      try {   // tryb podglądu albo błąd liczenia: sam licznik wyników
        const n = await source.countNew(R.dropOffFilterWords(draft), null);
        if (seq === countSeq) $('#filters-apply').textContent = t('filters.show', n);
      } catch (e) { /* zostaje bez liczby */ }
    }, 250);
  }

  $('#filters-body').addEventListener('click', (e) => {
    const r = filterClick(e, state.draft);
    if (!r) return;
    if (r.f) state.draft = r.f;
    renderFilterSheet(r.focusInfo);
  });

  /** group = jedna grupa (przycisk pod wyszukiwarką) albo nic (przycisk „Filtry”: wszystkie). */
  function openFilters(group) {
    hideIntro();
    weightCustomOpen = false;
    state.sheetGroup = typeof group === 'string' ? group : null;
    state.draft = R.normalizeFilters(Object.assign({}, state.filters, { q: $('#q').value }));
    $('#filters-sheet').classList.toggle('mini', !!state.sheetGroup);
    renderFilterSheet();
    $('#filters-backdrop').hidden = false;
    $('#filters-sheet').hidden = false;
    document.body.style.overflow = 'hidden';
  }
  function closeFilters() {
    $('#filters-backdrop').hidden = true;
    $('#filters-sheet').hidden = true;
    document.body.style.overflow = '';
  }
  $('#open-filters').addEventListener('click', () => openFilters());
  $('#filters-backdrop').addEventListener('click', closeFilters);
  $('#filters-reset').addEventListener('click', () => {
    state.draft = state.sheetGroup ? R.clearGroup(state.draft, state.sheetGroup)
      : Object.assign(R.defaultFilters(), { q: state.draft.q, sort: state.draft.sort });
    renderFilterSheet();
  });
  $('#filters-apply').addEventListener('click', () => {
    closeFilters();
    setFilters(state.draft);
    window.scrollTo(0, 0);
  });

  // --- Komputer: filtry w kolumnie po lewej, każde kliknięcie od razu zmienia wyniki --------------
  let sideSeq = 0;
  function renderSide() {
    const aside = $('#filters-side');
    if (!wide.matches) { aside.hidden = true; return; }
    aside.hidden = false;
    const body = $('#side-body');
    const key = R.filtersKey(R.dropOffFilterWords(state.filters));
    const draw = (counts) => {
      const y = body.scrollTop;
      body.innerHTML = filterGroupsHtml(state.filters, null, counts);
      body.scrollTop = y;
      syncWeightSlider(body, null);
    };
    draw(state.sideCountsFor === key ? state.sideCounts : null);
  }
  /** Liczby w kolumnie: dopiero po wczytaniu wyników (żeby liczenie nie spowalniało samego wyszukiwania). */
  function loadSideCounts() {
    if (!wide.matches) return;
    const key = R.filtersKey(R.dropOffFilterWords(state.filters));
    if (state.sideCountsFor === key) return;
    const seq = ++sideSeq;
    loadCounts(state.filters).then((c) => {
      if (seq !== sideSeq || !c) return;
      state.sideCounts = c;
      state.sideCountsFor = key;
      renderSide();
    });
  }
  $('#side-body').addEventListener('click', (e) => {
    const r = filterClick(e, state.filters);
    if (!r) return;
    if (r.f) setFilters(r.f);
    else renderSide();
  });
  $('#side-body').addEventListener('input', (e) => {
    if (e.target.matches('.w-min, .w-max')) syncWeightSlider($('#side-body'), e.target);
  });
  $('#side-body').addEventListener('change', (e) => {   // gramatura z suwaka: po puszczeniu uchwytu
    if (!e.target.matches('.w-min, .w-max')) return;
    const r = syncWeightSlider($('#side-body'), e.target);
    setFilters(Object.assign({}, state.filters, { weightMin: r.min, weightMax: r.max }));
  });
  $('#side-reset').addEventListener('click', clearAllFilters);
  wide.addEventListener('change', () => { renderSide(); loadSideCounts(); });

  // --- Alerty -----------------------------------------------------------------
  function shopsById() { return Object.fromEntries(source.shops.map((s) => [s.id, s])); }

  function saveAlert() {
    const f = Object.assign({}, state.filters, { q: $('#q').value });
    if (alerts.find(f)) { toast(t('alerts.exists')); return; }
    const a = alerts.add(R.describeFilters(f, I.getLang(), shopsById()), f);
    if (!a) { toast(t('alerts.limit', R.MAX_ALERTS)); return; }
    searchMemory.markNudged(f);
    toast(t('alerts.saved'));
    source.track('alert_save', { query: f.q || null, detail: R.describeFilters(f, 'en', shopsById()) });
    renderAlertsBadge();
  }
  $('#save-alert').addEventListener('click', saveAlert);

  /** To samo wyszukiwanie w kolejnej wizycie: raz pytamy, czy zapisać je jako alert. */
  function maybeNudge() {
    const f = state.filters;
    if (state.editAlert || !state.items.length || !searchMemory.shouldNudge(f) || alerts.find(f)) return;
    searchMemory.markNudged(f);
    toast(t('alerts.nudge'), t('alerts.nudgeSave'), saveAlert);
  }

  // Edycja alertu: wyszukiwanie alertu wraca do zakładki Szukaj, a pasek nad wynikami zapisuje zmiany
  function renderEditBanner() {
    const el = $('#edit-banner');
    const a = state.editAlert && alerts.list().find((x) => x.id === state.editAlert);
    if (!a) { state.editAlert = null; el.hidden = true; $('#save-alert').hidden = false; return; }
    el.hidden = false;
    $('#save-alert').hidden = true;
    el.innerHTML = `<p>${esc(t('alerts.editing', a.name))}</p><div class="edit-actions">` +
      `<button type="button" class="primary-btn" id="edit-save">${esc(t('alerts.update'))}</button>` +
      `<button type="button" class="ghost-btn" id="edit-cancel">${esc(t('alerts.cancelEdit'))}</button></div>`;
  }
  $('#edit-banner').addEventListener('click', (e) => {
    if (e.target.closest('#edit-cancel')) {
      state.editAlert = null;
      renderEditBanner();
      switchView('alerts');
    } else if (e.target.closest('#edit-save')) {
      const f = Object.assign({}, state.filters, { q: $('#q').value });
      const a = alerts.update(state.editAlert, R.describeFilters(f, I.getLang(), shopsById()), f);
      if (!a) { toast(t('alerts.exists')); return; }
      searchMemory.markNudged(f);
      state.editAlert = null;
      renderEditBanner();
      renderAlertsBadge();
      toast(t('alerts.updated'));
      switchView('alerts');
    }
  });

  async function checkAlerts() {
    const list = alerts.list();
    await Promise.all(list.map(async (a) => {
      try { alerts.setNewCount(a.id, await source.countNew(a.filters, a.seenAt)); } catch (e) { /* bez zmian */ }
    }));
    renderAlertsBadge();
    if (state.view === 'alerts') renderAlerts();
  }

  function renderAlertsBadge() {
    const n = alerts.totalNew();
    const b = $('#alerts-badge');
    b.hidden = !n;
    b.textContent = n > 99 ? '99+' : n;
  }

  function renderAlerts() {
    const list = alerts.list();
    const el = $('#alert-list');
    if (!list.length) {
      el.innerHTML = `<div class="empty"><strong>${esc(t('alerts.empty'))}</strong>${esc(t('alerts.emptyHint'))}</div>`;
      return;
    }
    el.innerHTML = list.map((a) => `
      <div class="alert" data-alert="${esc(a.id)}">
        <div class="name">${esc(a.name)}</div>
        <div class="count ${a.newCount ? 'has' : ''}">${esc(a.newCount ? t('alerts.new', a.newCount) : t('alerts.none'))}</div>
        <div class="meta">${esc(t('alerts.since', fmtDate(a.seenAt)))}</div>
        <div class="actions">
          <button type="button" class="ghost-btn" data-show="${esc(a.id)}">${esc(t('alerts.show'))}</button>
          <button type="button" class="ghost-btn" data-edit="${esc(a.id)}">${esc(t('alerts.edit'))}</button>
          <button type="button" class="ghost-btn" data-del="${esc(a.id)}">${esc(t('alerts.delete'))}</button>
        </div>
      </div>`).join('');
  }

  $('#alert-list').addEventListener('click', (e) => {
    const show = e.target.closest('[data-show]');
    const del = e.target.closest('[data-del]');
    const edit = e.target.closest('[data-edit]');
    if (edit) {
      const a = alerts.list().find((x) => x.id === edit.dataset.edit);
      if (!a) return;
      state.editAlert = a.id;
      $('#q').value = a.filters.q || '';
      $('#q-clear').hidden = !a.filters.q;
      switchView('search');
      setFilters(Object.assign({}, a.filters));
      return;
    }
    if (show) {
      const a = alerts.list().find((x) => x.id === show.dataset.show);
      if (!a) return;
      const since = a.seenAt;
      alerts.markSeen(a.id);
      renderAlertsBadge();
      $('#q').value = a.filters.q || '';
      $('#q-clear').hidden = !a.filters.q;
      // Pokaż najnowsze dopasowania (od ostatniej wizyty, jeśli są nowe)
      switchView('search');
      setFilters(Object.assign({}, a.filters, { sort: 'newest' }));
      void since;
    } else if (del) {
      const a = alerts.list().find((x) => x.id === del.dataset.del);
      if (!a) return;
      alerts.remove(a.id);
      renderAlerts(); renderAlertsBadge();
      toast(t('alerts.deleted'), t('alerts.undo'), () => {
        const back = alerts.add(a.name, a.filters);
        if (back) { alerts.setNewCount(back.id, a.newCount); }
        renderAlerts(); renderAlertsBadge();
      });
    }
  });

  // --- Ulubione -----------------------------------------------------------------
  let favRefreshed = false;
  async function renderFavorites() {
    const list = favorites.list();
    const el = $('#fav-list');
    if (!list.length) {
      el.innerHTML = `<div class="empty"><strong>${esc(t('fav.empty'))}</strong>${esc(t('fav.emptyHint'))}</div>`;
      return;
    }
    el.innerHTML = list.map((p) => cardHtml(p, { gone: p.removed_at || p.available === false, favorites: true })).join('');
    if (!favRefreshed) {
      favRefreshed = true;
      try {
        const fresh = await source.byIds(list.map((p) => p.id));
        const byId = Object.fromEntries(fresh.map((p) => [p.id, p]));
        for (const p of list) {
          if (byId[p.id]) favorites.update(byId[p.id]);
          else if (source.mode === 'live') favorites.update({ id: p.id, removed_at: new Date().toISOString(), available: false });
        }
        if (state.view === 'favorites') renderFavorites();
      } catch (e) { /* zostają zapisane dane */ }
    }
  }

  // --- Więcej -------------------------------------------------------------------
  function renderMore() {
    const shops = source.shops;
    $('#sources-note').textContent = t('more.sourcesNote', shops.length);
    $('#shop-list').innerHTML = shops.map((s) => `<li><span>${esc(s.name)}</span><span class="c">${esc(s.country ? countryName(s.country) : '')}${s.product_count ? ' · ' + esc(t('more.offers', s.product_count)) : ''}</span></li>`).join('');
    const cfg = window.REMNA_CONFIG;
    $('#contact').textContent = cfg.contactEmail || '';
    // Zgłoś uwagę: e-mail z wersją i platformą (ułatwia szukanie błędów)
    const body = t('more.feedbackBody', cfg.version, N.isNative ? 'Android' : 'web');
    $('#feedback').href = 'mailto:' + (cfg.contactEmail || '') + '?subject=' + encodeURIComponent(t('more.feedbackSubject')) + '&body=' + encodeURIComponent(body);
    $('#stats-toggle').checked = statsAllowed();
    $('#stats-toggle').disabled = dnt;
    $('#stats-note').textContent = dnt ? t('more.statsDnt') : t('more.statsText');
    $('#version').textContent = t('more.version', cfg.version) + (source.updatedAt ? ' · ' + t('more.updated', fmtDate(source.updatedAt)) : '');
  }
  // linki do stron poza aplikacją (polityka, przewodnik): w Androidzie otwieramy je w przeglądarce
  document.querySelectorAll('#privacy-link, .ext-link').forEach((a) => a.addEventListener('click', (e) => {
    e.preventDefault();
    N.openExternal(e.currentTarget.href);
  }));
  $('#stats-toggle').addEventListener('change', (e) => {
    storage.setItem('remna-statystyki', e.target.checked ? 'tak' : 'nie');
  });
  $('#lang').addEventListener('change', (e) => {
    I.setLang(e.target.value);
    storage.setItem('remna-jezyk', I.getLang());
    applyI18n(); renderQuick(); renderSort(); renderResults(); renderModeBanner(); renderSide(); renderEditBanner();
    if (state.view === 'more') renderMore();
  });

  // --- Zakładki -----------------------------------------------------------------
  function switchView(view) {
    state.view = view;
    document.querySelectorAll('.view').forEach((v) => { v.hidden = v.dataset.view !== view; });
    document.querySelectorAll('#tabs button').forEach((b) => {
      if (b.dataset.tab === view) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    });
    if (view === 'favorites') renderFavorites();
    if (view === 'alerts') { renderAlerts(); checkAlerts(); }
    if (view === 'more') renderMore();
    window.scrollTo(0, 0);
  }
  $('#tabs').addEventListener('click', (e) => {
    const b = e.target.closest('[data-tab]');
    if (b) switchView(b.dataset.tab);
  });

  function renderModeBanner() {
    const el = $('#mode-banner');
    if (source.mode === 'demo') {
      el.hidden = false;
      el.textContent = t(source.reason === 'offline' ? 'mode.offline' : 'mode.demo');
    } else el.hidden = true;
  }

  // Cień pod nagłówkiem przy przewijaniu
  window.addEventListener('scroll', () => { $('.top').classList.toggle('scrolled', window.scrollY > 4); }, { passive: true });
  // Wysokość nagłówka (komputer: kolumna filtrów przykleja się tuż pod nim)
  if (window.ResizeObserver) {
    new ResizeObserver(() => document.documentElement.style.setProperty('--top-h', $('.top').offsetHeight + 'px')).observe($('.top'));
  }

  // Wstecz (Android) i Esc (komputer)
  function handleBack() {
    if (!$('#suggest').hidden) { hideSuggest(); return true; }
    if (!$('#detail').hidden) { closeDetail(); return true; }   // (na Androidzie: przycisk wstecz)
    if (!$('#filters-sheet').hidden) { closeFilters(); return true; }
    if (state.view !== 'search') { switchView('search'); return true; }
    return false;
  }
  N.onBack(handleBack);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') handleBack(); });
  N.onResume(() => {
    if (!source.mode) return;
    checkAlerts();
    // Po dłuższej przerwie lista mogła się zestarzeć: odświeżamy po cichu.
    if (state.view === 'search' && Date.now() - lastRefresh > 30 * 60 * 1000 && !state.loading) refreshAll(false);
  });

  // --- Odświeżanie (pociągnij listę w dół) ------------------------------------------
  /** Sklep z zapamiętanych filtrów (albo z linku) mógł zostać wstrzymany lub usunięty: wtedy wracamy do „Dowolny sklep”. */
  function pruneGoneShops() {
    if (!source.shops.length) return;   // lista sklepów się nie wczytała: nie ruszamy wyboru
    const f = R.pruneShops(state.filters, source.shopsByCountry, source.shops.map((s) => s.id));
    if (f === state.filters) return;
    state.filters = f;
    saveFilters();
    renderFilterBadge();
  }

  let lastRefresh = Date.now();
  let refreshing = false;
  async function refreshAll(withToast) {
    if (refreshing) return;
    refreshing = true;
    try {
      await source.init();
      renderModeBanner();
      pruneGoneShops();
      await runSearch(true);
      checkAlerts();
      lastRefresh = Date.now();
      if (withToast && !state.error) toast(t('ptr.done'));
    } catch (e) { /* błąd pokazuje lista wyników */ }
    finally { refreshing = false; }
  }
  (function pullToRefresh() {
    const ind = document.createElement('div');
    ind.className = 'ptr';
    ind.setAttribute('aria-hidden', 'true');
    ind.innerHTML = '<svg viewBox="0 0 24 24"><path d="M20 12a8 8 0 1 1-2.3-5.6"/><path d="M20 4v4.5h-4.5"/></svg>';
    document.body.appendChild(ind);
    const MAX = 90, TRIGGER = 64;
    let y0 = null, pull = 0;
    const blocked = () => state.view !== 'search' || !$('#detail').hidden || !$('#filters-sheet').hidden || refreshing;
    function show(d) {
      ind.style.transform = `translate(-50%, ${d - 48}px) rotate(${d * 4}deg)`;
      ind.style.opacity = String(Math.min(1, d / TRIGGER));
      ind.classList.toggle('ready', d >= TRIGGER);
    }
    function reset() { ind.classList.remove('ready', 'spin'); ind.style.transform = ''; ind.style.opacity = ''; }
    document.addEventListener('touchstart', (e) => {
      y0 = (!blocked() && window.scrollY <= 0 && e.touches.length === 1) ? e.touches[0].clientY : null;
      pull = 0;
    }, { passive: true });
    document.addEventListener('touchmove', (e) => {
      if (y0 == null) return;
      const d = e.touches[0].clientY - y0;
      if (d <= 0 || window.scrollY > 0) { pull = 0; reset(); return; }
      pull = Math.min(MAX, d * 0.5);
      show(pull);
    }, { passive: true });
    document.addEventListener('touchend', async () => {
      if (y0 == null) return;
      y0 = null;
      if (pull < TRIGGER) { reset(); return; }
      ind.classList.add('spin');
      ind.style.opacity = '1';
      ind.style.transform = `translate(-50%, ${TRIGGER - 48}px)`;
      await refreshAll(true);
      reset();
    });
  })();

  // --- Start ----------------------------------------------------------------------
  // --- Powitanie (pierwsza wizyta) -----------------------------------------------------
  function showIntro() {
    // Wejście z linkiem do wyszukiwania (np. z Google): najpierw wyniki, powitanie przy następnej zwykłej wizycie
    if (storage.getItem('remna-powitanie') || R.isSearch(state.filters)) { $('#intro').hidden = true; return; }
    const ua = navigator.userAgent || '';
    const iosSafari = /iPhone|iPad|iPod/.test(ua) && !window.navigator.standalone && !N.isNative;
    $('#intro-ios').hidden = !iosSafari;
    $('#intro').hidden = false;
  }
  function hideIntro() {
    storage.setItem('remna-powitanie', '1');
    $('#intro').hidden = true;
  }
  $('#intro-close').addEventListener('click', hideIntro);
  $('#intro-go').addEventListener('click', () => { hideIntro(); $('#q').focus(); });

  async function start() {
    I.setLang(storage.getItem('remna-jezyk') || I.detectLang(navigator));
    applyI18n();
    renderQuick();
    renderSort();
    renderFilterBadge();
    renderAlertsBadge();
    state.loading = true;
    renderResults();
    try {
      await source.init();
      source.track('open');
    } catch (e) {
      state.loading = false;
      state.error = true;
      renderResults();
      return;
    }
    renderModeBanner();
    // Link z filtrami (?q=…&colors=…) albo do oferty (?o=…)
    let openId = null;
    if (WEB) {
      const params = new URLSearchParams(location.search);
      const fromUrl = R.filtersFromParams(params);
      if (fromUrl) { state.filters = fromUrl; $('#q').value = fromUrl.q || ''; state.typed = R.extractFilters(fromUrl.q, true); renderQuick(); renderFilterBadge(); $('#sort').value = fromUrl.sort; }
    }
    pruneGoneShops();
    showIntro();
    renderActive();
    renderQuick();   // podpisy sklepów w przyciskach są znane dopiero po wczytaniu listy sklepów
    renderSide();
    if (WEB) {
      const params = new URLSearchParams(location.search);
      openId = params.get('o');
    }
    await runSearch(true);
    if (openId) openDetail(openId, { replace: true });
    checkAlerts();
  }
  start();
})();
