/* Foodology - Seguimiento de Ventas - App logic */
/* global BASE_DATE, DIM_COUNTRIES, DIM_CITIES, DIM_KITCHENS, DIM_BRANDS, DIM_PROVIDERS, DIM_COMBOS, DAILY, MONTHLY, Chart */

// ---------------------------------------------------------------------------
// 1. CONSTANTS
// ---------------------------------------------------------------------------

const FX = { COL: 4000, MEX: 20, PER: 3.7, ECU: 1 };
const LOCAL_SYMBOL = { COL: 'COP', MEX: 'MXN', PER: 'PEN', ECU: 'USD' };

const CHART_COLORS = ['#5cb85c', '#4a9fd4', '#e8a838', '#c94f4f', '#9b59b6', '#1abc9c', '#e67e22', '#3498db'];
const COLOR_POSITIVE = '#5cb85c';
const COLOR_NEGATIVE = '#c94f4f';
const COLOR_NEUTRAL = '#4a9fd4';
const COLOR_AMBER = '#e8a838';

// Festivos nacionales (fecha ya movida a lunes donde aplica la convención del país). Fuente: calendarios oficiales 2025-2026.
const HOLIDAYS = {
  COL: [
    '2025-01-01', '2025-01-06', '2025-03-24', '2025-04-17', '2025-04-18', '2025-05-01', '2025-06-02', '2025-06-23',
    '2025-06-30', '2025-07-20', '2025-08-07', '2025-08-18', '2025-10-13', '2025-11-03', '2025-11-17', '2025-12-08', '2025-12-25',
    '2026-01-01', '2026-01-12', '2026-03-23', '2026-04-02', '2026-04-03', '2026-05-01', '2026-05-18', '2026-06-08',
    '2026-06-15', '2026-07-13', '2026-07-20', '2026-08-07', '2026-08-17', '2026-10-12', '2026-11-02', '2026-11-16', '2026-12-08', '2026-12-25'
  ],
  MEX: [
    '2025-01-01', '2025-02-03', '2025-03-17', '2025-05-01', '2025-09-16', '2025-11-17', '2025-12-25',
    '2026-01-01', '2026-02-02', '2026-03-16', '2026-05-01', '2026-09-16', '2026-11-16', '2026-12-25'
  ],
  PER: [
    '2025-01-01', '2025-04-17', '2025-04-18', '2025-05-01', '2025-06-29', '2025-07-28', '2025-07-29',
    '2025-08-30', '2025-10-08', '2025-11-01', '2025-12-08', '2025-12-25',
    '2026-01-01', '2026-04-02', '2026-04-03', '2026-05-01', '2026-06-29', '2026-07-28', '2026-07-29',
    '2026-08-30', '2026-10-08', '2026-11-01', '2026-12-08', '2026-12-25'
  ],
  ECU: [
    '2025-01-01', '2025-04-18', '2025-05-01', '2025-05-24', '2025-08-10', '2025-10-09', '2025-11-02', '2025-11-03', '2025-12-25',
    '2026-01-01', '2026-04-03', '2026-05-01', '2026-05-24', '2026-08-10', '2026-10-09', '2026-11-02', '2026-11-03', '2026-12-25'
  ]
};

// ---------------------------------------------------------------------------
// 2. STATE
// ---------------------------------------------------------------------------

const state = {
  theme: 'dark',
  currency: 'USD', // 'USD' | 'LOCAL'
  filters: { country: [], city: [], kitchen: [], provider: [], brand: [] },
  dateFrom: null,
  dateTo: null,
  specialDates: [],
  s2Granularity: 'Diario',
  s3Sort: { key: 'meta', dir: 'desc' },
  s3bSort: { key: 'meta', dir: 'desc' },
  s4Sort: { key: 'meta', dir: 'desc' },
  s4bSort: { key: 'meta', dir: 'desc' },
  s5Sort: { key: 'meta', dir: 'desc' },
  s7Sort: { key: 'varAbs', dir: 'asc' },
  s7Page: 1,
  range1: { from: null, to: null },
  range2: { from: null, to: null },
  s2DateFrom: null,
  s2DateTo: null,
  leversExpanded: false,
  levers: {
    pastaNova: { active: true, incrementUSD: 25000000 / 4000, country: 'all' },
    pastaLab: { active: true, incrementUSD: 25000000 / 4000, country: 'all' },
    turboMarkups: { active: true, incrementUSD: 50000000 / 4000, country: 'all' },
    newPoint: { active: true, incrementUSD: 65000000 / 4000, country: 'all' },
    eriaQuadra: { active: true, incrementUSD: 50000000 / 4000, country: 'COL' }
  },
  metaProjection: {
    active: false,
    baselineFrom: null,
    baselineTo: null,
    targetYear: null,
    targetMonth: null, // 0-indexed; null = usar el mes actual (comportamiento por defecto)
    levers: [], // {id, name, amountUSD, scope: {cities:[], brands:[], kitchens:[], turbo:false}} -- borrador en edición
    excludedKitchens: [], // [kitchenId, ...] -- cocinas cerradas/excluidas: su aporte a la meta se fuerza a $0, sin importar palancas o baseline (borrador en edición)
    savedList: [], // {id, name, createdAt, baselineFrom, baselineTo, targetYear, targetMonth, levers:[...], excludedKitchens:[...]}
    appliedSavedId: null, // id de la proyección resuelta para el país+mes actualmente filtrado (recalculado en cada render, no se persiste como fuente de verdad)
    assignments: [] // [{country, year, month, savedId}] -- una proyección asignada por cada combinación país+mes, independientes entre sí
  }
};

// Repara palancas que quedaron con scope.countries vacío a pesar de pertenecer
// a una proyección guardada que sí tiene país (saved.country) — pasaba cuando
// se agregaba/editaba una palanca sin marcar el toggle de "País" en el
// formulario. Sin país explícito, una palanca de marca nueva (sin ventas
// reales todavía) quedaba invisible en cuanto se filtraba cualquier país
// específico, porque no había ningún hecho real con el que emparejarla.
// Corre una sola vez al cargar y persiste el arreglo, para no tener que
// repetirlo en cada sesión.
function repairLeverCountryGaps() {
  let fixedCount = 0;
  const proj = state.metaProjection;
  (proj.savedList || []).forEach(saved => {
    if (!saved.country) return;
    (saved.levers || []).forEach(lever => {
      if (lever.scope && (!lever.scope.countries || lever.scope.countries.length === 0)) {
        lever.scope.countries = [saved.country];
        fixedCount++;
      }
    });
  });
  if (proj.appliedSavedId) {
    const appliedSaved = (proj.savedList || []).find(s => s.id === proj.appliedSavedId);
    if (appliedSaved && appliedSaved.country) {
      (proj.levers || []).forEach(lever => {
        if (lever.scope && (!lever.scope.countries || lever.scope.countries.length === 0)) {
          lever.scope.countries = [appliedSaved.country];
          fixedCount++;
        }
      });
    }
  }
  return fixedCount;
}

