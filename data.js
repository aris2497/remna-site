// Remna: skąd aplikacja bierze oferty.
// Tryb "live": baza Supabase (REST, klucz publiczny tylko do odczytu).
// Tryb "demo": zapisana próbka ofert (data/demo.json), gdy baza nie działa albo nie ma internetu.
(function (root) {
  'use strict';

  function makeSource(config, deps) {
    const R = deps.Remna;
    const fetchFn = deps.fetch;
    const base = String(config.supabaseUrl || '').replace(/\/$/, '') + '/rest/v1';
    const headers = { apikey: config.supabaseKey, Authorization: 'Bearer ' + config.supabaseKey };

    let mode = null;            // 'live' | 'demo'
    let reason = null;          // 'not-ready' | 'offline' (dla trybu demo)
    let shops = [];
    let demo = null;            // {generatedAt, shops, products}
    let shopsByCountry = {};
    let updatedAt = null;

    async function getJson(path, extraHeaders) {
      const r = await fetchFn(base + path, { headers: Object.assign({}, headers, extraHeaders || {}) });
      if (!r.ok) {
        const err = new Error('HTTP ' + r.status);
        err.status = r.status;
        err.headers = r.headers;
        throw err;
      }
      return { body: await r.json(), headers: r.headers };
    }

    function indexShops(list) {
      shops = list.slice().sort((a, b) => a.name.localeCompare(b.name));
      shopsByCountry = {};
      for (const s of shops) {
        if (!s.country) continue;
        (shopsByCountry[s.country] = shopsByCountry[s.country] || []).push(s.id);
      }
    }

    async function loadDemo(why) {
      if (!demo) {
        const r = await fetchFn(config.demoUrl || 'data/demo.json');
        demo = await r.json();
      }
      mode = 'demo';
      reason = why;
      updatedAt = demo.generatedAt || null;
      indexShops(demo.shops || []);
    }

    async function init() {
      if (config.supabaseUrl && config.supabaseKey) {
        try {
          const { body } = await getJson('/shops?select=id,name,domain,country,city,currency,product_count,last_success_at&order=name.asc');
          if (Array.isArray(body) && body.length) {
            mode = 'live';
            reason = null;
            indexShops(body);
            updatedAt = body.map((s) => s.last_success_at).filter(Boolean).sort().pop() || null;
            return mode;
          }
          await loadDemo('not-ready');
          return mode;
        } catch (e) {
          // 404/401 = tabel jeszcze nie ma; brak odpowiedzi = brak internetu
          await loadDemo(e && e.status ? 'not-ready' : 'offline');
          return mode;
        }
      }
      await loadDemo('not-ready');
      return mode;
    }

    function parseTotal(h) {
      const range = h && h.get && h.get('content-range');
      if (!range) return null;
      const total = range.split('/')[1];
      return total && total !== '*' ? Number(total) : null;
    }

    /**
     * Lista sklejona z kilku części (każda to osobne zapytanie, strony liczone przez wszystkie):
     *  1) oferty, o których wiemy, że pasują do filtrów; 2) oferty, w których sklep nie podał części cech
     *     (gramatury, składu…) — pokazujemy je, ale na końcu (pole _unknown na karcie);
     *  w każdej z nich przy wpisanym tekście i kolejności „najnowsze”: najpierw słowo w nazwie, potem reszta.
     * Liczniki części: „reszta” = całość − trafienia w nazwie (liczenie „nie w nazwie” byłoby wolne).
     */
    const tierCounts = new Map();
    async function searchTiered(filters, page, key) {
      const n = R.normalizeFilters(filters);
      const knownTiers = R.unknownFields(n).length ? ['only', 'missing'] : [null];
      const byTitle = !!(R.tsQuery(n.q) && n.sort === 'newest');
      const params = (known, title, offset, limit, select) =>
        R.restParams(filters, Object.assign({ page: 0, shopsByCountry }, known ? { known } : {}, title ? { title } : {}, select ? { select } : {}))
          .filter(([k]) => k !== 'limit' && k !== 'offset')
          .concat([['limit', String(limit)], ['offset', String(offset)]]);
      const countOf = (known, title) => getJson('/products?' + R.toQueryString(params(known, title, 0, 1, 'id')), { Prefer: 'count=exact' })
        .then((r) => parseTotal(r.headers));
      const tiers = [];
      for (const known of knownTiers) {
        if (byTitle) { tiers.push({ known, title: 'only' }); tiers.push({ known, title: 'exclude' }); }
        else tiers.push({ known, title: null });
      }
      let counts = page ? tierCounts.get(key) : null;
      if (!counts) {
        const raw = await Promise.all(knownTiers.flatMap((k) => byTitle ? [countOf(k, null), countOf(k, 'only')] : [countOf(k, null)]));
        if (raw.some((c) => c == null)) { const e = new Error('no count'); e.status = 'count'; throw e; }
        counts = [];
        for (let i = 0; i < knownTiers.length; i++) {
          if (byTitle) { const all = raw[2 * i], t = raw[2 * i + 1]; counts.push(t, Math.max(0, all - t)); }
          else counts.push(raw[i]);
        }
        tierCounts.set(key, counts);
      }
      const total = counts.reduce((x, y) => x + y, 0);
      const items = [];
      let skip = (page || 0) * R.PAGE_SIZE;
      for (let i = 0; i < tiers.length && items.length < R.PAGE_SIZE; i++) {
        if (skip >= counts[i]) { skip -= counts[i]; continue; }
        const need = Math.min(R.PAGE_SIZE - items.length, counts[i] - skip);
        const { body } = await getJson('/products?' + R.toQueryString(params(tiers[i].known, tiers[i].title, skip, need)));
        items.push(...body.map((p) => (tiers[i].known === 'missing' ? Object.assign(p, { _unknown: true }) : p)));
        skip = 0;
      }
      return { items, total, approx: false, tiered: true, hasMore: (page || 0) * R.PAGE_SIZE + items.length < total };
    }

    // Którą kolejność wybrała pierwsza strona danego wyszukiwania (żeby dalsze strony jej nie zmieniały)
    const tieredFor = new Map();

    /** Strona startowa bez tekstu i filtrów: po 2 najnowsze oferty z każdego sklepu na stronę (różnorodnie). */
    const FEED_PER_SHOP = 2;
    function isFeed(nf, since) {
      return !nf.q && !R.countActive(nf) && nf.sort === 'newest' && !since;
    }
    async function searchFeed(filters, page) {
      const qs = 'pg=' + (page || 0) + '&per_shop=' + FEED_PER_SHOP + '&select=' + encodeURIComponent(R.LIST_FIELDS);
      const countParams = R.restParams(filters, { page: 0, shopsByCountry, select: 'id' })
        .filter(([k]) => k !== 'order' && k !== 'limit' && k !== 'offset').concat([['limit', '1']]);
      const [feed, all] = await Promise.all([
        getJson('/rpc/feed?' + qs),
        // licznik tylko na pierwszej stronie; gdy baza jest zajęta (wgrywanie ofert), lista i tak się pokazuje
        page ? Promise.resolve(null) : getJson('/products?' + R.toQueryString(countParams), { Prefer: 'count=exact' }).catch(() => null),
      ]);
      return { items: feed.body, total: all ? parseTotal(all.headers) : null, approx: false, hasMore: feed.body.length > 0 };
    }
    function feedLocal(products, page) {
      const byShop = new Map();
      for (const p of R.sortLocal(products, 'newest')) {
        if (!byShop.has(p.shop_id)) byShop.set(p.shop_id, []);
        byShop.get(p.shop_id).push(p);
      }
      const start = (page || 0) * FEED_PER_SHOP;
      const items = [];
      for (const list of byShop.values()) items.push(...list.slice(start, start + FEED_PER_SHOP));
      return R.sortLocal(items, 'newest');
    }

    /** Wyniki wyszukiwania: {items, total, approx, hasMore?}. */
    async function search(filters, page, since) {
      const nf = R.normalizeFilters(filters);
      if (isFeed(nf, since)) {
        if (mode === 'live') {
          try { return await searchFeed(filters, page); } catch (e) { if (!e.status) throw e; /* zwykła lista niżej */ }
        } else {
          const all = demo.products.filter((p) => R.matchLocal(p, filters, { shopsByCountry }));
          const items = feedLocal(all, page);
          return { items, total: all.length, approx: false, hasMore: items.length > 0 };
        }
      }
      const key = R.filtersKey(filters) + '|' + nf.sort;
      const wantTiered = mode === 'live' && !since &&
        ((R.tsQuery(nf.q) && nf.sort === 'newest') || R.unknownFields(nf).length > 0);
      if (wantTiered && (!page || tieredFor.get(key) !== false)) {
        try {
          const res = await searchTiered(filters, page, key);
          if (!page) tieredFor.set(key, true);
          return res;
        } catch (e) {
          if (!e.status) throw e;
          // Dalsze strony: jedna ponowna próba, bez zmiany kolejności w połowie listy (to dawało powtórki)
          if (page) return await searchTiered(filters, page, key);
          tieredFor.set(key, false);   // pierwsza strona: zwykła kolejność niżej, także dla dalszych stron
        }
      }
      if (mode === 'live') {
        const qs = R.toQueryString(R.restParams(filters, { page: page || 0, shopsByCountry, since }));
        try {
          const { body, headers: h } = await getJson('/products?' + qs, { Prefer: 'count=exact' });
          return { items: body, total: parseTotal(h), approx: false };
        } catch (e) {
          // Liczenie bywa wolne przy szerokich wyszukiwaniach: pokazujemy wyniki bez licznika.
          if (!e.status) throw e;
          const { body } = await getJson('/products?' + qs);
          return { items: body, total: null, approx: false };
        }
      }
      const all = demo.products.filter((p) => R.matchLocal(p, filters, { shopsByCountry, since }));
      const byTitle = (list) => (nf.q && nf.sort === 'newest'
        ? list.filter((p) => R.titleMatches(p, nf.q)).concat(list.filter((p) => !R.titleMatches(p, nf.q))) : list);
      // jak w bazie: najpierw pewne, potem oferty bez części cech (oznaczone _unknown)
      const sortedAll = R.sortLocal(all, nf.sort);
      const sure = sortedAll.filter((p) => R.matchLocal(p, filters, { shopsByCountry, since, known: 'only' }));
      const rest = R.unknownFields(nf).length ? sortedAll.filter((p) => !sure.includes(p)).map((p) => Object.assign({}, p, { _unknown: true })) : [];
      const sorted = byTitle(sure).concat(byTitle(rest));
      const start = (page || 0) * R.PAGE_SIZE;
      return { items: sorted.slice(start, start + R.PAGE_SIZE), total: sorted.length, approx: false };
    }

    /** Ile ofert pasuje do filtrów i pojawiło się po dacie `since`. */
    async function countNew(filters, since) {
      if (mode === 'live') {
        const params = R.restParams(filters, { page: 0, shopsByCountry, since, select: 'id' })
          .filter(([k]) => k !== 'order' && k !== 'limit' && k !== 'offset');
        params.push(['limit', '1']);
        const { headers: h } = await getJson('/products?' + R.toQueryString(params), { Prefer: 'count=exact' });
        return parseTotal(h) || 0;
      }
      return demo.products.filter((p) => R.matchLocal(p, filters, { shopsByCountry, since })).length;
    }

    /** Świeże dane ofert o podanych id (do ulubionych). */
    async function byIds(ids) {
      if (!ids.length) return [];
      if (mode === 'live') {
        const out = [];
        for (let i = 0; i < ids.length; i += 50) {
          const chunk = ids.slice(i, i + 50).map((x) => '"' + x.replace(/"/g, '') + '"').join(',');
          const qs = 'select=' + encodeURIComponent(R.LIST_FIELDS + ',removed_at') + '&id=in.(' + encodeURIComponent(chunk) + ')';
          const { body } = await getJson('/products?' + qs);
          out.push(...body);
        }
        return out;
      }
      const set = new Set(ids);
      return demo.products.filter((p) => set.has(p.id));
    }

    /** Pełne dane jednej oferty (z opisem). */
    async function details(id) {
      if (mode === 'live') {
        const qs = 'select=*&id=eq.' + encodeURIComponent(id);
        const { body } = await getJson('/products?' + qs);
        return body[0] || null;
      }
      return demo.products.find((p) => p.id === id) || null;
    }

    /** Pyta sklep, czy oferta jest jeszcze dostępna: 'available' | 'soldout' | 'gone' | null. */
    async function checkLive(product, timeoutMs) {
      const url = R.liveCheckUrl(product && product.url);
      if (!url) return null;
      const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const timer = ctrl ? setTimeout(() => ctrl.abort(), timeoutMs || 6000) : null;
      try {
        const r = await fetchFn(url, { headers: { Accept: 'application/json' }, signal: ctrl ? ctrl.signal : undefined });
        let body = null;
        if (r.status === 200) { try { body = await r.json(); } catch (e) { body = null; } }
        return R.readLiveCheck(r.status, body);
      } catch (e) {
        return null;   // brak internetu, blokada albo za długo: zostają dane z bazy
      } finally {
        if (timer) clearTimeout(timer);
      }
    }

    // Anonimowe statystyki: bez identyfikatora osoby i bez ciasteczek. „session” = losowe na jedno otwarcie aplikacji
    // (tylko w pamięci), żeby liczyć wizyty, a nie ludzi. Wyłączane w ustawieniach i przy „Nie śledź” w przeglądarce.
    const session = Math.random().toString(36).slice(2, 12);
    let statsOn = () => true;
    function setStatsCheck(fn) { statsOn = fn; }
    function track(name, extra) {
      if (mode !== 'live' || !statsOn()) return;
      const cut = (v, n) => (v == null ? null : String(v).slice(0, n));
      const e = extra || {};
      const row = {
        name, session, platform: deps.platform || 'web', lang: cut(deps.lang && deps.lang(), 5),
        shop_id: cut(e.shop_id, 40), product_id: cut(e.product_id, 80), query: cut(e.query, 80), detail: cut(e.detail, 120),
      };
      try {
        fetchFn(base + '/events', {
          method: 'POST',
          headers: Object.assign({}, headers, { 'Content-Type': 'application/json', Prefer: 'return=minimal' }),
          body: JSON.stringify(row),
          keepalive: true,
        }).catch(() => {});
      } catch (err) { /* statystyki nigdy nie psują aplikacji */ }
    }

    return {
      init, search, countNew, byIds, details, checkLive, track, setStatsCheck,
      get mode() { return mode; },
      get reason() { return reason; },
      get shops() { return shops; },
      get shopsByCountry() { return shopsByCountry; },
      get updatedAt() { return updatedAt; },
      shopById(id) { return shops.find((s) => s.id === id) || null; },
    };
  }

  const api = { makeSource };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.RemnaData = api;
})(typeof window !== 'undefined' ? window : globalThis);
