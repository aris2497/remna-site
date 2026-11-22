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
    document.title = 'Remna – ' + t('app.tagline').charAt(0).toLowerCase() + t('app.tagline').slice(1);
    document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
    document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => { el.placeholder = t(el.dataset.i18nPlaceholder); });
    document.querySelectorAll('[data-i18n-aria]').forEach((el) => { el.setAttribute('aria-label', t(el.dataset.i18nAria)); });
    $('#q').setAttribute('aria-label', t('tab.search'));
    $('#lang').value = I.getLang();
  }

  // --- Szybkie filtry (chipy pod wyszukiwarką) --------------------------------
  const QUICK_FIBERS = ['silk', 'wool', 'linen', 'cotton', 'viscose', 'cashmere'];
  function renderQuick() {
    const f = state.filters;
    const chips = [];
    const plain = f.kind === 'all' && !f.fibers.length;
    chips.push(`<button type="button" class="chip" data-quick="all" aria-pressed="${plain}">${esc(t('quick.all'))}</button>`);
    for (const id of QUICK_FIBERS) {
      chips.push(`<button type="button" class="chip" data-quick="fiber:${id}" aria-pressed="${f.fibers.includes(id)}">${esc(fiberName(id))}</button>`);
    }
    chips.push(`<button type="button" class="chip" data-quick="leather" aria-pressed="${f.kind === 'leather'}">${esc(t('filters.kind.leather'))}</button>`);
    chips.push(`<button type="button" class="chip" data-quick="new" aria-pressed="${f.newDays === 7}">${esc(t('filters.new7'))}</button>`);
    $('#quick').innerHTML = chips.join('');
  }
  $('#quick').addEventListener('click', (e) => {
    const b = e.target.closest('[data-quick]');
    if (!b) return;
    const q = b.dataset.quick;
    const f = Object.assign({}, state.filters);
    if (q === 'all') { f.kind = 'all'; f.fibers = []; }
    else if (q === 'leather') { f.kind = f.kind === 'leather' ? 'all' : 'leather'; }
    else if (q === 'new') { f.newDays = f.newDays === 7 ? null : 7; }
    else if (q.startsWith('fiber:')) {
      const id = q.slice(6);
      f.fibers = f.fibers.includes(id) ? f.fibers.filter((x) => x !== id) : f.fibers.concat(id);
      if (f.kind === 'leather') f.kind = 'all';
    }
    setFilters(f);
  });

  function renderSort() {
    $('#sort').innerHTML = R.SORTS.map((s) => `<option value="${s}">${esc(t('sort.' + s))}</option>`).join('');
    $('#sort').value = state.filters.sort;
  }
  $('#sort').addEventListener('change', (e) => setFilters(Object.assign({}, state.filters, { sort: e.target.value })));

  function setFilters(f) {
    state.filters = R.normalizeFilters(f);
    saveFilters();
    renderQuick();
    renderFilterBadge();
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
  $('#q').addEventListener('input', () => {
    $('#q-clear').hidden = !$('#q').value;
    clearTimeout(qTimer);
    qTimer = setTimeout(() => setFilters(Object.assign({}, state.filters, { q: $('#q').value })), 350);
  });
  $('#search-form').addEventListener('submit', (e) => {
    e.preventDefault();
    clearTimeout(qTimer);
    $('#q').blur();
    setFilters(Object.assign({}, state.filters, { q: $('#q').value }));
  });
  $('#q-clear').addEventListener('click', () => {
    $('#q').value = '';
    $('#q-clear').hidden = true;
    setFilters(Object.assign({}, state.filters, { q: '' }));
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
    } catch (e) {
      if (seq !== state.seq) return;
      state.error = true;
    } finally {
      if (seq === state.seq) { state.loading = false; renderResults(); }
    }
  }

  /** „zostało 25 m” (bez powtarzania długości jedynego kuponu, którą pokazuje cena). */
  function stockText(p) {
    if (p.stock_m == null) return '';
    const s = Number(p.stock_m);
    if (p.price_unit === 'piece' && p.piece_length_m && Math.abs(s - Number(p.piece_length_m)) < 0.01) return '';
    return t('card.stock', s);
  }
  function labelLine(p) {
    const bits = [];
    const comp = R.compositionText(p, I.getLang());
    if (comp) bits.push(comp);
    if (p.width_cm) bits.push(Math.round(p.width_cm) + ' cm');
    if (p.weight_gsm) bits.push(Math.round(p.weight_gsm) + ' g/m²');
    const st = stockText(p);
    if (st) bits.push(st);
    return bits.join(' · ');
  }

  function cardHtml(p, opts) {
    const o = opts || {};
    const lang = I.getLang();
    const shop = source.shopById(p.shop_id);
    const pr = R.priceParts(p, lang);
    let price;
    if (pr.unit === 'per_m') price = `${esc(pr.main)}<small>${esc(t('card.perM'))}</small>` + (pr.piece ? ` <small>· ${esc(t('card.piece', pr.piece))}</small>` : '');
    else price = `${esc(pr.main)} <small>${esc(t('card.priceUnknown'))}</small>`;
    const img = p.image_url
      ? `<img src="${esc(R.imageUrl(p.image_url, 480))}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">`
      : `<span class="noimg">Remna</span>`;
    const gone = (o.gone || liveGone(p.id)) ? `<span class="flag gone">${esc(t('fav.gone'))}</span>` : (isNew(p) ? `<span class="flag">${esc(t('card.new'))}</span>` : '');
    const label = labelLine(p);
    return `<article class="card" data-id="${esc(p.id)}" tabindex="0" aria-label="${esc(R.displayTitle(p.title))}">
      <div class="ph">${img}${gone}
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
      el.innerHTML = `<div class="empty"><strong>${esc(t('results.empty'))}</strong>${esc(t('results.emptyHint'))}</div>`;
      $('#result-count').textContent = t('results.count', 0);
      $('#load-more').hidden = true;
      return;
    }
    el.innerHTML = state.items.map((p) => cardHtml(p)).join('') + (state.loading ? skeletons(2) : '');
    $('#result-count').textContent = state.total == null ? '' : (state.approx ? t('results.countApprox', state.total) : t('results.count', state.total));
    $('#load-more').hidden = state.loading || !state.hasMore;
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
    const quick = state.items.find((x) => x.id === id) || favorites.list().find((x) => x.id === id);
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
      priceHtml = `<div class="big">${esc(pr.main)} <small>${esc(t('detail.perM'))}</small></div>`;
      if (pr.piece) priceHtml += `<div class="sub">${esc(t('detail.piece', pr.piece, pr.total))}</div>`;
      if (pr.eur) priceHtml += `<div class="sub">${esc(t('detail.perMEur', pr.eur))}</div>`;
    } else {
      priceHtml = `<div class="sub">${esc(t('detail.priceFrom'))}</div><div class="big">${esc(pr.main)}</div>`;
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
    const img = p.image_url ? `<img src="${esc(R.imageUrl(p.image_url, 1200))}" alt="" referrerpolicy="no-referrer">` : '';
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
        ${p.description ? `<h2 class="desc-title">${esc(t('detail.description'))}</h2><div class="desc">${esc(p.description.slice(0, 1800))}${p.description.length > 1800 ? '…' : ''}</div>` : ''}
        <p class="open-note">${esc(t('detail.openNote'))}</p>
      </div>`;
    $('#detail-open').href = p.url;
    $('#detail-fav').setAttribute('aria-pressed', favorites.has(p.id));
    $('#detail-body').scrollTop = 0;
    renderLive(p.id);
  }
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
      N.openExternal(detailProduct.url);
    }
  });

  // --- Arkusz filtrów -----------------------------------------------------------
  function chip(attr, value, label, pressed, extra, disabled) {
    return `<button type="button" class="chip" data-${attr}="${esc(value)}" aria-pressed="${pressed}"${disabled ? ' disabled' : ''}>${extra || ''}${esc(label)}</button>`;
  }
  /** Nagłówek grupy z przyciskiem „Zaznacz wszystkie” / „Odznacz wszystkie”. */
  function groupHead(titleKey, field, ids, selected) {
    const all = ids.length > 0 && ids.every((id) => selected.includes(id));
    return `<div class="fgroup-head"><h3>${esc(t(titleKey))}</h3>` +
      `<button type="button" class="text-btn small" data-selectall="${field}" data-ids="${esc(ids.join(','))}" data-on="${all ? '0' : '1'}">` +
      `${esc(t(all ? 'filters.selectNone' : 'filters.selectAll'))}</button></div>`;
  }

  // Suwak gramatury: przesuwanie nie przerysowuje arkusza (żeby nie zgubić uchwytu), tylko podpis i wypełnienie
  let weightCustomOpen = false;
  function syncWeightSlider(changed) {
    const lo = $('#weight-min'), hi = $('#weight-max');
    if (!lo || !hi) return;
    const W_MAX = R.WEIGHT_SLIDER_MAX, STEP = R.WEIGHT_STEP;
    let a = Number(lo.value), b = Number(hi.value);
    if (a > b - STEP) { if (changed === lo) a = b - STEP; else b = a + STEP; }
    a = Math.max(0, a); b = Math.min(W_MAX, b);
    lo.value = a; hi.value = b;
    $('#weight-fill').style.left = (a / W_MAX * 100) + '%';
    $('#weight-fill').style.right = ((W_MAX - b) / W_MAX * 100) + '%';
    const min = a > 0 ? a : null, max = b < W_MAX ? b : null;
    $('#weight-label').textContent = R.weightLabel(min, max) || ('0–' + W_MAX + '+ g/m²');
    // na wierzchu ten uchwyt, którym ostatnio ruszano (gdy oba są w jednym miejscu)
    lo.style.zIndex = changed === lo ? 3 : 2; hi.style.zIndex = changed === hi ? 3 : 2;
    return { min, max };
  }
  $('#filters-body').addEventListener('input', (e) => {
    if (e.target.id !== 'weight-min' && e.target.id !== 'weight-max') return;
    const r = syncWeightSlider(e.target);
    state.draft.weightMin = r.min;
    state.draft.weightMax = r.max;
    updateApplyCount();
  });

  function renderFilterSheet() {
    const f = state.draft;
    const countries = Object.keys(source.shopsByCountry).sort((a, b) => countryName(a).localeCompare(countryName(b)));
    const html = [];
    html.push(`<div class="fgroup"><h3>${esc(t('filters.kind'))}</h3><div class="chips">` +
      ['all', 'fabric', 'leather'].map((k) => chip('kind', k, t('filters.kind.' + k), f.kind === k)).join('') + '</div></div>');
    const fiberIds = R.FIBERS.filter((x) => x.id !== 'leather').map((x) => x.id);
    html.push(`<div class="fgroup">${groupHead('filters.fibers', 'fibers', fiberIds, f.fibers)}<div class="chips">` +
      R.FIBERS.filter((x) => x.id !== 'leather').map((x) => chip('fiber', x.id, x[I.getLang()] || x.en, f.fibers.includes(x.id))).join('') + '</div></div>');
    // Skład: udział wybranego materiału i „bez syntetyków”
    const purityOff = !f.fibers.length;
    html.push(`<div class="fgroup"><h3>${esc(t('filters.composition'))}</h3>` +
      `<p class="hint">${esc(purityOff ? t('filters.purityPick') : t('filters.purityLead'))}</p>` +
      `<div class="chips${purityOff ? ' disabled' : ''}">` +
      chip('purity', '', t('filters.purityAny'), !f.purity, '', purityOff) +
      R.PURITY_STEPS.map((v) => chip('purity', v, v === 100 ? t('filters.purity100') : t('filters.purityMin', v), f.purity === v, '', purityOff)).join('') +
      `</div><div class="chips">` + chip('nosynth', '1', t('filters.noSynthetic'), f.noSynthetic) +
      `</div><p class="hint">${esc(t('filters.compositionNote'))}</p></div>`);
    // Ile metrów potrzebujesz
    html.push(`<div class="fgroup"><h3>${esc(t('filters.minStock'))}</h3><div class="chips">` +
      chip('stock', '', t('filters.any'), !f.minStock) +
      R.MIN_STOCK_STEPS.map((v) => chip('stock', v, t('filters.fromStock', v), f.minStock === v)).join('') +
      `</div><div class="chips">` + chip('stockknown', '1', t('filters.stockKnown'), f.stockKnown) +
      `</div><p class="hint">${esc(t('filters.stockNote'))}</p></div>`);
    // Gramatura (g/m²): gotowe przedziały albo własny zakres suwakiem
    const wSet = f.weightMin != null || f.weightMax != null;
    const wPreset = R.weightPreset(f.weightMin, f.weightMax);
    const wCustom = weightCustomOpen || (wSet && !wPreset);
    const W_MAX = R.WEIGHT_SLIDER_MAX;
    html.push(`<div class="fgroup" id="weight-group"><h3>${esc(t('filters.weight'))}</h3><div class="chips">` +
      chip('weight', '', t('filters.any'), !wSet && !weightCustomOpen) +
      Object.keys(R.WEIGHT_RANGES).map((k) => chip('weight', k, t('filters.weight.' + k), !wCustom && wPreset === k)).join('') +
      chip('weight', 'custom', t('filters.weight.custom'), wCustom) +
      `</div>` +
      (wCustom ? `<div class="wrange-box">
        <div class="wrange-label" id="weight-label">${esc(R.weightLabel(f.weightMin, f.weightMax) || '0–' + W_MAX + '+ g/m²')}</div>
        <div class="wrange">
          <div class="wtrack"><div class="wfill" id="weight-fill"></div></div>
          <input type="range" id="weight-min" min="0" max="${W_MAX}" step="${R.WEIGHT_STEP}" value="${f.weightMin || 0}" aria-label="${esc(t('filters.weightMinAria'))}">
          <input type="range" id="weight-max" min="0" max="${W_MAX}" step="${R.WEIGHT_STEP}" value="${f.weightMax == null ? W_MAX : f.weightMax}" aria-label="${esc(t('filters.weightMaxAria'))}">
        </div>
        <div class="wrange-scale"><span>0</span><span>200</span><span>400</span><span>${W_MAX}+</span></div>
      </div>` : '') +
      `<p class="hint">${esc(t('filters.weightNote'))}</p></div>`);
    // Wzór: jednolite / wzorzyste
    html.push(`<div class="fgroup"><h3>${esc(t('filters.pattern'))}</h3><div class="chips">` +
      chip('pattern', '', t('filters.patternAny'), !f.pattern) +
      chip('pattern', 'plain', t('filters.patternPlain'), f.pattern === 'plain') +
      chip('pattern', 'patterned', t('filters.patternPatterned'), f.pattern === 'patterned') +
      `</div><p class="hint">${esc(t('filters.patternNote'))}</p></div>`);
    html.push(`<div class="fgroup">${groupHead('filters.colors', 'colors', R.COLORS.map((c) => c.id), f.colors)}<div class="chips">` +
      R.COLORS.map((c) => chip('color', c.id, c[I.getLang()] || c.en, f.colors.includes(c.id), `<span class="dot" style="background:${c.hex}"></span>`)).join('') +
      `</div><p class="hint">${esc(t('filters.colorsNote'))}</p></div>`);
    html.push(`<div class="fgroup"><h3>${esc(t('filters.maxPrice'))}</h3><div class="chips">` +
      chip('price', '', t('filters.any'), !f.maxPrice) +
      R.MAX_PRICE_STEPS.map((v) => chip('price', v, t('filters.upTo', v), f.maxPrice === v)).join('') +
      `</div><p class="hint">${esc(t('filters.priceNote'))}</p></div>`);
    html.push(`<div class="fgroup"><h3>${esc(t('filters.minWidth'))}</h3><div class="chips">` +
      chip('width', '', t('filters.anyWidth'), !f.minWidth) +
      R.MIN_WIDTH_STEPS.map((v) => chip('width', v, t('filters.fromWidth', v), f.minWidth === v)).join('') + '</div></div>');
    html.push(`<div class="fgroup"><h3>${esc(t('filters.newDays'))}</h3><div class="chips">` +
      chip('new', '', t('filters.newAny'), !f.newDays) +
      [1, 7, 30].map((d) => chip('new', d, t('filters.new' + d), f.newDays === d)).join('') + '</div></div>');
    if (countries.length) {
      html.push(`<div class="fgroup">${groupHead('filters.countries', 'countries', countries, f.countries)}<div class="chips">` +
        countries.map((c) => chip('country', c, countryName(c), f.countries.includes(c))).join('') + '</div></div>');
    }
    html.push(`<div class="fgroup">${groupHead('filters.shops', 'shops', source.shops.map((s) => s.id), f.shops)}<div class="chips">` +
      source.shops.map((s) => chip('shop', s.id, s.name, f.shops.includes(s.id))).join('') + '</div></div>');
    $('#filters-body').innerHTML = html.join('');
    syncWeightSlider(null);
    updateApplyCount();
  }

  let countTimer = null, countSeq = 0;
  function updateApplyCount() {
    $('#filters-apply').textContent = t('filters.show', null);
    clearTimeout(countTimer);
    const seq = ++countSeq;
    countTimer = setTimeout(async () => {
      try {
        const n = await source.countNew(state.draft, null);
        if (seq === countSeq) $('#filters-apply').textContent = t('filters.show', n);
      } catch (e) { /* zostaje bez liczby */ }
    }, 250);
  }

  $('#filters-body').addEventListener('click', (e) => {
    const f = state.draft;
    const sa = e.target.closest('[data-selectall]');
    if (sa) {
      f[sa.dataset.selectall] = sa.dataset.on === '1' ? sa.dataset.ids.split(',').filter(Boolean) : [];
      state.draft = R.normalizeFilters(f);
      const y0 = $('#filters-body').scrollTop;
      renderFilterSheet();
      $('#filters-body').scrollTop = y0;
      return;
    }
    const b = e.target.closest('.chip');
    if (!b) return;
    const toggle = (arr, v) => (arr.includes(v) ? arr.filter((x) => x !== v) : arr.concat(v));
    if (b.dataset.kind) f.kind = b.dataset.kind;
    else if (b.dataset.fiber) f.fibers = toggle(f.fibers, b.dataset.fiber);
    else if ('purity' in b.dataset) f.purity = b.dataset.purity ? Number(b.dataset.purity) : null;
    else if (b.dataset.nosynth) f.noSynthetic = !f.noSynthetic;
    else if ('stock' in b.dataset) f.minStock = b.dataset.stock ? Number(b.dataset.stock) : null;
    else if ('pattern' in b.dataset) f.pattern = b.dataset.pattern || null;
    else if ('weight' in b.dataset) {
      const k = b.dataset.weight;
      if (k === 'custom') { weightCustomOpen = true; }
      else if (!k) { f.weightMin = null; f.weightMax = null; weightCustomOpen = false; }
      else { const [lo, hi] = R.WEIGHT_RANGES[k]; f.weightMin = lo || null; f.weightMax = hi; weightCustomOpen = false; }
    }
    else if (b.dataset.stockknown) f.stockKnown = !f.stockKnown;
    else if (b.dataset.color) f.colors = toggle(f.colors, b.dataset.color);
    else if ('price' in b.dataset) f.maxPrice = b.dataset.price ? Number(b.dataset.price) : null;
    else if ('width' in b.dataset) f.minWidth = b.dataset.width ? Number(b.dataset.width) : null;
    else if ('new' in b.dataset) f.newDays = b.dataset.new ? Number(b.dataset.new) : null;
    else if (b.dataset.country) f.countries = toggle(f.countries, b.dataset.country);
    else if (b.dataset.shop) f.shops = toggle(f.shops, b.dataset.shop);
    state.draft = R.normalizeFilters(f);
    const y = $('#filters-body').scrollTop;
    renderFilterSheet();
    $('#filters-body').scrollTop = y;
  });

  function openFilters() {
    weightCustomOpen = false;
    state.draft = R.normalizeFilters(Object.assign({}, state.filters, { q: $('#q').value }));
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
  $('#open-filters').addEventListener('click', openFilters);
  $('#filters-backdrop').addEventListener('click', closeFilters);
  $('#filters-reset').addEventListener('click', () => {
    state.draft = Object.assign(R.defaultFilters(), { q: state.draft.q, sort: state.draft.sort });
    renderFilterSheet();
  });
  $('#filters-apply').addEventListener('click', () => {
    closeFilters();
    setFilters(state.draft);
    window.scrollTo(0, 0);
  });

  // --- Alerty -----------------------------------------------------------------
  function shopsById() { return Object.fromEntries(source.shops.map((s) => [s.id, s])); }

  $('#save-alert').addEventListener('click', () => {
    const f = Object.assign({}, state.filters, { q: $('#q').value });
    if (alerts.find(f)) { toast(t('alerts.exists')); return; }
    const a = alerts.add(R.describeFilters(f, I.getLang(), shopsById()), f);
    if (!a) { toast(t('alerts.limit', R.MAX_ALERTS)); return; }
    toast(t('alerts.saved'));
    source.track('alert_save', { query: f.q || null, detail: R.describeFilters(f, 'en', shopsById()) });
    renderAlertsBadge();
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
          <button type="button" class="ghost-btn" data-del="${esc(a.id)}">${esc(t('alerts.delete'))}</button>
        </div>
      </div>`).join('');
  }

  $('#alert-list').addEventListener('click', (e) => {
    const show = e.target.closest('[data-show]');
    const del = e.target.closest('[data-del]');
    if (show) {
      const a = alerts.list().find((x) => x.id === show.dataset.show);
      if (!a) return;
      const since = a.seenAt;
      alerts.markSeen(a.id);
      renderAlertsBadge();
      $('#q').value = a.filters.q || '';
      $('#q-clear').hidden = !a.filters.q;
      // Pokaż najnowsze dopasowania (od ostatniej wizyty, jeśli są nowe)
      const f = Object.assign({}, a.filters, { sort: 'newest' });
      state.filters = R.normalizeFilters(f);
      saveFilters();
      renderQuick(); renderFilterBadge(); $('#sort').value = 'newest';
      switchView('search');
      runSearch(true);
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
    el.innerHTML = list.map((p) => cardHtml(p, { gone: p.removed_at || p.available === false })).join('');
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
  $('#privacy-link').addEventListener('click', (e) => {
    e.preventDefault();
    N.openExternal(e.currentTarget.href);
  });
  $('#stats-toggle').addEventListener('change', (e) => {
    storage.setItem('remna-statystyki', e.target.checked ? 'tak' : 'nie');
  });
  $('#lang').addEventListener('change', (e) => {
    I.setLang(e.target.value);
    storage.setItem('remna-jezyk', I.getLang());
    applyI18n(); renderQuick(); renderSort(); renderResults(); renderModeBanner();
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

  // Wstecz (Android) i Esc (komputer)
  function handleBack() {
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
  let lastRefresh = Date.now();
  let refreshing = false;
  async function refreshAll(withToast) {
    if (refreshing) return;
    refreshing = true;
    try {
      await source.init();
      renderModeBanner();
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
    if (storage.getItem('remna-powitanie')) return;
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
    showIntro();
    // Link z filtrami (?q=…&colors=…) albo do oferty (?o=…)
    let openId = null;
    if (WEB) {
      const params = new URLSearchParams(location.search);
      const fromUrl = R.filtersFromParams(params);
      if (fromUrl) { state.filters = fromUrl; $('#q').value = fromUrl.q || ''; renderQuick(); renderFilterBadge(); $('#sort').value = fromUrl.sort; }
      openId = params.get('o');
    }
    await runSearch(true);
    if (openId) openDetail(openId, { replace: true });
    checkAlerts();
  }
  start();
})();