// Fusiona palancas duplicadas exactas (mismo alcance/scope y mismo monto) que
// quedaron dentro de una misma proyección guardada — residuo de cuando se
// intentaba agregar una marca nueva y quedaban dos entradas casi idénticas
// (p.ej. "Panquequeria Turbo" y "La Panquequeria Turbo", ambas con el mismo
// alcance y los mismos $10.000.000). Se queda con la primera y descarta el
// resto, para que el monto total no se duplique.
function dedupeIdenticalLevers() {
  let removedCount = 0;
  const dedupeArray = (levers) => {
    if (!levers || levers.length < 2) return levers || [];
    const seen = new Set();
    const kept = [];
    levers.forEach(lever => {
      const key = JSON.stringify(lever.scope) + '|' + lever.amountUSD;
      if (seen.has(key)) { removedCount++; return; }
      seen.add(key);
      kept.push(lever);
    });
    return kept;
  };
  const proj = state.metaProjection;
  (proj.savedList || []).forEach(saved => { saved.levers = dedupeArray(saved.levers); });
  proj.levers = dedupeArray(proj.levers);
  return removedCount;
}

(function loadMetaProjection() {
  try {
    const saved = JSON.parse(localStorage.getItem('metaProjection') || 'null');
    if (saved && typeof saved === 'object') Object.assign(state.metaProjection, saved);
  } catch (e) { /* ignore corrupt storage */ }
  // El "pin" de edición explícita (resolveMetaProjectionForFilter) solo debía
  // durar mientras el Editor estuviera abierto en esa sesión — pero al
  // persistirse dentro de todo el objeto metaProjection, sobrevivía a cerrar
  // el navegador. Si Laura editaba "Meta COL Agosto" y simplemente cerraba la
  // pestaña sin volver a "Proyecciones Guardadas" (lo único que libera el pin),
  // reabrir el dashboard días después — ya filtrando septiembre — seguía
  // mostrando las palancas de agosto indefinidamente, porque el pin nunca
  // comprueba el mes, solo que el país siga coincidiendo. Se libera aquí, una
  // sola vez por carga de página, para que el auto-resolver normal (que sí
  // respeta el mes que se está viendo) vuelva a tomar el control desde el inicio.
  const pinWasSet = !!state.metaProjection.pinnedEditId;
  state.metaProjection.pinnedEditId = null;
  const gapsFixed = repairLeverCountryGaps();
  const dupesFixed = dedupeIdenticalLevers();
  if (pinWasSet || gapsFixed > 0 || dupesFixed > 0) saveMetaProjection();
})();
function saveMetaProjection() {
  localStorage.setItem('metaProjection', JSON.stringify(state.metaProjection));
}

// Palancas "legacy" (Pasta Nova, Pasta Lab, Turbo Markups, New Point, Ería
// Quadra): son las que getLeverImpactsForScope() suma a la Meta por defecto
// cuando NO hay una Proyección de Metas activa. Antes no se guardaba su
// active/false en ningún lado, así que cada recarga las volvía a dejar todas
// activas sin avisar — igual que state.metaProjection, ahora persisten en
// localStorage para que un apagado manual sobreviva a recargar la página.
(function loadLegacyLevers() {
  try {
    const saved = JSON.parse(localStorage.getItem('legacyLevers') || 'null');
    if (saved && typeof saved === 'object') {
      Object.keys(state.levers).forEach(key => {
        if (saved[key] && typeof saved[key].active === 'boolean') state.levers[key].active = saved[key].active;
      });
    }
  } catch (e) { /* ignore corrupt storage */ }
})();
function saveLegacyLevers() {
  const toSave = {};
  Object.keys(state.levers).forEach(key => { toSave[key] = { active: state.levers[key].active }; });
  localStorage.setItem('legacyLevers', JSON.stringify(toSave));
}

// ---------------------------------------------------------------------------
// 3. DATA PREP — resolve combo_id + day/month offsets into flat FACTS array
// ---------------------------------------------------------------------------

