// Remna: logika filtrów, zapytań i pamięci (bez interfejsu, testowana w tests/).
// Działa w przeglądarce (window.Remna) i w Node (require) do testów.
(function (root) {
  'use strict';

  const FIBERS = [
    { id: 'silk', pl: 'Jedwab', en: 'Silk', de: 'Seide', fr: 'Soie', it: 'Seta', es: 'Seda', nl: 'Zijde' },
    { id: 'wool', pl: 'Wełna', en: 'Wool', de: 'Wolle', fr: 'Laine', it: 'Lana', es: 'Lana', nl: 'Wol' },
    { id: 'cashmere', pl: 'Kaszmir', en: 'Cashmere', de: 'Kaschmir', fr: 'Cachemire', it: 'Cashmere', es: 'Cachemira', nl: 'Kasjmier' },
    { id: 'cotton', pl: 'Bawełna', en: 'Cotton', de: 'Baumwolle', fr: 'Coton', it: 'Cotone', es: 'Algodón', nl: 'Katoen' },
    { id: 'linen', pl: 'Len', en: 'Linen', de: 'Leinen', fr: 'Lin', it: 'Lino', es: 'Lino', nl: 'Linnen' },
    { id: 'viscose', pl: 'Wiskoza', en: 'Viscose', de: 'Viskose', fr: 'Viscose', it: 'Viscosa', es: 'Viscosa', nl: 'Viscose' },
    { id: 'cupro', pl: 'Cupro', en: 'Cupro', de: 'Cupro', fr: 'Cupro', it: 'Cupro', es: 'Cupro', nl: 'Cupro' },
    { id: 'acetate', pl: 'Acetat', en: 'Acetate', de: 'Acetat', fr: 'Acétate', it: 'Acetato', es: 'Acetato', nl: 'Acetaat' },
    { id: 'polyester', pl: 'Poliester', en: 'Polyester', de: 'Polyester', fr: 'Polyester', it: 'Poliestere', es: 'Poliéster', nl: 'Polyester' },
    { id: 'polyamide', pl: 'Poliamid', en: 'Polyamide', de: 'Polyamid', fr: 'Polyamide', it: 'Poliammide', es: 'Poliamida', nl: 'Polyamide' },
    { id: 'elastane', pl: 'Elastan', en: 'Elastane', de: 'Elasthan', fr: 'Élasthanne', it: 'Elastan', es: 'Elastano', nl: 'Elastaan' },
    { id: 'mohair', pl: 'Moher', en: 'Mohair', de: 'Mohair', fr: 'Mohair', it: 'Mohair', es: 'Mohair', nl: 'Mohair' },
    { id: 'alpaca', pl: 'Alpaka', en: 'Alpaca', de: 'Alpaka', fr: 'Alpaga', it: 'Alpaca', es: 'Alpaca', nl: 'Alpaca' },
    { id: 'hemp', pl: 'Konopie', en: 'Hemp', de: 'Hanf', fr: 'Chanvre', it: 'Canapa', es: 'Cáñamo', nl: 'Hennep' },
    { id: 'acrylic', pl: 'Akryl', en: 'Acrylic', de: 'Acryl', fr: 'Acrylique', it: 'Acrilico', es: 'Acrílico', nl: 'Acryl' },
    { id: 'metallic', pl: 'Lureks', en: 'Metallic', de: 'Lurex', fr: 'Lurex', it: 'Lurex', es: 'Lúrex', nl: 'Lurex' },
    { id: 'leather', pl: 'Skóra', en: 'Leather', de: 'Leder', fr: 'Cuir', it: 'Pelle', es: 'Piel', nl: 'Leer' },
  ];

  const COLORS = [
    { id: 'black', pl: 'Czarny', en: 'Black', de: 'Schwarz', fr: 'Noir', it: 'Nero', es: 'Negro', nl: 'Zwart', hex: '#1c1c1e' },
    { id: 'white', pl: 'Biały', en: 'White', de: 'Weiß', fr: 'Blanc', it: 'Bianco', es: 'Blanco', nl: 'Wit', hex: '#ffffff' },
    { id: 'cream', pl: 'Kremowy', en: 'Cream', de: 'Creme', fr: 'Crème', it: 'Panna', es: 'Crema', nl: 'Crème', hex: '#efe6d2' },
    { id: 'beige', pl: 'Beżowy', en: 'Beige', de: 'Beige', fr: 'Beige', it: 'Beige', es: 'Beige', nl: 'Beige', hex: '#cdb491' },
    { id: 'brown', pl: 'Brązowy', en: 'Brown', de: 'Braun', fr: 'Marron', it: 'Marrone', es: 'Marrón', nl: 'Bruin', hex: '#7a5134' },
    { id: 'grey', pl: 'Szary', en: 'Grey', de: 'Grau', fr: 'Gris', it: 'Grigio', es: 'Gris', nl: 'Grijs', hex: '#8e9196' },
    { id: 'blue', pl: 'Niebieski', en: 'Blue', de: 'Blau', fr: 'Bleu', it: 'Blu', es: 'Azul', nl: 'Blauw', hex: '#2f5fb3' },
    { id: 'green', pl: 'Zielony', en: 'Green', de: 'Grün', fr: 'Vert', it: 'Verde', es: 'Verde', nl: 'Groen', hex: '#3f7f4f' },
    { id: 'red', pl: 'Czerwony', en: 'Red', de: 'Rot', fr: 'Rouge', it: 'Rosso', es: 'Rojo', nl: 'Rood', hex: '#b8312f' },
    { id: 'pink', pl: 'Różowy', en: 'Pink', de: 'Rosa', fr: 'Rose', it: 'Rosa', es: 'Rosa', nl: 'Roze', hex: '#e48aa6' },
    { id: 'purple', pl: 'Fioletowy', en: 'Purple', de: 'Lila', fr: 'Violet', it: 'Viola', es: 'Morado', nl: 'Paars', hex: '#6d4b9a' },
    { id: 'yellow', pl: 'Żółty', en: 'Yellow', de: 'Gelb', fr: 'Jaune', it: 'Giallo', es: 'Amarillo', nl: 'Geel', hex: '#e8c23a' },
    { id: 'orange', pl: 'Pomarańczowy', en: 'Orange', de: 'Orange', fr: 'Orange', it: 'Arancione', es: 'Naranja', nl: 'Oranje', hex: '#e07a2e' },
    { id: 'gold', pl: 'Złoty', en: 'Gold', de: 'Gold', fr: 'Or', it: 'Oro', es: 'Dorado', nl: 'Goud', hex: '#c9a24a' },
    { id: 'silver', pl: 'Srebrny', en: 'Silver', de: 'Silber', fr: 'Argent', it: 'Argento', es: 'Plata', nl: 'Zilver', hex: '#bfc3c7' },
  ];

  const MAX_PRICE_STEPS = [10, 20, 40, 80, 150];   // €/m
  const MIN_WIDTH_STEPS = [110, 140, 150];        // cm
  const SORTS = ['newest', 'price_asc', 'price_desc'];
  // Filtr składu: minimalny udział wybranego włókna (%) i „bez syntetyków” (najwyżej 5%, np. elastanu)
  const PURITY_STEPS = [50, 80, 100];
  const SYNTHETIC = ['polyester', 'polyamide', 'acrylic', 'elastane', 'metallic'];
  const MAX_SYNTHETIC_PCT = 5;
  // Ile metrów potrzebujesz: ukrywamy oferty, o których wiemy, że zostało mniej
  const MIN_STOCK_STEPS = [2, 3, 5, 10, 20];
  // Gramatura (g/m²): przedziały, w których myślą krawcy (szyfon / sukienkowe / spodniowe / płaszczowe)
  const WEIGHT_RANGES = { light: [0, 120], medium: [120, 250], heavy: [250, 400], xheavy: [400, null] };
  const WEIGHT_SLIDER_MAX = 600;   // suwak 0–600 g/m²; 600 = „600 i więcej” (bez górnej granicy)
  const WEIGHT_STEP = 10;
  /** Gotowy przedział pasujący do zakresu od–do (np. 'medium') albo null, gdy zakres jest własny. */
  function weightPreset(min, max) {
    for (const [k, [lo, hi]] of Object.entries(WEIGHT_RANGES)) {
      if ((min || 0) === lo && (max == null ? null : max) === hi) return k;
    }
    return null;
  }
  /** Opis zakresu bez słów (działa w każdym języku): „120–250 g/m²”, „400+ g/m²”, „< 120 g/m²”. */
  function weightLabel(min, max) {
    if (min && max) return `${min}–${max} g/m²`;
    if (min) return `${min}+ g/m²`;
    if (max) return `< ${max} g/m²`;
    return '';
  }
  const PAGE_SIZE = 30;

  function defaultFilters() {
    return {
      q: '', kind: 'all', fibers: [], colors: [], maxPrice: null, minWidth: null,
      countries: [], shops: [], newDays: null, sort: 'newest',
      purity: null, noSynthetic: false, minStock: null, stockKnown: false, pattern: null, weightMin: null, weightMax: null,
    };
  }

  function normalizeFilters(f) {
    const d = defaultFilters();
    const out = Object.assign({}, d, f || {});
    out.q = String(out.q || '').trim().slice(0, 80);
    if (!['all', 'fabric', 'leather'].includes(out.kind)) out.kind = 'all';
    for (const k of ['fibers', 'colors', 'countries', 'shops']) {
      out[k] = Array.isArray(out[k]) ? Array.from(new Set(out[k].map(String))).sort() : [];
    }
    out.fibers = out.fibers.filter((x) => FIBERS.some((f2) => f2.id === x));
    out.colors = out.colors.filter((x) => COLORS.some((c) => c.id === x));
    out.maxPrice = MAX_PRICE_STEPS.includes(out.maxPrice) ? out.maxPrice : null;
    out.minWidth = MIN_WIDTH_STEPS.includes(out.minWidth) ? out.minWidth : null;
    out.newDays = [1, 7, 30].includes(out.newDays) ? out.newDays : null;
    // Udział ma sens tylko z wybranym materiałem
    out.purity = PURITY_STEPS.includes(out.purity) && out.fibers.length ? out.purity : null;
    out.noSynthetic = out.noSynthetic === true;
    out.minStock = MIN_STOCK_STEPS.includes(out.minStock) ? out.minStock : null;
    out.stockKnown = out.stockKnown === true;
    out.pattern = ['plain', 'patterned'].includes(out.pattern) ? out.pattern : null;
    // Gramatura od–do (g/m²). Starsze alerty i linki mają jeszcze „weight: 'medium'”: zamieniamy na zakres.
    if (out.weight && Object.prototype.hasOwnProperty.call(WEIGHT_RANGES, out.weight)) {
      const [lo, hi] = WEIGHT_RANGES[out.weight];
      out.weightMin = lo || null;
      out.weightMax = hi;
    }
    delete out.weight;
    const wnum = (v) => (v == null || v === '' || !Number.isFinite(Number(v)) ? null : Math.round(Number(v) / WEIGHT_STEP) * WEIGHT_STEP);
    out.weightMin = wnum(out.weightMin);
    out.weightMax = wnum(out.weightMax);
    if (!(out.weightMin > 0)) out.weightMin = null;
    if (out.weightMin != null && out.weightMin >= WEIGHT_SLIDER_MAX) out.weightMin = WEIGHT_SLIDER_MAX - WEIGHT_STEP;
    if (!(out.weightMax > 0) || out.weightMax >= WEIGHT_SLIDER_MAX) out.weightMax = null;
    if (out.weightMin != null && out.weightMax != null && out.weightMax <= out.weightMin) out.weightMax = null;
    if (!SORTS.includes(out.sort)) out.sort = 'newest';
    return out;
  }

  /** Liczba ustawionych filtrów (bez wyszukiwanego tekstu i sortowania). */
  function countActive(f) {
    const n = normalizeFilters(f);
    return (n.kind !== 'all' ? 1 : 0) + n.fibers.length + n.colors.length + (n.maxPrice ? 1 : 0) +
      (n.minWidth ? 1 : 0) + n.countries.length + n.shops.length + (n.newDays ? 1 : 0) +
      (n.purity ? 1 : 0) + (n.noSynthetic ? 1 : 0) + (n.minStock ? 1 : 0) + (n.stockKnown ? 1 : 0) + (n.pattern ? 1 : 0) +
      (n.weightMin != null || n.weightMax != null ? 1 : 0);
  }

  /** Klucz porównawczy filtrów (do alertów i pamięci podręcznej). */
  function filtersKey(f) {
    const n = normalizeFilters(f);
    delete n.sort;
    return JSON.stringify(n);
  }

  // --- Wyszukiwanie tekstowe ------------------------------------------------
  // Słowa w różnych językach, które zamieniamy na nazwy wspólne (jak w bazie).
  const WORD_ALIASES = (() => {
    const map = {};
    const add = (canon, words) => words.forEach((w) => { map[w] = canon; });
    add('silk', ['jedwab', 'jedwabna', 'jedwabny', 'seta', 'soie', 'seide', 'zijde', 'seda']);
    add('wool', ['wełna', 'welna', 'wełniana', 'welniana', 'wełniany', 'lana', 'laine', 'wolle', 'wol']);
    add('cashmere', ['kaszmir', 'cachemire', 'kaschmir']);
    add('cotton', ['bawełna', 'bawelna', 'bawełniana', 'cotone', 'coton', 'baumwolle', 'katoen', 'algodon']);
    add('linen', ['len', 'lniana', 'lniany', 'lino', 'leinen', 'linnen']);
    add('viscose', ['wiskoza', 'viscosa', 'viskose', 'rayon']);
    add('leather', ['skóra', 'skora', 'skórzana', 'pelle', 'cuir', 'leder']);
    add('polyester', ['poliester']);
    add('elastane', ['elastan', 'lycra', 'spandex']);
    for (const c of COLORS) add(c.id, [c.pl.toLowerCase()]);
    add('black', ['czarna', 'czarne']);
    add('white', ['biała', 'biale', 'białe']);
    add('blue', ['granatowy', 'granat', 'navy', 'niebieska']);
    add('green', ['zielona', 'oliwkowy', 'khaki']);
    add('red', ['czerwona', 'bordowy', 'bordo']);
    add('pink', ['różowa', 'rozowy']);
    add('grey', ['szara', 'gray', 'popielaty']);
    return map;
  })();


  // Rodzaje tkanin i wzory w wielu językach: wpisanie dowolnego słowa z grupy szuka wszystkich naraz
  // (PL, EN, FR, IT, DE, NL, ES, PT). „=słowo” = tylko całe słowo (krótkie, łatwo o fałszywe trafienia);
  // kilka słów = wyrażenie (słowa obok siebie), np. „velours côtelé” (samo „côtelé” to też dzianina w prążek).
  const TERM_GROUPS = [
    ['sztruks', 'corduroy', 'velours côtelé', 'velours cotele', 'milleraies', 'mille raies', '1000 raies', 'velluto a coste', 'millerighe', 'cordsamt', 'feincord', 'babycord', 'needlecord', 'ribfluweel', 'bombazina'],
    ['aksamit', 'welur', 'velvet', 'velours', 'velluto', 'samt', 'fluweel', 'terciopelo', 'veludo'],
    ['plusz', 'plush', 'peluche', 'plüsch', 'pluche', 'minky'],
    ['dżins', 'dzins', 'jeans', 'denim'],
    ['tiul', 'tulle', 'tüll', 'tule'],
    ['koronka', 'koronkowy', 'lace', 'dentelle', 'pizzo', 'spitze', '=kant', 'encaje', 'renda', 'guipure', 'gipiura'],
    ['szyfon', 'chiffon', 'mousseline', 'chifón'],
    ['krepa', 'crepe', 'crêpe', 'crespo', 'krepp', 'crep'],
    ['satyna', 'satin', 'raso', 'satijn', 'cetim', 'charmeuse'],
    ['tafta', 'taffeta', 'taffetas', 'taft', 'tafetán', 'tafetá'],
    ['organza', 'organdi', 'organdy'],
    ['żakard', 'zakard', 'jacquard'],
    ['tweed'],
    ['flanela', 'flannel', 'flanelle', 'flanella', 'flanell', 'franela'],
    ['dzianina', 'jersey', 'knit', 'maille', 'tricot', 'maglia', 'strick', 'tricô', 'punto'],
    ['popelina', 'poplin', 'popeline', 'popelin', 'popelín'],
    ['gabardyna', 'gabardine', 'gabardina'],
    ['muślin', 'muslin', 'mussola', 'musselin', 'muselina'],
    ['batyst', 'batiste', 'batista', 'cambric'],
    ['płótno', 'plotno', 'canvas', 'toile', '=tela', 'leinwand', 'lona'],
    ['diagonal', 'twill', 'sergé', 'serge', 'saia', 'köper', 'keper', 'sarga'],
    ['boucle', 'bouclé'],
    ['frotte', 'frotté', 'terry', 'éponge', 'eponge', 'spugna', 'frottee', 'badstof', 'rizo', 'atoalhado'],
    ['polar', 'fleece', 'polaire', 'fleecestoff'],
    ['podszewka', 'lining', 'doublure', 'fodera', 'futter', 'voering', 'forro'],
    ['filc', 'felt', 'feutre', 'feltro', 'filz', 'vilt', 'fieltro'],
    ['zamsz', 'suede', 'suède', 'daim', 'scamosciato', 'wildleder', 'camurça'],
    ['brokat', 'brocade', 'brocart', 'broccato', 'brokaat', 'brocado'],
    ['gaza', 'gauze', '=gaze', 'garza', 'gasa'],
    ['cekiny', 'sequin', 'paillette', 'paillettes', 'paillettato', 'pailletten', 'lentejuelas'],
    ['loden'],
    ['softshell'],
    ['neopren', 'neoprene', 'néoprène', 'scuba'],
    ['kratka', 'krata', 'check', 'tartan', 'carreaux', 'quadri', 'quadretti', '=karo', 'kariert', 'ruit', 'cuadros', 'xadrez', 'plaid', 'vichy', 'gingham'],
    ['paski', 'paseczki', 'stripe', 'stripes', 'rayure', 'rayures', 'righe', 'rigato', 'streifen', 'streep', 'rayas', 'riscas', 'pinstripe', 'gessato'],
    ['kwiaty', 'kwiatowy', 'kwiatki', 'floral', 'flower', 'fleurs', 'fleuri', 'fiori', 'floreale', 'blumen', 'bloemen', 'flores'],
    ['kropki', 'groszki', 'grochy', 'dots', 'polka', '=pois', 'punkte', 'stippen', 'lunares', 'bolinhas'],
    ['pepitka', 'houndstooth', 'pied-de-poule', 'pepita', 'hahnentritt'],
    ['jodełka', 'jodelka', 'herringbone', 'chevron', 'spina', 'fischgrat', 'visgraat', 'espiga'],
    ['haft', 'haftowany', 'embroidered', 'embroidery', 'brodé', 'broderie', 'ricamato', 'ricamo', 'bestickt', 'geborduurd', 'bordado'],
    ['nadruk', 'drukowany', 'printed', 'imprimé', 'stampato', 'stampa', 'bedruckt', 'bedrukt', 'estampado'],
    ['siatka', 'mesh', 'filet', 'netz', 'malla'],
    ['wodoodporny', 'waterproof', 'imperméable', 'impermeabile', 'wasserdicht', 'waterdicht', 'impermeable'],
  ];
  const GROUP_OF = (() => {
    const m = new Map();
    TERM_GROUPS.forEach((g, i) => g.forEach((t) => m.set(t.replace(/^=/, ''), i)));
    return m;
  })();
  /** Grupa słów dla wpisanego słowa: dokładnie albo z polską/obcą końcówką (np. „sztruksowa”, „velvets”). */
  function termGroup(word) {
    if (GROUP_OF.has(word)) return TERM_GROUPS[GROUP_OF.get(word)];
    if (word.length < 5) return null;
    let best = null, bestLen = 0;
    for (const [t, i] of GROUP_OF) {
      if (t.length >= 4 && word.startsWith(t) && t.length > bestLen && !TERM_GROUPS[i].includes('=' + t)) { best = i; bestLen = t.length; }
    }
    return best == null ? null : TERM_GROUPS[best];
  }
  const _tsSafe = (w) => w.replace(/[^\p{L}\p{N}]/gu, '');
  /** Słowo z grupy -> fragment to_tsquery: „=cord” -> cord, „velours côtelé” -> (velours <-> côtelé:*), „tulle” -> tulle:* */
  function _tsTerm(t) {
    if (t.startsWith('=')) return _tsSafe(t.slice(1));
    const words = t.split(/\s+/).map(_tsSafe).filter(Boolean);
    if (!words.length) return '';
    if (words.length === 1) return words[0] + ':*';
    return '(' + words.slice(0, -1).join(' <-> ') + ' <-> ' + words[words.length - 1] + ':*)';
  }

  // Polskie odmiany kolorów i materiałów: rdzeń słowa -> nazwa w bazie („brązowa”, „wełniany”, „jedwabne”)
  const STEM_ALIASES = [
    ['brązow', 'brown'], ['brazow', 'brown'], ['czarn', 'black'], ['biał', 'white'], ['bial', 'white'],
    ['kremow', 'cream'], ['ecru', 'cream'], ['beżow', 'beige'], ['bezow', 'beige'], ['szar', 'grey'], ['popiel', 'grey'],
    ['niebiesk', 'blue'], ['granatow', 'blue'], ['błękit', 'blue'], ['blekit', 'blue'], ['turkusow', 'blue'],
    ['zielon', 'green'], ['oliwkow', 'green'], ['butelkow', 'green'], ['czerwon', 'red'], ['bordow', 'red'], ['burgund', 'red'],
    ['różow', 'pink'], ['rozow', 'pink'], ['łososiow', 'pink'], ['fioletow', 'purple'], ['liliow', 'purple'], ['śliwkow', 'purple'],
    ['żółt', 'yellow'], ['zolt', 'yellow'], ['musztardow', 'yellow'], ['pomarańczow', 'orange'], ['pomaranczow', 'orange'],
    ['rdzaw', 'orange'], ['złot', 'gold'], ['zlot', 'gold'], ['srebrn', 'silver'],
    ['wełnian', 'wool'], ['welnian', 'wool'], ['bawełnian', 'cotton'], ['bawelnian', 'cotton'], ['jedwabn', 'silk'],
    ['lnian', 'linen'], ['wiskozow', 'viscose'], ['kaszmirow', 'cashmere'], ['poliestrow', 'polyester'], ['skórzan', 'leather'],
    ['skorzan', 'leather'], ['moherow', 'mohair'], ['alpak', 'alpaca'], ['konopn', 'hemp'],
  ];
  function aliasWord(w) {
    if (WORD_ALIASES[w]) return WORD_ALIASES[w];
    if (w.length >= 4) for (const [stem, canon] of STEM_ALIASES) if (w.startsWith(stem)) return canon;
    return w;
  }

  function searchWords(q) {
    return String(q || '').toLowerCase()
      .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
      .split(/\s+/).filter((w) => w.length >= 2).slice(0, 6)
      .map(aliasWord);
  }

  /** Słowa z wyszukiwarki, które są kolorem albo materiałem (w 7 językach i polskich odmianach), zamieniamy na filtry:
   *  „red silk” = kolor Czerwony + materiał Jedwab (filtry sprawdzają skład i kolor wariantu, a nie słowo w nazwie).
   *  final = false (w trakcie pisania): ostatnie słowo zostaje, dopóki nie postawisz po nim spacji. */
  const LANGS = ['pl', 'en', 'de', 'fr', 'it', 'es', 'nl'];
  const _plain = (w) => w.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l');
  const FILTER_WORDS = (() => {
    const map = {};
    const add = (word, kind, id) => {
      const k = String(word || '').toLowerCase();
      if (k.length < 3) return;   // „or” (fr. złoty) to też angielskie „lub”
      map[k] = map[k] || [kind, id];
      map[_plain(k)] = map[_plain(k)] || [kind, id];
    };
    COLORS.forEach((c) => { add(c.id, 'colors', c.id); LANGS.forEach((l) => add(c[l], 'colors', c.id)); });
    FIBERS.filter((f) => f.id !== 'leather').forEach((f) => { add(f.id, 'fibers', f.id); LANGS.forEach((l) => add(f[l], 'fibers', f.id)); });
    // wzór: gładkie / wzorzyste (ogólne słowa; konkretne wzory jak „kwiaty” zostają tekstem)
    ['plain', 'solid', 'gładki', 'gładka', 'gładkie', 'uni', 'unie', 'unito', 'einfarbig', 'unifarben', 'effen', 'liso', 'lisa']
      .forEach((w) => add(w, 'pattern', 'plain'));
    ['patterned', 'wzorzysty', 'wzorzysta', 'wzorzyste', 'gemustert', 'motifs', 'fantasia', 'gedessineerd']
      .forEach((w) => add(w, 'pattern', 'patterned'));
    return map;
  })();
  function filterWord(word) {
    const k = String(word || '').toLowerCase().replace(/[^\p{L}]/gu, '');
    if (k.length < 3) return null;
    if (FILTER_WORDS[k]) return FILTER_WORDS[k];
    if (FILTER_WORDS[_plain(k)]) return FILTER_WORDS[_plain(k)];
    const a = aliasWord(k);   // odmiany: „czerwona”, „jedwabny”, „wełniany”…
    return a !== k && FILTER_WORDS[a] ? FILTER_WORDS[a] : null;
  }
  // spójniki („silk or wool”, „jedwab lub wełna”) nie mają sensu jako tekst, gdy słowa obok stały się filtrami
  const STOP = ['or', 'and', 'lub', 'albo', 'oraz', 'und', 'oder', 'et', 'ou', 'en', 'of', 'y', 'o', 'e', 'i', 'w', 'in', 'z', 'with'];
  function extractFilters(text, final) {
    const raw = String(text || '');
    const words = raw.split(/\s+/).filter(Boolean);
    const keepLast = !final && words.length && !/\s$/.test(raw);
    const out = { q: '', colors: [], fibers: [], pattern: null };
    const rest = [];
    words.forEach((w, i) => {
      const hit = keepLast && i === words.length - 1 ? null : filterWord(w);
      if (hit && hit[0] === 'pattern') out.pattern = hit[1];
      else if (hit) { if (!out[hit[0]].includes(hit[1])) out[hit[0]].push(hit[1]); } else rest.push(w);
    });
    const found = out.colors.length + out.fibers.length > 0 || !!out.pattern;
    const kept = found ? rest.filter((w, i) => !(STOP.includes(w.toLowerCase()) && !(keepLast && i === rest.length - 1))) : rest;
    out.q = kept.join(' ');
    if (!final && /\s$/.test(raw) && kept.length) out.q += ' ';
    return out;
  }

  /** Tekst, którego naprawdę szukamy: wpisane słowa bez tych, które już działają jako włączony filtr
   *  („gold metallic” z filtrem Złoty → „metallic”). Słowo filtra, który jest wyłączony, zostaje zwykłym tekstem. */
  function textQuery(f) {
    const n = normalizeFilters(f);
    const words = n.q.split(/\s+/).filter(Boolean);
    let found = false;
    const rest = words.filter((w) => {
      const hit = filterWord(w);
      const on = hit && (hit[0] === 'pattern' ? n.pattern === hit[1] : n[hit[0]].includes(hit[1]));
      if (on) found = true;
      return !on;
    });
    return (found ? rest.filter((w) => !STOP.includes(w.toLowerCase())) : rest).join(' ');
  }

  /**
   * Wpisany tekst → filtry. Słowa koloru, materiału i wzoru włączają filtr (chip), a tekst zostaje w polu.
   *  prevTyped = wynik extractFilters z poprzedniego razu: nowe wpisane słowo ZASTĘPUJE wcześniej ustawiony
   *  filtr tego rodzaju (zielony → „gold” = złoty), a słowo usunięte z pola wyłącza swój filtr.
   *  Zwraca {filters, typed, changed: [{field, ids}]} (changed = co zastąpiło inny filtr, do krótkiej informacji).
   */
  function applySearchText(f, text, prevTyped, final) {
    const x = extractFilters(text, final);
    const prev = prevTyped || { colors: [], fibers: [], pattern: null };
    const n = normalizeFilters(Object.assign({}, f, { q: String(text || '').trim() }));
    const changed = [];
    for (const k of ['colors', 'fibers']) {
      const added = x[k].filter((v) => !prev[k].includes(v));
      let cur = n[k].filter((v) => !(prev[k].includes(v) && !x[k].includes(v)));
      if (added.length) {
        if (cur.some((v) => !x[k].includes(v))) changed.push({ field: k, ids: added });
        cur = x[k].slice();
      }
      n[k] = cur;
    }
    if (x.pattern && x.pattern !== prev.pattern) {
      if (n.pattern && n.pattern !== x.pattern) changed.push({ field: 'pattern', ids: [x.pattern] });
      n.pattern = x.pattern;
    } else if (!x.pattern && prev.pattern && n.pattern === prev.pattern) n.pattern = null;
    if (x.fibers.length && n.kind === 'leather') n.kind = 'all';
    return { filters: normalizeFilters(n), typed: x, changed };
  }

  /** Po zmianie filtrów poza polem (✕ na chipie, arkusz filtrów): słowa wyłączonych filtrów znikają z pola. */
  function dropOffFilterWords(f) {
    const n = normalizeFilters(f);
    const words = n.q.split(/\s+/).filter(Boolean);
    const kept = words.filter((w) => {
      const hit = filterWord(w);
      return !hit || (hit[0] === 'pattern' ? n.pattern === hit[1] : n[hit[0]].includes(hit[1]));
    });
    if (kept.length === words.length) return n;
    const anyFilter = kept.some((w) => filterWord(w));
    const q = (anyFilter ? kept : kept.filter((w) => !STOP.includes(w.toLowerCase()))).join(' ');
    return Object.assign(n, { q });
  }

  // --- Literówki: „velvit” → velvet, „metalic” → metallic -----------------------
  /** Ile pomyłek dopuszczamy: krótkie słowa (< 4 litery) żadnej, 4–7 liter jedną, 8+ dwie. */
  function maxTypos(len) { return len < 4 ? 0 : len <= 7 ? 1 : 2; }
  /** Odległość edycyjna (wstawienie, usunięcie, zamiana, przestawienie sąsiednich liter); > max → max + 1. */
  function editDistance(a, b, max) {
    if (Math.abs(a.length - b.length) > max) return max + 1;
    let prev2 = null;
    let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
    for (let i = 1; i <= a.length; i++) {
      const cur = [i];
      let rowMin = i;
      for (let j = 1; j <= b.length; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
        if (prev2 && i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prev2[j - 2] + 1);
        cur.push(v);
        if (v < rowMin) rowMin = v;
      }
      if (rowMin > max) return max + 1;
      prev2 = prev;
      prev = cur;
    }
    return Math.min(prev[b.length], max + 1);
  }
  /** Słowa tkanin, kolorów, materiałów i wzorów, które znamy zawsze (też bez listy słów z nazw ofert). */
  function baseWords() {
    const out = new Set();
    const add = (w) => String(w || '').toLowerCase().split(/\s+/).forEach((x) => { x = x.replace(/^=/, ''); if (x.length >= 4) out.add(x); });
    TERM_GROUPS.forEach((g) => g.forEach(add));
    Object.keys(FILTER_WORDS).forEach(add);
    Object.keys(WORD_ALIASES).forEach(add);
    return [...out];
  }
  /**
   * Poprawianie pisowni. words = [[słowo, ile razy w nazwach ofert], ...] (data/words.json, z nazw ofert w bazie).
   *  correct(tekst) → poprawiony tekst albo null, gdy nie ma czego poprawić. Słowa znane (z listy, filtry, odmiany,
   *  początki znanych słów) zostają; nieznane zamieniamy na najbliższe znane (najmniej pomyłek, potem najczęstsze).
   */
  function makeSpeller(words) {
    const byKey = new Map();   // forma bez ogonków → {w, n}
    const put = (w, cnt) => {
      const k = _plain(w);
      const cur = byKey.get(k);
      if (!cur || cnt > cur.n) byKey.set(k, { w, n: cnt });
    };
    for (const [w, cnt] of words || []) if (w && String(w).length >= 4) put(String(w).toLowerCase(), Number(cnt) || 1);
    for (const w of baseWords()) put(w, 1e6);   // słowa tkanin wygrywają remisy
    const keys = [...byKey.keys()];
    function known(w) {
      const k = _plain(w);
      if (byKey.has(k) || filterWord(w) || termGroup(w) || aliasWord(w) !== w) return true;
      return keys.some((x) => x.length > k.length && x.startsWith(k));
    }
    function fix(w) {
      const k = _plain(w);
      const max = maxTypos(k.length);
      if (!max || known(w)) return null;
      let best = null, bestD = max + 1, bestN = -1;
      for (const x of keys) {
        if (Math.abs(x.length - k.length) > max || maxTypos(x.length) === 0) continue;
        const d = editDistance(k, x, max);
        if (d > max) continue;
        const e = byKey.get(x);
        if (d < bestD || (d === bestD && e.n > bestN)) { best = e.w; bestD = d; bestN = e.n; }
      }
      return best;
    }
    function correct(text) {
      let changed = false;
      const out = String(text || '').trim().split(/(\s+)/).map((part) => {
        const w = part.toLowerCase();
        if (!/^[\p{L}-]+$/u.test(w)) return part;
        const c = fix(w);
        if (c && c !== w) { changed = true; return c; }
        return part;
      }).join('');
      return changed ? out : null;
    }
    return { correct, size: byKey.size };
  }
  /** Lista słów z nazw ofert (tryb podglądu: z próbki ofert). */
  function titleWordCounts(products) {
    const cnt = new Map();
    for (const p of products || []) {
      for (const w of String(p.title || '').toLowerCase().split(/[^\p{L}]+/u)) if (w.length >= 4) cnt.set(w, (cnt.get(w) || 0) + 1);
    }
    return [...cnt.entries()];
  }

  /** Czy szukane słowa są w nazwie oferty (do kolejności „najpierw trafienia w nazwie”). */
  function titleMatches(p, q) {
    const words = searchWords(q);
    if (!words.length) return false;
    const tokens = String(p.title || '').toLowerCase().split(/[^\p{L}\p{N}]+/u);
    const hit = (v) => tokens.some((_, i) => v.words.every((vw, k) => {
      const t = tokens[i + k] || '';
      return v.exact || k < v.words.length - 1 ? t === vw : t.startsWith(vw);
    }));
    return words.every((w) => wordVariants(w).some(hit));
  }

  /** Warianty słowa do dopasowania lokalnie (tryb podglądu): całe grupy tłumaczeń. */
  function wordVariants(w) {
    const g = termGroup(w);
    return g ? g.map((t) => ({ t: t.replace(/^=/, ''), exact: t.startsWith('='), words: t.replace(/^=/, '').split(/\s+/) }))
      : [{ t: w, exact: false, words: [w] }];
  }

  /** Zapytanie Postgres to_tsquery: każde słowo jako przedrostek, wszystkie naraz. */
  function tsQuery(q) {
    const parts = searchWords(q).map((w) => {
      const g = termGroup(w);
      if (!g) { const t = _tsSafe(w); return t ? t + ':*' : ''; }
      const alts = [...new Set(g.map(_tsTerm).filter(Boolean))];
      return alts.length > 1 ? '(' + alts.join(' | ') + ')' : alts[0];
    }).filter(Boolean);
    return parts.join(' & ');
  }

  // --- Zapytanie do bazy (Supabase / PostgREST) -------------------------------
  const LIST_FIELDS = 'id,shop_id,title,url,image_url,kind,currency,price_min,price_unit,price_per_m,price_per_m_eur,' +
    'piece_length_m,stock_m,composition,fibers,colors,color_images,pattern,width_cm,weight_gsm,available,first_seen_at';

  function sinceIso(days, now) {
    return new Date((now || Date.now()) - days * 86400000).toISOString();
  }

  /** Kolumny filtrów, których wartości sklep może nie podać (null = nie wiadomo), dla aktywnych filtrów. */
  function unknownFields(f) {
    const n = normalizeFilters(f);
    const out = [];
    if (n.fibers.length) out.push(n.purity ? 'main_pct' : 'fibers');
    if (n.noSynthetic) out.push('synthetic_pct');
    if (n.minStock && !n.stockKnown) out.push('stock_m');
    if (n.pattern) out.push('pattern');
    if (n.weightMin != null || n.weightMax != null) out.push('weight_gsm');
    if (n.maxPrice) out.push('price_per_m_eur');
    if (n.minWidth) out.push('width_cm');
    return Array.from(new Set(out));
  }

  function restParams(f, opts) {
    const n = normalizeFilters(f);
    const o = Object.assign({ page: 0, now: Date.now(), shopsByCountry: {}, since: null, select: LIST_FIELDS }, opts || {});
    const p = [];
    p.push(['select', o.select]);
    p.push(['removed_at', 'is.null']);
    p.push(['available', 'eq.true']);   // „eq”, nie „is”: tak pasuje do częściowego indeksu products_live_idx
    if (n.kind === 'all') p.push(['kind', 'in.(fabric,leather)']);
    else p.push(['kind', 'eq.' + n.kind]);
    // Każdy filtr cechy, której sklep może nie podać (skład, gramatura…), ma dwa warianty:
    //  o.known = 'only'    → tylko oferty, o których WIEMY, że pasują (pierwsza część listy),
    //  o.known = 'missing' → pasują albo nie wiadomo, i brakuje co najmniej jednej z tych cech (druga część),
    //  bez o.known         → pasują albo nie wiadomo (całość: liczniki, alerty).
    // Warunki „lub” trafiają do and=(or(...),or(...)), żeby kilka naraz się nie nadpisywało.
    const strict = o.known === 'only';
    const ors = [];
    const fiberSet = '{' + n.fibers.join(',') + '}';
    if (n.fibers.length && n.purity) {
      // Włókno z udziałem ≥ 50% jest zawsze włóknem głównym, więc wystarczą main_fiber i main_pct.
      if (strict) {
        p.push(['main_fiber', 'in.(' + n.fibers.join(',') + ')']);
        p.push(['main_pct', 'gte.' + n.purity]);
      } else {
        ors.push('and(main_fiber.in.(' + n.fibers.join(',') + '),main_pct.gte.' + n.purity + '),' +
          'and(main_pct.is.null,or(fibers.is.null,fibers.ov.' + fiberSet + '))');
      }
    } else if (n.fibers.length) {
      if (strict) p.push(['fibers', 'ov.' + fiberSet]);
      else ors.push('fibers.is.null,fibers.ov.' + fiberSet);
    }
    if (n.noSynthetic) {
      if (strict) p.push(['synthetic_pct', 'lte.' + MAX_SYNTHETIC_PCT]);
      else ors.push('synthetic_pct.is.null,synthetic_pct.lte.' + MAX_SYNTHETIC_PCT);
    }
    if (n.stockKnown) p.push(['stock_m', 'gte.' + (n.minStock || 0.01)]);
    else if (n.minStock) {
      if (strict) p.push(['stock_m', 'gte.' + n.minStock]);
      else ors.push('stock_m.is.null,stock_m.gte.' + n.minStock);
    }
    if (n.colors.length) p.push(['colors', 'ov.{' + colorsWithNear(n.colors).join(',') + '}']);
    if (n.pattern) {
      if (strict) p.push(['pattern', 'eq.' + n.pattern]);
      else ors.push('pattern.is.null,pattern.eq.' + n.pattern);
    }
    if (n.weightMin != null || n.weightMax != null) {
      const lo = n.weightMin != null ? 'weight_gsm.gte.' + n.weightMin : 'weight_gsm.gt.0';
      const hi = n.weightMax != null ? 'weight_gsm.lt.' + n.weightMax : null;
      if (strict) {
        p.push(['weight_gsm', lo.slice('weight_gsm.'.length)]);
        if (hi) p.push(['weight_gsm', hi.slice('weight_gsm.'.length)]);
      } else ors.push('weight_gsm.is.null,' + (hi ? 'and(' + lo + ',' + hi + ')' : lo));
    }
    if (n.maxPrice) {
      if (strict) p.push(['price_per_m_eur', 'lte.' + n.maxPrice]);
      else ors.push('price_per_m_eur.is.null,price_per_m_eur.lte.' + n.maxPrice);
    }
    if (n.minWidth) {
      if (strict) p.push(['width_cm', 'gte.' + n.minWidth]);
      else ors.push('width_cm.is.null,width_cm.gte.' + n.minWidth);
    }
    if (o.known === 'missing') {
      const miss = unknownFields(n);
      if (miss.length) ors.push(miss.map((c) => c + '.is.null').join(','));
    }
    if (ors.length === 1) p.push(['or', '(' + ors[0] + ')']);
    else if (ors.length) p.push(['and', '(' + ors.map((x) => 'or(' + x + ')').join(',') + ')']);
    const shopIds = allowedShops(n, o.shopsByCountry);
    if (shopIds) p.push(['shop_id', 'in.(' + shopIds.join(',') + ')']);
    const since = o.since || (n.newDays ? sinceIso(n.newDays, o.now) : null);
    if (since) p.push(['first_seen_at', 'gt.' + since]);
    const ts = tsQuery(textQuery(n));
    if (ts) p.push(['search', 'fts(simple).' + ts]);
    // Kolejność „najtrafniejsze”: najpierw oferty z szukanym słowem w nazwie (o.title = 'only'), potem reszta ('exclude')
    if (ts && o.title === 'only') p.push(['title_fts', 'fts(simple).' + ts]);
    if (ts && o.title === 'exclude') p.push(['title_fts', 'not.fts(simple).' + ts]);
    if (n.sort === 'price_asc') p.push(['order', 'price_per_m_eur.asc.nullslast,first_seen_at.desc']);
    else if (n.sort === 'price_desc') p.push(['order', 'price_per_m_eur.desc.nullslast,first_seen_at.desc']);
    else p.push(['order', 'first_seen_at.desc,id.asc']);
    p.push(['limit', String(PAGE_SIZE)]);
    p.push(['offset', String(o.page * PAGE_SIZE)]);
    return p;
  }

  /** Sklepy dopuszczone przez filtry: SUMA sklepów z wybranych krajów i pojedynczo wybranych sklepów; null = wszystkie.
   *  (Kraj zapisujemy jako kraj, nie listę sklepów, żeby nowe sklepy z tego kraju też się łapały, np. w alertach.) */
  function allowedShops(n, shopsByCountry) {
    if (!n.countries.length && !n.shops.length) return null;
    const ids = [];
    for (const c of n.countries) ids.push(...(shopsByCountry[c] || []));
    ids.push(...n.shops);
    return ids.length ? Array.from(new Set(ids)).sort() : ['__none__'];
  }

  function countryOfShop(id, shopsByCountry) {
    return Object.keys(shopsByCountry).find((c) => (shopsByCountry[c] || []).includes(id)) || null;
  }

  /** Kliknięcie kraju w sekcji „Sklepy”: zaznacza / odznacza cały kraj (pojedyncze sklepy z niego stają się zbędne). */
  function toggleCountry(f, c, shopsByCountry) {
    const own = shopsByCountry[c] || [];
    const shops = f.shops.filter((x) => !own.includes(x));
    const countries = f.countries.includes(c) ? f.countries.filter((x) => x !== c) : f.countries.concat(c);
    return Object.assign({}, f, { countries, shops });
  }

  /** Kliknięcie sklepu: w zaznaczonym kraju odznacza tylko ten sklep (reszta kraju zostaje),
   *  a gdy zaznaczone są już wszystkie sklepy kraju, zwija je do kraju. */
  function toggleShop(f, id, shopsByCountry) {
    const c = countryOfShop(id, shopsByCountry);
    const own = c ? shopsByCountry[c] : [id];
    let countries = f.countries.slice();
    let shops = f.shops.slice();
    if (c && countries.includes(c)) {
      countries = countries.filter((x) => x !== c);
      shops = shops.concat(own.filter((x) => x !== id && !shops.includes(x)));
    } else {
      shops = shops.includes(id) ? shops.filter((x) => x !== id) : shops.concat(id);
      if (c && own.length > 1 && own.every((x) => shops.includes(x))) {
        shops = shops.filter((x) => !own.includes(x));
        countries = countries.concat(c);
      }
    }
    return Object.assign({}, f, { countries, shops });
  }

  /** Zdjęcie oferty: przy filtrze koloru wariant w tym kolorze (color_images), inaczej zdjęcie główne. */
  function pickImage(p, f) {
    const imgs = p && p.color_images;
    const wanted = f && f.colors && f.colors.length ? colorsWithNear(normalizeFilters(f).colors) : [];
    for (const c of wanted) if (imgs && imgs[c]) return imgs[c];
    return p ? p.image_url : null;
  }

  /** Link do sklepu ze znacznikiem źródła (utm), żeby sklep widział w swoich statystykach ruch z Remny.
   *  Nie nadpisuje utm, które już są w adresie; zachowuje inne parametry (np. ?variant=…) i #kotwicę. */
  /** Linki partnerskie (afiliacyjne): domena sklepu → parametr śledzący. Kolejność wyników od tego NIE zależy.
   *  EVA re-source: program GoAffPro (evaresource-store.goaffpro.com), kod polecający właścicielki. */
  const AFFILIATE_PARAMS = {
    'evaresource.com': ['ref', 'vqmfavjx'],
  };

  function shopUrl(url, medium) {
    if (!url) return url;
    try {
      const u = new URL(url);
      if (!u.searchParams.has('utm_source')) {
        u.searchParams.set('utm_source', 'remna');
        u.searchParams.set('utm_medium', medium || 'referral');
      }
      const aff = AFFILIATE_PARAMS[u.hostname.replace(/^www\./, '')];
      if (aff && !u.searchParams.has(aff[0])) u.searchParams.set(aff[0], aff[1]);
      return u.toString();
    } catch (e) { return url; }
  }

  function toQueryString(params) {
    return params.map(([k, v]) => encodeURIComponent(k) + '=' + encodeURIComponent(v)).join('&');
  }

  // --- To samo filtrowanie lokalnie (tryb podglądu bez bazy) -----------------
  function matchLocal(p, f, opts) {
    const n = normalizeFilters(f);
    const o = Object.assign({ now: Date.now(), shopsByCountry: {}, since: null }, opts || {});
    if (p.removed_at || !p.available) return false;
    if (n.kind === 'all' ? !['fabric', 'leather'].includes(p.kind) : p.kind !== n.kind) return false;
    // Nieznana wartość (sklep nie podał) nie wyklucza oferty; opts.known: 'only' = tylko pewne, 'missing' = tylko z brakami
    let unknown = false;
    const fibers = p.fibers && p.fibers.length ? p.fibers : null;
    const comp = p.composition && Object.keys(p.composition).length ? p.composition : null;
    if (n.fibers.length && n.purity) {
      if (comp) { if (!n.fibers.some((x) => (comp[x] || 0) >= n.purity)) return false; }
      else if (fibers && !fibers.some((x) => n.fibers.includes(x))) return false;
      else unknown = true;
    } else if (n.fibers.length) {
      if (!fibers) unknown = true;
      else if (!fibers.some((x) => n.fibers.includes(x))) return false;
    }
    if (n.noSynthetic) {
      if (!comp) unknown = true;
      else if (syntheticShare(comp) > MAX_SYNTHETIC_PCT) return false;
    }
    const stock = p.stock_m == null ? null : Number(p.stock_m);
    if (n.stockKnown && !(stock != null && stock >= (n.minStock || 0.01))) return false;
    if (n.minStock && !n.stockKnown) {
      if (stock == null) unknown = true;
      else if (stock < n.minStock) return false;
    }
    if (n.colors.length && !(p.colors || []).some((x) => colorsWithNear(n.colors).includes(x))) return false;
    if (n.pattern) {
      if (!p.pattern) unknown = true;
      else if (p.pattern !== n.pattern) return false;
    }
    if (n.weightMin != null || n.weightMax != null) {
      const g = p.weight_gsm == null ? null : Number(p.weight_gsm);
      if (g == null) unknown = true;
      else if (!(g > 0) || (n.weightMin != null && g < n.weightMin) || (n.weightMax != null && g >= n.weightMax)) return false;
    }
    if (n.maxPrice) {
      if (p.price_per_m_eur == null) unknown = true;
      else if (p.price_per_m_eur > n.maxPrice) return false;
    }
    if (n.minWidth) {
      if (p.width_cm == null) unknown = true;
      else if (p.width_cm < n.minWidth) return false;
    }
    if (o.known === 'only' && unknown) return false;
    if (o.known === 'missing' && !unknown) return false;
    const shopIds = allowedShops(n, o.shopsByCountry);
    if (shopIds && !shopIds.includes(p.shop_id)) return false;
    const since = o.since || (n.newDays ? sinceIso(n.newDays, o.now) : null);
    if (since && !(p.first_seen_at && p.first_seen_at > since)) return false;
    const words = searchWords(textQuery(n));
    if (words.length) {
      const hay = ((p.search_text || p.title || '') + ' ' + (p.fibers || []).join(' ') + ' ' + (p.colors || []).join(' ')).toLowerCase();
      const tokens = hay.split(/[^\p{L}\p{N}]+/u);
      const hit = (v) => tokens.some((_, i) => v.words.every((vw, k) => {
        const t = tokens[i + k] || '';
        return v.exact || k < v.words.length - 1 ? t === vw : t.startsWith(vw);
      }));
      if (!words.every((w) => wordVariants(w).some(hit))) return false;
    }
    return true;
  }

  /** Suma udziałów włókien syntetycznych w składzie (%). */
  function syntheticShare(comp) {
    return SYNTHETIC.reduce((sum, k) => sum + (Number(comp[k]) || 0), 0);
  }

  function sortLocal(list, sort) {
    const byNew = (a, b) => (b.first_seen_at || '').localeCompare(a.first_seen_at || '') || a.id.localeCompare(b.id);
    const price = (x) => (x.price_per_m_eur == null ? null : x.price_per_m_eur);
    const arr = list.slice();
    if (sort === 'price_asc' || sort === 'price_desc') {
      const dir = sort === 'price_asc' ? 1 : -1;
      arr.sort((a, b) => {
        const pa = price(a), pb = price(b);
        if (pa == null && pb == null) return byNew(a, b);
        if (pa == null) return 1;
        if (pb == null) return -1;
        return (pa - pb) * dir || byNew(a, b);
      });
    } else arr.sort(byNew);
    return arr;
  }

  // --- Ceny i opisy -----------------------------------------------------------
  const CURRENCY_SIGN = { EUR: '€', GBP: '£', CHF: 'CHF', SEK: 'kr', DKK: 'kr', PLN: 'zł', USD: '$' };

  function money(value, currency, lang) {
    if (value == null || isNaN(value)) return '';
    const locale = { pl: 'pl-PL', en: 'en-GB', de: 'de-DE', fr: 'fr-FR', it: 'it-IT', es: 'es-ES', nl: 'nl-NL' }[lang] || 'en-GB';
    try {
      return new Intl.NumberFormat(locale, { style: 'currency', currency: currency || 'EUR', currencyDisplay: 'narrowSymbol', maximumFractionDigits: value < 100 ? 2 : 0 }).format(value);
    } catch (e) {
      return value.toFixed(2) + ' ' + (CURRENCY_SIGN[currency] || currency || '');
    }
  }

  /** Najważniejsza cena na karcie: za metr, jeśli ją znamy. */
  function priceParts(p, lang) {
    const cur = p.currency || 'EUR';
    if (p.price_per_m != null) {
      const main = money(p.price_per_m, cur, lang);
      const eur = cur !== 'EUR' && p.price_per_m_eur != null ? money(p.price_per_m_eur, 'EUR', lang) : null;
      return { main, unit: 'per_m', eur, piece: p.price_unit === 'piece' ? p.piece_length_m : null, total: p.price_unit === 'piece' ? money(p.price_min, cur, lang) : null };
    }
    return { main: money(p.price_min, cur, lang), unit: p.kind === 'leather' ? 'leather' : 'unknown', eur: null, piece: null, total: null };
  }

  function compositionText(p, lang) {
    const names = Object.fromEntries(FIBERS.map((f) => [f.id, f[lang] || f.en]));
    if (p.composition && Object.keys(p.composition).length) {
      return Object.entries(p.composition)
        .sort((a, b) => b[1] - a[1])
        .map(([k, v]) => `${Math.round(v * 10) / 10}% ${(names[k] || k).toLowerCase()}`)
        .join(', ');
    }
    if (p.fibers && p.fibers.length) return p.fibers.map((k) => names[k] || k).join(', ');
    return '';
  }

  // Jasne neutralne kolory przechodzą jeden w drugi (granica zależy od sklepu i zdjęcia), więc szukamy też sąsiada
  const COLOR_NEAR = { white: ['cream'], cream: ['white', 'beige'], beige: ['cream'] };
  function colorsWithNear(ids) {
    const out = new Set(ids);
    for (const id of ids) for (const x of COLOR_NEAR[id] || []) out.add(x);
    return [...out].sort();
  }

  /** Filtry jako parametry adresu (tylko różne od domyślnych), np. ?q=sztruks&colors=brown&pattern=plain */
  function filtersToParams(f) {
    const n = normalizeFilters(f);
    const d = defaultFilters();
    const out = [];
    for (const k of Object.keys(d)) {
      const v = n[k];
      if (Array.isArray(v)) { if (v.length) out.push([k, v.join(',')]); }
      else if (typeof v === 'boolean') { if (v) out.push([k, '1']); }
      else if (v != null && v !== d[k] && v !== '') out.push([k, String(v)]);
    }
    return out;
  }
  /** Odwrotnie: parametry adresu -> filtry (null = w adresie nie ma żadnego filtra) */
  function filtersFromParams(params) {
    const d = defaultFilters();
    const f = {};
    let any = false;
    for (const k of Object.keys(d)) {
      if (!params.has(k)) continue;
      any = true;
      const raw = params.get(k);
      if (Array.isArray(d[k])) f[k] = raw.split(',').filter(Boolean);
      else if (typeof d[k] === 'boolean') f[k] = raw === '1' || raw === 'true';
      else if (/^\d+(\.\d+)?$/.test(raw) && k !== 'q') f[k] = Number(raw);
      else f[k] = raw;
    }
    if (params.has('weight')) { any = true; f.weight = params.get('weight'); }   // starsze linki
    return any ? normalizeFilters(f) : null;
  }

  /**
   * Nazwa do wyświetlenia: „CREPE SATINÉ MOTIF LÉOPARD” -> „Crepe satiné motif léopard”.
   * Tylko gdy nazwa jest cała wielkimi literami; kody z cyframi („T26A16561”, „M8”) zostają bez zmian.
   */
  function displayTitle(title) {
    const t = String(title || '').trim();
    const letters = t.replace(/[^\p{L}]/gu, '');
    const upper = letters.replace(/[^\p{Lu}]/gu, '').length;
    if (letters.length < 6 || upper / letters.length < 0.75) return t;   // np. „(Chute) VELOURS DE COTON” też
    let first = true;
    return t.split(/(\s+)/).map((w) => {
      if (/^\s+$/.test(w) || /\d/.test(w)) return w;
      const lower = w.toLocaleLowerCase('fr');
      if (first && /\p{L}/u.test(w)) {
        first = false;
        return lower.replace(/\p{L}/u, (c) => c.toLocaleUpperCase('fr'));
      }
      return lower;
    }).join('');
  }

  function imageUrl(url, width) {
    if (!url) return '';
    if (/cdn\.shopify\.com|\/cdn\/shop\//.test(url)) {
      return url + (url.includes('?') ? '&' : '?') + 'width=' + (width || 480);
    }
    return url;
  }

  // --- Pamięć na telefonie: ulubione i alerty ---------------------------------
  function readJson(storage, key, fallback) {
    try {
      const v = JSON.parse(storage.getItem(key));
      return v == null ? fallback : v;
    } catch (e) { return fallback; }
  }
  function writeJson(storage, key, value) {
    try { storage.setItem(key, JSON.stringify(value)); } catch (e) { /* pełna pamięć: pomijamy */ }
  }

  function makeFavorites(storage) {
    const KEY = 'remna-ulubione';
    let items = readJson(storage, KEY, []);   // [{id, ...podgląd, savedAt}]
    if (!Array.isArray(items)) items = [];
    const save = () => writeJson(storage, KEY, items);
    return {
      list: () => items.slice(),
      has: (id) => items.some((x) => x.id === id),
      toggle(product) {
        if (items.some((x) => x.id === product.id)) items = items.filter((x) => x.id !== product.id);
        else items.unshift(Object.assign({}, product, { savedAt: new Date().toISOString() }));
        save();
        return items.some((x) => x.id === product.id);
      },
      update(product) {   // świeże dane (cena, dostępność) z bazy
        const i = items.findIndex((x) => x.id === product.id);
        if (i >= 0) { items[i] = Object.assign({}, items[i], product); save(); }
      },
    };
  }

  const MAX_ALERTS = 20;

  function makeAlerts(storage, now) {
    const KEY = 'remna-alerty';
    const clock = now || (() => Date.now());
    let items = readJson(storage, KEY, []);   // [{id, name, filters, createdAt, seenAt, newCount}]
    if (!Array.isArray(items)) items = [];
    const save = () => writeJson(storage, KEY, items);
    return {
      list: () => items.slice(),
      find: (filters) => items.find((a) => filtersKey(a.filters) === filtersKey(filters)) || null,
      add(name, filters) {
        const existing = this.find(filters);
        if (existing) return existing;
        if (items.length >= MAX_ALERTS) return null;
        const iso = new Date(clock()).toISOString();
        const a = { id: 'a' + clock().toString(36) + Math.random().toString(36).slice(2, 6), name: String(name || '').slice(0, 60), filters: normalizeFilters(filters), createdAt: iso, seenAt: iso, newCount: 0 };
        items.unshift(a);
        save();
        return a;
      },
      remove(id) { items = items.filter((a) => a.id !== id); save(); },
      rename(id, name) { const a = items.find((x) => x.id === id); if (a) { a.name = String(name).slice(0, 60); save(); } },
      setNewCount(id, n) { const a = items.find((x) => x.id === id); if (a && a.newCount !== n) { a.newCount = n; save(); } },
      markSeen(id) { const a = items.find((x) => x.id === id); if (a) { a.seenAt = new Date(clock()).toISOString(); a.newCount = 0; save(); } },
      totalNew: () => items.reduce((s, a) => s + (a.newCount || 0), 0),
    };
  }

  /** Domyślna nazwa alertu z ustawionych filtrów, np. „Jedwab, niebieski, do 40 €/m”. */
  // Słówka do nazw alertów (np. „Jedwab, niebieski, do 40 €/m”)
  const DESCRIBE = {
    pl: { leather: 'skóry', or: ' lub ', noSynth: 'bez syntetyków', plain: 'jednolite', patterned: 'wzorzyste', upTo: 'do ', width: 'szer. od ', all: 'Wszystkie nowe tkaniny', weight: { light: 'lekkie', medium: 'średnie', heavy: 'ciężkie', xheavy: 'bardzo ciężkie' } },
    en: { leather: 'leather', or: ' or ', noSynth: 'no synthetics', plain: 'plain', patterned: 'patterned', upTo: 'up to ', width: 'width from ', all: 'All new fabrics', weight: { light: 'light', medium: 'medium weight', heavy: 'heavy', xheavy: 'very heavy' } },
    de: { leather: 'Leder', or: ' oder ', noSynth: 'ohne Synthetik', plain: 'uni', patterned: 'gemustert', upTo: 'bis ', width: 'Breite ab ', all: 'Alle neuen Stoffe', weight: { light: 'leicht', medium: 'mittel', heavy: 'schwer', xheavy: 'sehr schwer' } },
    fr: { leather: 'cuir', or: ' ou ', noSynth: 'sans synthétique', plain: 'uni', patterned: 'à motifs', upTo: 'jusqu’à ', width: 'laize dès ', all: 'Tous les nouveaux tissus', weight: { light: 'léger', medium: 'moyen', heavy: 'lourd', xheavy: 'très lourd' } },
    it: { leather: 'pelle', or: ' o ', noSynth: 'senza sintetici', plain: 'tinta unita', patterned: 'fantasia', upTo: 'fino a ', width: 'altezza da ', all: 'Tutti i nuovi tessuti', weight: { light: 'leggero', medium: 'medio', heavy: 'pesante', xheavy: 'molto pesante' } },
    es: { leather: 'piel', or: ' o ', noSynth: 'sin sintéticos', plain: 'liso', patterned: 'estampado', upTo: 'hasta ', width: 'ancho desde ', all: 'Todos los tejidos nuevos', weight: { light: 'ligero', medium: 'medio', heavy: 'pesado', xheavy: 'muy pesado' } },
    nl: { leather: 'leer', or: ' of ', noSynth: 'zonder synthetisch', plain: 'effen', patterned: 'met dessin', upTo: 'tot ', width: 'breedte vanaf ', all: 'Alle nieuwe stoffen', weight: { light: 'licht', medium: 'gemiddeld', heavy: 'zwaar', xheavy: 'heel zwaar' } },
  };

  /** Domyślna nazwa alertu z ustawionych filtrów, np. „Jedwab, niebieski, do 40 €/m”. */
  function describeFilters(f, lang, shopsById) {
    const n = normalizeFilters(f);
    const L = DESCRIBE[lang] ? lang : 'en';
    const W = DESCRIBE[L];
    const parts = [];
    const tq = textQuery(n);
    if (tq) parts.push('„' + tq + '”');
    if (n.kind === 'leather') parts.push(W.leather);
    const fiberNames = n.fibers.map((id) => FIBERS.find((f2) => f2.id === id)).filter(Boolean).map((x) => (x[L] || x.en).toLowerCase());
    if (n.purity && fiberNames.length) {
      const joined = fiberNames.join(W.or);
      parts.push(n.purity === 100 ? '100% ' + joined : 'min. ' + n.purity + '% ' + joined);
    } else parts.push(...fiberNames);
    if (n.noSynthetic) parts.push(W.noSynth);
    if (n.minStock) parts.push('min. ' + n.minStock + ' m');
    if (n.pattern) parts.push(n.pattern === 'plain' ? W.plain : W.patterned);
    if (n.weightMin != null || n.weightMax != null) {
      const preset = weightPreset(n.weightMin, n.weightMax);
      parts.push(preset ? W.weight[preset] : weightLabel(n.weightMin, n.weightMax));
    }
    for (const id of n.colors) { const x = COLORS.find((c) => c.id === id); if (x) parts.push((x[L] || x.en).toLowerCase()); }
    if (n.maxPrice) parts.push(W.upTo + n.maxPrice + ' €/m');
    if (n.minWidth) parts.push(W.width + n.minWidth + ' cm');
    if (n.countries.length) parts.push(n.countries.join(', '));
    if (n.shops.length) parts.push(n.shops.map((s) => (shopsById && shopsById[s] ? shopsById[s].name : s)).join(', '));
    const text = parts.join(', ');
    if (!text) return W.all;
    return text.charAt(0).toUpperCase() + text.slice(1);
  }


  // --- Sprawdzanie dostępności w sklepie (z telefonu, jedno zapytanie na otwarcie oferty) ---
  /** Adres, pod którym sklep Shopify podaje dane jednego produktu (z dostępnością). */
  function liveCheckUrl(url) {
    const m = /^(https:\/\/[^/?#]+\/products\/[^/?#]+)/.exec(String(url || ''));
    return m ? m[1] + '.js' : null;
  }

  /**
   * Odpowiedź sklepu → 'available' | 'soldout' | 'gone' | null (nie wiadomo).
   * Ceny nie porównujemy: Shopify potrafi pokazać ją w walucie kraju telefonu.
   */
  function readLiveCheck(status, body) {
    if (status === 404 || status === 410) return 'gone';
    if (status !== 200 || !body || typeof body !== 'object') return null;
    if (typeof body.available === 'boolean') return body.available ? 'available' : 'soldout';
    if (Array.isArray(body.variants) && body.variants.length) {
      return body.variants.some((v) => v && v.available) ? 'available' : 'soldout';
    }
    return null;
  }

  const api = {
    FIBERS, COLORS, MAX_PRICE_STEPS, MIN_WIDTH_STEPS, SORTS, PAGE_SIZE, LIST_FIELDS,
    PURITY_STEPS, SYNTHETIC, MAX_SYNTHETIC_PCT, syntheticShare, MIN_STOCK_STEPS, WEIGHT_RANGES, colorsWithNear,
    WEIGHT_SLIDER_MAX, WEIGHT_STEP, weightPreset, weightLabel,
    defaultFilters, normalizeFilters, countActive, filtersKey, searchWords, tsQuery, termGroup, titleMatches,
    restParams, unknownFields, pickImage, shopUrl, extractFilters, textQuery, applySearchText, dropOffFilterWords,
    maxTypos, editDistance, makeSpeller, titleWordCounts, toQueryString, allowedShops, toggleCountry, toggleShop, matchLocal, sortLocal,
    money, priceParts, compositionText, imageUrl, displayTitle, filtersToParams, filtersFromParams,
    makeFavorites, makeAlerts, describeFilters, MAX_ALERTS,
    liveCheckUrl, readLiveCheck,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Remna = api;
})(typeof window !== 'undefined' ? window : globalThis);