const baseDateObj = new Date(BASE_DATE + 'T00:00:00');
function addDays(base, n) {
  const d = new Date(base.getTime());
  d.setDate(d.getDate() + n);
  return d;
}
function toISO(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Las marcas "Pase" (canal de pedido por caja/POS, no una marca aparte) se fusionan
// en su marca base — "La Cuadra Pase" fusiona en "La Cuadra", "Cinnabon Pase Turbo"
// fusiona en "Cinnabon Turbo" (conserva el "Turbo", solo quita "Pase"). Se resuelve
// por NOMBRE (no con una lista fija de IDs) para que cualquier marca "Pase" que
// aparezca en un futuro refresh de datos se fusione sola, sin tener que tocar este
// código de nuevo cada vez.
const BRAND_NAME_TO_ENTRY = new Map();
for (const b of DIM_BRANDS) {
  const norm = b.name.trim().toLowerCase();
  if (!BRAND_NAME_TO_ENTRY.has(norm)) BRAND_NAME_TO_ENTRY.set(norm, b);
}
function stripPaseSuffix(name) {
  return name.replace(/\bpase\b/gi, ' ').replace(/\s+/g, ' ').trim();
}
const BRAND_ID_REMAP = new Map();
for (const b of DIM_BRANDS) {
  if (!/\bpase\b/i.test(b.name)) continue;
  const target = BRAND_NAME_TO_ENTRY.get(stripPaseSuffix(b.name).toLowerCase());
  if (target && target.id !== b.id) BRAND_ID_REMAP.set(b.id, target);
}
function resolveBrand(brand) {
  return BRAND_ID_REMAP.get(brand.id) || brand;
}

if (typeof window.FACTS === 'undefined' || window.FACTS.length === 0) {
  window.FACTS = [];
  (function buildFacts() {
    for (const row of DAILY) {
    const [d, c, g, disc, n] = row;
    const combo = DIM_COMBOS[c];
    const date = addDays(baseDateObj, d);
    const brand = resolveBrand(DIM_BRANDS[combo[3]]);
    window.FACTS.push({
      gran: 'day', dateISO: toISO(date), dow: date.getDay(), month: date.getMonth(),
      country: DIM_COUNTRIES[combo[0]], city: DIM_CITIES[combo[1]],
      kitchenId: DIM_KITCHENS[combo[2]].id, kitchenName: DIM_KITCHENS[combo[2]].name,
      brandId: brand.id, brandName: brand.name,
      provider: DIM_PROVIDERS[combo[4]],
      gmv: g, discount: disc, orders: n
    });
  }
  for (const row of MONTHLY) {
    const [m, c, g, disc, n] = row;
    const combo = DIM_COMBOS[c];
    const brand = resolveBrand(DIM_BRANDS[combo[3]]);
    window.FACTS.push({
      gran: 'month', dateISO: null, dow: null, month: m,
      country: DIM_COUNTRIES[combo[0]], city: DIM_CITIES[combo[1]],
      kitchenId: DIM_KITCHENS[combo[2]].id, kitchenName: DIM_KITCHENS[combo[2]].name,
      brandId: brand.id, brandName: brand.name,
      provider: DIM_PROVIDERS[combo[4]],
      gmv: g, discount: disc, orders: n
    });
  }
  })();
}

const MIN_DAILY_DATE = '2026-06-01';
const today = new Date();
today.setHours(0, 0, 0, 0);
const TODAY_ISO = toISO(today);
// La vista se refresca hasta D-1; usamos el último día con datos reales como "hoy" operativo.
const LAST_DATA_ISO = window.FACTS.filter(f => f.gran === 'day').reduce((max, f) => f.dateISO > max ? f.dateISO : max, '2026-01-01');

// ---------------------------------------------------------------------------
// 4. HELPERS — FX, formatting, dates
// ---------------------------------------------------------------------------

function isHoliday(dateISO, country) {
  const list = HOLIDAYS[country];
  return !!list && list.includes(dateISO);
}
function isSpecialDate(dateISO) {
  return state.specialDates.includes(dateISO);
}
function daysInMonth(year, month) { return new Date(year, month + 1, 0).getDate(); }
function pad2(n) { return String(n).padStart(2, '0'); }
function ymd(y, m, d) { return `${y}-${pad2(m + 1)}-${pad2(d)}`; }

function activeCountriesInFilter() {
  return state.filters.country.length ? state.filters.country : DIM_COUNTRIES.slice();
}

function fxValue(gmvLocal, country) {
  return state.currency === 'USD' ? gmvLocal / (FX[country] || 1) : gmvLocal;
}

function currencyLabel() {
  if (state.currency === 'USD') return 'USD';
  const countries = activeCountriesInFilter();
  if (countries.length === 1) return LOCAL_SYMBOL[countries[0]] || 'LC';
  return 'LC';
}

function currencySymbolPrefix() {
  if (state.currency === 'USD') return '$';
  const countries = activeCountriesInFilter();
  if (countries.length === 1) {
    const sym = LOCAL_SYMBOL[countries[0]];
    return sym === 'USD' ? '$' : sym + ' ';
  }
  return 'LC ';
}

function fmtMoney(value) {
  const v = Math.round(value || 0);
  const abs = Math.abs(v).toLocaleString('en-US');
  const sign = v < 0 ? '-' : '';
  return `${sign}${currencySymbolPrefix()}${abs}`;
}
function fmtPct(value, decimals = 1) {
  if (value === null || value === undefined || !isFinite(value)) return '—';
  return `${value >= 0 ? '' : ''}${value.toFixed(decimals)}%`;
}
function fmtInt(value) { return Math.round(value || 0).toLocaleString('en-US'); }

// ---------------------------------------------------------------------------
// 5. FILTER CASCADE + QUERY
// ---------------------------------------------------------------------------

function matchesGlobalFilters(f, opts = {}) {
  const filt = state.filters;
  if (filt.country.length && !filt.country.includes(f.country)) return false;
  if (filt.city.length && !filt.city.includes(f.city)) return false;
  if (filt.kitchen.length && !filt.kitchen.includes(f.kitchenId)) return false;
  if (filt.provider.length && !filt.provider.includes(f.provider)) return false;
  if (filt.brand.length && !filt.brand.includes(f.brandId)) return false;
  if (!opts.ignoreDate) {
    if (f.gran === 'day') {
      if (state.dateFrom && f.dateISO < state.dateFrom) return false;
      if (state.dateTo && f.dateISO > state.dateTo) return false;
    } else {
      // registros mensuales: se incluyen si el mes intersecta el rango activo
      const monthStartISO = ymd(2026, f.month, 1);
      const monthEndISO = ymd(2026, f.month, daysInMonth(2026, f.month));
      if (state.dateFrom && monthEndISO < state.dateFrom) return false;
      if (state.dateTo && monthStartISO > state.dateTo) return false;
    }
  }
  return true;
}

function getFilteredFacts(opts = {}) {
  return window.FACTS.filter(f => matchesGlobalFilters(f, opts));
}

// Opciones disponibles por nivel, respetando cascading País→Ciudad→Cocina→Plataforma→Marca
function computeCascadeOptions() {
  const filt = state.filters;
  const afterCountry = window.FACTS.filter(f => !filt.country.length || filt.country.includes(f.country));
  const cityOpts = uniqueSorted(afterCountry.map(f => f.city));

  const afterCity = afterCountry.filter(f => !filt.city.length || filt.city.includes(f.city));
  const kitchenOpts = uniqueByKey(afterCity, f => f.kitchenId, f => ({ id: f.kitchenId, name: f.kitchenName }));

  const afterKitchen = afterCity.filter(f => !filt.kitchen.length || filt.kitchen.includes(f.kitchenId));
  const providerOpts = uniqueSorted(afterKitchen.map(f => f.provider));

  const afterProvider = afterKitchen.filter(f => !filt.provider.length || filt.provider.includes(f.provider));
  const brandOpts = uniqueByKey(afterProvider, f => f.brandId, f => ({ id: f.brandId, name: f.brandName }));

  const countryOpts = uniqueSorted(window.FACTS.map(f => f.country));

  return { countryOpts, cityOpts, kitchenOpts, providerOpts, brandOpts };
}
function uniqueSorted(arr) { return Array.from(new Set(arr)).sort(); }
function uniqueByKey(arr, keyFn, mapFn) {
  const seen = new Map();
  for (const item of arr) { const k = keyFn(item); if (!seen.has(k)) seen.set(k, mapFn(item)); }
  return Array.from(seen.values()).sort((a, b) => a.name.localeCompare(b.name));
}

// ---------------------------------------------------------------------------
// 6. CALC ENGINE — GMV real / meta / run rate
// ---------------------------------------------------------------------------

function sumGmv(facts) { return facts.reduce((s, f) => s + fxValue(f.gmv, f.country), 0); }
function sumDiscount(facts) { return facts.reduce((s, f) => s + fxValue(f.discount, f.country), 0); }
function sumOrders(facts) { return facts.reduce((s, f) => s + f.orders, 0); }

function dailyFactsInRange(facts, fromISO, toISO_) {
  return facts.filter(f => f.gran === 'day' && f.dateISO >= fromISO && f.dateISO <= toISO_);
}

// Serie de GMV por día (sumado, en moneda activa) para un set de facts ya filtrado por dimensiones
function dailySeries(facts, fromISO, toISO_) {
  const map = new Map();
  for (const f of facts) {
    if (f.gran !== 'day' || f.dateISO < fromISO || f.dateISO > toISO_) continue;
    map.set(f.dateISO, (map.get(f.dateISO) || 0) + fxValue(f.gmv, f.country));
  }
  return map;
}

function isExcludedDay(dateISO, countries) {
  if (isSpecialDate(dateISO)) return true;
  return countries.some(c => isHoliday(dateISO, c));
}

// Resuelve, para el país+mes actualmente filtrado, cuál proyección guardada (si
// alguna) está asignada — cada combinación país+mes tiene su propia asignación
// independiente (state.metaProjection.assignments), en vez de un único "aplicado"
// global. Deja el resultado reflejado en los campos "en vivo" de metaProjection
// (active/baselineFrom/baselineTo/targetYear/targetMonth/levers/appliedSavedId)
// que ya usa todo el motor de cálculo (computeGMVMeta, getLeverImpactsForScope,
// breakdownBy, el panel de "Palancas de Crecimiento", etc.) — así ninguno de ellos
// necesita saber que existen asignaciones múltiples. Solo resuelve cuando hay
// EXACTAMENTE un país filtrado; con varios países (o "Todos") a la vez no hay una
// única asignación que aplique de forma consistente, así que se usa el cálculo
// por defecto (mes anterior, sin palancas personalizadas).
function resolveMetaProjectionForFilter() {
  const proj = state.metaProjection;
  const countries = activeCountriesInFilter();
  // Mientras se está editando explícitamente una proyección guardada (vía
  // "✏️ Editar palancas"), este resolver NO debe reemplazar sus palancas por
  // las de "lo que correspondería ver ahora mismo" en el dashboard general.
  // Antes sí lo hacía: renderAll() llama a este resolver primero, así que
  // editar "Meta COL Septiembre 2026" (targetMonth distinto al mes que el
  // dashboard está mostrando por defecto, agosto, porque los datos llegan
  // hasta el 31/08) mostraba bien las palancas de septiembre por un instante
  // y luego el siguiente renderAll() las reemplazaba con las de "Meta COL
  // Agosto 2026" sin avisar — el editor terminaba mostrando la proyección
  // equivocada. Se respeta el "pin" mientras la proyección fijada siga
  // existiendo y su país siga coincidiendo con el filtro activo; si cualquiera
  // de las dos cosas deja de cumplirse, se libera y este resolver retoma el
  // comportamiento automático normal.
  if (proj.pinnedEditId) {
    const pinned = (proj.savedList || []).find(s => s.id === proj.pinnedEditId);
    if (pinned && countries.length === 1 && (!pinned.country || pinned.country === countries[0])) {
      return;
    }
    proj.pinnedEditId = null;
  }
  let saved = null;
  if (countries.length === 1) {
    const { year, month } = refYearMonth();
    const assignment = (proj.assignments || []).find(a => a.country === countries[0] && a.year === year && a.month === month);
    saved = assignment ? (proj.savedList || []).find(s => s.id === assignment.savedId) : null;
  }
  if (saved) {
    proj.active = true;
    proj.baselineFrom = saved.baselineFrom;
    proj.baselineTo = saved.baselineTo;
    proj.targetYear = saved.targetYear;
    proj.targetMonth = saved.targetMonth;
    proj.levers = JSON.parse(JSON.stringify(saved.levers));
    proj.excludedKitchens = JSON.parse(JSON.stringify(saved.excludedKitchens || []));
    proj.appliedSavedId = saved.id;
  } else if (proj.appliedSavedId) {
    // Antes había una asignación resuelta para el país/mes anterior; como ya no
    // hay ninguna para el país/mes actual, se apaga. Si en cambio proj.active se
    // activó manualmente con "Aplicar proyección" (sin asignación de por medio,
    // appliedSavedId null), se deja intacto — este resolver no lo tocó.
    proj.active = false;
    proj.appliedSavedId = null;
  }
}

// Mes objetivo de la META: el mes elegido en la Proyección de Metas si está activa,
// o el mes actual (comportamiento por defecto) si no se ha elegido uno.
function getProjectionTargetMonth() {
  const proj = state.metaProjection;
  if (proj && proj.active && proj.targetYear != null && proj.targetMonth != null) {
    return { year: proj.targetYear, month: proj.targetMonth };
  }
  return refYearMonth();
}

function getMetaBaselineRange(refYear, refMonth) {
  const proj = state.metaProjection;
  if (proj && proj.active && proj.baselineFrom && proj.baselineTo) {
    return { from: proj.baselineFrom, to: proj.baselineTo };
  }
  const prevMonth = refMonth === 0 ? 11 : refMonth - 1;
  const prevYear = refMonth === 0 ? refYear - 1 : refYear;
  // Para junio (month 5), usar mes completo (30 días). Para otros meses, usar hasta día 24.
  const prevMonthDays = daysInMonth(prevYear, prevMonth);
  const dayLimit = prevMonth === 5 ? prevMonthDays : 24;  // Junio = 30 días, otros = 24 días
  return { from: ymd(prevYear, prevMonth, 1), to: ymd(prevYear, prevMonth, dayLimit) };
}

// Cocinas cerradas/excluidas de la Proyección de Metas activa: su venta histórica
// sigue contando en GMV Real/RR (no se tocan los FACTS), pero se excluyen de todo
// cálculo de BASELINE — así ninguna palanca (ni siquiera una de alcance amplio,
// "Todos los países") puede volver a atribuirles proyección alguna. Esto es más
// robusto que restar un monto con una palanca negativa, que solo cancela la parte
// de baseline y se descuadra en cuanto se agrega/edita otra palanca que también
// las toque.
// Cada entrada de excludedKitchens es {kitchenId, closedFrom, closedTo} — el rango
// de fechas en que esa cocina está/estará cerrada. Devuelve qué fracción del MES
// PROYECTADO (getProjectionTargetMonth) queda realmente abierta: 1 = sin cierre,
// 0 = cerrada todo el mes, 0.29 = cerrada 22 de 31 días, etc. Con eso se prorratea
// su contribución al baseline (y por lo tanto su meta) sin necesidad de saber
// día por día cuánto vendería — solo qué fracción del mes seguirá operando.
function kitchenOpenFraction(kitchenId) {
  const entries = state.metaProjection && state.metaProjection.excludedKitchens;
  const entry = entries && entries.find(e => e.kitchenId === kitchenId);
  if (!entry) return 1;
  const { year, month } = getProjectionTargetMonth();
  const totalDays = daysInMonth(year, month);
  const monthStart = ymd(year, month, 1);
  const monthEnd = ymd(year, month, totalDays);
  const closedFrom = entry.closedFrom || monthStart;
  const closedTo = entry.closedTo || monthEnd;
  const from = closedFrom > monthStart ? closedFrom : monthStart;
  const to = closedTo < monthEnd ? closedTo : monthEnd;
  if (from > to) return 1; // el rango de cierre no cae dentro del mes proyectado
  const closedDays = Math.round((new Date(to + 'T00:00:00') - new Date(from + 'T00:00:00')) / 86400000) + 1;
  const openDays = Math.max(0, totalDays - closedDays);
  return totalDays > 0 ? openDays / totalDays : 1;
}

// 3.2 — GMV Meta: promedio de GMV por día de semana usando el baseline (mes anterior 1-24,
// o el rango personalizado de la Proyección de Metas si está activa), proyectado sobre el
// mes objetivo multiplicando por el conteo real de cada día de la semana + festivos.
// IMPORTANTE: calcula SIEMPRE en GMV local (COP), sin aplicar conversión de FX
function computeGMVMeta(facts, refYear, refMonth, countries) {
  const { from: prevFrom, to: prevTo } = getMetaBaselineRange(refYear, refMonth);
  // Usa GMV sin convertir (local), ignorando estado de moneda
  const series = new Map();
  for (const f of facts) {
    if (f.gran !== 'day' || f.dateISO < prevFrom || f.dateISO > prevTo) continue;
    const openFraction = kitchenOpenFraction(f.kitchenId);
    if (openFraction <= 0) continue;
    series.set(f.dateISO, (series.get(f.dateISO) || 0) + f.gmv * openFraction); // f.gmv SIN fxValue()
  }

  const dowSums = [0, 0, 0, 0, 0, 0, 0];
  const dowCounts = [0, 0, 0, 0, 0, 0, 0];
  let festivalSum = 0, festivalCount = 0;

  // Recorre día por día el rango de baseline. Con proyección personalizada activa
  // se usa el rango completo elegido; en el comportamiento por defecto (mes
  // anterior) se preserva el promedio histórico basado en los primeros 24 días,
  // igual que siempre (aunque `series`/prevTo cubran el mes completo en junio).
  const proj = state.metaProjection;
  const isCustomBaseline = !!(proj && proj.active && proj.baselineFrom && proj.baselineTo);
  let curD = new Date(prevFrom + 'T00:00:00');
  let endD = new Date(prevTo + 'T00:00:00');
  if (!isCustomBaseline) {
    const cappedEnd = new Date(prevFrom + 'T00:00:00');
    cappedEnd.setDate(cappedEnd.getDate() + 23); // días 1..24 desde el inicio del mes anterior
    if (cappedEnd < endD) endD = cappedEnd;
  }
  while (curD <= endD) {
    const iso = toISOLocal(curD);
    if (isSpecialDate(iso) || isHoliday(iso, countries[0])) {
      festivalSum += series.get(iso) || 0;
      festivalCount += 1;
    } else {
      const dow = curD.getDay();
      dowSums[dow] += series.get(iso) || 0;
      dowCounts[dow] += 1;
    }
    curD.setDate(curD.getDate() + 1);
  }

  const dowAvg = dowSums.map((s, i) => dowCounts[i] > 0 ? s / dowCounts[i] : 0);
  // Si ningún festivo cayó dentro del rango de baseline elegido (p.ej. proyectar
  // septiembre —que sí tiene un festivo— usando agosto —que no tuvo ninguno—
  // como baseline), festivalCount queda en 0 y el festivo se proyectaría en $0,
  // claramente peor que usar una referencia razonable. Un festivo se comporta
  // más como domingo (poco tráfico laboral/oficinas) que como un día de semana
  // normal, así que se usa el promedio de domingo como respaldo mientras no
  // haya ningún festivo real en el baseline.
  const festivalAvg = festivalCount > 0 ? festivalSum / festivalCount : dowAvg[0];

  // Contar días de la semana en el mes actual (julio)
  const dowCountsInMonth = [0, 0, 0, 0, 0, 0, 0];
  let festivalCountInMonth = 0;
  const nDaysCurrent = daysInMonth(refYear, refMonth);
  for (let d = 1; d <= nDaysCurrent; d++) {
    const iso = ymd(refYear, refMonth, d);
    if (isSpecialDate(iso) || isHoliday(iso, countries[0])) {
      festivalCountInMonth += 1;
    } else {
      const dow = new Date(iso + 'T00:00:00').getDay();
      dowCountsInMonth[dow] += 1;
    }
  }

  let total = 0;
  const dailyMeta = [];
  for (let d = 1; d <= nDaysCurrent; d++) {
    const iso = ymd(refYear, refMonth, d);
    const isFestival = isSpecialDate(iso) || isHoliday(iso, countries[0]);
    const val = isFestival ? festivalAvg : dowAvg[new Date(iso + 'T00:00:00').getDay()];
    dailyMeta.push({ dateISO: iso, value: val });
    total += val;
  }
  return { total, dailyMeta, dowAvg, festivalAvg, dowCountsInMonth, festivalCountInMonth };
}

// 3.3 — GMV Run Rate
// Calcular el impacto total de las palancas para un país (todas las palancas son exclusivas de COL)
function computeLeverImpact(facts, countryCode) {
  if (countryCode !== 'COL') return 0;

  let impact = 0;

  if (state.levers.pastaNova.active) {
    impact += state.levers.pastaNova.incrementUSD;
  }
  if (state.levers.pastaLab.active) {
    impact += state.levers.pastaLab.incrementUSD;
  }
  if (state.levers.turboMarkups.active) {
    // Repartir 50M COP proporcionalmente entre marcas turbo según sus ventas en junio 1-24
    const turboFacts = facts.filter(f => /turb/i.test(f.brandId || f.brandName));
    const turboGmv = sumGmv(turboFacts);
    if (turboGmv > 0) {
      const turboIncrementUSD = 50000000 / (FX[countryCode] || 1);
      impact += turboIncrementUSD;
    }
  }
  if (state.levers.newPoint.active) {
    impact += state.levers.newPoint.incrementUSD;
  }
  if (state.levers.eriaQuadra.active) {
    impact += state.levers.eriaQuadra.incrementUSD;
  }

  return impact;
}

function getLeverImpactsForScope(countries) {
  const proj = state.metaProjection;
  if (proj && proj.active) {
    return (proj.levers || [])
      .filter(l => l.amountUSD && l.active !== false)
      .map(l => ({ name: l.name, amountUSD: l.amountUSD, scope: l.scope || {} }));
  }
  // Las 5 palancas "legacy" nacieron cuando Foodology solo operaba en Colombia
  // (Pasta Nova/Pasta Lab son literalmente las marcas COL "453 PASTA NOVA" /
  // "455 PASTA LAB", New Point y Turbo Markups son ajustes de esa misma época) —
  // ninguna es "global": solo deben aplicar con el filtro de país puesto
  // EXCLUSIVAMENTE en Colombia, nunca con "Todos los países" (aunque Colombia
  // esté incluida ahí de paso) ni con una selección de varios países a la vez.
  // Antes se usaba countries.includes('COL'), que también era true en "Todos".
  // Además llevan scope.countries=['COL'] (no solo este gate) para que, si en
  // el futuro alguna vista SÍ combinara países, breakdownBy() reparta su monto
  // solo entre las filas de Colombia y no lo distribuya también sobre México/Perú.
  const legacy = [];
  const isCOL = countries.length === 1 && countries[0] === 'COL';
  if (isCOL && state.levers.pastaNova.active) legacy.push({ name: 'Pasta Nova', amountUSD: state.levers.pastaNova.incrementUSD, scope: { countries: ['COL'] } });
  if (isCOL && state.levers.pastaLab.active) legacy.push({ name: 'Pasta Lab', amountUSD: state.levers.pastaLab.incrementUSD, scope: { countries: ['COL'] } });
  if (isCOL && state.levers.turboMarkups.active) legacy.push({ name: 'Turbo Markups', amountUSD: state.levers.turboMarkups.incrementUSD, scope: { countries: ['COL'], turbo: true } });
  if (isCOL && state.levers.newPoint.active) legacy.push({ name: 'New Point', amountUSD: state.levers.newPoint.incrementUSD, scope: { countries: ['COL'] } });
  if (isCOL && state.levers.eriaQuadra.active) legacy.push({ name: 'Ería Quadra', amountUSD: state.levers.eriaQuadra.incrementUSD, scope: { countries: ['COL'] } });
  return legacy;
}

// El alcance combina dimensiones con AND: si varias vienen con valores (p.ej.
// ciudades Y marcas), un hecho debe cumplir TODAS para que la palanca aplique.
// Una dimensión vacía significa "sin restricción" en esa dimensión.
function isAllScope(scope) {
  return !scope || (!scope.turbo &&
    (!scope.countries || !scope.countries.length) &&
    (!scope.cities || !scope.cities.length) &&
    (!scope.brands || !scope.brands.length) &&
    (!scope.kitchens || !scope.kitchens.length) &&
    (!scope.categories || !scope.categories.length) &&
    (!scope.providers || !scope.providers.length));
}

// Mapa marca → categoría (turbo/core/new/other), armado una sola vez a partir de
// BRAND_CATEGORIES, para poder escoger un alcance como "Categoría: Core" sin
// tener que listar/seleccionar cada marca individualmente.
let __brandCategoryMapCache = null;
function brandCategoryOf(brandId) {
  if (!__brandCategoryMapCache) {
    __brandCategoryMapCache = new Map();
    if (typeof projBrandIdsForGroup === 'function') {
      ['turbo', 'core', 'new', 'other'].forEach(group => {
        projBrandIdsForGroup(group).forEach(id => { if (!__brandCategoryMapCache.has(id)) __brandCategoryMapCache.set(id, group); });
      });
    }
  }
  return __brandCategoryMapCache.get(brandId) || null;
}

function leverMatchesFact(scope, f) {
  if (isAllScope(scope)) return true;
  if (scope.turbo && !(/turb/i.test(f.brandId) || /turb/i.test(f.brandName))) return false;
  if (scope.countries && scope.countries.length && !scope.countries.includes(f.country)) return false;
  if (scope.cities && scope.cities.length && !scope.cities.includes(f.city)) return false;
  if (scope.brands && scope.brands.length && !scope.brands.includes(f.brandId)) return false;
  if (scope.kitchens && scope.kitchens.length && !scope.kitchens.includes(f.kitchenId)) return false;
  if (scope.categories && scope.categories.length && !scope.categories.includes(brandCategoryOf(f.brandId))) return false;
  if (scope.providers && scope.providers.length && !scope.providers.includes(f.provider)) return false;
  return true;
}

function leverMatchesAnyFact(scope, facts) {
  if (isAllScope(scope)) return true;
  return facts.some(f => leverMatchesFact(scope, f));
}

// ¿Está esta cocina cerrada en esta fecha puntual, según su rango de cierre
// configurado en "Cocinas cerradas / excluidas de la meta"? (closedTo vacío =
// cerrada hasta fin de mes, sin límite fijo).
function isKitchenClosedOnDate(kitchenId, dateISO) {
  const entries = state.metaProjection && state.metaProjection.excludedKitchens;
  if (!entries || !entries.length) return false;
  return entries.some(e => e.kitchenId === kitchenId && dateISO >= e.closedFrom && (!e.closedTo || dateISO <= e.closedTo));
}

function computeGMVRunRate(facts, countries, asOfISO) {
  const refDate = new Date((asOfISO || LAST_DATA_ISO) + 'T00:00:00');
  const y = refDate.getFullYear(), m = refDate.getMonth(), day = refDate.getDate();
  const nDays = daysInMonth(y, m);
  const monthFrom = ymd(y, m, 1);

  if (day < 7) return { value: null, insufficientData: true };

  const asOf = asOfISO || LAST_DATA_ISO;
  const series = dailySeries(facts, monthFrom, asOf);
  let realSoFar = 0;
  for (const [, v] of series) realSoFar += v;

  const hasClosures = !!(state.metaProjection && state.metaProjection.excludedKitchens && state.metaProjection.excludedKitchens.length);

  // Promedio por día de la semana (0-6) + festivos como tipo 7. Si hay cocinas con
  // cierre configurado, también se acumula por separado cuánto aportó cada cocina
  // a cada tipo de día — necesario para poder restar su parte al proyectar días
  // futuros en los que sabemos que estará cerrada (ver más abajo).
  const dowSums = [0, 0, 0, 0, 0, 0, 0, 0];  // 0-6=días semana, 7=festivos
  const dowCounts = [0, 0, 0, 0, 0, 0, 0, 0];
  const dowKitchenSums = hasClosures ? [{}, {}, {}, {}, {}, {}, {}, {}] : null;
  if (hasClosures) {
    for (const f of facts) {
      if (f.gran !== 'day' || f.dateISO < monthFrom || f.dateISO > asOf) continue;
      const d = new Date(f.dateISO + 'T00:00:00');
      const dow = isExcludedDay(f.dateISO, countries) ? 7 : d.getDay();
      const bucket = dowKitchenSums[dow];
      bucket[f.kitchenId] = (bucket[f.kitchenId] || 0) + fxValue(f.gmv, f.country);
    }
  }
  for (let d = 1; d <= day; d++) {
    const iso = ymd(y, m, d);
    let dow = new Date(iso + 'T00:00:00').getDay();
    if (isExcludedDay(iso, countries)) dow = 7;  // Festivos = tipo 7
    dowSums[dow] += series.get(iso) || 0;
    dowCounts[dow] += 1;
  }
  const dowAvg = dowSums.map((s, i) => dowCounts[i] > 0 ? s / dowCounts[i] : 0);

  // Si el único viernes transcurrido este mes fue festivo (queda contado como tipo 7,
  // no como viernes), dowCounts[5] se queda en 0 y el viernes se proyectaría en $0 para
  // todo lo que resta del mes — claramente peor que usar una referencia cercana. Mientras
  // no haya NINGÚN viernes real transcurrido, se usa el promedio de jueves como sustituto;
  // en cuanto exista al menos un viernes real (dowCounts[5] > 0), esto deja de aplicar
  // automáticamente y vuelve a usarse el propio promedio de viernes.
  if (dowCounts[5] === 0 && dowCounts[4] > 0) {
    dowAvg[5] = dowAvg[4];
  }
  // Mismo respaldo que en computeGMVMeta(): si todavía no ha pasado ningún
  // festivo real este mes (dowCounts[7]===0), un festivo futuro se proyectaría
  // en $0 sin esto. Un festivo se comporta más como domingo que como un día de
  // semana normal, así que se usa el promedio de domingo mientras tanto.
  if (dowCounts[7] === 0) {
    dowAvg[7] = dowAvg[0];
  }

  // Proyección: sumar promedio de cada tipo de día que falta. Si alguna cocina que
  // contribuyó a ese promedio va a estar cerrada en un día futuro puntual, se resta
  // su parte histórica antes de promediar — así el RR no sigue "run-rateando"
  // venta de una cocina para fechas en las que ya sabemos que no va a vender.
  let projected = 0;
  for (let d = day + 1; d <= nDays; d++) {
    const iso = ymd(y, m, d);
    let dow = new Date(iso + 'T00:00:00').getDay();
    if (isExcludedDay(iso, countries)) dow = 7;  // Festivos = tipo 7
    if (!hasClosures || dowCounts[dow] === 0) { projected += dowAvg[dow]; continue; }
    let closedContribution = 0;
    for (const kid in dowKitchenSums[dow]) {
      if (isKitchenClosedOnDate(kid, iso)) closedContribution += dowKitchenSums[dow][kid];
    }
    projected += Math.max(0, dowSums[dow] - closedContribution) / dowCounts[dow];
  }

  return { value: realSoFar + projected, insufficientData: false };
}

// Histórico mensual (2025) por país, en moneda local — ver MONTHLY_HISTORY_2025
// en data.js. Solo cubre 2025 por ahora (suficiente para "vs mismo mes año
// pasado" mientras el dashboard siga en 2026); devuelve null si no hay dato
// para ese país/año/mes.
function getHistoricalMonthlyGMV(country, year, month) {
  if (typeof MONTHLY_HISTORY_2025 === 'undefined') return null;
  if (year !== 2025) return null;
  const arr = MONTHLY_HISTORY_2025[country];
  if (!arr || arr[month] == null) return null;
  return arr[month];
}

// Compara un total ya calculado (Meta Total de una Proyección, en la moneda de
// visualización activa) contra (a) el mismo mes del año pasado (real, si hay
// histórico) y (b) el mes anterior de este mismo año (real, calculado del
// dataset actual — siempre disponible mientras exista el mes anterior).
// Solo aplica con un único país filtrado (la Proyección de Metas siempre es
// de un solo país a la vez); devuelve null si countries no es exactamente 1.
function computeGrowthComparisons(totalDisplay, countries, targetYear, targetMonth) {
  if (!countries || countries.length !== 1) return null;
  const country = countries[0];
  const monthNamesCap = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

  let vsLastYear = null;
  const lastYearLocal = getHistoricalMonthlyGMV(country, targetYear - 1, targetMonth);
  if (lastYearLocal != null && lastYearLocal > 0) {
    const lastYearDisplay = fxValue(lastYearLocal, country);
    vsLastYear = { label: `${monthNamesCap[targetMonth]} ${targetYear - 1}`, real: lastYearDisplay, pct: ((totalDisplay - lastYearDisplay) / lastYearDisplay) * 100 };
  }

  // Solo se muestra "vs mes anterior" si ese mes anterior ya está COMPLETO en
  // los datos (los datos llegan hasta LAST_DATA_ISO) — si el mes anterior
  // todavía está en curso (p.ej. proyectar octubre a inicios de septiembre,
  // con LAST_DATA_ISO todavía en septiembre), comparar una meta de mes
  // completo contra un real de mes parcial da un % absurdamente inflado.
  const prevMonth = targetMonth === 0 ? 11 : targetMonth - 1;
  const prevYear = targetMonth === 0 ? targetYear - 1 : targetYear;
  const prevMonthLastDay = ymd(prevYear, prevMonth, daysInMonth(prevYear, prevMonth));
  let vsPrevMonth = null;
  if (prevMonthLastDay <= LAST_DATA_ISO) {
    const prevMonthDisplay = computeGMVRealForMonth(FACTS.filter(f => f.country === country), prevYear, prevMonth);
    if (prevMonthDisplay > 0) {
      vsPrevMonth = { label: `${monthNamesCap[prevMonth]} ${prevYear}`, real: prevMonthDisplay, pct: ((totalDisplay - prevMonthDisplay) / prevMonthDisplay) * 100 };
    }
  }

  return { vsLastYear, vsPrevMonth };
}

// Arma el HTML de una línea "📈 Crecimiento: vs Septiembre 2025: +X% · vs
// Agosto 2026: +Y%" a partir de computeGrowthComparisons() — compartido entre
// el Editor y "Ver detalle" de una proyección guardada para que ambos se vean
// idénticos.
function growthLineHTML(totalDisplay, countries, targetYear, targetMonth) {
  const growth = computeGrowthComparisons(totalDisplay, countries, targetYear, targetMonth);
  if (!growth || (!growth.vsLastYear && !growth.vsPrevMonth)) return '';
  const parts = [];
  if (growth.vsLastYear) {
    const g = growth.vsLastYear;
    parts.push(`vs ${g.label}: <strong style="color:${g.pct >= 0 ? 'var(--accent-green,#5cb85c)' : 'var(--accent-red,#c94f4f)'};">${g.pct >= 0 ? '+' : ''}${g.pct.toFixed(1)}%</strong>`);
  }
  if (growth.vsPrevMonth) {
    const g = growth.vsPrevMonth;
    parts.push(`vs ${g.label}: <strong style="color:${g.pct >= 0 ? 'var(--accent-green,#5cb85c)' : 'var(--accent-red,#c94f4f)'};">${g.pct >= 0 ? '+' : ''}${g.pct.toFixed(1)}%</strong>`);
  }
  return `📈 Crecimiento: ${parts.join(' · ')}`;
}

function computeGMVRealForMonth(facts, year, month) {
  const from = ymd(year, month, 1);
  const to = ymd(year, month, daysInMonth(year, month));
  let total = 0;
  for (const f of facts) {
    if (f.gran === 'day' && f.dateISO >= from && f.dateISO <= to) total += fxValue(f.gmv, f.country);
    else if (f.gran === 'month' && f.month === month) total += fxValue(f.gmv, f.country);
  }
  return total;
}

// ---------------------------------------------------------------------------
// 7. RENDER ORCHESTRATION
// ---------------------------------------------------------------------------

function renderAll() {
  resolveMetaProjectionForFilter();
  renderFilterOptions();
  renderChips();
  renderLevers();
  renderS1();
  renderS2();
  renderS3();
  renderS3b();
  renderS4();
  renderS4b();
  renderS5();
  renderS6();
  renderS7();
  renderS8();
  renderS9();
  // Mantiene la vista previa de Proyección de Metas (baseline + tablas de resultado)
  // sincronizada con el resto del dashboard — sin esto, cambiar el filtro de País
  // (u otro estado global) no refrescaba estas tablas hasta tocar un input propio
  // del formulario de proyección, dejando ver valores del país filtrado anterior.
  if (typeof renderProjBaselineTable === 'function') renderProjBaselineTable();
  if (typeof renderProjResultTables === 'function') renderProjResultTables();
  // Mismo motivo que las dos anteriores: la lista de "Palancas de Proyección" filtra
  // qué palancas mostrar según el país activo (leverAppliesToActiveCountryFilter), pero
  // sin esta llamada esa lista solo se refrescaba al agregar/editar/eliminar una palanca
  // directamente — cambiar el filtro de País en cualquier otra pestaña la dejaba mostrando
  // palancas de un país que ya no coincidía con el filtro.
  if (typeof renderProjectionLevers === 'function') renderProjectionLevers();
  // Igual que las dos anteriores: sin esto, la lista de "Proyecciones Guardadas"
  // (incluido el total de la proyección "aplicada") solo se recalculaba al entrar
  // a esa pestaña o guardar/aplicar/eliminar una proyección — quedando desfasada
  // del total ya recalculado en "Resumen General" en cuanto cambiabas el filtro de
  // fecha/país en cualquier otra pestaña (más notorio con proyecciones a "mes actual").
  if (typeof renderProjSavedList === 'function') renderProjSavedList();
  // Igual patrón: la etiqueta "COP/PEN/MXN (moneda local)" del selector de palancas
  // quedaba fija en "COP" aunque filtraras otro país, hasta reabrir la pestaña.
  if (typeof updateProjLeverCurrencyLabel === 'function') updateProjLeverCurrencyLabel();
  if (typeof generateInsights === 'function') {
    generateInsights(FACTS);
  }
}

function initApp() {
  initTheme();
  initCurrencyToggle();
  initDateDefaults();
  initFilterUI();
  initRangePickers();
  initSpecialDates();
  initSortHandlers();
  initExportPrint();
  initProjectionTab();
  initProjSavedTab();
  initMetaExplainModal();
  if (typeof initProjComboDownloadButtons === 'function') initProjComboDownloadButtons();
  if (window.FACTS.length === 0) {
    document.getElementById('empty-banner').style.display = 'flex';
  }
  renderAll();
}

// app.js is loaded via a <script> tag near the end of <body>, so the DOM is
// already parsed by the time this runs — DOMContentLoaded has already fired
// and would never trigger a listener registered here. Run directly instead,
// falling back to the event only for the (non-standard) case of an early load.
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
