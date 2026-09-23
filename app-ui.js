/* Foodology — Seguimiento de Ventas — UI + render layer */
/* global state, FACTS, DIM_COUNTRIES, HOLIDAYS, MIN_DAILY_DATE, TODAY_ISO, LAST_DATA_ISO,
   fmtMoney, fmtPct, fmtInt, fxValue, sumGmv, sumOrders, sumDiscount, currencyLabel,
   getFilteredFacts, computeCascadeOptions, matchesGlobalFilters, computeGMVMeta, computeGMVRunRate,
   computeGMVRealForMonth, dailySeries, dailyFactsInRange, ymd, daysInMonth, isHoliday, isSpecialDate,
   CHART_COLORS, COLOR_POSITIVE, COLOR_NEGATIVE, COLOR_NEUTRAL, COLOR_AMBER, Chart, activeCountriesInFilter */

// ---------------------------------------------------------------------------
// THEME / CURRENCY / EXPORT
// ---------------------------------------------------------------------------

// Escapa texto libre (p.ej. el "Racional" de una palanca) antes de insertarlo
// vía innerHTML, para que no rompa el layout ni ejecute HTML si alguien pega
// algo con < > & " adentro.
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function initTheme() {
  document.documentElement.setAttribute('data-theme', state.theme);
  document.getElementById('btn-theme').addEventListener('click', () => {
    state.theme = state.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', state.theme);
    document.getElementById('btn-theme').textContent = state.theme === 'dark' ? '🌙' : '☀️';
    rebuildCharts();
  });
}

function initCurrencyToggle() {
  const btnUsd = document.getElementById('btn-currency-usd');
  const btnLocal = document.getElementById('btn-currency-local');
  function updateUI() {
    btnUsd.classList.toggle('active', state.currency === 'USD');
    btnLocal.classList.toggle('active', state.currency === 'LOCAL');
    const warn = document.getElementById('currency-warning');
    const multi = activeCountriesInFilter().length > 1;
    warn.style.display = (state.currency === 'LOCAL' && multi) ? 'inline' : 'none';
  }
  btnUsd.addEventListener('click', () => { state.currency = 'USD'; updateUI(); renderAll(); });
  btnLocal.addEventListener('click', () => { state.currency = 'LOCAL'; updateUI(); renderAll(); });
  updateUI();
}

function initExportPrint() {
  document.getElementById('btn-export').addEventListener('click', () => window.print());
}

// ---------------------------------------------------------------------------
// DATE DEFAULTS + RANGE PICKERS
// ---------------------------------------------------------------------------

function initDateDefaults() {
  const from = document.getElementById('date-from');
  const to = document.getElementById('date-to');
  from.min = '2026-01-01'; to.min = '2026-01-01';
  from.max = LAST_DATA_ISO; to.max = LAST_DATA_ISO;
  from.value = ymd(new Date(LAST_DATA_ISO).getFullYear(), new Date(LAST_DATA_ISO + 'T00:00:00').getMonth(), 1);
  to.value = LAST_DATA_ISO;
  state.dateFrom = from.value; state.dateTo = to.value;
  from.addEventListener('change', () => { state.dateFrom = from.value || null; renderAll(); });
  to.addEventListener('change', () => { state.dateTo = to.value || null; renderAll(); });
}

function initRangePickers() {
  const lastDate = new Date(LAST_DATA_ISO + 'T00:00:00');
  const curMonthStart = ymd(lastDate.getFullYear(), lastDate.getMonth(), 1);
  const prevMonthDate = new Date(lastDate.getFullYear(), lastDate.getMonth() - 1, 1);
  const prevMonthStart = ymd(prevMonthDate.getFullYear(), prevMonthDate.getMonth(), 1);
  const prevMonthEnd = ymd(prevMonthDate.getFullYear(), prevMonthDate.getMonth(), daysInMonth(prevMonthDate.getFullYear(), prevMonthDate.getMonth()));

  state.range1 = { from: prevMonthStart, to: prevMonthEnd };
  state.range2 = { from: curMonthStart, to: LAST_DATA_ISO };

  const r1f = document.getElementById('range1-from'), r1t = document.getElementById('range1-to');
  const r2f = document.getElementById('range2-from'), r2t = document.getElementById('range2-to');
  r1f.value = state.range1.from; r1t.value = state.range1.to;
  r2f.value = state.range2.from; r2t.value = state.range2.to;
  [r1f, r1t, r2f, r2t].forEach(el => { el.min = '2026-01-01'; el.max = LAST_DATA_ISO; });

  function wire() {
    state.range1.from = r1f.value; state.range1.to = r1t.value;
    state.range2.from = r2f.value; state.range2.to = r2t.value;
    renderS6(); renderS7(); renderS8();
  }
  [r1f, r1t, r2f, r2t].forEach(el => el.addEventListener('change', wire));
}

function initSpecialDates() {
  const toggle = document.getElementById('special-dates-toggle');
  const panel = document.getElementById('special-dates-panel');
  toggle.addEventListener('click', () => panel.classList.toggle('open'));
  for (let i = 0; i < 5; i++) {
    const input = document.getElementById(`special-date-${i}`);
    input.min = '2026-01-01'; input.max = '2026-12-31';
    input.addEventListener('change', () => {
      state.specialDates = [0, 1, 2, 3, 4].map(j => document.getElementById(`special-date-${j}`).value).filter(Boolean);
      renderAll();
    });
  }
}

// ---------------------------------------------------------------------------
// MULTI-SELECT FILTER COMPONENT
// ---------------------------------------------------------------------------

function createMultiSelect(key, buttonId, panelId, labelFn) {
  const btn = document.getElementById(buttonId);
  const panel = document.getElementById(panelId);
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    document.querySelectorAll('.ms-panel.open').forEach(p => { if (p !== panel) p.classList.remove('open'); });
    panel.classList.toggle('open');
  });
  document.addEventListener('click', (e) => {
    if (!panel.contains(e.target) && e.target !== btn) panel.classList.remove('open');
  });
  return { btn, panel, key, labelFn };
}

const multiSelects = {};

function initFilterUI() {
  multiSelects.country = createMultiSelect('country', 'btn-filter-country', 'panel-filter-country', v => v);
  multiSelects.city = createMultiSelect('city', 'btn-filter-city', 'panel-filter-city', v => v);
  multiSelects.kitchen = createMultiSelect('kitchen', 'btn-filter-kitchen', 'panel-filter-kitchen', v => v);
  multiSelects.provider = createMultiSelect('provider', 'btn-filter-provider', 'panel-filter-provider', v => v);
  multiSelects.brand = createMultiSelect('brand', 'btn-filter-brand', 'panel-filter-brand', v => v);

  document.getElementById('btn-clear-all').addEventListener('click', () => {
    state.filters = { country: [], city: [], kitchen: [], provider: [], brand: [] };
    renderAll();
    if (typeof updateProjSaveNameAuto === 'function') updateProjSaveNameAuto();
  });
}

function renderMultiSelectPanel(msKey, panelId, options, valueFn, labelFn, cascadeKeysToReset) {
  const panel = document.getElementById(panelId);
  const selected = state.filters[msKey];
  panel.innerHTML = '';
  const searchBox = document.createElement('input');
  searchBox.type = 'text';
  searchBox.className = 'ms-search';
  searchBox.placeholder = 'Buscar...';
  panel.appendChild(searchBox);
  const list = document.createElement('div');
  list.className = 'ms-list';
  panel.appendChild(list);

  function draw(filterText) {
    list.innerHTML = '';
    const ft = (filterText || '').toLowerCase();
    options.filter(o => labelFn(o).toLowerCase().includes(ft)).forEach(o => {
      const val = valueFn(o);
      const row = document.createElement('label');
      row.className = 'ms-row';
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = selected.includes(val);
      cb.addEventListener('change', () => {
        if (cb.checked) { if (!selected.includes(val)) selected.push(val); }
        else { const idx = selected.indexOf(val); if (idx >= 0) selected.splice(idx, 1); }
        cascadeKeysToReset.forEach(k => { state.filters[k] = []; });
        renderAll();
        if (msKey === 'country' && typeof updateProjSaveNameAuto === 'function') updateProjSaveNameAuto();
      });
      row.appendChild(cb);
      row.appendChild(document.createTextNode(' ' + labelFn(o)));
      list.appendChild(row);
    });
  }
  draw('');
  searchBox.addEventListener('input', () => draw(searchBox.value));

  const btnId = panelId.replace('panel-filter-', 'btn-filter-');
  const btn = document.getElementById(btnId);
  const labelSpanId = btnId + '-label';
  let labelSpan = document.getElementById(labelSpanId);
  if (selected.length === 0) btn.querySelector('.ms-btn-label').textContent = 'Todos';
  else if (selected.length === 1) btn.querySelector('.ms-btn-label').textContent = labelFn(options.find(o => valueFn(o) === selected[0]) || { }) || selected[0];
  else btn.querySelector('.ms-btn-label').textContent = `${selected.length} seleccionados`;
}

function renderFilterOptions() {
  const opts = computeCascadeOptions();
  renderMultiSelectPanel('country', 'panel-filter-country', opts.countryOpts, v => v, v => v, ['city', 'kitchen', 'provider', 'brand']);

  // Filtrar opciones por país seleccionado (si hay país seleccionado, SOLO mostrar ese país)
  const selectedCountries = state.filters.country.length > 0 ? state.filters.country : opts.countryOpts;
  const filteredCities = opts.cityOpts.filter(c => FACTS.some(f => f.city === c && selectedCountries.includes(f.country)));
  const filteredKitchens = opts.kitchenOpts.filter(k => FACTS.some(f => f.kitchenId === k.id && selectedCountries.includes(f.country)));
  const filteredProviders = opts.providerOpts.filter(p => FACTS.some(f => f.provider === p && selectedCountries.includes(f.country)));
  const filteredBrands = opts.brandOpts.filter(b => FACTS.some(f => f.brandId === b.id && selectedCountries.includes(f.country)));

  renderMultiSelectPanel('city', 'panel-filter-city', filteredCities, v => v, v => v, ['kitchen', 'provider', 'brand']);
  renderMultiSelectPanel('kitchen', 'panel-filter-kitchen', filteredKitchens, o => o.id, o => o.name, ['provider', 'brand']);
  renderMultiSelectPanel('provider', 'panel-filter-provider', filteredProviders, v => v, v => v, ['brand']);
  renderMultiSelectPanel('brand', 'panel-filter-brand', filteredBrands, o => o.id, o => o.name, []);

  const filtered = getFilteredFacts();
  const total = FACTS.length;
  document.getElementById('record-counter').textContent = `${filtered.length.toLocaleString('en-US')} / ${total.toLocaleString('en-US')} registros`;
}

function renderChips() {
  const container = document.getElementById('chips-container');
  container.innerHTML = '';
  const labelsMap = {
    country: v => v,
    city: v => v,
    kitchen: v => (window.__kitchenNameById && window.__kitchenNameById[v]) || v,
    provider: v => v,
    brand: v => (window.__brandNameById && window.__brandNameById[v]) || v
  };
  const kitchenById = {}; const brandById = {};
  for (const f of FACTS) { kitchenById[f.kitchenId] = f.kitchenName; brandById[f.brandId] = f.brandName; }
  window.__kitchenNameById = kitchenById; window.__brandNameById = brandById;

  Object.entries(state.filters).forEach(([key, arr]) => {
    arr.forEach(val => {
      const chip = document.createElement('span');
      chip.className = 'chip';
      chip.textContent = labelsMap[key](val);
      const x = document.createElement('button');
      x.textContent = '✕';
      x.addEventListener('click', () => {
        const idx = state.filters[key].indexOf(val);
        if (idx >= 0) state.filters[key].splice(idx, 1);
        if (key === 'country') { state.filters.city = []; state.filters.kitchen = []; state.filters.provider = []; state.filters.brand = []; }
        if (key === 'city') { state.filters.kitchen = []; state.filters.provider = []; state.filters.brand = []; }
        if (key === 'kitchen') { state.filters.provider = []; state.filters.brand = []; }
        if (key === 'provider') { state.filters.brand = []; }
        renderAll();
        if (key === 'country' && typeof updateProjSaveNameAuto === 'function') updateProjSaveNameAuto();
      });
      chip.appendChild(x);
      container.appendChild(chip);
    });
  });
}

// ---------------------------------------------------------------------------
// S1 — KPIs
// ---------------------------------------------------------------------------

// Mes de referencia por defecto para Meta/Mes Anterior/tablas de desglose: el mes
// del filtro "Hasta" elegido por el usuario (mismo criterio que ya usa Run Rate vía
// rrAsOf), o el mes del último dato disponible si no hay filtro de fecha activo.
// Así, si el usuario filtra Desde/Hasta = julio 2026, "el mes que está revisando"
// pasa a ser julio en vez de quedar fijo al mes calendario actual.
function refYearMonth() {
  const refISO = (state.dateTo && state.dateTo <= LAST_DATA_ISO) ? state.dateTo : LAST_DATA_ISO;
  const d = new Date(refISO + 'T00:00:00');
  return { year: d.getFullYear(), month: d.getMonth() };
}

function renderS1() {
  const dimFacts = getFilteredFacts({ ignoreDate: true }); // Meta/RR/mes anterior son ancla mensual fija, independiente del filtro de fecha
  const dateFacts = getFilteredFacts();
  const countries = activeCountriesInFilter();
  const { year, month } = refYearMonth();
  const prevMonth = month === 0 ? 11 : month - 1;
  const prevYear = month === 0 ? year - 1 : year;

  const gmvPrevMonth = computeGMVRealForMonth(dimFacts, prevYear, prevMonth);
  // Meta siempre se calcula para COL (referencia baseline) por defecto, independientemente
  // del filtro de país; con la Proyección de Metas activa, usa el país seleccionado en los filtros.
  // El mes a proyectar puede ser distinto al mes actual si la Proyección de Metas lo define así.
  const metaCountries = metaCountriesFor(countries);
  const metaFacts = FACTS.filter(f => metaCountries.includes(f.country));
  const metaTarget = getProjectionTargetMonth();
  const meta = computeGMVMeta(metaFacts, metaTarget.year, metaTarget.month, metaCountries);
  const leverImpacts = getLeverImpactsForScope(countries);
  const metaFxCountry = metaFxCountryFor(countries);
  // Se guarda el detalle por palanca (no solo la suma) para poder mostrar el mismo
  // modal "Cálculo de Meta" que ya tienen las tablas de S3-S5 también en este KPI.
  let leverImpactUSD = 0;
  const kpiLeverBreakdown = [];
  // Igual que calculateTotalMetaWithLevers(): antes se exigía leverMatchesAnyFact
  // antes de sumar, así que una palanca de marca/cocina nueva (aún sin ventas
  // reales) contaba en el editor pero no aquí — el KPI "GMV Meta" quedaba por
  // debajo de "Meta Total" en Proyecciones Guardadas exactamente por el monto de
  // esas palancas. Toda palanca activa cuenta su monto completo.
  leverImpacts.forEach(l => {
    leverImpactUSD += l.amountUSD;
    kpiLeverBreakdown.push({ name: l.name, amountUSD: l.amountUSD, scope: l.scope, weight: 1, contributionCOP: l.amountUSD * (FX[metaFxCountry] || 1) });
  });
  const leverImpactCOP = leverImpactUSD * (FX[metaFxCountry] || 1); // Convertir USD → moneda local del país de referencia
  const metaWithLeversInCOP = meta.total + leverImpactCOP;
  const metaWithLevers = fxValue(metaWithLeversInCOP, metaFxCountry); // Aplicar conversión según state.currency
  // GMV Real = ventas reales dentro del filtro de fecha Desde/Hasta que eligió el usuario.
  // dateFacts ya viene acotado a ese rango (getFilteredFacts respeta state.dateFrom/dateTo),
  // así que basta con sumarlo tal cual — restringirlo además al mes actual (como antes)
  // producía $0 en cuanto el rango elegido no tocara el mes en curso (p.ej. filtrar julio
  // con la fecha del sistema ya en agosto).
  const real = sumGmv(dateFacts);
  // Run Rate vinculado a los filtros de fecha Desde/Hasta: usa 'Hasta' como fecha de referencia
  // y solo los hechos dentro del rango filtrado, en vez del ancla fija de hoy.
  const rrAsOf = (state.dateTo && state.dateTo < LAST_DATA_ISO) ? state.dateTo : LAST_DATA_ISO;
  const rr = computeGMVRunRate(dateFacts, countries, rrAsOf);

  const difGmv = rr.value === null ? null : rr.value - metaWithLevers;
  const varPrev = rr.value === null ? null : rr.value - gmvPrevMonth;

  const kpi1 = document.getElementById('kpi-1-value');
  if (kpi1) kpi1.textContent = fmtMoney(gmvPrevMonth);

  const kpi2 = document.getElementById('kpi-2-value');
  if (kpi2) {
    // Mismo modal "Cálculo de Meta" que ya usan las tablas S3-S5 (metaCell/showMetaExplainModal),
    // pero para el KPI agregado de todo el alcance filtrado en vez de una fila individual —
    // por eso baseWeight/weight quedan en 1 (100%): esta "fila" ES el alcance completo.
    const { from: kpiBaseFrom, to: kpiBaseTo } = getMetaBaselineRange(metaTarget.year, metaTarget.month);
    let kpiScopeBaseline = 0;
    for (const f of metaFacts) {
      if (f.gran !== 'day' || f.dateISO < kpiBaseFrom || f.dateISO > kpiBaseTo) continue;
      const frac = kitchenOpenFraction(f.kitchenId);
      if (frac > 0) kpiScopeBaseline += f.gmv * frac;
    }
    const metaRow = {
      key: '__KPI_META_TOTAL__',
      label: 'Total del alcance filtrado',
      meta: metaWithLevers,
      metaBreakdown: {
        baseMetaCOP: meta.total,
        totalBaseline: kpiScopeBaseline,
        ownBaseline: kpiScopeBaseline,
        baseWeight: 1,
        baseContributionCOP: meta.total,
        levers: kpiLeverBreakdown,
        fxCountry: metaFxCountry
      }
    };
    const idx = window.__metaExplainRows.length;
    window.__metaExplainRows.push(metaRow);
    kpi2.innerHTML = `<span data-meta-explain-idx="${idx}" style="cursor:pointer;border-bottom:1px dotted var(--text-muted);" title="Ver cómo se calculó esta meta">${fmtMoney(metaWithLevers)}</span>`;
  }

  const kpi3 = document.getElementById('kpi-3-value');
  if (kpi3) kpi3.textContent = fmtMoney(real);

  const kpi4 = document.getElementById('kpi-4-value');
  if (kpi4) {
    kpi4.textContent = rr.value === null ? '—' : fmtMoney(rr.value);
    kpi4.title = rr.insufficientData ? 'Se necesita al menos 1 semana de datos para calcular el run rate.' : '';
  }

  // KPI 6: Var. Mes Anterior
  const kpi6el = document.getElementById('kpi-6-value');
  const kpi6pct = document.getElementById('kpi-6-pct');
  if (kpi6el) {
    if (varPrev === null) {
      kpi6el.textContent = '—';
      if (kpi6pct) kpi6pct.textContent = '';
    } else {
      kpi6el.textContent = fmtMoney(varPrev);
      kpi6el.className = 'kpi-value ' + (varPrev >= 0 ? 'positive' : 'negative');
      if (kpi6pct) kpi6pct.textContent = gmvPrevMonth ? fmtPct((varPrev / gmvPrevMonth) * 100) : '—';
    }
  }

  // KPI 7: Cumplimiento %
  const kpi7el = document.getElementById('kpi-7-value');
  const kpi7pct = document.getElementById('kpi-7-pct');
  if (kpi7el) {
    if (rr.value === null) {
      kpi7el.textContent = '—';
      if (kpi7pct) kpi7pct.textContent = '';
    } else {
      const diffDollar = rr.value - metaWithLevers;
      const diffPct = metaWithLevers ? (diffDollar / metaWithLevers) * 100 : 0;
      const cumpPct = metaWithLevers ? (rr.value / metaWithLevers) * 100 : 0;
      kpi7el.textContent = fmtMoney(diffDollar);
      kpi7el.className = 'kpi-value ' + (diffDollar >= 0 ? 'positive' : 'negative');
      if (kpi7pct) kpi7pct.textContent = `${fmtPct(diffPct)} · ${fmtPct(cumpPct, 1)}`;
    }
  }

  const diffPct = metaWithLevers ? ((rr.value - metaWithLevers) / metaWithLevers) * 100 : 0;
  document.getElementById('s1-summary').textContent = rr.value === null
    ? `Run rate — · Meta ${fmtMoney(metaWithLevers)} · Diferencia —`
    : `Run rate ${fmtMoney(rr.value)} · Meta ${fmtMoney(metaWithLevers)} · Diferencia ${diffPct >= 0 ? '+' : ''}${diffPct.toFixed(1)}%`;
}

// ---------------------------------------------------------------------------
// S2 — Evolución del GMV
// ---------------------------------------------------------------------------

let s2Chart = null;

function bucketKey(dateISO, granularity) {
  const d = new Date(dateISO + 'T00:00:00');
  if (granularity === 'Diario') return dateISO;
  if (granularity === 'Semanal') {
    const day = d.getDay();
    const monday = new Date(d); monday.setDate(d.getDate() - ((day + 6) % 7));
    return toISOLocal(monday);
  }
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
function toISOLocal(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function renderS2() {
  const countries = activeCountriesInFilter();
  const gran = state.s2Granularity;
  const s2From = state.s2DateFrom || '2026-01-01';
  const s2To = state.s2DateTo || LAST_DATA_ISO;

  const matchesNonDateFilters = (f) => {
    if (!countries.length || !countries.includes(f.country)) return false;
    if (state.filters.city && state.filters.city.length && !state.filters.city.includes(f.city)) return false;
    if (state.filters.kitchen && state.filters.kitchen.length && !state.filters.kitchen.includes(f.kitchenId)) return false;
    if (state.filters.provider && state.filters.provider.length && !state.filters.provider.includes(f.provider)) return false;
    if (state.filters.brand && state.filters.brand.length && !state.filters.brand.includes(f.brandId)) return false;
    return true;
  };

  // Filter facts for S2 with independent date range
  const facts = FACTS.filter(f => {
    if (f.gran !== 'day') return false; // month-grain facts have dateISO=null, can't be bucketed by day/week
    if (!matchesNonDateFilters(f)) return false;
    if (f.dateISO < s2From || f.dateISO > s2To) return false;
    return true;
  });

  const buckets = new Map(); // key -> {gmv, metaGmv, dayBreakdown (for Semanal)}
  for (const f of facts) {
    const key = bucketKey(f.dateISO, gran);
    if (!buckets.has(key)) {
      buckets.set(key, { gmv: 0, dayBreakdown: [0, 0, 0, 0, 0, 0, 0] });
    }
    const gmvVal = fxValue(f.gmv, f.country);
    buckets.get(key).gmv += gmvVal;

    // Track GMV by day of week for Semanal view
    if (gran === 'Semanal') {
      const d = new Date(f.dateISO + 'T00:00:00');
      const dow = d.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
      const dayIndex = (dow + 6) % 7; // Convert to Mon=0, Sun=6
      buckets.get(key).dayBreakdown[dayIndex] += gmvVal;
    }
  }
  // meta por mes, distribuida sobre los buckets según fecha
  const monthsInvolved = new Set();
  for (const key of buckets.keys()) {
    const monthKey = gran === 'Mensual' ? key : key.slice(0, 7);
    monthsInvolved.add(monthKey);
  }
  const metaFacts = getFilteredFacts({ ignoreDate: true });
  const metaByDate = new Map();
  monthsInvolved.forEach(mk => {
    const [y, m] = mk.split('-').map(Number);
    const res = computeGMVMeta(metaFacts, y, m - 1, countries);
    res.dailyMeta.forEach(dm => metaByDate.set(dm.dateISO, dm.value));
  });
  // computeGMVMeta devuelve valores en moneda local; hay que convertir con fxValue igual que el GMV real
  const metaCountry = countries.length === 1 ? countries[0] : 'COL';
  for (const key of buckets.keys()) {
    if (gran === 'Diario') buckets.get(key).metaGmv = fxValue(metaByDate.get(key) || 0, metaCountry);
    else if (gran === 'Semanal') {
      let sum = 0;
      for (let i = 0; i < 7; i++) {
        const d = new Date(key + 'T00:00:00'); d.setDate(d.getDate() + i);
        sum += metaByDate.get(toISOLocal(d)) || 0;
      }
      buckets.get(key).metaGmv = fxValue(sum, metaCountry);
    } else {
      const [y, m] = key.split('-').map(Number);
      let sum = 0;
      for (let i = 1; i <= daysInMonth(y, m - 1); i++) sum += metaByDate.get(ymd(y, m - 1, i)) || 0;
      buckets.get(key).metaGmv = fxValue(sum, metaCountry);
    }
  }

  const sortedKeys = Array.from(buckets.keys()).sort();
  const metaData = sortedKeys.map(k => buckets.get(k).metaGmv);
  const curPeriodKey = gran === 'Diario' ? LAST_DATA_ISO : bucketKey(LAST_DATA_ISO, gran);

  // Colors by day of week
  const dowColors = ['#4a9fd4', '#5cb85c', '#f0ad4e', '#d9534f', '#5bc0de', '#9b59b6', '#e74c3c']; // Mon-Sun

  const ctx = document.getElementById('s2-chart').getContext('2d');
  if (s2Chart) s2Chart.destroy();
  const isDark = state.theme === 'dark';
  const gridColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
  const textColor = isDark ? '#8aadcc' : '#344a5e';

  // Build datasets
  let datasets = [];
  if (gran === 'Semanal') {
    // Stacked bars by day of week
    const dowNames = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
    dowNames.forEach((name, dayIndex) => {
      datasets.push({
        type: 'bar',
        label: name,
        data: sortedKeys.map(k => buckets.get(k).dayBreakdown[dayIndex]),
        backgroundColor: dowColors[dayIndex],
        stack: 'gmv',
        order: 2
      });
    });
    // Meta line
    datasets.push({
      type: 'line',
      label: 'GMV Meta',
      data: metaData,
      borderColor: '#e8a838',
      borderDash: [6, 4],
      borderWidth: 2,
      pointRadius: 0,
      fill: false,
      order: 1
    });
  } else {
    // Regular single bar (Diario, Mensual)
    const gmvData = sortedKeys.map(k => buckets.get(k).gmv);
    const barColors = sortedKeys.map(k => k === curPeriodKey ? '#5cb85c' : '#4a9fd4');
    datasets = [
      { type: 'bar', label: 'GMV', data: gmvData, backgroundColor: barColors, order: 2 },
      { type: 'line', label: 'GMV Meta', data: metaData, borderColor: '#e8a838', borderDash: [6, 4], borderWidth: 2, pointRadius: 0, fill: false, order: 1 }
    ];
  }

  s2Chart = new Chart(ctx, {
    data: {
      labels: sortedKeys,
      datasets: datasets
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { grid: { color: gridColor }, ticks: { color: textColor } },
        y: {
          title: { display: true, text: `GMV (${currencyLabel()})`, color: textColor },
          grid: { color: gridColor },
          ticks: { color: textColor }
        }
      },
      plugins: {
        legend: { labels: { color: textColor } },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              if (ctx.dataset.type === 'bar' && gran === 'Semanal') {
                return `${ctx.dataset.label}: ${fmtMoney(ctx.parsed.y)}`;
              }
              if (ctx.dataset.label === 'GMV') {
                const meta = metaData[ctx.dataIndex];
                const diff = ctx.parsed.y - meta;
                return [`GMV: ${fmtMoney(ctx.parsed.y)}`, `Meta: ${fmtMoney(meta)}`, `Dif: ${fmtMoney(diff)}`];
              }
              return `Meta: ${fmtMoney(ctx.parsed.y)}`;
            }
          }
        }
      }
    }
  });

  // Calculate summary (period with highest GMV)
  let maxIdx = 0;
  let maxGmv = 0;
  for (let i = 0; i < sortedKeys.length; i++) {
    const gmv = buckets.get(sortedKeys[i]).gmv;
    if (gmv > maxGmv) {
      maxGmv = gmv;
      maxIdx = i;
    }
  }
  document.getElementById('s2-summary').textContent = sortedKeys.length
    ? `Periodo con mayor GMV: ${sortedKeys[maxIdx]} — ${fmtMoney(maxGmv)}`
    : 'Sin datos para el rango seleccionado.';

  // Populate day-of-week legend for Semanal view
  const legendEl = document.getElementById('s2-dow-legend');
  if (legendEl) {
    if (gran === 'Semanal') {
      const dowNames = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
      legendEl.innerHTML = dowNames.map((name, i) =>
        `<div style="display: flex; align-items: center; gap: 6px;">
          <div style="width: 16px; height: 16px; background-color: ${dowColors[i]}; border-radius: 2px;"></div>
          <span>${name}</span>
        </div>`
      ).join('');
      legendEl.style.display = 'flex';
    } else {
      legendEl.innerHTML = '';
      legendEl.style.display = 'none';
    }
  }

  document.querySelectorAll('.s2-pill').forEach(p => p.classList.toggle('active', p.dataset.gran === gran));
}

function rebuildCharts() { renderS2(); }

document.addEventListener('DOMContentLoaded', () => {
  // S2 Granularity pills
  document.querySelectorAll('.s2-pill').forEach(p => {
    p.addEventListener('click', () => { state.s2Granularity = p.dataset.gran; renderS2(); });
  });

  // S2 Date range (8 semanas hacia atrás por defecto)
  const s2From = document.getElementById('s2-date-from');
  const s2To = document.getElementById('s2-date-to');
  const lastDate = new Date(LAST_DATA_ISO + 'T00:00:00');
  const sixMonthsAgo = new Date(lastDate);
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6); // 6 months
  state.s2DateFrom = toISOLocal(sixMonthsAgo);
  state.s2DateTo = LAST_DATA_ISO;
  s2From.value = state.s2DateFrom;
  s2To.value = state.s2DateTo;
  s2From.min = '2026-01-01';
  s2To.min = '2026-01-01';
  s2From.max = LAST_DATA_ISO;
  s2To.max = LAST_DATA_ISO;
  s2From.addEventListener('change', () => { state.s2DateFrom = s2From.value || state.s2DateFrom; renderS2(); });
  s2To.addEventListener('change', () => { state.s2DateTo = s2To.value || state.s2DateTo; renderS2(); });

  renderS2();
});

// ---------------------------------------------------------------------------
// Generic breakdown table (S3, S3b, S4, S5)
// ---------------------------------------------------------------------------

// Con la Proyección de Metas activa, la meta se calcula con el/los país(es)
// seleccionado(s) en los filtros; sin proyección activa se mantiene el
// comportamiento histórico (siempre Colombia, sin importar el filtro de país).
function metaCountriesFor(countries) {
  const proj = state.metaProjection;
  if (proj && proj.active && countries && countries.length) return countries;
  return ['COL'];
}
function metaFxCountryFor(countries) {
  return metaCountriesFor(countries)[0] || 'COL';
}

// País de referencia para EDITAR/MOSTRAR montos de palancas (selector de moneda,
// "Monto" en la tabla, herramienta de reparación). A diferencia de metaFxCountryFor,
// esto NO depende de si la Proyección de Metas ya está "activa" — mientras se arma
// el borrador de palancas (antes de aplicar la proyección), proj.active todavía es
// false, y metaFxCountryFor caía de vuelta a COL aunque el filtro mostrara Perú/México,
// convirtiendo montos ingresados en moneda local con la tasa de COL por error.
function leverEntryCountryFor(countries) {
  return (countries && countries.length === 1) ? countries[0] : 'COL';
}

// Igual criterio que leverAppliesToActiveCountryFilter, para cocinas excluidas: una
// cocina "aplica" al filtro de país activo si esa cocina realmente vende en alguno de
// los países filtrados (una cocina pertenece a un solo país, así que en la práctica
// esto es "¿la cocina es de este país?", sin tener que hardcodear una tabla propia).
function kitchenAppliesToActiveCountryFilter(kitchenId) {
  const countries = activeCountriesInFilter();
  if (countries.length >= DIM_COUNTRIES.length) return true;
  return window.FACTS.some(f => f.kitchenId === kitchenId && countries.includes(f.country));
}

function calculateBaseMetaCOP(facts, countries) {
  const { year, month } = getProjectionTargetMonth();
  const metaCountries = metaCountriesFor(countries);
  const metaFacts = facts.filter(f => metaCountries.includes(f.country));
  const meta = computeGMVMeta(metaFacts, year, month, metaCountries);
  return meta.total; // moneda local del país de referencia, sin convertir a la moneda de visualización
}

function calculateTotalMetaWithLevers(facts, countries) {
  const baseMetaCOP = calculateBaseMetaCOP(facts, countries);
  const leverImpacts = getLeverImpactsForScope(countries);
  let leverImpactUSD = 0;
  // Antes se exigía leverMatchesAnyFact(l.scope, facts) antes de sumar — una
  // palanca de una marca o cocina agregada con "+ Marca nueva"/"+ Cocina nueva"
  // (aún sin ventas reales) nunca encuentra ningún hecho que igualar, así que su
  // monto quedaba en $0 aquí aunque "TOTAL ACTIVO" en el editor sí la contara —
  // el mismo síntoma que ya se corrigió en leverAppliesToActiveCountryFilter().
  // Toda palanca activa cuenta su monto completo; breakdownBy() (más abajo) es
  // el que decide CÓMO repartirla entre filas, no si cuenta o no.
  leverImpacts.forEach(l => { leverImpactUSD += l.amountUSD; });
  const fxCountry = metaFxCountryFor(countries);
  const leverImpactCOP = leverImpactUSD * (FX[fxCountry] || 1);
  return fxValue(baseMetaCOP + leverImpactCOP, fxCountry);
}

function breakdownBy(facts, keyFn, labelFn, countries, baseMetaCOP, leverImpacts, dateFacts) {
  const groups = new Map();
  for (const f of facts) {
    const key = keyFn(f);
    if (!groups.has(key)) groups.set(key, { label: labelFn(f), facts: [] });
    groups.get(key).facts.push(f);
  }

  // Run Rate vinculado a los filtros de fecha Desde/Hasta
  const dateGroups = new Map();
  if (dateFacts) {
    for (const f of dateFacts) {
      const key = keyFn(f);
      if (!dateGroups.has(key)) dateGroups.set(key, []);
      dateGroups.get(key).push(f);
    }
  }
  const rrAsOf = (state.dateTo && state.dateTo < LAST_DATA_ISO) ? state.dateTo : LAST_DATA_ISO;

  const { year, month } = getProjectionTargetMonth();

  // Baseline (por defecto mes anterior al mes proyectado, o el rango personalizado
  // de la Proyección de Metas si está activa) para distribución proporcional de la meta base
  const { from: baselineFrom, to: baselineTo } = getMetaBaselineRange(year, month);
  const baselineFactsAll = FACTS.filter(f =>
    f.gran === 'day' &&
    f.dateISO >= baselineFrom && f.dateISO <= baselineTo &&
    countries.includes(f.country)
  );
  // Las cocinas cerradas/excluidas (total o parcialmente, ver kitchenOpenFraction)
  // aportan al baseline solo la fracción del mes proyectado que seguirán abiertas
  // — así ninguna palanca, ni siquiera una de alcance amplio, puede volver a
  // atribuirles más peso del que realmente les corresponde. Su GMV Real/RR
  // histórico no se toca, solo su parte de la meta queda prorrateada (o en $0
  // si el cierre cubre todo el mes).
  const baselineGroups = new Map();
  for (const f of baselineFactsAll) {
    const frac = kitchenOpenFraction(f.kitchenId);
    if (frac <= 0) continue;
    const key = keyFn(f);
    baselineGroups.set(key, (baselineGroups.get(key) || 0) + f.gmv * frac);
  }
  // El denominador solo debe considerar las filas que realmente aparecen en esta tabla
  // (p.ej. GMV por Marca excluye Turbo), para que la suma de metas por fila = total
  const totalBaseline = Array.from(baselineGroups.entries())
    .filter(([key]) => groups.has(key))
    .reduce((s, [, v]) => s + v, 0);

  // Cada palanca reparte su propio monto SOLO entre las filas que coinciden con su
  // alcance (ciudad/marca/cocina/turbo/todas), según el peso de cada una en el
  // baseline dentro de ese alcance — así una palanca de una marca específica no
  // se reparte entre marcas que no le corresponden.
  const leverData = (leverImpacts || []).map(lever => {
    if (isAllScope(lever.scope)) {
      return { lever, groups: baselineGroups, total: totalBaseline };
    }
    const scopedFacts = baselineFactsAll.filter(f => leverMatchesFact(lever.scope, f));
    const scopedGroups = new Map();
    for (const f of scopedFacts) {
      const frac = kitchenOpenFraction(f.kitchenId);
      if (frac <= 0) continue;
      const key = keyFn(f);
      scopedGroups.set(key, (scopedGroups.get(key) || 0) + f.gmv * frac);
    }
    const scopedTotal = Array.from(scopedGroups.entries())
      .filter(([key]) => groups.has(key))
      .reduce((s, [, v]) => s + v, 0);
    if (scopedTotal > 0) return { lever, groups: scopedGroups, total: scopedTotal };

    // El alcance de la palanca no tuvo venta en la ventana de baseline (p.ej. una
    // cocina que abrió después de esa ventana) — sin peso, la palanca se perdía en
    // silencio (el total de "palancas activas" la contaba, pero ninguna fila la
    // reflejaba). En ese caso se reparte según TODO el histórico disponible
    // (facts, que ignora el filtro de fecha) para las filas de su alcance.
    const fallbackFacts = facts.filter(f => leverMatchesFact(lever.scope, f));
    const fallbackGroups = new Map();
    for (const f of fallbackFacts) {
      const frac = kitchenOpenFraction(f.kitchenId);
      if (frac <= 0) continue;
      const key = keyFn(f);
      fallbackGroups.set(key, (fallbackGroups.get(key) || 0) + f.gmv * frac);
    }
    const fallbackTotal = Array.from(fallbackGroups.entries())
      .filter(([key]) => groups.has(key))
      .reduce((s, [, v]) => s + v, 0);
    if (fallbackTotal > 0) return { lever, groups: fallbackGroups, total: fallbackTotal };

    // Último recurso (la cocina/marca/ciudad del alcance no tiene NINGUNA venta
    // histórica todavía): repartir en partes iguales entre las filas que sí
    // coinciden con el alcance, para que la palanca al menos aparezca en algún
    // lado en vez de desaparecer.
    const evenGroups = new Map();
    for (const [key, g] of groups) {
      if (g.facts.some(f => kitchenOpenFraction(f.kitchenId) > 0 && leverMatchesFact(lever.scope, f))) evenGroups.set(key, 1);
    }
    if (evenGroups.size > 0) return { lever, groups: evenGroups, total: evenGroups.size };

    // Huérfana de verdad: su alcance no tiene NINGÚN hecho real en todo el
    // histórico (p.ej. una marca/cocina agregada con "+ Marca nueva"/"+ Cocina
    // nueva" que aún no ha vendido nada) — ni siquiera en esta tabla ni en
    // ninguna otra, así que no hay ninguna fila real a la que prorratearle el
    // monto. Antes esto hacía que la palanca desapareciera silenciosamente del
    // TOTAL de la tabla (contaba en "TOTAL ACTIVO" del editor pero en ningún
    // otro lado) — se marca "orphan" para que breakdownBy() le agregue su
    // propia fila en vez de perder su monto.
    return { lever, groups: new Map(), total: 0, orphan: true };
  });

  const fxCountry = metaFxCountryFor(countries);
  const rows = [];
  for (const [key, g] of groups) {
    const rrFacts = dateFacts ? (dateGroups.get(key) || []) : g.facts;
    const rr = computeGMVRunRate(rrFacts, countries, rrAsOf);

    const ownBaseline = baselineGroups.get(key) || 0;
    const baseWeight = totalBaseline > 0 ? ownBaseline / totalBaseline : 0;
    const baseContributionCOP = baseMetaCOP * baseWeight;
    let metaCOP = baseContributionCOP;

    const leverBreakdown = [];
    for (const ld of leverData) {
      if (ld.total > 0) {
        const w = (ld.groups.get(key) || 0) / ld.total;
        const contributionCOP = ld.lever.amountUSD * (FX[fxCountry] || 1) * w;
        metaCOP += contributionCOP;
        if (w > 0) {
          leverBreakdown.push({ name: ld.lever.name, amountUSD: ld.lever.amountUSD, scope: ld.lever.scope, weight: w, contributionCOP });
        }
      }
    }
    const metaInDisplay = fxValue(metaCOP, fxCountry);

    const diffAbs = rr.value === null ? null : rr.value - metaInDisplay;
    const diffPct = (rr.value === null || !metaInDisplay) ? null : (diffAbs / metaInDisplay) * 100;
    rows.push({
      key, label: g.label, rr: rr.value, meta: metaInDisplay, diffAbs, diffPct,
      metaBreakdown: { baseMetaCOP, totalBaseline, ownBaseline, baseWeight, baseContributionCOP, levers: leverBreakdown, fxCountry }
    });
  }

  // Palancas "huérfanas" (ver arriba): sin ninguna fila real a la que
  // prorratearlas, se suman en una fila propia para que el TOTAL de la tabla
  // siga incluyendo su monto completo en vez de perderlo en silencio.
  const orphanLevers = leverData.filter(ld => ld.orphan);
  if (orphanLevers.length) {
    const orphanContributionsCOP = orphanLevers.map(ld => ld.lever.amountUSD * (FX[fxCountry] || 1));
    const orphanTotalCOP = orphanContributionsCOP.reduce((s, v) => s + v, 0);
    rows.push({
      key: '__orphan_levers__',
      label: '🆕 Palancas sin ventas aún (marca/cocina nueva)',
      rr: null, meta: fxValue(orphanTotalCOP, fxCountry), diffAbs: null, diffPct: null,
      metaBreakdown: {
        baseMetaCOP: 0, totalBaseline: 0, ownBaseline: 0, baseWeight: 0, baseContributionCOP: 0,
        levers: orphanLevers.map((ld, i) => ({ name: ld.lever.name, amountUSD: ld.lever.amountUSD, scope: ld.lever.scope, weight: 1, contributionCOP: orphanContributionsCOP[i] })),
        fxCountry
      }
    });
  }
  return rows;
}

function renderSortableTable(tbodyId, rows, sortState, columns) {
  const dir = sortState.dir === 'asc' ? 1 : -1;
  rows.sort((a, b) => {
    const av = a[sortState.key], bv = b[sortState.key];
    if (av === null && bv === null) return 0;
    if (av === null) return 1;
    if (bv === null) return -1;
    if (typeof av === 'string') return av.localeCompare(bv) * dir;
    return (av - bv) * dir;
  });
  const tbody = document.getElementById(tbodyId);
  tbody.innerHTML = '';
  rows.forEach(r => {
    const tr = document.createElement('tr');
    tr.innerHTML = columns.map(c => c(r)).join('');
    tbody.appendChild(tr);
  });
  return rows;
}

function moneyCell(v) { return `<td class="mono">${v === null ? '—' : fmtMoney(v)}</td>`; }

// Celda de Meta clickeable: abre un modal explicando de dónde salió el número
// (peso en el baseline + aporte de cada palanca que aplique a esta fila).
window.__metaExplainRows = [];
function metaCell(r) {
  if (r.meta === null || r.meta === undefined) return `<td class="mono">—</td>`;
  const idx = window.__metaExplainRows.length;
  window.__metaExplainRows.push(r);
  return `<td class="mono"><span data-meta-explain-idx="${idx}" style="cursor:pointer;border-bottom:1px dotted var(--text-muted);" title="Ver cómo se calculó esta meta">${fmtMoney(r.meta)}</span></td>`;
}

// Arma el metaBreakdown "agregado" para la fila TOTAL de una tabla S3-S5: mismo
// baseMetaCOP/totalBaseline que cualquier fila individual de esa tabla (son iguales
// para todas, ya que representan el alcance completo de la tabla), pero con peso 100%
// (esta "fila" ES todo el alcance) y cada palanca sumada a través de todas las filas
// — por construcción de breakdownBy, los pesos de una palanca dentro de esta tabla
// siempre suman 1, así que la suma de sus aportes por fila da su monto completo.
function buildTableTotalMetaBreakdown(rows) {
  const withMeta = rows.filter(r => r.metaBreakdown);
  if (!withMeta.length) return null;
  const first = withMeta[0].metaBreakdown;
  // OJO: algunas tablas (Marcas Turbo, GMV por Marca sin Turbo) son un SUBCONJUNTO
  // del negocio completo, no el 100% — first.baseMetaCOP/totalBaseline son el
  // baseline de TODO el negocio (igual en cualquier fila, por eso "first" alcanza),
  // pero el aporte de ESTA tabla al TOTAL debe ser la SUMA de lo que cada fila
  // visible ya aporta individualmente (ownBaseline/baseContributionCOP), no el 100%
  // del baseline completo — si no, "Marcas Turbo" mostraba el baseline de TODAS las
  // marcas (turbo + no turbo) en vez de solo el de las turbo.
  const sumOwnBaseline = withMeta.reduce((s, r) => s + r.metaBreakdown.ownBaseline, 0);
  const sumBaseContribution = withMeta.reduce((s, r) => s + r.metaBreakdown.baseContributionCOP, 0);
  const leverMap = new Map();
  for (const r of withMeta) {
    for (const l of r.metaBreakdown.levers) {
      const acc = leverMap.get(l.name) || { name: l.name, amountUSD: l.amountUSD, scope: l.scope, contributionCOP: 0 };
      acc.contributionCOP += l.contributionCOP;
      leverMap.set(l.name, acc);
    }
  }
  return {
    baseMetaCOP: first.baseMetaCOP,
    totalBaseline: first.totalBaseline,
    ownBaseline: sumOwnBaseline,
    baseWeight: first.totalBaseline > 0 ? sumOwnBaseline / first.totalBaseline : 0,
    baseContributionCOP: sumBaseContribution,
    levers: Array.from(leverMap.values()).map(l => ({ ...l, weight: 1 })),
    fxCountry: first.fxCountry
  };
}

// Celda de Meta clickeable para la fila TOTAL de una tabla — mismo modal que metaCell(),
// pero mostrando el desglose agregado de toda la tabla en vez de una sola fila.
function metaTotalCell(rows, totalMetaValue) {
  const breakdown = buildTableTotalMetaBreakdown(rows);
  if (!breakdown) return `<td class="mono">${fmtMoney(totalMetaValue)}</td>`;
  const idx = window.__metaExplainRows.length;
  window.__metaExplainRows.push({ key: '__TABLE_TOTAL__', label: 'TOTAL', meta: totalMetaValue, metaBreakdown: breakdown });
  return `<td class="mono"><span data-meta-explain-idx="${idx}" style="cursor:pointer;border-bottom:1px dotted var(--text-muted);" title="Ver cómo se calculó esta meta">${fmtMoney(totalMetaValue)}</span></td>`;
}

function showMetaExplainModal(row) {
  const b = row.metaBreakdown;
  if (!b) return;
  const overlay = document.getElementById('meta-explain-overlay');
  document.getElementById('meta-explain-title').textContent = `Cálculo de Meta — ${row.label}`;

  const fxCountry = b.fxCountry || 'COL';
  const basePct = b.totalBaseline > 0 ? (b.baseWeight * 100).toFixed(1) : '0.0';

  // Si esta fila es una cocina con cierre configurado (total o parcial), se avisa
  // explícitamente — el aporte de meta base de arriba YA viene prorrateado por la
  // fracción de días que seguirá abierta, y sin este aviso parece un número normal.
  let html = '';
  const excludedEntry = (state.metaProjection.excludedKitchens || []).find(e => e.kitchenId === row.key);
  if (excludedEntry) {
    const { openFraction, openDays, totalDays } = computeOpenFractionForRange(excludedEntry.closedFrom, excludedEntry.closedTo);
    const pctOpen = (openFraction * 100).toFixed(1);
    html += `<div style="margin-bottom:12px;padding:8px 10px;background:var(--bg-card-2);border:1px solid var(--accent-red);border-radius:6px;">
      ⚠️ <b>Cocina excluida/cerrada:</b> ${excludedEntry.closedFrom} → ${excludedEntry.closedTo || 'fin del mes proyectado'}
      (abierta ${openDays}/${totalDays} días = <b>${pctOpen}%</b> del mes). El aporte de meta base y de palancas de abajo ya vienen reducidos por esa fracción.
    </div>`;
  }

  html += `
    <div style="margin-bottom:14px;">
      <div style="font-weight:600;margin-bottom:4px;color:var(--accent-blue-2);">Meta base (según baseline)</div>
      <div style="color:var(--text-muted);margin-bottom:2px;">Peso de "${row.label}" en el baseline: ${fmtMoney(fxValue(b.ownBaseline, fxCountry))} de ${fmtMoney(fxValue(b.totalBaseline, fxCountry))} = <b>${basePct}%</b></div>
      <div style="color:var(--text-muted);margin-bottom:2px;">Meta base total del alcance: ${fmtMoney(fxValue(b.baseMetaCOP, fxCountry))}</div>
      <div style="margin-top:6px;">Aporte de meta base: <b>${fmtMoney(fxValue(b.baseContributionCOP, fxCountry))}</b></div>
    </div>`;

  if (b.levers.length) {
    html += `<div style="font-weight:600;margin-bottom:6px;color:var(--accent-blue-2);">Palancas aplicadas</div>`;
    b.levers.forEach(l => {
      const pct = (l.weight * 100).toFixed(1);
      html += `<div style="margin-bottom:8px;padding:8px 10px;background:var(--bg-card-2);border-radius:6px;">
        <div style="font-weight:500;">${l.name || 'Palanca'}</div>
        <div style="color:var(--text-muted);">Monto total: ${fmtMoney(fxValue(l.amountUSD * (FX[fxCountry] || 1), fxCountry))} · Alcance: ${projScopeValueLabels(l.scope)}</div>
        <div style="color:var(--text-muted);">Peso de "${row.label}" dentro de ese alcance: <b>${pct}%</b></div>
        <div>Aporte: <b>${fmtMoney(fxValue(l.contributionCOP, fxCountry))}</b></div>
      </div>`;
    });
  } else {
    html += `<div style="color:var(--text-muted);margin-bottom:10px;">Ninguna palanca activa aplica a esta fila.</div>`;
  }

  html += `<div style="border-top:2px solid var(--accent-blue);margin-top:10px;padding-top:10px;font-weight:700;">TOTAL META: ${fmtMoney(row.meta)}</div>`;

  document.getElementById('meta-explain-body').innerHTML = html;
  overlay.style.display = 'flex';
}

function initMetaExplainModal() {
  const overlay = document.getElementById('meta-explain-overlay');
  document.addEventListener('click', (e) => {
    const trigger = e.target.closest('[data-meta-explain-idx]');
    if (trigger) {
      const idx = parseInt(trigger.dataset.metaExplainIdx, 10);
      const row = window.__metaExplainRows[idx];
      if (row) showMetaExplainModal(row);
      return;
    }
    if (e.target === overlay) overlay.style.display = 'none';
  });
  document.getElementById('meta-explain-close').addEventListener('click', () => { overlay.style.display = 'none'; });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') overlay.style.display = 'none';
  });
}

function pctCell(v) {
  if (v === null) return `<td class="mono">—</td>`;
  const cls = v >= 0 ? 'positive' : 'negative';
  return `<td class="mono ${cls}">${fmtPct(v)}</td>`;
}
function diffCell(v) {
  if (v === null) return `<td class="mono">—</td>`;
  const cls = v >= 0 ? 'positive' : 'negative';
  return `<td class="mono ${cls}">${fmtMoney(v)}</td>`;
}

function renderS3() {
  const facts = getFilteredFacts({ ignoreDate: true });
  const dateFacts = getFilteredFacts();
  const countries = activeCountriesInFilter();
  const baseMetaCOP = calculateBaseMetaCOP(facts, countries);
  const leverImpacts = getLeverImpactsForScope(countries);
  const rows = breakdownBy(facts, f => f.provider, f => f.provider, countries, baseMetaCOP, leverImpacts, dateFacts);
  const sorted = renderSortableTable('s3-table-body', rows, state.s3Sort, [
    r => `<td>${r.label}</td>`,
    r => moneyCell(r.rr),
    r => metaCell(r),
    r => diffCell(r.diffAbs),
    r => pctCell(r.diffPct)
  ]);

  // Agregar fila de totales
  const totalRR = sorted.reduce((s, r) => s + (r.rr || 0), 0);
  const totalMetaSum = sorted.reduce((s, r) => s + (r.meta || 0), 0);
  const totalDiffAbs = totalRR - totalMetaSum;
  const totalDiffPct = totalMetaSum > 0 ? (totalDiffAbs / totalMetaSum) * 100 : 0;
  const s3TotalTbody = document.getElementById('s3-table-total');
  s3TotalTbody.innerHTML = '';
  const trTotal = document.createElement('tr');
  trTotal.innerHTML = `<td style="font-weight:bold">TOTAL</td>${moneyCell(totalRR)}${metaTotalCell(sorted, totalMetaSum)}${diffCell(totalDiffAbs)}${pctCell(totalDiffPct)}`;
  s3TotalTbody.appendChild(trTotal);

  const leader = sorted.slice().sort((a, b) => (b.rr || 0) - (a.rr || 0))[0];
  document.getElementById('s3-summary').textContent = sorted.length
    ? `${sorted.length} plataformas · Plataforma líder: ${leader.label} con ${fmtMoney(leader.rr || 0)} RR`
    : 'Sin datos para la selección actual.';
}

function renderS3b() {
  const facts = getFilteredFacts({ ignoreDate: true });
  const dateFacts = getFilteredFacts();
  const countries = activeCountriesInFilter();
  const baseMetaCOP = calculateBaseMetaCOP(facts, countries);
  const leverImpacts = getLeverImpactsForScope(countries);
  const rows = breakdownBy(facts, f => f.city, f => f.city, countries, baseMetaCOP, leverImpacts, dateFacts);
  const sorted = renderSortableTable('s3b-table-body', rows, state.s3bSort, [
    r => `<td>${r.label}</td>`,
    r => moneyCell(r.rr),
    r => metaCell(r),
    r => diffCell(r.diffAbs),
    r => pctCell(r.diffPct)
  ]);

  // Agregar fila de totales
  const totalRR = sorted.reduce((s, r) => s + (r.rr || 0), 0);
  const totalMetaSum = sorted.reduce((s, r) => s + (r.meta || 0), 0);
  const totalDiffAbs = totalRR - totalMetaSum;
  const totalDiffPct = totalMetaSum > 0 ? (totalDiffAbs / totalMetaSum) * 100 : 0;
  const s3bTotalTbody = document.getElementById('s3b-table-total');
  s3bTotalTbody.innerHTML = '';
  const trTotal = document.createElement('tr');
  trTotal.innerHTML = `<td style="font-weight:bold">TOTAL</td>${moneyCell(totalRR)}${metaTotalCell(sorted, totalMetaSum)}${diffCell(totalDiffAbs)}${pctCell(totalDiffPct)}`;
  s3bTotalTbody.appendChild(trTotal);

  const leader = sorted.slice().sort((a, b) => (b.rr || 0) - (a.rr || 0))[0];
  document.getElementById('s3b-summary').textContent = sorted.length
    ? `${sorted.length} ciudades · Ciudad líder: ${leader.label} con ${fmtMoney(leader.rr || 0)} RR`
    : 'Sin datos para la selección actual.';
}

// Desglose por marca calculado UNA sola vez (Turbo + full-service juntas), para que
// las palancas de alcance 'all'/'turbo' se repartan sin duplicarse entre las dos
// tablas (GMV por Marca y Marcas Turbo): cada una es solo un filtro de estas filas.
function computeBrandBreakdown() {
  const facts = getFilteredFacts({ ignoreDate: true });
  const dateFacts = getFilteredFacts();
  const countries = activeCountriesInFilter();
  const baseMetaCOP = calculateBaseMetaCOP(facts, countries);
  const leverImpacts = getLeverImpactsForScope(countries);
  return breakdownBy(facts, f => f.brandId, f => f.brandName, countries, baseMetaCOP, leverImpacts, dateFacts);
}

function renderS4() {
  const isTurbo = label => /turb/i.test(label);
  const countries = activeCountriesInFilter();
  const rows = computeBrandBreakdown().filter(r => !isTurbo(r.key) && !isTurbo(r.label));
  // Ocultar solo marcas realmente sin actividad (sin meta Y sin RR). Marcas nuevas
  // sin baseline de junio (meta=0) pero con venta real (RR>0) sí deben mostrarse.
  const rowsFiltered = rows.filter(r => (r.meta && r.meta > 0) || (r.rr && r.rr > 0));
  const sorted = renderSortableTable('s4-table-body', rowsFiltered, state.s4Sort, [
    r => `<td>${r.label}</td>`,
    r => moneyCell(r.rr),
    r => metaCell(r),
    r => diffCell(r.diffAbs),
    r => pctCell(r.diffPct)
  ]);

  // Agregar fila de totales: sobre TODAS las marcas (rows), no solo las visibles,
  // para no perder marcas sin baseline de junio (meta=0) del total.
  const totalRR = rows.reduce((s, r) => s + (r.rr || 0), 0);
  const totalMetaSum = rows.reduce((s, r) => s + (r.meta || 0), 0);
  const totalDiffAbs = totalRR - totalMetaSum;
  const totalDiffPct = totalMetaSum > 0 ? (totalDiffAbs / totalMetaSum) * 100 : 0;
  const s4TotalTbody = document.getElementById('s4-table-total');
  s4TotalTbody.innerHTML = '';
  const trTotal = document.createElement('tr');
  trTotal.innerHTML = `<td style="font-weight:bold">TOTAL</td>${moneyCell(totalRR)}${metaTotalCell(rows, totalMetaSum)}${diffCell(totalDiffAbs)}${pctCell(totalDiffPct)}`;
  s4TotalTbody.appendChild(trTotal);

  const leader = sorted.slice().sort((a, b) => (b.rr || 0) - (a.rr || 0))[0];
  document.getElementById('s4-summary').textContent = sorted.length
    ? `${sorted.length} marcas · Marca líder: ${leader.label} con ${fmtMoney(leader.rr || 0)} RR`
    : 'Sin datos para la selección actual.';
}

function renderS4b() {
  const facts = getFilteredFacts({ ignoreDate: true });
  const dateFacts = getFilteredFacts();
  const countries = activeCountriesInFilter();
  const baseMetaCOP = calculateBaseMetaCOP(facts, countries);
  const leverImpacts = getLeverImpactsForScope(countries);
  const rows = breakdownBy(facts, f => f.kitchenId, f => f.kitchenName, countries, baseMetaCOP, leverImpacts, dateFacts);
  // Ocultar solo cocinas realmente sin actividad (sin meta Y sin RR). Cocinas nuevas
  // sin baseline de junio (meta=0) pero con venta real (RR>0) sí deben mostrarse.
  const rowsFiltered = rows.filter(r => (r.meta && r.meta > 0) || (r.rr && r.rr > 0));
  const sorted = renderSortableTable('s4b-table-body', rowsFiltered, state.s4bSort, [
    r => `<td>${r.label}</td>`,
    r => moneyCell(r.rr),
    r => metaCell(r),
    r => diffCell(r.diffAbs),
    r => pctCell(r.diffPct)
  ]);

  // Agregar fila de totales: se calcula sobre TODAS las cocinas (rows), no solo las
  // visibles (sorted), para que cocinas sin meta (sin baseline de junio) no se
  // pierdan silenciosamente del total aunque estén ocultas de la lista.
  const totalRR = rows.reduce((s, r) => s + (r.rr || 0), 0);
  const totalMetaSum = rows.reduce((s, r) => s + (r.meta || 0), 0);
  const totalDiffAbs = totalRR - totalMetaSum;
  const totalDiffPct = totalMetaSum > 0 ? (totalDiffAbs / totalMetaSum) * 100 : 0;
  const s4bTotalTbody = document.getElementById('s4b-table-total');
  s4bTotalTbody.innerHTML = '';
  const trTotal = document.createElement('tr');
  trTotal.innerHTML = `<td style="font-weight:bold">TOTAL</td>${moneyCell(totalRR)}${metaTotalCell(rows, totalMetaSum)}${diffCell(totalDiffAbs)}${pctCell(totalDiffPct)}`;
  s4bTotalTbody.appendChild(trTotal);

  const leader = sorted.slice().sort((a, b) => (b.rr || 0) - (a.rr || 0))[0];
  document.getElementById('s4b-summary').textContent = sorted.length
    ? `${sorted.length} cocinas · Cocina líder: ${leader.label} con ${fmtMoney(leader.rr || 0)} RR`
    : 'Sin datos para la selección actual.';
}

function renderS5() {
  const isTurbo = label => /turb/i.test(label);
  const facts = getFilteredFacts({ ignoreDate: true }).filter(f => /turb/i.test(f.brandId) || /turb/i.test(f.brandName));
  const allFacts = getFilteredFacts({ ignoreDate: true });
  const rows = computeBrandBreakdown().filter(r => isTurbo(r.key) || isTurbo(r.label));
  const empty = document.getElementById('s5-empty');
  const table = document.getElementById('s5-table');
  if (rows.length === 0) {
    empty.style.display = 'block'; table.style.display = 'none';
    document.getElementById('s5-summary').textContent = 'No hay marcas Turbo en la selección actual.';
    return;
  }
  empty.style.display = 'none'; table.style.display = '';
  const sorted = renderSortableTable('s5-table-body', rows, state.s5Sort, [
    r => `<td>${r.label}</td>`,
    r => moneyCell(r.rr),
    r => metaCell(r),
    r => diffCell(r.diffAbs),
    r => pctCell(r.diffPct)
  ]);

  // Agregar fila de totales
  const totalRR = sorted.reduce((s, r) => s + (r.rr || 0), 0);
  const totalMetaSum = sorted.reduce((s, r) => s + (r.meta || 0), 0);
  const totalDiffAbs = totalRR - totalMetaSum;
  const totalDiffPct = totalMetaSum > 0 ? (totalDiffAbs / totalMetaSum) * 100 : 0;
  const s5TotalTbody = document.getElementById('s5-table-total');
  s5TotalTbody.innerHTML = '';
  const trTotal = document.createElement('tr');
  trTotal.innerHTML = `<td style="font-weight:bold">TOTAL</td>${moneyCell(totalRR)}${metaTotalCell(sorted, totalMetaSum)}${diffCell(totalDiffAbs)}${pctCell(totalDiffPct)}`;
  s5TotalTbody.appendChild(trTotal);

  const turboTotal = sumGmv(facts);
  const totalGmv = sumGmv(allFacts);
  const pct = totalGmv ? (turboTotal / totalGmv) * 100 : 0;
  document.getElementById('s5-summary').textContent = `${rows.length} marcas Turbo · Representan ${pct.toFixed(1)}% del GMV total`;
}

function initSortHandlers() {
  document.querySelectorAll('[data-sort-table]').forEach(th => {
    th.addEventListener('click', () => {
      const tableKey = th.dataset.sortTable;
      const sortKey = th.dataset.sortKey;
      const stateKey = tableKey + 'Sort';
      if (state[stateKey].key === sortKey) state[stateKey].dir = state[stateKey].dir === 'asc' ? 'desc' : 'asc';
      else { state[stateKey].key = sortKey; state[stateKey].dir = 'desc'; }
      renderAll();
    });
  });
}

// ---------------------------------------------------------------------------
// S6 — Comparación de rangos (KPIs)
// ---------------------------------------------------------------------------

function factsInDateRange(facts, fromISO, toISO_) {
  return facts.filter(f => {
    if (f.gran === 'day') return f.dateISO >= fromISO && f.dateISO <= toISO_;
    const mStart = ymd(2026, f.month, 1);
    const mEnd = ymd(2026, f.month, daysInMonth(2026, f.month));
    return mEnd >= fromISO && mStart <= toISO_;
  });
}

function renderS6() {
  const facts = getFilteredFacts({ ignoreDate: true });
  const countries = activeCountriesInFilter();
  const r1 = state.range1, r2 = state.range2;
  const r1Date = new Date(r1.from + 'T00:00:00');
  const r1Facts = factsInDateRange(facts, r1.from, r1.to);
  const r2Facts = factsInDateRange(facts, r2.from, r2.to);

  const metaR1 = computeGMVMeta(facts.filter(f => countries.includes(f.country)), r1Date.getFullYear(), r1Date.getMonth(), countries).total;
  const gmvR1 = sumGmv(r1Facts);
  const gmvR2 = sumGmv(r2Facts);
  const r1EndCapped = r1.to < LAST_DATA_ISO ? r1.to : LAST_DATA_ISO;
  const rrR1 = computeGMVRunRate(facts, countries, r1EndCapped).value;
  const difR2R1 = gmvR2 - gmvR1;
  const varPctR2R1 = gmvR1 ? (difR2R1 / gmvR1) * 100 : null;
  const ordersR1 = sumOrders(r1Facts);

  document.getElementById('s6-kpi-1').textContent = fmtMoney(metaR1);
  document.getElementById('s6-kpi-2').textContent = fmtMoney(gmvR1);
  document.getElementById('s6-kpi-3').textContent = fmtMoney(gmvR2);
  document.getElementById('s6-kpi-4').textContent = rrR1 === null ? '—' : fmtMoney(rrR1);
  const kpi5 = document.getElementById('s6-kpi-5');
  kpi5.textContent = fmtMoney(difR2R1);
  kpi5.className = 'kpi-value ' + (difR2R1 >= 0 ? 'positive' : 'negative');
  const kpi6 = document.getElementById('s6-kpi-6');
  kpi6.textContent = varPctR2R1 === null ? '—' : fmtPct(varPctR2R1);
  kpi6.className = 'kpi-value ' + (varPctR2R1 >= 0 ? 'positive' : 'negative');
  document.getElementById('s6-kpi-7').textContent = fmtInt(ordersR1);

  document.getElementById('s6-summary').textContent =
    `Rango 1: ${r1.from} → ${r1.to} · Rango 2: ${r2.from} → ${r2.to} · Variación: ${varPctR2R1 === null ? '—' : varPctR2R1.toFixed(1) + '%'}`;
}

// ---------------------------------------------------------------------------
// S7 — Comparación de rangos por marca
// ---------------------------------------------------------------------------

function renderS7() {
  const facts = getFilteredFacts({ ignoreDate: true });
  const r1Facts = factsInDateRange(facts, state.range1.from, state.range1.to);
  const r2Facts = factsInDateRange(facts, state.range2.from, state.range2.to);

  const byBrand = new Map();
  for (const f of r1Facts) {
    if (!byBrand.has(f.brandId)) byBrand.set(f.brandId, { label: f.brandName, gmv1: 0, gmv2: 0 });
    byBrand.get(f.brandId).gmv1 += fxValue(f.gmv, f.country);
  }
  for (const f of r2Facts) {
    if (!byBrand.has(f.brandId)) byBrand.set(f.brandId, { label: f.brandName, gmv1: 0, gmv2: 0 });
    byBrand.get(f.brandId).gmv2 += fxValue(f.gmv, f.country);
  }
  const rows = Array.from(byBrand.values()).map(r => {
    const varAbs = r.gmv2 - r.gmv1;
    const varPct = r.gmv1 ? (varAbs / r.gmv1) * 100 : null;
    return { label: r.label, gmv1: r.gmv1, gmv2: r.gmv2, varAbs, varPct };
  });

  const dir = state.s7Sort.dir === 'asc' ? 1 : -1;
  rows.sort((a, b) => {
    const av = a[state.s7Sort.key], bv = b[state.s7Sort.key];
    if (av === null) return 1; if (bv === null) return -1;
    if (typeof av === 'string') return av.localeCompare(bv) * dir;
    return (av - bv) * dir;
  });

  const pageSize = 20;
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  if (state.s7Page > totalPages) state.s7Page = totalPages;
  const pageRows = rows.slice((state.s7Page - 1) * pageSize, state.s7Page * pageSize);

  const tbody = document.getElementById('s7-table-body');
  tbody.innerHTML = '';
  pageRows.forEach(r => {
    const tr = document.createElement('tr');
    const badgeCls = r.varAbs >= 0 ? 'badge-positive' : 'badge-negative';
    tr.innerHTML = `<td>${r.label}</td>${moneyCell(r.gmv1)}${moneyCell(r.gmv2)}` +
      `<td class="mono"><span class="badge ${badgeCls}">${r.varPct === null ? '—' : fmtPct(r.varPct)}</span></td>` +
      `${diffCell(r.varAbs)}`;
    tbody.appendChild(tr);
  });

  const pagDiv = document.getElementById('s7-pagination');
  pagDiv.innerHTML = '';
  for (let p = 1; p <= totalPages; p++) {
    const b = document.createElement('button');
    b.textContent = p;
    b.className = p === state.s7Page ? 'active' : '';
    b.addEventListener('click', () => { state.s7Page = p; renderS7(); });
    pagDiv.appendChild(b);
  }

  const positives = rows.filter(r => r.varAbs >= 0).length;
  const negatives = rows.length - positives;
  document.getElementById('s7-summary').textContent = `${rows.length} marcas · ${positives} positivas · ${negatives} negativas`;
}

// ---------------------------------------------------------------------------
// S8 — Worst offenders
// ---------------------------------------------------------------------------

function renderS8() {
  const facts = getFilteredFacts({ ignoreDate: true });
  const r1Facts = factsInDateRange(facts, state.range1.from, state.range1.to);
  const r2Facts = factsInDateRange(facts, state.range2.from, state.range2.to);

  const byKey = new Map();
  for (const f of r1Facts) {
    const key = f.brandId + '|' + f.provider;
    if (!byKey.has(key)) byKey.set(key, { brand: f.brandName, provider: f.provider, gmv1: 0, gmv2: 0 });
    byKey.get(key).gmv1 += fxValue(f.gmv, f.country);
  }
  for (const f of r2Facts) {
    const key = f.brandId + '|' + f.provider;
    if (!byKey.has(key)) byKey.set(key, { brand: f.brandName, provider: f.provider, gmv1: 0, gmv2: 0 });
    byKey.get(key).gmv2 += fxValue(f.gmv, f.country);
  }
  const rows = Array.from(byKey.values()).map(r => {
    const varAbs = r.gmv2 - r.gmv1;
    const varPct = r.gmv1 ? (varAbs / r.gmv1) * 100 : null;
    return { ...r, varAbs, varPct };
  }).sort((a, b) => a.varAbs - b.varAbs).slice(0, 10);

  const tbody = document.getElementById('s8-table-body');
  tbody.innerHTML = '';
  rows.forEach(r => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${r.brand}</td><td>${r.provider}</td>${moneyCell(r.gmv1)}${moneyCell(r.gmv2)}` +
      `<td class="mono"><span class="badge badge-negative">${r.varPct === null ? '—' : fmtPct(r.varPct)}</span></td>` +
      `<td class="mono negative">${fmtMoney(r.varAbs)}</td>`;
    tbody.appendChild(tr);
  });
  const totalLoss = rows.reduce((s, r) => s + Math.min(0, r.varAbs), 0);
  document.getElementById('s8-summary').textContent = rows.length
    ? `Las 10 marcas con mayor caída acumulan ${fmtMoney(Math.abs(totalLoss))} de pérdida`
    : 'Sin datos suficientes para calcular caídas.';
}

// ---------------------------------------------------------------------------
// S9 — Alerta: combinaciones sin ventas (últimos 7 días calendario, fijo)
// ---------------------------------------------------------------------------

function renderS9() {
  const sevenDaysAgo = new Date(LAST_DATA_ISO + 'T00:00:00');
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
  const cutoffISO = toISOLocal(sevenDaysAgo);

  const facts = getFilteredFacts({ ignoreDate: true }).filter(f => f.gran === 'day');
  const byCombo = new Map();
  for (const f of facts) {
    const key = f.kitchenId + '|' + f.brandId;
    if (!byCombo.has(key)) byCombo.set(key, { kitchen: f.kitchenName, brand: f.brandName, lastDate: null, lastGmv: 0 });
    const c = byCombo.get(key);
    if (!c.lastDate || f.dateISO > c.lastDate) { c.lastDate = f.dateISO; c.lastGmv = fxValue(f.gmv, f.country); }
  }

  const rows = [];
  for (const [, c] of byCombo) {
    if (c.lastDate >= cutoffISO) continue;
    const lastD = new Date(c.lastDate + 'T00:00:00');
    const nowD = new Date(LAST_DATA_ISO + 'T00:00:00');
    const daysSince = Math.round((nowD - lastD) / 86400000);
    rows.push({ kitchen: c.kitchen, brand: c.brand, lastGmv: c.lastGmv, lastDate: c.lastDate, daysSince });
  }
  rows.sort((a, b) => b.daysSince - a.daysSince);

  const tbody = document.getElementById('s9-table-body');
  const table = document.getElementById('s9-table');
  const emptyMsg = document.getElementById('s9-empty');
  tbody.innerHTML = '';
  if (rows.length === 0) {
    table.style.display = 'none'; emptyMsg.style.display = 'block';
  } else {
    table.style.display = ''; emptyMsg.style.display = 'none';
    rows.forEach(r => {
      const badgeCls = r.daysSince > 14 ? 'badge-negative' : 'badge-amber';
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${r.kitchen}</td><td>${r.brand}</td>${moneyCell(r.lastGmv)}<td class="mono">${r.lastDate}</td>` +
        `<td class="mono"><span class="badge ${badgeCls}">${r.daysSince}</span></td>`;
      tbody.appendChild(tr);
    });
  }
  const over14 = rows.filter(r => r.daysSince > 14).length;
  document.getElementById('s9-summary').textContent = rows.length
    ? `${rows.length} combinaciones sin ventas · ${over14} llevan más de 14 días inactivas`
    : 'Todas las combinaciones tienen actividad en los últimos 7 días.';
}

// ---------------------------------------------------------------------------
// LEVERS
// ---------------------------------------------------------------------------

function toggleLeversContent() {
  state.leversExpanded = !state.leversExpanded;
  const content = document.getElementById('levers-content');
  const icon = document.getElementById('levers-toggle-icon');
  content.style.display = state.leversExpanded ? 'block' : 'none';
  icon.textContent = state.leversExpanded ? '▼' : '▶';
}

// ---------------------------------------------------------------------------
// Proyección de Metas: baseline personalizado + palancas con alcance
// (ciudad/marca/cocina). Cuando está activa, reemplaza la META usada en todo
// el dashboard (KPIs y tablas S3/S3b/S4/S4b/S5).
// ---------------------------------------------------------------------------

function projScopeValueLabels(scope) {
  if (isAllScope(scope)) return 'Todos los países';
  const parts = [];
  if (scope.turbo) parts.push('Turbo');
  if (scope.countries && scope.countries.length) parts.push(`País: ${scope.countries.join(', ')}`);
  if (scope.cities && scope.cities.length) parts.push(`Ciudad: ${scope.cities.join(', ')}`);
  if (scope.brands && scope.brands.length) {
    const byId = new Map(DIM_BRANDS.map(b => [b.id, b.name]));
    parts.push(`Marca: ${scope.brands.map(v => byId.get(v) || v).join(', ')}`);
  }
  if (scope.categories && scope.categories.length) {
    parts.push(`Categoría: ${scope.categories.map(c => PROJ_CATEGORY_LABELS[c] || c).join(', ')}`);
  }
  if (scope.kitchens && scope.kitchens.length) {
    const byId = new Map(DIM_KITCHENS.map(k => [k.id, k.name]));
    parts.push(`Cocina: ${scope.kitchens.map(v => byId.get(v) || v).join(', ')}`);
  }
  if (scope.providers && scope.providers.length) {
    parts.push(`Plataforma: ${scope.providers.join(', ')}`);
  }
  return parts.join(' · ') || 'Todas (país)';
}

// Atajos de categorías de marca (BRAND_CATEGORIES viene de brand-categories.js,
// clasificado por nombre de marca; se resuelve a los IDs de DIM_BRANDS).
const PROJ_BRAND_GROUP_MAP = {
  turbo: ['Turbo Core', 'Turbo New', 'Turbo Other'],
  core: ['Core brands'],
  new: ['New Brands'],
  other: ['Other brands']
};
function projBrandIdsForGroup(groupKey) {
  const categories = PROJ_BRAND_GROUP_MAP[groupKey] || [];
  if (typeof BRAND_CATEGORIES === 'undefined') return [];
  const nameSet = new Set();
  categories.forEach(cat => (BRAND_CATEGORIES[cat] || []).forEach(n => nameSet.add(n.toLowerCase())));
  return DIM_BRANDS.filter(b => nameSet.has(b.name.toLowerCase())).map(b => b.id);
}

// Opciones de alcance limitadas al/los país(es) seleccionado(s) en los filtros
// principales del dashboard (si eliges Colombia arriba, solo debe verse Colombia aquí).
let projScopeCountrySignature = null;
function refreshProjScopeOptionsIfNeeded() {
  const citiesEl = document.getElementById('proj-lever-scope-cities');
  const brandsEl = document.getElementById('proj-lever-scope-brands');
  const kitchensEl = document.getElementById('proj-lever-scope-kitchens');
  const providersEl = document.getElementById('proj-lever-scope-providers');
  const excludedKitchenSelectEl = document.getElementById('proj-excluded-kitchen-select');
  if (!citiesEl || !brandsEl || !kitchensEl) return;

  const countries = activeCountriesInFilter();
  const sig = countries.slice().sort().join(',');
  if (sig === projScopeCountrySignature) return; // sin cambios de país: no pisar la selección en curso
  projScopeCountrySignature = sig;

  const scopedFacts = FACTS.filter(f => countries.includes(f.country));
  const cities = Array.from(new Set(scopedFacts.map(f => f.city))).sort();
  const brands = Array.from(new Map(scopedFacts.map(f => [f.brandId, f.brandName])).entries())
    .map(([id, name]) => ({ value: id, label: name })).sort((a, b) => a.label.localeCompare(b.label));
  const kitchens = Array.from(new Map(scopedFacts.map(f => [f.kitchenId, f.kitchenName])).entries())
    .map(([id, name]) => ({ value: id, label: name })).sort((a, b) => a.label.localeCompare(b.label));
  const providers = Array.from(new Set(scopedFacts.map(f => f.provider))).sort();

  citiesEl.innerHTML = cities.map(c => `<option value="${c}">${c}</option>`).join('');
  brandsEl.innerHTML = brands.map(o => `<option value="${o.value}">${o.label}</option>`).join('');
  kitchensEl.innerHTML = kitchens.map(o => `<option value="${o.value}">${o.label}</option>`).join('');
  if (providersEl) providersEl.innerHTML = providers.map(p => `<option value="${p}">${p}</option>`).join('');
  if (excludedKitchenSelectEl) {
    excludedKitchenSelectEl.innerHTML = kitchens.map(o => `<option value="${o.value}">${o.label}</option>`).join('');
    updateExcludedKitchenPreview();
  }
}

function updateProjBaselineSummary() {
  const el = document.getElementById('proj-baseline-summary');
  if (!el) return;
  const proj = state.metaProjection;
  if (!proj.active || !proj.baselineFrom || !proj.baselineTo) {
    el.textContent = 'Proyección personalizada inactiva: se está proyectando el mes actual usando el mes anterior como baseline (comportamiento por defecto).';
    return;
  }
  const monthNamesCap = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const targetLabel = proj.targetMonth != null ? `${monthNamesCap[proj.targetMonth]} ${proj.targetYear}` : 'el mes actual';
  const countries = activeCountriesInFilter();
  const fxCountry = countries[0] || 'COL';
  const facts = FACTS.filter(f => f.gran === 'day' && f.dateISO >= proj.baselineFrom && f.dateISO <= proj.baselineTo && countries.includes(f.country));
  const totalCOP = facts.reduce((s, f) => s + f.gmv, 0);
  const nDays = Math.round((new Date(proj.baselineTo + 'T00:00:00') - new Date(proj.baselineFrom + 'T00:00:00')) / 86400000) + 1;
  const avgDay = nDays > 0 ? totalCOP / nDays : 0;
  el.textContent = `Proyección activa · Proyectando: ${targetLabel} · Baseline: ${proj.baselineFrom} → ${proj.baselineTo} (${nDays} días) · ` +
    `Venta total del baseline: ${fmtMoney(fxValue(totalCOP, fxCountry))} · Promedio diario: ${fmtMoney(fxValue(avgDay, fxCountry))}`;
}

const PROJ_DOW_ORDER = [1, 2, 3, 4, 5, 6, 0]; // Lunes..Domingo (getDay(): 0=Domingo)
const PROJ_DOW_NAMES = { 0: 'Domingo', 1: 'Lunes', 2: 'Martes', 3: 'Miércoles', 4: 'Jueves', 5: 'Viernes', 6: 'Sábado' };

// Muestra cómo se calcula la meta: promedio por día de la semana en el rango de
// baseline elegido (aunque aún no se haya aplicado la proyección), multiplicado
// por cuántos días de cada tipo tiene el mes que se está proyectando.
function renderProjBaselineTable() {
  const tbody = document.getElementById('proj-baseline-table-body');
  const totalTbody = document.getElementById('proj-baseline-table-total');
  if (!tbody || !totalTbody) return;
  const fromEl = document.getElementById('proj-baseline-from');
  const toEl = document.getElementById('proj-baseline-to');
  const from = fromEl.value, to = toEl.value;
  if (!from || !to || from > to) { tbody.innerHTML = ''; totalTbody.innerHTML = ''; return; }

  // Simula temporalmente el rango y el mes objetivo del formulario (sin necesidad
  // de haber aplicado la proyección) para poder previsualizar el cálculo mientras se elige.
  const proj = state.metaProjection;
  const prevActive = proj.active, prevFrom = proj.baselineFrom, prevTo = proj.baselineTo;
  const prevTargetYear = proj.targetYear, prevTargetMonth = proj.targetMonth;
  const targetEl = document.getElementById('proj-target-month');
  const [selYear, selMonth] = targetEl && targetEl.value ? targetEl.value.split('-').map(Number) : [null, null];
  proj.active = true; proj.baselineFrom = from; proj.baselineTo = to;
  proj.targetYear = selYear; proj.targetMonth = selMonth;

  const { year, month } = getProjectionTargetMonth();
  const countries = activeCountriesInFilter();
  const fxCountry = countries[0] || 'COL';
  const metaFacts = FACTS.filter(f => countries.includes(f.country));
  const meta = computeGMVMeta(metaFacts, year, month, countries);

  proj.active = prevActive; proj.baselineFrom = prevFrom; proj.baselineTo = prevTo;
  proj.targetYear = prevTargetYear; proj.targetMonth = prevTargetMonth;

  const monthNames = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  tbody.innerHTML = PROJ_DOW_ORDER.map(dow => {
    const avg = meta.dowAvg[dow] || 0;
    const count = meta.dowCountsInMonth[dow] || 0;
    const total = avg * count;
    return `<tr><td>${PROJ_DOW_NAMES[dow]}</td><td class="mono">${fmtMoney(fxValue(avg, fxCountry))}</td><td class="mono">${count}</td><td class="mono">${fmtMoney(fxValue(total, fxCountry))}</td></tr>`;
  }).join('') + `<tr><td>Festivos / Fechas especiales</td><td class="mono">${fmtMoney(fxValue(meta.festivalAvg || 0, fxCountry))}</td><td class="mono">${meta.festivalCountInMonth || 0}</td><td class="mono">${fmtMoney(fxValue((meta.festivalAvg || 0) * (meta.festivalCountInMonth || 0), fxCountry))}</td></tr>`;

  totalTbody.innerHTML = `<tr><td style="font-weight:bold">TOTAL — Meta proyectada para ${monthNames[month]}</td><td></td><td></td><td class="mono" style="font-weight:bold">${fmtMoney(fxValue(meta.total, fxCountry))}</td></tr>`;
}

// Ejecuta fn() con el estado de metaProjection simulado según los valores actuales
// del formulario (mes objetivo + rango de baseline + palancas ya guardadas), sin
// necesidad de haber pulsado "Aplicar proyección". Restaura el estado real al salir.
function withSimulatedProjFormState(fn) {
  const proj = state.metaProjection;
  const fromEl = document.getElementById('proj-baseline-from');
  const toEl = document.getElementById('proj-baseline-to');
  const targetEl = document.getElementById('proj-target-month');
  const from = fromEl ? fromEl.value : proj.baselineFrom;
  const to = toEl ? toEl.value : proj.baselineTo;
  const [selYear, selMonth] = targetEl && targetEl.value ? targetEl.value.split('-').map(Number) : [proj.targetYear, proj.targetMonth];

  const prev = { active: proj.active, baselineFrom: proj.baselineFrom, baselineTo: proj.baselineTo, targetYear: proj.targetYear, targetMonth: proj.targetMonth };
  if (from && to && from <= to) {
    proj.active = true; proj.baselineFrom = from; proj.baselineTo = to;
    proj.targetYear = selYear; proj.targetMonth = selMonth;
  }
  try {
    return fn();
  } finally {
    proj.active = prev.active; proj.baselineFrom = prev.baselineFrom; proj.baselineTo = prev.baselineTo;
    proj.targetYear = prev.targetYear; proj.targetMonth = prev.targetMonth;
  }
}

const PROJ_CATEGORY_LABELS = { turbo: 'Turbo', core: 'Core', new: 'New', other: 'Other', uncategorized: 'Sin categorizar' };

function renderProjResultTable(tbodyId, totalTbodyId, rows, labelHeader) {
  const tbody = document.getElementById(tbodyId);
  const totalTbody = document.getElementById(totalTbodyId);
  if (!tbody || !totalTbody) return;
  const sorted = rows.slice().sort((a, b) => (b.meta || 0) - (a.meta || 0));
  tbody.innerHTML = sorted.map(r => `<tr><td>${r.label}</td><td class="mono">${fmtMoney(r.meta || 0)}</td></tr>`).join('');
  const total = sorted.reduce((s, r) => s + (r.meta || 0), 0);
  totalTbody.innerHTML = `<tr><td style="font-weight:bold">TOTAL</td><td class="mono" style="font-weight:bold">${fmtMoney(total)}</td></tr>`;
}

function renderProjResultTables() {
  if (!document.getElementById('proj-result-city-body')) return;
  withSimulatedProjFormState(() => {
    const facts = getFilteredFacts({ ignoreDate: true });
    const countries = activeCountriesInFilter();
    const baseMetaCOP = calculateBaseMetaCOP(facts, countries);
    const leverImpacts = getLeverImpactsForScope(countries);

    const cityRows = breakdownBy(facts, f => f.city, f => f.city, countries, baseMetaCOP, leverImpacts);
    renderProjResultTable('proj-result-city-body', 'proj-result-city-total', cityRows);

    const brandRows = breakdownBy(facts, f => f.brandId, f => f.brandName, countries, baseMetaCOP, leverImpacts);
    renderProjResultTable('proj-result-brand-body', 'proj-result-brand-total', brandRows);

    // Agregar por categoría: cada marca cae en el primer grupo (turbo/core/new/other)
    // en el que aparezca su ID; lo que no se encuentre en BRAND_CATEGORIES cae en "Sin categorizar".
    const brandToCategory = new Map();
    ['turbo', 'core', 'new', 'other'].forEach(group => {
      projBrandIdsForGroup(group).forEach(id => { if (!brandToCategory.has(id)) brandToCategory.set(id, group); });
    });
    const categoryTotals = new Map();
    brandRows.forEach(r => {
      const group = brandToCategory.get(r.key) || 'uncategorized';
      categoryTotals.set(group, (categoryTotals.get(group) || 0) + (r.meta || 0));
    });
    const categoryRows = Array.from(categoryTotals.entries()).map(([group, meta]) => ({ label: PROJ_CATEGORY_LABELS[group] || group, meta }));
    renderProjResultTable('proj-result-category-body', 'proj-result-category-total', categoryRows);

    const growthLineEl = document.getElementById('proj-growth-line');
    if (growthLineEl) {
      const { year: gYear, month: gMonth } = getProjectionTargetMonth();
      const totalDisplay = calculateTotalMetaWithLevers(facts, countries);
      growthLineEl.innerHTML = growthLineHTML(totalDisplay, countries, gYear, gMonth) ||
        (countries.length !== 1 ? 'Filtra un único país para ver el crecimiento vs. año pasado / mes anterior.' : '');
    }
  });
}

function projLeverAmountLabel(l) {
  // Se muestra en la moneda activa del dashboard (USD o Local), sin importar en
  // cuál se haya ingresado originalmente el monto. Usa el país de referencia vigente
  // (el filtro de país activo) — antes asumía siempre Colombia, lo que además
  // enmascaraba el bug de entrada: un monto en PEN se guardaba mal (dividido por
  // la tasa de COL) y luego se mostraba "bien" porque el display multiplicaba por
  // esa misma tasa de COL, ocultando que el amountUSD interno era incorrecto.
  const leverFxCountry = leverEntryCountryFor(activeCountriesInFilter());
  return fmtMoney(fxValue(l.amountUSD * (FX[leverFxCountry] || 1), leverFxCountry));
}

// Mantiene la etiqueta "LOCAL" del selector de moneda de la palanca alineada con el
// país de referencia vigente (antes decía "COP" fijo aunque filtraras Perú/México).
function updateProjLeverCurrencyLabel() {
  const currencyEl = document.getElementById('proj-lever-currency');
  if (!currencyEl) return;
  const localOption = currencyEl.querySelector('option[value="LOCAL"]');
  if (!localOption) return;
  const leverFxCountry = leverEntryCountryFor(activeCountriesInFilter());
  localOption.textContent = `${LOCAL_SYMBOL[leverFxCountry] || 'LC'} (moneda local)`;
}

// Las palancas que se editan/eliminan/activan en el Editor viven en
// state.metaProjection.levers (el borrador "en vivo"). Si ese borrador vino de
// "Asignar a la meta" sobre una proyección guardada (appliedSavedId), hay que
// reflejar el cambio también en el snapshot guardado — si no, "Ver detalle" de
// esa proyección sigue mostrando la palanca vieja, y volver a asignarla más
// adelante revertiría la corrección.
function syncAppliedSavedLevers() {
  const proj = state.metaProjection;
  if (!proj.appliedSavedId) return;
  const saved = (proj.savedList || []).find(s => s.id === proj.appliedSavedId);
  if (!saved) return;
  saved.levers = JSON.parse(JSON.stringify(proj.levers));
  saved.excludedKitchens = JSON.parse(JSON.stringify(proj.excludedKitchens || []));
  // También el baseline/mes objetivo — "Aplicar proyección" cambiaba proj.baselineFrom/
  // baselineTo en vivo pero nunca los escribía de vuelta en el snapshot guardado, así
  // que el cambio se veía en pantalla pero se perdía al recargar la página o al volver
  // a abrir la proyección con "Editar palancas".
  saved.baselineFrom = proj.baselineFrom;
  saved.baselineTo = proj.baselineTo;
  saved.targetYear = proj.targetYear;
  saved.targetMonth = proj.targetMonth;
  // Se guarda AQUÍ (no basta con el saveMetaProjection() que ya corrió justo antes
  // de llamar a esta función en cada handler) porque ese guardado anterior ocurre
  // ANTES de que `saved.excludedKitchens`/`saved.levers` se actualicen arriba — sin
  // este guardado, la edición se ve bien en pantalla pero nunca queda persistida en
  // localStorage, y se pierde al recargar la página.
  saveMetaProjection();
  renderProjSavedList();
  if (currentProjSavedDetailId === saved.id) showProjSavedDetail(saved.id);
}

let editingLeverId = null;

// Formatea un número con puntos de miles (y coma decimal si aplica) para
// mostrarlo en el campo "Monto" — sin esto es fácil equivocarse de cero al
// escribir montos grandes como 40.000.000 a mano.
function formatLeverAmountForInput(num) {
  if (num == null || isNaN(num)) return '';
  const [intPart, decPart] = String(num).split('.');
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return decPart ? `${grouped},${decPart}` : grouped;
}

// Inverso de formatLeverAmountForInput: "40.000.000,50" -> 40000000.5. El
// campo es type="text" (no "number") precisamente para poder mostrar los
// puntos de miles mientras se escribe — hay que quitarlos antes de parsear.
function parseLeverAmountInput(str) {
  if (!str) return NaN;
  return parseFloat(str.replace(/\./g, '').replace(',', '.'));
}

// Reformatea el campo "Monto" en cada tecla: agrupa la parte entera de a 3
// dígitos con puntos, y deja como mucho una coma decimal (2 dígitos) — así
// escribir 40 millones se ve "40.000.000" en vez de un bloque ilegible de
// ceros que hay que contar a mano.
function initLeverAmountLiveFormatting() {
  const el = document.getElementById('proj-lever-amount');
  if (!el) return;
  el.addEventListener('input', () => {
    const cursorFromEnd = el.value.length - el.selectionStart;
    const raw = el.value.replace(/[^\d,]/g, '');
    const firstComma = raw.indexOf(',');
    let intPart = firstComma === -1 ? raw : raw.slice(0, firstComma);
    const decPart = firstComma === -1 ? '' : raw.slice(firstComma + 1).replace(/,/g, '').slice(0, 2);
    intPart = intPart.replace(/^0+(?=\d)/, '');
    const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    const newValue = firstComma === -1 ? grouped : `${grouped},${decPart}`;
    el.value = newValue;
    const newPos = Math.max(0, newValue.length - cursorFromEnd);
    el.setSelectionRange(newPos, newPos);
  });
}

// Carga una palanca existente en el formulario de "2. Palancas de Proyección"
// para editarla en el mismo lugar, en vez de tener que eliminarla y recrearla
// (p.ej. cuando una palanca quedó mal asignada a una marca/ciudad equivocada).
function startEditLever(id) {
  const lever = (state.metaProjection.levers || []).find(l => l.id === id);
  if (!lever) return;
  editingLeverId = id;

  document.getElementById('proj-lever-name').value = lever.name;
  document.getElementById('proj-lever-amount').value = formatLeverAmountForInput(lever.amountEntered != null ? lever.amountEntered : lever.amountUSD);
  document.getElementById('proj-lever-currency').value = lever.currencyEntered || 'USD';
  const rationalEl = document.getElementById('proj-lever-rational');
  if (rationalEl) rationalEl.value = lever.rational || '';

  const toggleAllEl = document.getElementById('proj-lever-toggle-all');
  const dims = {
    countries: { toggle: document.getElementById('proj-lever-toggle-countries'), wrap: document.getElementById('proj-lever-scope-countries-wrap'), select: document.getElementById('proj-lever-scope-countries') },
    cities: { toggle: document.getElementById('proj-lever-toggle-cities'), wrap: document.getElementById('proj-lever-scope-cities-wrap'), select: document.getElementById('proj-lever-scope-cities') },
    brands: { toggle: document.getElementById('proj-lever-toggle-brands'), wrap: document.getElementById('proj-lever-scope-brands-wrap'), select: document.getElementById('proj-lever-scope-brands') },
    categories: { toggle: document.getElementById('proj-lever-toggle-categories'), wrap: document.getElementById('proj-lever-scope-categories-wrap'), select: document.getElementById('proj-lever-scope-categories') },
    kitchens: { toggle: document.getElementById('proj-lever-toggle-kitchens'), wrap: document.getElementById('proj-lever-scope-kitchens-wrap'), select: document.getElementById('proj-lever-scope-kitchens') },
    providers: { toggle: document.getElementById('proj-lever-toggle-providers'), wrap: document.getElementById('proj-lever-scope-providers-wrap'), select: document.getElementById('proj-lever-scope-providers') }
  };
  const scope = lever.scope || {};
  let anySpecific = false;
  Object.keys(dims).forEach(key => {
    const { toggle, wrap, select } = dims[key];
    const values = scope[key] || [];
    // Si esta palanca quedó guardada con una marca o cocina "manual" (una que
    // no existe en los datos, agregada con "+ Marca nueva"/"+ Cocina nueva") y
    // el select ya no la tiene como opción (p.ej. tras recargar la página), se
    // reinserta aquí — si no, se vería como si esa parte del alcance se
    // hubiera perdido al editar.
    if (key === 'brands' || key === 'kitchens') {
      values.forEach(v => {
        if (!Array.from(select.options).some(o => o.value === v)) select.appendChild(new Option(v, v));
      });
    }
    Array.from(select.options).forEach(o => { o.selected = values.includes(o.value); });
    toggle.checked = values.length > 0;
    wrap.style.display = values.length > 0 ? '' : 'none';
    if (values.length > 0) anySpecific = true;
  });
  toggleAllEl.checked = !anySpecific;

  const addBtn = document.getElementById('proj-lever-add');
  addBtn.textContent = '💾 Guardar cambios';
  const cancelBtn = document.getElementById('proj-lever-cancel-edit');
  if (cancelBtn) cancelBtn.style.display = '';

  document.getElementById('proj-lever-name').scrollIntoView({ block: 'center' });
}

function cancelEditLever() {
  editingLeverId = null;
  document.getElementById('proj-lever-name').value = '';
  document.getElementById('proj-lever-amount').value = '';
  const rationalCancelEl = document.getElementById('proj-lever-rational');
  if (rationalCancelEl) rationalCancelEl.value = '';
  const addBtn = document.getElementById('proj-lever-add');
  addBtn.textContent = '+ Agregar palanca';
  const cancelBtn = document.getElementById('proj-lever-cancel-edit');
  if (cancelBtn) cancelBtn.style.display = 'none';
  const toggleAllEl = document.getElementById('proj-lever-toggle-all');
  const specificToggles = ['countries', 'cities', 'brands', 'categories', 'kitchens', 'providers'].map(k => document.getElementById(`proj-lever-toggle-${k}`));
  specificToggles.forEach(t => { t.checked = false; });
  ['countries', 'cities', 'brands', 'categories', 'kitchens', 'providers'].forEach(key => {
    document.getElementById(`proj-lever-scope-${key}-wrap`).style.display = 'none';
    Array.from(document.getElementById(`proj-lever-scope-${key}`).options).forEach(o => { o.selected = false; });
  });
  toggleAllEl.checked = true;
}

// Se llama junto con renderProjectionLevers() (mismos puntos de mutación:
// aplicar/restablecer baseline, asignar/editar una proyección guardada) para
// que la lista de cocinas excluidas siempre quede sincronizada con el resto.
function renderExcludedKitchens() {
  const tbody = document.getElementById('proj-excluded-kitchens-body');
  const summaryEl = document.getElementById('proj-excluded-kitchens-summary');
  if (!tbody || !summaryEl) return;
  const excluded = state.metaProjection.excludedKitchens || [];
  const visibleExcluded = excluded.filter(e => kitchenAppliesToActiveCountryFilter(e.kitchenId));
  const hiddenExcludedCount = excluded.length - visibleExcluded.length;
  const kitchenNameById = new Map(FACTS.map(f => [f.kitchenId, f.kitchenName]));
  const { year, month } = getProjectionTargetMonth();
  const totalDaysInTargetMonth = daysInMonth(year, month);

  tbody.innerHTML = visibleExcluded.length ? visibleExcluded.map(entry => {
    const openDays = Math.round(kitchenOpenFraction(entry.kitchenId) * totalDaysInTargetMonth);
    return `<tr>` +
      `<td>${kitchenNameById.get(entry.kitchenId) || entry.kitchenId}</td>` +
      `<td>${entry.closedFrom} → ${entry.closedTo || '(fin de mes)'}</td>` +
      `<td>${openDays} / ${totalDaysInTargetMonth}</td>` +
      `<td><button class="icon-btn" data-proj-excluded-kitchen-remove="${entry.kitchenId}" style="padding:2px 8px;font-size:11px;">Quitar</button></td>` +
      `</tr>`;
  }).join('') : '<tr><td colspan="4" style="color:var(--text-muted);">Ninguna cocina excluida.</td></tr>';

  const hiddenExcludedNote = hiddenExcludedCount > 0
    ? ` · ${hiddenExcludedCount} oculta${hiddenExcludedCount === 1 ? '' : 's'} por el filtro de país`
    : '';
  summaryEl.textContent = (visibleExcluded.length
    ? `${visibleExcluded.length} cocina${visibleExcluded.length === 1 ? '' : 's'} con cierre configurado para el mes proyectado.`
    : 'Ninguna cocina excluida de la meta.') + hiddenExcludedNote;

  tbody.querySelectorAll('[data-proj-excluded-kitchen-remove]').forEach(btn => {
    btn.addEventListener('click', () => {
      const kid = btn.dataset.projExcludedKitchenRemove;
      state.metaProjection.excludedKitchens = (state.metaProjection.excludedKitchens || []).filter(e => e.kitchenId !== kid);
      saveMetaProjection();
      syncAppliedSavedLevers();
      renderExcludedKitchens();
      renderProjResultTables();
      if (state.metaProjection.active) renderAll();
    });
  });

  updateExcludedKitchenPreview();
}

// Calcula qué fracción del mes proyectado quedaría ABIERTA para un rango de
// cierre dado (closedTo vacío = cerrada hasta fin de mes) — misma lógica que
// kitchenOpenFraction (app.js) pero tomando el rango directo del formulario,
// para poder previsualizar ANTES de guardar la exclusión.
function computeOpenFractionForRange(closedFrom, closedTo) {
  const { year, month } = getProjectionTargetMonth();
  const totalDays = daysInMonth(year, month);
  const monthStart = ymd(year, month, 1);
  const monthEnd = ymd(year, month, totalDays);
  const from = closedFrom > monthStart ? closedFrom : monthStart;
  const to = (closedTo || monthEnd) < monthEnd ? (closedTo || monthEnd) : monthEnd;
  if (from > to) return { openFraction: 1, openDays: totalDays, totalDays };
  const closedDays = Math.round((new Date(to + 'T00:00:00') - new Date(from + 'T00:00:00')) / 86400000) + 1;
  const openDays = Math.max(0, totalDays - closedDays);
  return { openFraction: totalDays > 0 ? openDays / totalDays : 1, openDays, totalDays };
}

// Al elegir una cocina y un rango "Cerrada desde/hasta", muestra cuántos días
// del mes proyectado seguiría abierta y cuánto bajaría la meta: Baseline,
// Palancas y Total — usando la misma descomposición que la tabla combinada de
// "Ver detalle" de una proyección guardada, prorrateada por la fracción de
// días cerrados, para ver el impacto ANTES de confirmar.
function updateExcludedKitchenPreview() {
  const selectEl = document.getElementById('proj-excluded-kitchen-select');
  const fromEl = document.getElementById('proj-excluded-kitchen-from');
  const toEl = document.getElementById('proj-excluded-kitchen-to');
  const previewEl = document.getElementById('proj-excluded-kitchen-preview');
  if (!selectEl || !fromEl || !toEl || !previewEl) return;
  const kitchenId = selectEl.value;
  if (!kitchenId) { previewEl.textContent = ''; return; }
  if ((state.metaProjection.excludedKitchens || []).some(e => e.kitchenId === kitchenId)) {
    previewEl.textContent = 'Esta cocina ya tiene un cierre configurado (quítalo primero para cambiar las fechas).';
    return;
  }
  if (!fromEl.value) {
    previewEl.textContent = 'Elige la fecha "Cerrada desde" para ver el impacto.';
    return;
  }

  // computeOpenFractionForRange calcula todo contra el "Mes a proyectar" de la
  // sección 1 (getProjectionTargetMonth), no contra el mes de las fechas que se
  // acaban de elegir aquí — si no coinciden (p.ej. seleccionaste septiembre
  // pero el mes a proyectar sigue en agosto), el rango cae totalmente fuera de
  // la ventana del mes proyectado y computeOpenFractionForRange devuelve
  // silenciosamente "sin cierre" (abierta todo el mes), sin ningún aviso. Se
  // valida esto explícitamente antes de calcular, para no fallar en silencio.
  const { year: targetYear, month: targetMonth } = getProjectionTargetMonth();
  const monthNamesCap = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const fromDate = new Date(fromEl.value + 'T00:00:00');
  if (fromDate.getFullYear() !== targetYear || fromDate.getMonth() !== targetMonth) {
    previewEl.innerHTML = `⚠️ La fecha "Cerrada desde" (${fromEl.value}) es de un mes distinto al que se está proyectando ahora mismo (<strong>${monthNamesCap[targetMonth]} ${targetYear}</strong>, configurado arriba en "1. Baseline y Mes a Proyectar"). Cambia el "Mes a proyectar" para que coincida con ${monthNamesCap[fromDate.getMonth()]} ${fromDate.getFullYear()} antes de excluir esta cocina — si no, el sistema no aplica ningún cierre.`;
    return;
  }

  const { openFraction, openDays, totalDays } = computeOpenFractionForRange(fromEl.value, toEl.value);

  const facts = getFilteredFacts({ ignoreDate: true });
  const countries = activeCountriesInFilter();
  const baseMetaCOP = calculateBaseMetaCOP(facts, countries);
  const leverImpacts = getLeverImpactsForScope(countries);
  const rows = breakdownBy(facts, f => f.kitchenId, f => f.kitchenName, countries, baseMetaCOP, leverImpacts);
  const row = rows.find(r => r.key === kitchenId);
  if (!row || !row.meta) {
    previewEl.textContent = 'Esta cocina no tiene meta proyectada actualmente (nada que disminuiría).';
    return;
  }

  const mb = row.metaBreakdown;
  const baselineFull = fxValue(mb.baseContributionCOP, mb.fxCountry);
  const palancaFull = fxValue((mb.levers || []).reduce((s, l) => s + l.contributionCOP, 0), mb.fxCountry);
  const reductionFactor = 1 - openFraction;

  previewEl.innerHTML = `<strong>${row.label}</strong> quedaría abierta ${openDays}/${totalDays} días del mes proyectado — la meta disminuiría: ` +
    `Baseline: <strong>${fmtMoney(baselineFull * reductionFactor)}</strong> · Palancas: <strong>${fmtMoney(palancaFull * reductionFactor)}</strong> · Total: <strong>${fmtMoney(row.meta * reductionFactor)}</strong>`;
}

// Una palanca aplica al filtro de país activo si su alcance (scope) puede
// coincidir con al menos un fact de esos países — cubre tanto el caso simple
// (scope.countries no incluye el país filtrado) como el caso donde el país
// viene implícito por otra dimensión (p.ej. una cocina que solo existe en
// Colombia, sin que la palanca declare countries explícitamente).
function leverAppliesToActiveCountryFilter(lever) {
  const countries = activeCountriesInFilter();
  if (countries.length >= DIM_COUNTRIES.length) return true; // sin filtro de país (o "Todos"): mostrar todas
  // Si la palanca declara explícitamente scope.countries, se respeta ESO
  // directamente en vez de exigir una venta real que combine TODAS las
  // dimensiones del alcance a la vez (país + marca + categoría, etc.) — antes,
  // una palanca de una marca nueva sin ventas todavía (agregada con "+ Marca
  // nueva") nunca encontraba ningún hecho real que la combinación completa
  // pudiera igualar, así que quedaba oculta al filtrar un país específico
  // aunque su alcance dijera "País: COL" con toda claridad.
  if (lever.scope && lever.scope.countries && lever.scope.countries.length) {
    return lever.scope.countries.some(c => countries.includes(c));
  }
  const filteredFacts = window.FACTS.filter(f => countries.includes(f.country));
  return leverMatchesAnyFact(lever.scope, filteredFacts);
}

// Deja siempre visible CUÁL proyección guardada está cargada ahora mismo en el
// Editor — sin esto, era fácil asumir que se estaba editando un mes cuando en
// realidad el borrador compartido (proj.levers) tenía cargado otro (p.ej. el
// que resolveMetaProjectionForFilter() auto-cargó para "el mes actual" en vez
// del que se creía estar editando), y los cambios terminaban guardándose en la
// proyección equivocada sin ningún aviso visual de que eso estaba pasando.
function renderProjEditorCurrentLabel() {
  const el = document.getElementById('proj-editor-current-label');
  if (!el) return;
  const proj = state.metaProjection;
  const saved = proj.appliedSavedId ? (proj.savedList || []).find(s => s.id === proj.appliedSavedId) : null;
  if (saved) {
    const monthLabel = saved.targetMonth != null ? `${PROJ_MONTH_NAMES_CAP[saved.targetMonth]} ${saved.targetYear}` : '—';
    el.innerHTML = `📝 Editando: <span style="color:var(--accent-blue-2);">${escapeHtml(saved.name)}</span> (${monthLabel}${saved.country ? ' · ' + saved.country : ''})`;
  } else if (proj.active) {
    el.innerHTML = `📝 Editando un borrador sin guardar todavía (no corresponde a ninguna "Proyección Guardada").`;
  } else {
    el.innerHTML = `📝 Sin ninguna proyección guardada cargada. Usa "✏️ Editar palancas" en Proyecciones Guardadas para cargar una, o guarda este borrador como nueva.`;
  }
}

// Bloquea una acción que modificaría proj.levers/baselineFrom/baselineTo/etc.
// cuando lo cargado ahí llegó por auto-resolución (resolveMetaProjectionForFilter)
// y no por haber abierto explícitamente esa proyección con "✏️ Editar palancas"
// — evita guardar cambios (palancas O fechas de baseline) en la proyección
// equivocada sin darse cuenta, y evita que "Aplicar proyección" parezca "no
// hacer nada" porque el siguiente renderAll() vuelve a pisar lo recién
// aplicado con el snapshot guardado auto-resuelto. Devuelve true si hay que
// bloquear (ya mostró la alerta).
function blockIfProjEditNotPinned() {
  const proj = state.metaProjection;
  if (proj.appliedSavedId && proj.pinnedEditId !== proj.appliedSavedId) {
    const saved = (proj.savedList || []).find(s => s.id === proj.appliedSavedId);
    alert(`Esto modificaría "${saved ? saved.name : 'una proyección'}", que se cargó automáticamente (no la abriste con "✏️ Editar palancas"). Ve a Proyecciones Guardadas y usa "✏️ Editar palancas" en la proyección correcta antes de hacer cambios.`);
    return true;
  }
  return false;
}

function renderProjectionLevers() {
  const tbody = document.getElementById('proj-levers-table-body');
  const totalTbody = document.getElementById('proj-levers-table-total');
  if (!tbody || !totalTbody) return;
  renderProjEditorCurrentLabel();
  updateProjLeverCurrencyLabel();
  refreshProjScopeOptionsIfNeeded();
  renderExcludedKitchens();
  const levers = state.metaProjection.levers || [];
  const visibleLevers = levers.filter(leverAppliesToActiveCountryFilter);
  const hiddenCount = levers.length - visibleLevers.length;

  // Proyecciones a las que se puede "migrar" (copiar) una palanca desde aquí —
  // todas las guardadas EXCEPTO la que está cargada ahora mismo en el Editor.
  // Copiar no mueve/quita la palanca de la proyección actual, solo la duplica
  // en la otra — para que una palanca que aplica varios meses (ej. "Turbo") no
  // haya que recrearla a mano en cada proyección.
  const copyTargets = (state.metaProjection.savedList || []).filter(s => s.id !== state.metaProjection.appliedSavedId);

  tbody.innerHTML = '';
  visibleLevers.forEach(l => {
    const isActive = l.active !== false;
    const tr = document.createElement('tr');
    const copyOptions = copyTargets.length
      ? `<option value="">Copiar a...</option>` + copyTargets.map(s => `<option value="${s.id}">${s.name}${s.country ? ' (' + s.country + ')' : ''}</option>`).join('')
      : `<option value="">— sin otras proyecciones —</option>`;
    tr.innerHTML = `<td><input type="checkbox" data-proj-lever-toggle-active="${l.id}" ${isActive ? 'checked' : ''}></td>` +
      `<td${isActive ? '' : ' style="color:var(--text-muted);text-decoration:line-through;"'}>${l.name}</td>` +
      `<td class="mono">${projLeverAmountLabel(l)}</td><td>${projScopeValueLabels(l.scope)}</td>` +
      `<td style="max-width:180px;font-size:12px;color:var(--text-muted);white-space:normal;">${escapeHtml(l.rational || '')}</td>` +
      `<td><select data-proj-lever-copy="${l.id}" ${copyTargets.length ? '' : 'disabled'} style="font-size:11px;padding:3px 4px;max-width:150px;background:var(--bg-card-2);color:var(--text-primary);border:1px solid var(--border);border-radius:4px;">${copyOptions}</select></td>` +
      `<td style="display:flex;gap:6px;">` +
      `<button class="icon-btn" data-proj-lever-edit="${l.id}" style="padding:2px 8px;font-size:11px;">Editar</button>` +
      `<button class="icon-btn" data-proj-lever-remove="${l.id}" style="padding:2px 8px;font-size:11px;">Eliminar</button></td>`;
    tbody.appendChild(tr);
  });

  // El total refleja solo las palancas activas Y visibles con el filtro de país actual
  // (las que realmente se están sumando a la meta para lo que se está viendo ahora)
  const totalUSD = visibleLevers.filter(l => l.active !== false).reduce((s, l) => s + (l.amountUSD || 0), 0);
  const totalFxCountry = leverEntryCountryFor(activeCountriesInFilter());
  const totalDisplay = fmtMoney(fxValue(totalUSD * (FX[totalFxCountry] || 1), totalFxCountry));
  totalTbody.innerHTML = '';
  const trTotal = document.createElement('tr');
  trTotal.innerHTML = `<td></td><td style="font-weight:bold">TOTAL ACTIVO</td><td class="mono">${totalDisplay}</td><td></td><td></td><td></td><td></td>`;
  totalTbody.appendChild(trTotal);

  tbody.querySelectorAll('[data-proj-lever-copy]').forEach(sel => {
    sel.addEventListener('change', () => {
      const leverId = sel.dataset.projLeverCopy;
      const targetId = sel.value;
      if (!targetId) return;
      const lever = (state.metaProjection.levers || []).find(l => l.id === leverId);
      const target = (state.metaProjection.savedList || []).find(s => s.id === targetId);
      sel.value = '';
      if (!lever || !target) return;
      target.levers = target.levers || [];
      const alreadyExists = target.levers.some(l => l.name === lever.name && JSON.stringify(l.scope || {}) === JSON.stringify(lever.scope || {}));
      if (alreadyExists) {
        alert(`"${lever.name}" ya existe en "${target.name}" — no se copió de nuevo.`);
        return;
      }
      const copy = JSON.parse(JSON.stringify(lever));
      copy.id = 'lev' + Math.round(performance.now() * 1000) + Math.floor(Math.random() * 1000);
      target.levers.push(copy);
      saveMetaProjection();
      renderProjSavedList();
      alert(`"${lever.name}" copiada a "${target.name}".`);
    });
  });

  tbody.querySelectorAll('[data-proj-lever-remove]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (blockIfProjEditNotPinned()) return;
      const id = btn.dataset.projLeverRemove;
      if (editingLeverId === id) cancelEditLever();
      state.metaProjection.levers = state.metaProjection.levers.filter(l => l.id !== id);
      saveMetaProjection();
      syncAppliedSavedLevers();
      renderProjectionLevers();
      renderProjResultTables();
      if (state.metaProjection.active) renderAll();
    });
  });

  tbody.querySelectorAll('[data-proj-lever-edit]').forEach(btn => {
    btn.addEventListener('click', () => startEditLever(btn.dataset.projLeverEdit));
  });

  tbody.querySelectorAll('[data-proj-lever-toggle-active]').forEach(cb => {
    cb.addEventListener('change', () => {
      if (blockIfProjEditNotPinned()) { cb.checked = !cb.checked; return; }
      const id = cb.dataset.projLeverToggleActive;
      const lever = state.metaProjection.levers.find(l => l.id === id);
      if (lever) lever.active = cb.checked;
      saveMetaProjection();
      syncAppliedSavedLevers();
      renderProjectionLevers();
      renderProjResultTables();
      if (state.metaProjection.active) renderAll();
    });
  });

  const proj = state.metaProjection;
  const activeCount = visibleLevers.filter(l => l.active !== false).length;
  const hiddenNote = hiddenCount > 0
    ? ` · ${hiddenCount} palanca${hiddenCount === 1 ? '' : 's'} oculta${hiddenCount === 1 ? '' : 's'} por el filtro de país`
    : '';
  document.getElementById('proj-levers-summary').textContent = (proj.active
    ? `${activeCount}/${visibleLevers.length} palanca${visibleLevers.length === 1 ? '' : 's'} activa${activeCount === 1 ? '' : 's'} en la proyección · Impacto total: ${totalDisplay}`
    : `${activeCount}/${visibleLevers.length} palanca${visibleLevers.length === 1 ? '' : 's'} activa${activeCount === 1 ? '' : 's'} (proyección inactiva, no se están aplicando)`) + hiddenNote;
}

function initProjectionTab() {
  initLeverAmountLiveFormatting();
  const proj = state.metaProjection;
  const fromEl = document.getElementById('proj-baseline-from');
  const toEl = document.getElementById('proj-baseline-to');
  fromEl.min = '2026-01-01'; toEl.min = '2026-01-01';
  fromEl.max = LAST_DATA_ISO; toEl.max = LAST_DATA_ISO;

  // Selector de mes a proyectar: enero-diciembre 2026
  const targetEl = document.getElementById('proj-target-month');
  const monthNamesCap = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  targetEl.innerHTML = monthNamesCap.map((name, m) => `<option value="2026-${m}">${name} 2026</option>`).join('');
  const currentTarget = getProjectionTargetMonth();
  targetEl.value = `${(proj.targetYear != null ? proj.targetYear : currentTarget.year)}-${(proj.targetMonth != null ? proj.targetMonth : currentTarget.month)}`;

  if (proj.baselineFrom) {
    fromEl.value = proj.baselineFrom;
    toEl.value = proj.baselineTo;
  } else {
    // Prellenar con el baseline efectivo actual (mes anterior) para que la tabla
    // de cálculo tenga algo que mostrar desde el inicio.
    const range = getMetaBaselineRange(currentTarget.year, currentTarget.month);
    fromEl.value = range.from;
    toEl.value = range.to;
  }

  const refreshPreview = () => { renderProjBaselineTable(); renderProjResultTables(); };
  fromEl.addEventListener('change', refreshPreview);
  toEl.addEventListener('change', refreshPreview);
  targetEl.addEventListener('change', () => { refreshPreview(); updateProjSaveNameAuto(); });

  const saveNameEl = document.getElementById('proj-save-name');
  saveNameEl.addEventListener('input', () => { projSaveNameManuallyEdited = true; });
  updateProjSaveNameAuto();

  document.getElementById('proj-baseline-apply').addEventListener('click', () => {
    if (blockIfProjEditNotPinned()) return;
    const from = fromEl.value, to = toEl.value;
    if (!from || !to || from > to) {
      alert('Selecciona un rango de fechas válido (Desde ≤ Hasta) para el baseline.');
      return;
    }
    const [tYear, tMonth] = targetEl.value.split('-').map(Number);
    proj.active = true;
    proj.baselineFrom = from;
    proj.baselineTo = to;
    proj.targetYear = tYear;
    proj.targetMonth = tMonth;
    saveMetaProjection();
    syncAppliedSavedLevers();
    updateProjBaselineSummary();
    renderProjBaselineTable();
    renderProjResultTables();
    renderProjectionLevers();
    renderAll();
  });

  document.getElementById('proj-baseline-reset').addEventListener('click', () => {
    proj.active = false;
    proj.targetYear = null;
    proj.targetMonth = null;
    saveMetaProjection();
    const reset = getProjectionTargetMonth();
    targetEl.value = `${reset.year}-${reset.month}`;
    updateProjBaselineSummary();
    renderProjBaselineTable();
    renderProjResultTables();
    renderProjectionLevers();
    renderAll();
  });

  // Poblar los 4 selects de alcance (país / ciudad / marca / cocina), combinables
  // entre sí. País muestra siempre todas las opciones (DIM_COUNTRIES); los demás se
  // limitan al/los país(es) activos en los filtros principales.
  const countriesEl = document.getElementById('proj-lever-scope-countries');
  const citiesEl = document.getElementById('proj-lever-scope-cities');
  const brandsEl = document.getElementById('proj-lever-scope-brands');
  const kitchensEl = document.getElementById('proj-lever-scope-kitchens');
  const providersEl = document.getElementById('proj-lever-scope-providers');
  if (countriesEl && countriesEl.options.length === 0) {
    countriesEl.innerHTML = DIM_COUNTRIES.map(c => `<option value="${c}">${c}</option>`).join('');
  }
  refreshProjScopeOptionsIfNeeded();

  // El selector de valores de cada dimensión solo se muestra si su checkbox está
  // marcado ("¿A qué se aplica esta palanca?"); si se desmarca, se limpia su selección.
  // "Todos los países" es excluyente con las demás: marcar una las desmarca,
  // y marcar "Todos los países" las desmarca y oculta.
  const toggleAllEl = document.getElementById('proj-lever-toggle-all');
  const toggleCountriesEl = document.getElementById('proj-lever-toggle-countries');
  const toggleCitiesEl = document.getElementById('proj-lever-toggle-cities');
  const toggleBrandsEl = document.getElementById('proj-lever-toggle-brands');
  const toggleCategoriesEl = document.getElementById('proj-lever-toggle-categories');
  const toggleKitchensEl = document.getElementById('proj-lever-toggle-kitchens');
  const toggleProvidersEl = document.getElementById('proj-lever-toggle-providers');
  const categoriesEl = document.getElementById('proj-lever-scope-categories');
  const specificToggles = [toggleCountriesEl, toggleCitiesEl, toggleBrandsEl, toggleCategoriesEl, toggleKitchensEl, toggleProvidersEl];
  const wrapFor = { countries: document.getElementById('proj-lever-scope-countries-wrap'), cities: document.getElementById('proj-lever-scope-cities-wrap'), brands: document.getElementById('proj-lever-scope-brands-wrap'), categories: document.getElementById('proj-lever-scope-categories-wrap'), kitchens: document.getElementById('proj-lever-scope-kitchens-wrap'), providers: document.getElementById('proj-lever-scope-providers-wrap') };
  const selectFor = { countries: countriesEl, cities: citiesEl, brands: brandsEl, categories: categoriesEl, kitchens: kitchensEl, providers: providersEl };

  function clearSpecificScope() {
    specificToggles.forEach(t => { t.checked = false; });
    Object.keys(wrapFor).forEach(key => {
      wrapFor[key].style.display = 'none';
      Array.from(selectFor[key].options).forEach(o => o.selected = false);
    });
  }

  toggleAllEl.addEventListener('change', () => {
    if (toggleAllEl.checked) clearSpecificScope();
  });

  function wireScopeToggle(toggleEl, key) {
    toggleEl.addEventListener('change', () => {
      wrapFor[key].style.display = toggleEl.checked ? '' : 'none';
      if (!toggleEl.checked) Array.from(selectFor[key].options).forEach(o => o.selected = false);
      if (toggleEl.checked) toggleAllEl.checked = false; // marcar una dimensión específica excluye "Todas"
      if (!specificToggles.some(t => t.checked)) toggleAllEl.checked = true; // ninguna marcada = vuelve a "Todas"
    });
  }
  wireScopeToggle(toggleCountriesEl, 'countries');
  wireScopeToggle(toggleCitiesEl, 'cities');
  wireScopeToggle(toggleBrandsEl, 'brands');
  wireScopeToggle(toggleCategoriesEl, 'categories');
  wireScopeToggle(toggleKitchensEl, 'kitchens');
  wireScopeToggle(toggleProvidersEl, 'providers');

  // Atajos "+ Todas Turbo / Core / New / Otras": marcan (adicionan a lo ya
  // seleccionado) todas las marcas de esa categoría en el select de Marcas.
  document.querySelectorAll('[data-proj-brand-group]').forEach(btn => {
    btn.addEventListener('click', () => {
      const group = btn.dataset.projBrandGroup;
      if (group === 'clear') {
        Array.from(brandsEl.options).forEach(o => { o.selected = false; });
        return;
      }
      const ids = new Set(projBrandIdsForGroup(group));
      Array.from(brandsEl.options).forEach(o => { if (ids.has(o.value)) o.selected = true; });
      if (!toggleBrandsEl.checked) {
        toggleBrandsEl.checked = true;
        toggleBrandsEl.dispatchEvent(new Event('change'));
      }
    });
  });

  // Marca que todavía no existe en los datos (sin ventas históricas todavía,
  // p.ej. un lanzamiento nuevo): el selector de arriba solo lista marcas reales
  // de FACTS, así que una marca por lanzar nunca aparece ahí ni se puede elegir.
  // Esto agrega una opción "manual" al mismo <select> (mismo value que su
  // nombre, ya que no tiene un brandId real todavía) — el resto del código
  // (guardar, mostrar alcance, matching contra FACTS) no necesita cambios: una
  // palanca con este "id" simplemente no coincidirá con ninguna venta real
  // hasta que la marca lance y empiece a aparecer en los datos.
  const newBrandNameEl = document.getElementById('proj-lever-brand-new-name');
  const newBrandAddBtn = document.getElementById('proj-lever-brand-new-add');
  if (newBrandNameEl && newBrandAddBtn) {
    const addCustomBrand = () => {
      const name = newBrandNameEl.value.trim();
      if (!name) return;
      const already = Array.from(brandsEl.options).find(o => o.value === name);
      const opt = already || new Option(name, name);
      if (!already) brandsEl.appendChild(opt);
      opt.selected = true;
      if (!toggleBrandsEl.checked) {
        toggleBrandsEl.checked = true;
        toggleBrandsEl.dispatchEvent(new Event('change'));
      }
      newBrandNameEl.value = '';
    };
    newBrandAddBtn.addEventListener('click', addCustomBrand);
    newBrandNameEl.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addCustomBrand(); } });
  }

  // Igual que "+ Marca nueva" pero para una cocina que todavía no existe en los
  // datos (aún no ha vendido nada, p.ej. una apertura nueva) — el selector de
  // arriba solo lista cocinas reales de FACTS.
  const newKitchenNameEl = document.getElementById('proj-lever-kitchen-new-name');
  const newKitchenAddBtn = document.getElementById('proj-lever-kitchen-new-add');
  if (newKitchenNameEl && newKitchenAddBtn) {
    const addCustomKitchen = () => {
      const name = newKitchenNameEl.value.trim();
      if (!name) return;
      const already = Array.from(kitchensEl.options).find(o => o.value === name);
      const opt = already || new Option(name, name);
      if (!already) kitchensEl.appendChild(opt);
      opt.selected = true;
      if (!toggleKitchensEl.checked) {
        toggleKitchensEl.checked = true;
        toggleKitchensEl.dispatchEvent(new Event('change'));
      }
      newKitchenNameEl.value = '';
    };
    newKitchenAddBtn.addEventListener('click', addCustomKitchen);
    newKitchenNameEl.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addCustomKitchen(); } });
  }

  document.getElementById('proj-lever-add').addEventListener('click', () => {
    if (blockIfProjEditNotPinned()) return;
    const nameEl = document.getElementById('proj-lever-name');
    const amountEl = document.getElementById('proj-lever-amount');
    const currencyEl = document.getElementById('proj-lever-currency');
    const rationalEl = document.getElementById('proj-lever-rational');
    const name = nameEl.value.trim();
    const amountEntered = parseLeverAmountInput(amountEl.value);
    const currencyEntered = currencyEl.value; // 'USD' | 'LOCAL'
    const rational = rationalEl ? rationalEl.value.trim() : '';
    if (!name || !amountEntered) {
      alert('Ingresa un nombre y un monto para la palanca.');
      return;
    }
    // Usa el país de referencia vigente (el filtro de país activo, o COL por defecto)
    // en vez de asumir siempre Colombia — antes esto convertía como COP incluso
    // con Perú/México filtrados, dando un monto USD equivocado para la palanca.
    // leverEntryCountryFor (no metaFxCountryFor) porque esto debe reflejar el país
    // filtrado ya mismo, aunque la proyección todavía no esté "activa" (se arma el
    // borrador de palancas antes de aplicarla).
    const leverFxCountry = leverEntryCountryFor(activeCountriesInFilter());
    const amountUSD = currencyEntered === 'LOCAL' ? amountEntered / (FX[leverFxCountry] || 1) : amountEntered;
    // Solo se leen valores de las dimensiones marcadas; si una no está marcada,
    // no restringe (aunque el select tuviera alguna opción seleccionada de antes).
    // EXCEPCIÓN: País nunca debe quedar vacío. Si no se marcó el toggle, se usa
    // igual el país filtrado activo (siempre hay uno solo, porque el resto de
    // Proyección de Metas ya exige filtrar un único país) — antes, olvidar marcar
    // el toggle dejaba scope.countries=[] aunque la proyección fuera obviamente
    // de un solo país, y una palanca de marca nueva (sin ventas reales todavía)
    // quedaba invisible en cuanto se filtraba cualquier país específico, porque
    // no había ningún hecho real con el que emparejarla.
    const activeSingleCountry = activeCountriesInFilter().length === 1 ? activeCountriesInFilter() : [];
    const countries = toggleCountriesEl.checked ? Array.from(countriesEl.selectedOptions).map(o => o.value) : activeSingleCountry;
    const cities = toggleCitiesEl.checked ? Array.from(citiesEl.selectedOptions).map(o => o.value) : [];
    const brands = toggleBrandsEl.checked ? Array.from(brandsEl.selectedOptions).map(o => o.value) : [];
    const categories = toggleCategoriesEl.checked ? Array.from(categoriesEl.selectedOptions).map(o => o.value) : [];
    const kitchens = toggleKitchensEl.checked ? Array.from(kitchensEl.selectedOptions).map(o => o.value) : [];
    const providers = toggleProvidersEl.checked ? Array.from(providersEl.selectedOptions).map(o => o.value) : [];
    if ((toggleCountriesEl.checked && countries.length === 0) || (toggleCitiesEl.checked && cities.length === 0) || (toggleBrandsEl.checked && brands.length === 0) ||
        (toggleCategoriesEl.checked && categories.length === 0) || (toggleKitchensEl.checked && kitchens.length === 0) || (toggleProvidersEl.checked && providers.length === 0)) {
      alert('Selecciona al menos un valor en cada dimensión marcada, o desmárcala si no quieres restringir por ella.');
      return;
    }
    const scope = { countries, cities, brands, categories, kitchens, providers };
    if (editingLeverId) {
      const lever = state.metaProjection.levers.find(l => l.id === editingLeverId);
      if (lever) {
        lever.name = name; lever.amountUSD = amountUSD; lever.amountEntered = amountEntered;
        lever.currencyEntered = currencyEntered; lever.scope = scope; lever.rational = rational;
      } else {
        // El país/mes filtrado cambió mientras se editaba (la palanca pertenecía
        // a la asignación de otro país) — no hay dónde guardar el cambio.
        alert('No se pudo guardar: el país o mes filtrado cambió mientras editabas esta palanca. Vuelve a filtrar el país correcto e inténtalo de nuevo.');
      }
      cancelEditLever();
    } else {
      const id = 'lv' + Math.round(performance.now() * 1000) + '' + Math.floor(Math.random() * 1000);
      state.metaProjection.levers.push({ id, name, amountUSD, amountEntered, currencyEntered, active: true, scope, rational });
      nameEl.value = ''; amountEl.value = ''; if (rationalEl) rationalEl.value = '';
      clearSpecificScope();
      toggleAllEl.checked = true;
    }
    saveMetaProjection();
    syncAppliedSavedLevers();
    renderProjectionLevers();
    renderProjResultTables();
    if (state.metaProjection.active) renderAll();
  });

  document.getElementById('proj-lever-cancel-edit').addEventListener('click', cancelEditLever);

  const repairBtn = document.getElementById('proj-lever-repair-legacy');
  if (repairBtn) {
    repairBtn.addEventListener('click', () => {
      const fixed = repairLegacyLeverAmounts();
      alert(fixed > 0
        ? `Se recalcularon ${fixed} palanca(s) usando ${leverEntryCountryFor(activeCountriesInFilter())} como país de referencia.`
        : 'No se encontró ninguna palanca que necesitara recálculo (todas ya coinciden con el monto/moneda original).');
    });
  }

  const excludedKitchenSelectEl = document.getElementById('proj-excluded-kitchen-select');
  const excludedKitchenFromEl = document.getElementById('proj-excluded-kitchen-from');
  const excludedKitchenToEl = document.getElementById('proj-excluded-kitchen-to');
  [excludedKitchenSelectEl, excludedKitchenFromEl, excludedKitchenToEl].forEach(el => {
    if (el) el.addEventListener('change', updateExcludedKitchenPreview);
  });

  const excludedKitchenAddBtn = document.getElementById('proj-excluded-kitchen-add');
  if (excludedKitchenAddBtn) {
    excludedKitchenAddBtn.addEventListener('click', () => {
      const kid = excludedKitchenSelectEl.value;
      const closedFrom = excludedKitchenFromEl.value;
      const closedTo = excludedKitchenToEl.value || null;
      if (!kid) return;
      if (!closedFrom) {
        alert('Elige la fecha "Cerrada desde" antes de excluir la cocina.');
        return;
      }
      if (closedTo && closedTo < closedFrom) {
        alert('"Cerrada hasta" no puede ser anterior a "Cerrada desde".');
        return;
      }
      // Mismo chequeo que updateExcludedKitchenPreview(): si "Cerrada desde" no
      // cae en el mes que se está proyectando ahora, el cierre no tendría
      // ningún efecto (computeOpenFractionForRange lo trataría como "sin
      // cierre") — mejor bloquear el guardado con un aviso claro que dejar
      // guardar una exclusión que en la práctica no hace nada.
      const { year: targetYear, month: targetMonth } = getProjectionTargetMonth();
      const fromDateCheck = new Date(closedFrom + 'T00:00:00');
      if (fromDateCheck.getFullYear() !== targetYear || fromDateCheck.getMonth() !== targetMonth) {
        const monthNamesCap = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
        alert(`"Cerrada desde" (${closedFrom}) no cae en el mes que se está proyectando (${monthNamesCap[targetMonth]} ${targetYear}). Cambia "Mes a proyectar" arriba primero, o esta exclusión no tendría ningún efecto en la meta.`);
        return;
      }
      const excluded = state.metaProjection.excludedKitchens = state.metaProjection.excludedKitchens || [];
      if (excluded.some(e => e.kitchenId === kid)) {
        alert('Esta cocina ya tiene un cierre configurado. Quítalo primero si quieres cambiar las fechas.');
        return;
      }
      excluded.push({ kitchenId: kid, closedFrom, closedTo });
      saveMetaProjection();
      syncAppliedSavedLevers();
      excludedKitchenFromEl.value = ''; excludedKitchenToEl.value = '';
      renderExcludedKitchens();
      renderProjResultTables();
      if (state.metaProjection.active) renderAll();
    });
  }

  updateProjBaselineSummary();
  renderProjBaselineTable();
  renderProjResultTables();
  renderProjectionLevers();
}

// Recalcula amountUSD de palancas guardadas ANTES de la corrección del bug de FX
// (que siempre usaba la tasa de Colombia sin importar el país filtrado). Solo toca
// palancas con currencyEntered === 'LOCAL' y amountEntered disponible (todas las
// creadas con la UI lo tienen). Usa el país actualmente filtrado como referencia —
// pensado para usarse una sola vez, con el país correcto ya seleccionado.
function repairLegacyLeverAmounts() {
  const refCountry = leverEntryCountryFor(activeCountriesInFilter());
  const fxRate = FX[refCountry] || 1;
  let fixedCount = 0;
  (state.metaProjection.levers || []).forEach(l => {
    if (l.currencyEntered !== 'LOCAL' || l.amountEntered == null) return;
    const correctAmountUSD = l.amountEntered / fxRate;
    if (Math.abs(correctAmountUSD - l.amountUSD) > 0.01) {
      l.amountUSD = correctAmountUSD;
      fixedCount++;
    }
  });
  if (fixedCount > 0) {
    saveMetaProjection();
    renderProjectionLevers();
    renderProjResultTables();
    if (state.metaProjection.active) renderAll();
  }
  return fixedCount;
}

// ---------------------------------------------------------------------------
// Proyecciones Guardadas: lista de escenarios nombrados (baseline + mes +
// palancas), cada uno se puede ver en detalle o asignar como la meta activa.
// ---------------------------------------------------------------------------

function switchProjSubtab(tab) {
  document.querySelectorAll('.proj-subtab-btn').forEach(b => b.classList.toggle('active', b.dataset.projSubtab === tab));
  document.getElementById('proj-subtab-editor').style.display = tab === 'editor' ? '' : 'none';
  document.getElementById('proj-subtab-saved').style.display = tab === 'saved' ? '' : 'none';
  if (tab === 'saved') {
    // Volver a la lista de guardadas cuenta como "terminé de editar por ahora" —
    // libera el pin de resolveMetaProjectionForFilter() para que el resolver
    // automático retome el control normal (mostrar lo que corresponda al mes
    // que se esté viendo en el dashboard general).
    state.metaProjection.pinnedEditId = null;
    renderProjSavedList();
  }
}

const PROJ_MONTH_NAMES_CAP = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

// Nombre sugerido automáticamente: "Meta {País(es)} {Mes Año}". Se recalcula
// mientras el usuario no haya escrito su propio nombre a mano.
let projSaveNameManuallyEdited = false;
function updateProjSaveNameAuto() {
  if (projSaveNameManuallyEdited) return;
  const nameEl = document.getElementById('proj-save-name');
  const targetEl = document.getElementById('proj-target-month');
  if (!nameEl || !targetEl) return;
  const countries = activeCountriesInFilter();
  const countryLabel = countries.length ? countries.join('-') : 'Todos';
  const [tYear, tMonth] = targetEl.value ? targetEl.value.split('-').map(Number) : [null, null];
  const monthLabel = tMonth != null ? `${PROJ_MONTH_NAMES_CAP[tMonth]} ${tYear}` : '';
  nameEl.value = `Meta ${countryLabel} ${monthLabel}`.trim();
}

function projSavedMonthLabel(saved) {
  if (saved.targetMonth == null) return 'Mes actual';
  return `${PROJ_MONTH_NAMES_CAP[saved.targetMonth]} ${saved.targetYear}`;
}

// Ejecuta fn() con state.metaProjection temporalmente cargado con el snapshot
// `saved` (en vez de los valores del formulario), para poder calcular su detalle
// sin afectar ni la proyección activa ni el borrador que se está editando.
function withSimulatedProjSavedState(saved, fn) {
  const proj = state.metaProjection;
  const prev = { active: proj.active, baselineFrom: proj.baselineFrom, baselineTo: proj.baselineTo, targetYear: proj.targetYear, targetMonth: proj.targetMonth, levers: proj.levers, excludedKitchens: proj.excludedKitchens };
  proj.active = true;
  proj.baselineFrom = saved.baselineFrom;
  proj.baselineTo = saved.baselineTo;
  proj.targetYear = saved.targetYear;
  proj.targetMonth = saved.targetMonth;
  proj.levers = saved.levers;
  proj.excludedKitchens = saved.excludedKitchens || [];
  try {
    return fn();
  } finally {
    proj.active = prev.active; proj.baselineFrom = prev.baselineFrom; proj.baselineTo = prev.baselineTo;
    proj.targetYear = prev.targetYear; proj.targetMonth = prev.targetMonth; proj.levers = prev.levers;
    proj.excludedKitchens = prev.excludedKitchens;
  }
}

function computeProjSavedTotalMeta(saved) {
  return withSimulatedProjSavedState(saved, () => {
    const facts = getFilteredFacts({ ignoreDate: true });
    const countries = activeCountriesInFilter();
    return calculateTotalMetaWithLevers(facts, countries);
  });
}

function renderProjSavedList() {
  const tbody = document.getElementById('proj-saved-list-body');
  if (!tbody) return;
  const proj = state.metaProjection;
  const allSaved = proj.savedList || [];
  const filterCountries = activeCountriesInFilter();
  const singleFilterCountry = filterCountries.length === 1 ? filterCountries[0] : null;

  // Con un único país filtrado, oculta las proyecciones de otro país. La señal
  // principal es s.country (capturado al guardar); si una proyección vieja no
  // lo tiene, se usa su asignación real como respaldo. Solo si NO tiene ni
  // country ni asignación se deja visible siempre — es un caso ambiguo (no hay
  // forma de saber de qué país es) y ocultarla la haría invisible para siempre.
  const list = singleFilterCountry
    ? allSaved.filter(s => {
        if (s.country) return s.country === singleFilterCountry;
        const assignedTo = (proj.assignments || []).filter(a => a.savedId === s.id && a.year === s.targetYear && a.month === s.targetMonth);
        return assignedTo.length === 0 || assignedTo.some(a => a.country === singleFilterCountry);
      })
    : allSaved;
  const hiddenByCountryCount = allSaved.length - list.length;

  tbody.innerHTML = list.map(s => {
    // Una misma proyección guardada puede estar asignada a varios países a la vez
    // (cada país+mes es independiente) — se muestran todos para que quede claro
    // dónde está en uso, aunque ahora mismo estés filtrando otro país.
    const assignedTo = (proj.assignments || []).filter(a => a.savedId === s.id && a.year === s.targetYear && a.month === s.targetMonth);
    const isAppliedToCurrentFilter = singleFilterCountry && assignedTo.some(a => a.country === singleFilterCountry);
    const assignedNote = assignedTo.length ? ` <span style="color:var(--accent-blue-2);font-weight:600;">(asignada: ${assignedTo.map(a => a.country).join(', ')})</span>` : '';
    const totalMeta = computeProjSavedTotalMeta(s);
    const applyLabel = isAppliedToCurrentFilter ? `✓ Asignada (${singleFilterCountry})` : (singleFilterCountry ? `Asignar a la meta (${singleFilterCountry})` : 'Asignar a la meta');
    const countryBadge = `<button data-proj-saved-set-country="${s.id}" title="Click para cambiar el país de esta proyección" style="background:none;border:1px solid var(--border);border-radius:4px;cursor:pointer;color:${s.country ? 'var(--accent-blue-2)' : 'var(--accent-amber,#e8a838)'};font-size:11px;padding:1px 6px;margin-left:6px;">${s.country || '⚠ sin país'}</button>`;
    return `<tr>
      <td>
        <button data-proj-saved-rename="${s.id}" title="Renombrar" style="background:none;border:none;cursor:pointer;color:var(--text-muted);padding:0;margin-right:6px;font-size:13px;">✎</button>${s.name}${countryBadge}${assignedNote}
      </td>
      <td>${projSavedMonthLabel(s)}</td>
      <td>${s.baselineFrom} → ${s.baselineTo}</td>
      <td>${s.levers.length}</td>
      <td class="mono" style="font-weight:600;">${fmtMoney(totalMeta)}</td>
      <td>${s.createdAtLabel || ''}</td>
      <td style="display:flex;gap:6px;flex-wrap:wrap;">
        <button class="icon-btn" data-proj-saved-view="${s.id}" style="padding:2px 8px;font-size:11px;">Ver detalle</button>
        <button class="icon-btn" data-proj-saved-edit-levers="${s.id}" style="padding:2px 8px;font-size:11px;">✏️ Editar palancas</button>
        <button class="icon-btn" data-proj-saved-apply="${s.id}" ${singleFilterCountry ? '' : 'disabled title="Filtra un único país para asignar"'} style="padding:2px 8px;font-size:11px;">${applyLabel}</button>
        <button class="icon-btn" data-proj-saved-delete="${s.id}" style="padding:2px 8px;font-size:11px;">Eliminar</button>
      </td>
    </tr>`;
  }).join('');

  tbody.querySelectorAll('[data-proj-saved-set-country]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.projSavedSetCountry;
      const saved = allSaved.find(s => s.id === id);
      if (!saved) return;
      const input = prompt(`¿A qué país pertenece "${saved.name}"? Escribe uno de: ${DIM_COUNTRIES.join(', ')}`, saved.country || '');
      if (input === null) return;
      const code = input.trim().toUpperCase();
      if (!DIM_COUNTRIES.includes(code)) {
        alert(`"${code}" no es un país válido. Usa uno de: ${DIM_COUNTRIES.join(', ')}`);
        return;
      }
      saved.country = code;
      saveMetaProjection();
      renderProjSavedList();
    });
  });

  const hiddenNote = hiddenByCountryCount > 0
    ? ` · ${hiddenByCountryCount} oculta${hiddenByCountryCount === 1 ? '' : 's'} asignada${hiddenByCountryCount === 1 ? '' : 's'} a otro país (filtro: ${singleFilterCountry})`
    : '';
  document.getElementById('proj-saved-list-summary').textContent = list.length
    ? `${list.length} proyección${list.length === 1 ? '' : 'es'} guardada${list.length === 1 ? '' : 's'}${hiddenNote}`
    : (allSaved.length
        ? `Todas tus proyecciones guardadas (${allSaved.length}) están asignadas a otro país — cambia el filtro de país para verlas.`
        : 'Aún no has guardado ninguna proyección. Ve a "Editor", configura un baseline/palancas y usa "Guardar como nueva proyección".');

  tbody.querySelectorAll('[data-proj-saved-view]').forEach(btn => {
    btn.addEventListener('click', () => showProjSavedDetail(btn.dataset.projSavedView));
  });
  tbody.querySelectorAll('[data-proj-saved-edit-levers]').forEach(btn => {
    btn.addEventListener('click', () => editProjSavedLevers(btn.dataset.projSavedEditLevers));
  });
  tbody.querySelectorAll('[data-proj-saved-rename]').forEach(btn => {
    btn.addEventListener('click', () => renameProjSaved(btn.dataset.projSavedRename));
  });
  tbody.querySelectorAll('[data-proj-saved-apply]').forEach(btn => {
    btn.addEventListener('click', () => assignProjSavedToCurrentFilter(btn.dataset.projSavedApply));
  });
  tbody.querySelectorAll('[data-proj-saved-delete]').forEach(btn => {
    btn.addEventListener('click', () => deleteProjSaved(btn.dataset.projSavedDelete));
  });
}

function renameProjSaved(id) {
  const saved = (state.metaProjection.savedList || []).find(s => s.id === id);
  if (!saved) return;
  const newName = prompt('Nuevo nombre para la proyección:', saved.name);
  if (newName === null) return; // cancelado
  const trimmed = newName.trim();
  if (!trimmed) { alert('El nombre no puede quedar vacío.'); return; }
  saved.name = trimmed;
  saveMetaProjection();
  renderProjSavedList();
  if (currentProjSavedDetailId === id) showProjSavedDetail(id);
}

window.__projComboCache = {};

// Única exportación en imagen que queda (las de por marca/ciudad se quitaron a
// pedido de Laura — el detalle ahora se enfoca en baseline + palancas + total,
// sin desglose por marca): dibuja Baseline + cada palanca aplicada (nombre,
// alcance, monto) + META TOTAL — una sola imagen compacta con el mismo
// desglose que el modal "Cálculo de Meta" de los KPIs.
function downloadProjSummaryImage() {
  const data = window.__projComboCache.summary;
  if (!data) { alert('No hay datos para descargar todavía — abre el detalle de una proyección guardada primero.'); return; }

  const draw = () => {
    const { title, subtitle, baselineRange, baseline, levers, total } = data;
    const padX = 24, titleH = 36, subtitleH = 22, baselineH = 58, sectionGapH = 10, rowH = 26, totalH = 40, footerH = 26;
    const width = 460;
    const leverRows = levers.length ? levers.length : 1;
    const height = titleH + subtitleH + baselineH + sectionGapH
      + 22 /* "Palancas aplicadas" label */ + rowH * leverRows + sectionGapH
      + totalH + footerH;

    const scale = 2;
    const canvas = document.createElement('canvas');
    canvas.width = width * scale;
    canvas.height = height * scale;
    const ctx = canvas.getContext('2d');
    ctx.scale(scale, scale);

    const bg = '#0d2640', bg2 = '#112e4d', textPrimary = '#f0f6ff', textMuted = '#8aadcc', accent = '#4a9fd4', border = 'rgba(255,255,255,0.12)';

    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);
    ctx.textBaseline = 'middle';

    let y = 0;
    ctx.fillStyle = textPrimary;
    ctx.font = '700 16px Poppins, sans-serif';
    ctx.fillText(title, padX, y + titleH / 2);
    y += titleH;

    ctx.fillStyle = textMuted;
    ctx.font = '400 11px Poppins, sans-serif';
    ctx.fillText(subtitle, padX, y + subtitleH / 2);
    y += subtitleH;

    ctx.fillStyle = accent;
    ctx.font = '600 12px Poppins, sans-serif';
    ctx.fillText('META BASE (BASELINE)', padX, y + 10);
    ctx.fillStyle = textMuted;
    ctx.font = '400 11px Poppins, sans-serif';
    ctx.fillText(baselineRange, padX, y + 28);
    ctx.fillStyle = textPrimary;
    ctx.font = '700 16px "DM Mono", monospace';
    ctx.fillText(fmtMoney(baseline), padX, y + 47);
    y += baselineH + sectionGapH;

    ctx.fillStyle = accent;
    ctx.font = '600 12px Poppins, sans-serif';
    ctx.fillText('PALANCAS APLICADAS', padX, y + 10);
    y += 22;

    if (!levers.length) {
      ctx.fillStyle = textMuted;
      ctx.font = '400 12px Poppins, sans-serif';
      ctx.fillText('Ninguna palanca activa aplica a esta proyección.', padX, y + rowH / 2);
      y += rowH;
    } else {
      levers.forEach((l, i) => {
        if (i % 2 === 1) { ctx.fillStyle = 'rgba(255,255,255,0.03)'; ctx.fillRect(0, y, width, rowH); }
        ctx.fillStyle = textPrimary;
        ctx.font = '500 12px Poppins, sans-serif';
        const label = l.name.length > 22 ? l.name.slice(0, 21) + '…' : l.name;
        ctx.fillText(label, padX, y + rowH / 2 - 6);
        ctx.fillStyle = textMuted;
        ctx.font = '400 10px Poppins, sans-serif';
        const scope = l.scope.length > 40 ? l.scope.slice(0, 39) + '…' : l.scope;
        ctx.fillText(scope, padX, y + rowH / 2 + 7);
        ctx.fillStyle = textPrimary;
        ctx.font = '600 12px "DM Mono", monospace';
        ctx.textAlign = 'right';
        ctx.fillText(fmtMoney(l.amount), width - padX, y + rowH / 2);
        ctx.textAlign = 'left';
        ctx.strokeStyle = border;
        ctx.beginPath(); ctx.moveTo(0, y + rowH); ctx.lineTo(width, y + rowH); ctx.stroke();
        y += rowH;
      });
    }
    y += sectionGapH;

    ctx.fillStyle = bg2;
    ctx.fillRect(0, y, width, totalH);
    ctx.fillStyle = textPrimary;
    ctx.font = '700 13px Poppins, sans-serif';
    ctx.fillText('META TOTAL', padX, y + totalH / 2);
    ctx.font = '700 17px "DM Mono", monospace';
    ctx.textAlign = 'right';
    ctx.fillText(fmtMoney(total), width - padX, y + totalH / 2);
    ctx.textAlign = 'left';
    y += totalH;

    ctx.fillStyle = textMuted;
    ctx.font = '400 10px Poppins, sans-serif';
    ctx.fillText(`Foodology — generado ${new Date().toLocaleString('es-CO')}`, padX, y + footerH / 2);

    const link = document.createElement('a');
    const safeTitle = title.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    link.download = `${safeTitle || 'meta-resumen'}.png`;
    link.href = canvas.toDataURL('image/png');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(draw);
  } else {
    draw();
  }
}

function initProjComboDownloadButtons() {
  const summaryBtn = document.getElementById('proj-saved-detail-summary-download');
  if (summaryBtn) summaryBtn.addEventListener('click', downloadProjSummaryImage);
  const pdfBtn = document.getElementById('proj-saved-detail-export-pdf');
  if (pdfBtn) pdfBtn.addEventListener('click', exportProjSavedDetailPDF);
}

// Imprime SOLO el detalle de esta proyección guardada (baseline, palancas,
// cocinas excluidas, y las 3 tablas de reparto), en vez de la página completa
// que produce el botón "⬇ Exportar PDF" de arriba — reutiliza window.print()
// (mismo mecanismo, sin librerías externas) pero oculta temporalmente todo lo
// demás en la página, subiendo por la cadena de ancestros desde la sección de
// detalle y ocultando a cada nivel los hermanos que no forman parte de ella,
// sin necesidad de conocer de antemano toda la estructura del dashboard. Se
// restaura automáticamente al cerrar el diálogo de impresión (evento
// 'afterprint'), se imprima o se cancele.
function exportProjSavedDetailPDF() {
  const detailSection = document.getElementById('proj-saved-detail-section');
  if (!detailSection || detailSection.style.display === 'none') return;
  const hidden = [];
  let node = detailSection;
  while (node && node.parentElement && node !== document.body) {
    Array.from(node.parentElement.children).forEach(sibling => {
      if (sibling !== node && sibling.style.display !== 'none') {
        hidden.push({ el: sibling, prevDisplay: sibling.style.display });
        sibling.style.display = 'none';
      }
    });
    node = node.parentElement;
  }
  // Las tablas (palancas, cocinas excluidas, por marca/ciudad/categoría) viven
  // en contenedores .table-wrap con scroll interno (max-height + overflow:auto)
  // para caber en pantalla — al imprimir, eso recortaba todo lo que quedara
  // fuera de esa cajita visible (p.ej. "solo mostraba las palancas" si esa era
  // la única tabla corta que cabía completa). Se le quita el límite de alto y
  // el scroll SOLO durante la impresión, para que cada tabla salga completa —
  // Chrome sí sabe paginar overflow:visible en varias hojas.
  const expanded = [];
  detailSection.querySelectorAll('.table-wrap').forEach(el => {
    expanded.push({ el, prevMaxHeight: el.style.maxHeight, prevOverflow: el.style.overflow, prevOverflowY: el.style.overflowY });
    el.style.maxHeight = 'none';
    el.style.overflow = 'visible';
    el.style.overflowY = 'visible';
  });
  const restore = () => {
    hidden.forEach(({ el, prevDisplay }) => { el.style.display = prevDisplay; });
    expanded.forEach(({ el, prevMaxHeight, prevOverflow, prevOverflowY }) => {
      el.style.maxHeight = prevMaxHeight; el.style.overflow = prevOverflow; el.style.overflowY = prevOverflowY;
    });
    window.removeEventListener('afterprint', restore);
  };
  window.addEventListener('afterprint', restore);
  window.print();
}

let currentProjSavedDetailId = null;
function showProjSavedDetail(id) {
  const saved = (state.metaProjection.savedList || []).find(s => s.id === id);
  if (!saved) return;
  currentProjSavedDetailId = id;
  document.getElementById('proj-saved-detail-section').style.display = '';
  document.getElementById('proj-saved-detail-title').textContent = `Detalle — ${saved.name}`;

  // Una proyección guardada NO tiene un país fijo propio — solo queda ligada a
  // un país al "Asignarla" (proj.assignments). Antes, este detalle siempre usaba
  // el filtro de país ACTIVO del dashboard para las tablas de marca/ciudad, así
  // que ver el detalle de una proyección asignada a Perú con el filtro en "Todos"
  // (o en otro país) mezclaba marcas/ciudades de países que no son Perú — muy
  // confuso. Si esta proyección está asignada a uno o más países, se fuerza ese
  // alcance para todo este detalle (independientemente del filtro activo) y se
  // restaura el filtro real al terminar.
  const proj = state.metaProjection;
  const assignedCountries = (proj.assignments || [])
    .filter(a => a.savedId === id && a.year === saved.targetYear && a.month === saved.targetMonth)
    .map(a => a.country);
  const originalCountryFilter = state.filters.country;
  let countryScopeNote;
  if (assignedCountries.length) {
    state.filters.country = assignedCountries;
    countryScopeNote = ` · País${assignedCountries.length === 1 ? '' : 'es'}: ${assignedCountries.join(', ')} (según asignación)`;
  } else {
    countryScopeNote = ` · ⚠️ Sin asignar a ningún país — mostrando según el filtro de país activo del dashboard (${activeCountriesInFilter().join(', ')})`;
  }

  try {
    // Filtra también por relevancia al país activo — cubre proyecciones guardadas
    // antes de este fix, que todavía pueden tener palancas de otro país mezcladas.
    const appliedLevers = (saved.levers || []).filter(l => l.active !== false && leverAppliesToActiveCountryFilter(l));
    const hiddenLeverCount = (saved.levers || []).filter(l => l.active !== false).length - appliedLevers.length;
    // Igual filtro por relevancia al país activo — cubre proyecciones guardadas antes
    // de este fix, que todavía pueden tener cocinas excluidas de otro país mezcladas.
    const allExcludedKitchens = saved.excludedKitchens || [];
    const excludedKitchens = allExcludedKitchens.filter(e => kitchenAppliesToActiveCountryFilter(e.kitchenId));
    const hiddenExcludedKitchenCount = allExcludedKitchens.length - excludedKitchens.length;
    const kitchenNameById = new Map(FACTS.map(f => [f.kitchenId, f.kitchenName]));
    const excludedNote = excludedKitchens.length
      ? ` · ${excludedKitchens.length} cocina${excludedKitchens.length === 1 ? '' : 's'} con cierre (${excludedKitchens.map(e => `${kitchenNameById.get(e.kitchenId) || e.kitchenId}: ${e.closedFrom}→${e.closedTo || 'fin de mes'}`).join(', ')})`
      : '';
    const hiddenLeverNote = hiddenLeverCount > 0
      ? ` · ${hiddenLeverCount} palanca${hiddenLeverCount === 1 ? '' : 's'} oculta${hiddenLeverCount === 1 ? '' : 's'} (no aplica a este país)`
      : '';
    const hiddenExcludedKitchenNote = hiddenExcludedKitchenCount > 0
      ? ` · ${hiddenExcludedKitchenCount} cocina${hiddenExcludedKitchenCount === 1 ? '' : 's'} excluida${hiddenExcludedKitchenCount === 1 ? '' : 's'} oculta${hiddenExcludedKitchenCount === 1 ? '' : 's'} (no aplica a este país)`
      : '';
    document.getElementById('proj-saved-detail-summary').textContent =
      `Mes proyectado: ${projSavedMonthLabel(saved)} · Baseline: ${saved.baselineFrom} → ${saved.baselineTo} · ${appliedLevers.length} palanca${appliedLevers.length === 1 ? '' : 's'} activa${appliedLevers.length === 1 ? '' : 's'}${excludedNote}${hiddenLeverNote}${hiddenExcludedKitchenNote}${countryScopeNote}`;

    const leversTbody = document.getElementById('proj-saved-detail-levers-body');
    const leversTotalTbody = document.getElementById('proj-saved-detail-levers-total');
    if (leversTbody && leversTotalTbody) {
      const fxCountry = leverEntryCountryFor(activeCountriesInFilter());
      leversTbody.innerHTML = appliedLevers.length ? appliedLevers.map(l =>
        `<tr><td>${l.name}</td><td class="mono">${projLeverAmountLabel(l)}</td><td>${projScopeValueLabels(l.scope)}</td></tr>`
      ).join('') : '<tr><td colspan="3" style="color:var(--text-muted);">Sin palancas activas en esta proyección.</td></tr>';
      const totalUSD = appliedLevers.reduce((s, l) => s + (l.amountUSD || 0), 0);
      leversTotalTbody.innerHTML = `<tr><td style="font-weight:bold">TOTAL ACTIVO</td><td class="mono" style="font-weight:bold">${fmtMoney(fxValue(totalUSD * (FX[fxCountry] || 1), fxCountry))}</td><td></td></tr>`;
    }

    withSimulatedProjSavedState(saved, () => {
      const facts = getFilteredFacts({ ignoreDate: true });
      const countries = activeCountriesInFilter();
      const baseMetaCOP = calculateBaseMetaCOP(facts, countries);
      const leverImpacts = getLeverImpactsForScope(countries);

      // Resumen general (no desglosado por marca/ciudad): Baseline + cada palanca
      // aplicada + Meta Total — mismo desglose que el modal "Cálculo de Meta" que
      // ya usan los KPIs, pero para el alcance completo de esta proyección guardada,
      // pensado para compartir como una sola imagen sin tener que abrir el dashboard.
      const summaryFxCountry = metaFxCountryFor(countries);
      let summaryLeverImpactUSD = 0;
      const summaryLevers = [];
      // Mismo fix que calculateTotalMetaWithLevers()/renderS1(): no exigir
      // leverMatchesAnyFact — una palanca de marca/cocina nueva sin ventas
      // reales aún debe contar completa aquí también, o el resumen descargado
      // no cuadraría con "Meta Total" de la lista de Proyecciones Guardadas.
      leverImpacts.forEach(l => {
        summaryLeverImpactUSD += l.amountUSD;
        summaryLevers.push({
          name: l.name,
          scope: projScopeValueLabels(l.scope),
          amount: fxValue(l.amountUSD * (FX[summaryFxCountry] || 1), summaryFxCountry)
        });
      });
      const summaryLeverImpactCOP = summaryLeverImpactUSD * (FX[summaryFxCountry] || 1);
      const summaryBaseline = fxValue(baseMetaCOP, summaryFxCountry);
      const summaryTotal = fxValue(baseMetaCOP + summaryLeverImpactCOP, summaryFxCountry);
      window.__projComboCache.summary = {
        title: `Cálculo de Meta — ${saved.name}`,
        subtitle: `${countryScopeNote.replace(/^ · /, '')} · Mes proyectado: ${projSavedMonthLabel(saved)}`,
        baselineRange: `Fechas del baseline: ${saved.baselineFrom} → ${saved.baselineTo}`,
        baseline: summaryBaseline,
        levers: summaryLevers,
        total: summaryTotal
      };

      // Línea aparte, bien visible, con los montos (no solo fechas/conteos) —
      // antes el resumen de texto solo mostraba el rango de fechas del baseline
      // y cuántas palancas había, sin decir cuánto es el baseline en dinero ni
      // cuál es la Meta Total resultante; había que ir a buscarlo abajo, repetido
      // en cada una de las 3 tablas de reparto (Ciudad/Marca/Categoría).
      const totalsLineEl = document.getElementById('proj-saved-detail-totals-line');
      if (totalsLineEl) {
        totalsLineEl.innerHTML = `Baseline: <strong>${fmtMoney(summaryBaseline)}</strong> + Palancas: <strong>${fmtMoney(fxValue(summaryLeverImpactCOP, summaryFxCountry))}</strong> = <strong style="color:var(--accent-blue-2);font-size:15px;">Meta Total: ${fmtMoney(summaryTotal)}</strong>`;
      }
      const growthLineDetailEl = document.getElementById('proj-saved-detail-growth-line');
      if (growthLineDetailEl) {
        growthLineDetailEl.innerHTML = growthLineHTML(summaryTotal, countries, saved.targetYear, saved.targetMonth) ||
          (countries.length !== 1 ? 'Sin país único asignado — no se puede calcular el crecimiento.' : '');
      }

    const excludedKitchensCard = document.getElementById('proj-saved-detail-excluded-kitchens-card');
    const excludedKitchensTbody = document.getElementById('proj-saved-detail-excluded-kitchens-body');
    const excludedKitchensTotalTbody = document.getElementById('proj-saved-detail-excluded-kitchens-total');
    if (excludedKitchensTbody && excludedKitchensTotalTbody) {
      // Sin cocinas excluidas, la tarjeta entera se oculta (antes se dejaba
      // visible con un renglón "Ninguna cocina excluida..." — ruido de más en
      // el detalle/PDF cuando la mayoría de las proyecciones no excluyen nada).
      if (excludedKitchensCard) excludedKitchensCard.style.display = excludedKitchens.length ? '' : 'none';
      if (!excludedKitchens.length) {
        excludedKitchensTbody.innerHTML = '';
        excludedKitchensTotalTbody.innerHTML = '';
      } else {
        // Para cada cocina excluida, calcula cuánto se redujo la meta: se recalcula
        // su fila SIN ese cierre específico (pero manteniendo los demás cierres, si
        // hay varios) para obtener el valor "completo", y se multiplica por la
        // fracción de días cerrados — misma lógica que el preview al agregarla.
        const originalExcluded = state.metaProjection.excludedKitchens;
        const impacts = excludedKitchens.map(entry => {
          state.metaProjection.excludedKitchens = originalExcluded.filter(e => e.kitchenId !== entry.kitchenId);
          const baseMetaCOPFull = calculateBaseMetaCOP(facts, countries);
          const leverImpactsFull = getLeverImpactsForScope(countries);
          const rowsFull = breakdownBy(facts, f => f.kitchenId, f => f.kitchenName, countries, baseMetaCOPFull, leverImpactsFull);
          const rowFull = rowsFull.find(r => r.key === entry.kitchenId);
          const { openFraction, openDays, totalDays } = computeOpenFractionForRange(entry.closedFrom, entry.closedTo);
          const reductionFactor = 1 - openFraction;
          let baseline = 0, palanca = 0, total = 0;
          if (rowFull) {
            const mb = rowFull.metaBreakdown;
            baseline = fxValue(mb.baseContributionCOP, mb.fxCountry) * reductionFactor;
            palanca = fxValue((mb.levers || []).reduce((s, l) => s + l.contributionCOP, 0), mb.fxCountry) * reductionFactor;
            total = rowFull.meta * reductionFactor;
          }
          return { label: kitchenNameById.get(entry.kitchenId) || entry.kitchenId, closedFrom: entry.closedFrom, closedTo: entry.closedTo, openDays, totalDays, baseline, palanca, total };
        });
        state.metaProjection.excludedKitchens = originalExcluded;

        excludedKitchensTbody.innerHTML = impacts.map(imp => `<tr>` +
          `<td>${imp.label}</td>` +
          `<td>${imp.closedFrom} → ${imp.closedTo || 'fin de mes'}</td>` +
          `<td>${imp.openDays} / ${imp.totalDays}</td>` +
          `<td class="mono">${fmtMoney(imp.baseline)}</td>` +
          `<td class="mono">${fmtMoney(imp.palanca)}</td>` +
          `<td class="mono" style="font-weight:600;">${fmtMoney(imp.total)}</td>` +
          `</tr>`).join('');
        const totals = impacts.reduce((acc, imp) => ({ baseline: acc.baseline + imp.baseline, palanca: acc.palanca + imp.palanca, total: acc.total + imp.total }), { baseline: 0, palanca: 0, total: 0 });
        excludedKitchensTotalTbody.innerHTML = `<tr><td colspan="3" style="font-weight:bold">TOTAL REDUCIDO</td><td class="mono" style="font-weight:bold">${fmtMoney(totals.baseline)}</td><td class="mono" style="font-weight:bold">${fmtMoney(totals.palanca)}</td><td class="mono" style="font-weight:bold">${fmtMoney(totals.total)}</td></tr>`;
      }
    }

    // Cómo se calculó el Baseline: mismo desglose por día de la semana que
    // "1. Baseline" en el Editor (renderProjBaselineTable), pero usando el
    // baseline propio de ESTA proyección guardada en vez de lo que haya
    // tecleado en el formulario en este momento — withSimulatedProjSavedState
    // ya dejó proj.baselineFrom/baselineTo/targetYear/targetMonth con los
    // valores de `saved`, así que getProjectionTargetMonth() resuelve al mes
    // correcto sin tener que repetir esa lógica aquí.
    const baselineTbody = document.getElementById('proj-saved-detail-baseline-body');
    const baselineTotalTbody = document.getElementById('proj-saved-detail-baseline-total');
    if (baselineTbody && baselineTotalTbody) {
      const { year: bYear, month: bMonth } = getProjectionTargetMonth();
      const metaFull = computeGMVMeta(facts, bYear, bMonth, countries);
      const monthNamesLower = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
      baselineTbody.innerHTML = PROJ_DOW_ORDER.map(dow => {
        const avg = metaFull.dowAvg[dow] || 0;
        const count = metaFull.dowCountsInMonth[dow] || 0;
        return `<tr><td>${PROJ_DOW_NAMES[dow]}</td><td class="mono">${fmtMoney(fxValue(avg, summaryFxCountry))}</td><td class="mono">${count}</td><td class="mono">${fmtMoney(fxValue(avg * count, summaryFxCountry))}</td></tr>`;
      }).join('') + `<tr><td>Festivos / Fechas especiales</td><td class="mono">${fmtMoney(fxValue(metaFull.festivalAvg || 0, summaryFxCountry))}</td><td class="mono">${metaFull.festivalCountInMonth || 0}</td><td class="mono">${fmtMoney(fxValue((metaFull.festivalAvg || 0) * (metaFull.festivalCountInMonth || 0), summaryFxCountry))}</td></tr>`;
      baselineTotalTbody.innerHTML = `<tr><td style="font-weight:bold">TOTAL — Meta proyectada para ${monthNamesLower[bMonth]}</td><td></td><td></td><td class="mono" style="font-weight:bold">${fmtMoney(fxValue(metaFull.total, summaryFxCountry))}</td></tr>`;
    }
    });
  } finally {
    state.filters.country = originalCountryFilter;
  }
}

// Asigna una proyección guardada a la meta del país actualmente filtrado, para
// el mes objetivo de esa proyección — cada combinación país+mes tiene su propia
// asignación independiente (state.metaProjection.assignments), así que asignar
// una no pisa la de otro país u otro mes. Requiere tener exactamente un país
// filtrado arriba, porque la asignación es por país.
function assignProjSavedToCurrentFilter(id) {
  const countries = activeCountriesInFilter();
  if (countries.length !== 1) {
    alert('Para asignar una proyección a la meta, filtra primero un único país (arriba, en "País:").');
    return;
  }
  const saved = (state.metaProjection.savedList || []).find(s => s.id === id);
  if (!saved) return;
  const country = countries[0];
  const proj = state.metaProjection;
  proj.assignments = (proj.assignments || []).filter(a => !(a.country === country && a.year === saved.targetYear && a.month === saved.targetMonth));
  proj.assignments.push({ country, year: saved.targetYear, month: saved.targetMonth, savedId: id });
  saveMetaProjection();
  renderProjSavedList();
  renderAll();
}

// Atajo desde "Proyecciones Guardadas": asigna esa proyección al país filtrado
// (si no lo estaba ya) y salta directo al Editor con su baseline/palancas
// cargadas, para no tener que adivinar si el borrador del Editor corresponde a
// la proyección correcta antes de tocar sus palancas.
function editProjSavedLevers(id) {
  const proj = state.metaProjection;
  const saved = (proj.savedList || []).find(s => s.id === id);
  if (!saved) return;
  // La proyección tiene su PROPIO país (saved.country, o si es antigua y no lo
  // tiene, una asignación previa ya guardada) — hay que usar SIEMPRE ese país,
  // no el que esté filtrado en el dashboard en este momento. Antes, este botón
  // exigía tener ya filtrado un único país y con eso REASIGNABA la proyección a
  // ese país sin preguntar — editar "Meta PER Agosto" con el filtro puesto en
  // Colombia reasignaba silenciosamente esa proyección a Colombia, y como el
  // Editor oculta las palancas que no apliquen al país ACTIVO, casi todas las
  // palancas de Perú (con scope.countries=['PER']) quedaban ocultas — solo se
  // veían las 2 que no declaraban país. Esto también explica que una palanca ya
  // etiquetada "País: COL" pareciera desaparecer al filtrar Colombia: la
  // proyección misma se había reasignado a otro país sin que se notara.
  let targetCountry = saved.country;
  if (!targetCountry) {
    const existingAssignment = (proj.assignments || []).find(a => a.savedId === id && a.year === saved.targetYear && a.month === saved.targetMonth);
    if (existingAssignment) targetCountry = existingAssignment.country;
  }
  if (!targetCountry) {
    const countries = activeCountriesInFilter();
    if (countries.length !== 1) {
      alert('Esta proyección aún no tiene país asignado. Filtra primero un único país (arriba, en "País:") para asignársela.');
      return;
    }
    targetCountry = countries[0];
    saved.country = targetCountry;
  }
  state.filters.country = [targetCountry];
  proj.pinnedEditId = id;
  assignProjSavedToCurrentFilter(id);
  // Antes este paso faltaba: el Editor y el panel "Palancas de Crecimiento"
  // seguían mostrando lo que hubiera quedado en proj.levers de la ÚLTIMA vez
  // que se editó CUALQUIER proyección (de cualquier país), no las palancas
  // propias de ESTA — por eso podían aparecer palancas de Perú al editar una
  // proyección de Colombia. Ahora se reemplaza el borrador con el snapshot
  // real de esta proyección antes de mostrar el Editor.
  proj.active = true;
  proj.appliedSavedId = id;
  proj.baselineFrom = saved.baselineFrom;
  proj.baselineTo = saved.baselineTo;
  proj.targetYear = saved.targetYear;
  proj.targetMonth = saved.targetMonth;
  proj.levers = JSON.parse(JSON.stringify(saved.levers || []));
  proj.excludedKitchens = JSON.parse(JSON.stringify(saved.excludedKitchens || []));
  saveMetaProjection();
  const fromEl = document.getElementById('proj-baseline-from');
  const toEl = document.getElementById('proj-baseline-to');
  const targetEl = document.getElementById('proj-target-month');
  if (fromEl) fromEl.value = proj.baselineFrom;
  if (toEl) toEl.value = proj.baselineTo;
  if (targetEl) targetEl.value = `${proj.targetYear}-${proj.targetMonth}`;
  updateProjBaselineSummary();
  renderProjBaselineTable();
  renderProjectionLevers();
  renderProjResultTables();
  // renderAll() (no solo renderLevers/renderProjectionLevers) porque "Cumplimiento
  // de Palancas" en Insights Estratégicos también lee proj.levers directamente
  // (getLeverPalancasForCompliance) — sin esto, esa sección se quedaba mostrando
  // lo que hubiera al último renderAll() completo (p.ej. al cargar la página),
  // no el snapshot recién cargado de esta proyección.
  renderAll();
  switchProjSubtab('editor');
  const leversSection = document.getElementById('proj-levers-section');
  if (leversSection) leversSection.scrollIntoView({ block: 'start' });
}

function deleteProjSaved(id) {
  const proj = state.metaProjection;
  proj.savedList = (proj.savedList || []).filter(s => s.id !== id);
  proj.assignments = (proj.assignments || []).filter(a => a.savedId !== id);
  if (proj.appliedSavedId === id) proj.appliedSavedId = null;
  saveMetaProjection();
  renderProjSavedList();
  renderAll();
  if (currentProjSavedDetailId === id) {
    currentProjSavedDetailId = null;
    const detailSection = document.getElementById('proj-saved-detail-section');
    if (detailSection) detailSection.style.display = 'none';
  }
}

function initProjSavedTab() {
  document.querySelectorAll('.proj-subtab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchProjSubtab(btn.dataset.projSubtab));
  });

  document.getElementById('proj-save-new').addEventListener('click', () => {
    const nameEl = document.getElementById('proj-save-name');
    const name = nameEl.value.trim();
    if (!name) {
      alert('Ponle un nombre a la proyección antes de guardarla.');
      return;
    }
    const fromEl = document.getElementById('proj-baseline-from');
    const toEl = document.getElementById('proj-baseline-to');
    const targetEl = document.getElementById('proj-target-month');
    if (!fromEl.value || !toEl.value || fromEl.value > toEl.value) {
      alert('Selecciona un rango de baseline válido antes de guardar.');
      return;
    }
    const [tYear, tMonth] = targetEl.value.split('-').map(Number);
    const id = 'proj' + Math.round(performance.now() * 1000) + '' + Math.floor(Math.random() * 1000);
    const now = new Date(LAST_DATA_ISO + 'T00:00:00');
    // Solo se guardan las palancas relevantes al país filtrado en este momento — el
    // borrador (state.metaProjection.levers) es un array compartido donde pueden
    // convivir palancas de distintos países si se fueron agregando con distintos
    // filtros activos; sin este filtro, guardar una proyección "para Perú" arrastraba
    // también palancas de alcance Colombia que nunca deberían contar en su total.
    const relevantLevers = (state.metaProjection.levers || []).filter(leverAppliesToActiveCountryFilter);
    // Mismo criterio para cocinas excluidas: una cocina cerrada de otro país no tiene
    // sentido dentro de esta proyección y no debería quedar guardada en su snapshot.
    const relevantExcludedKitchens = (state.metaProjection.excludedKitchens || []).filter(e => kitchenAppliesToActiveCountryFilter(e.kitchenId));
    // País "propio" de esta proyección: se captura del filtro activo al momento
    // de guardar (si hay exactamente un país filtrado). Es DISTINTO de
    // proj.assignments — una proyección puede quedar guardada con su país sin
    // que nadie la haya "Asignado" todavía a la meta activa, y aun así la lista
    // de Proyecciones Guardadas debe poder ocultarla al filtrar otro país.
    const ownCountry = activeCountriesInFilter().length === 1 ? activeCountriesInFilter()[0] : null;
    const saved = {
      id, name,
      createdAtLabel: `${LAST_DATA_ISO}`,
      country: ownCountry,
      baselineFrom: fromEl.value, baselineTo: toEl.value,
      targetYear: tYear, targetMonth: tMonth,
      levers: JSON.parse(JSON.stringify(relevantLevers)),
      excludedKitchens: JSON.parse(JSON.stringify(relevantExcludedKitchens))
    };
    state.metaProjection.savedList = state.metaProjection.savedList || [];
    state.metaProjection.savedList.push(saved);
    saveMetaProjection();
    projSaveNameManuallyEdited = false;
    updateProjSaveNameAuto();
    const feedback = document.getElementById('proj-save-feedback');
    feedback.textContent = `Guardada como "${name}". Ve a la pestaña "Proyecciones Guardadas" para verla o asignarla.`;
    setTimeout(() => { feedback.textContent = ''; }, 6000);
  });

  document.getElementById('proj-saved-export').addEventListener('click', exportProjSaved);
  const importInput = document.getElementById('proj-saved-import-input');
  document.getElementById('proj-saved-import').addEventListener('click', () => importInput.click());
  importInput.addEventListener('change', () => {
    if (importInput.files && importInput.files[0]) importProjSaved(importInput.files[0]);
    importInput.value = '';
  });

  renderProjSavedList();
}

// Descarga savedList + assignments como JSON — pensado como respaldo manual:
// localStorage vive por navegador/origen (localhost:8000 vs abrir el archivo
// con doble clic cuentan como orígenes distintos), así que una proyección
// guardada en un lugar puede "desaparecer" al abrir el dashboard de otra forma.
// Exportar/Importar deja moverlas entre navegadores o recuperarlas si eso pasa.
function exportProjSaved() {
  const proj = state.metaProjection;
  const payload = {
    exportedAt: LAST_DATA_ISO,
    savedList: proj.savedList || [],
    assignments: proj.assignments || []
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const link = document.createElement('a');
  link.download = `proyecciones-metas-${LAST_DATA_ISO}.json`;
  link.href = URL.createObjectURL(blob);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}

// Importa un archivo exportado con exportProjSaved(): agrega las proyecciones
// que no existan todavía (por id) y fusiona las asignaciones, en vez de
// reemplazar todo — así importar no borra nada que ya tengas guardado aquí.
function importProjSaved(file) {
  const reader = new FileReader();
  reader.onload = () => {
    let data;
    try {
      data = JSON.parse(reader.result);
    } catch (e) {
      alert('El archivo no es un JSON válido de proyecciones exportadas.');
      return;
    }
    if (!data || !Array.isArray(data.savedList)) {
      alert('El archivo no tiene el formato esperado (¿lo generaste con "Exportar"?).');
      return;
    }
    const proj = state.metaProjection;
    proj.savedList = proj.savedList || [];
    proj.assignments = proj.assignments || [];
    const existingIds = new Set(proj.savedList.map(s => s.id));
    let added = 0, skipped = 0;
    data.savedList.forEach(s => {
      if (existingIds.has(s.id)) { skipped++; return; }
      proj.savedList.push(s);
      existingIds.add(s.id);
      added++;
    });
    (data.assignments || []).forEach(a => {
      const dup = proj.assignments.some(x => x.country === a.country && x.year === a.year && x.month === a.month && x.savedId === a.savedId);
      if (!dup) proj.assignments.push(a);
    });
    saveMetaProjection();
    renderProjSavedList();
    renderAll();
    alert(`Importadas ${added} proyección${added === 1 ? '' : 'es'} nueva${added === 1 ? '' : 's'}${skipped ? ` (${skipped} ya existían y se saltaron)` : ''}.`);
  };
  reader.readAsText(file);
}

// Una palanca sin países en su alcance aplica a todos; si tiene países específicos,
// solo aplica cuando el filtro de país activo se solapa con esa lista.
// El panel superior "Palancas de Crecimiento" muestra las palancas de la
// Proyección de Metas activa, filtradas por el país y la fecha que estén
// seleccionados arriba — solo tiene sentido mostrar palancas de un mes cuando
// el rango de fechas filtrado efectivamente cae en ese mes.
function renderLevers() {
  const gridBody = document.getElementById('levers-grid-body');
  const summaryEl = document.getElementById('levers-summary');
  if (!gridBody || !summaryEl) return;

  const countries = activeCountriesInFilter();
  const proj = state.metaProjection;

  // Usa la misma noción de "mes actual" que resolveMetaProjectionForFilter() y el
  // resto del motor de cálculo (refYearMonth, basado en state.dateTo) — así el
  // panel y el cálculo real de la meta siempre coinciden en qué mes están mirando.
  const { year: filterYear, month: filterMonth } = refYearMonth();
  const monthMatches = !!proj.active && proj.targetYear === filterYear && proj.targetMonth === filterMonth;

  // Se muestran TODAS las palancas del país/mes filtrado (activas e inactivas),
  // no solo las activas, para poder apagarlas/encenderlas desde aquí mismo.
  const allMatchingLevers = monthMatches
    ? (proj.levers || []).filter(leverAppliesToActiveCountryFilter)
    : [];

  if (allMatchingLevers.length === 0) {
    if (!proj.active) {
      // Sin Proyección de Metas activa, getLeverImpactsForScope() no deja la Meta
      // en blanco: suma por defecto estas 5 palancas "legacy" (Pasta Nova, Pasta
      // Lab, Turbo Markups, New Point, Ería Quadra). Antes este panel no las
      // mostraba en absoluto — decía "No hay proyección activa" mientras esos
      // montos ya estaban sumados en silencio a la Meta que se ve en pantalla.
      renderLegacyLeversGrid(gridBody, summaryEl, countries);
      return;
    }
    gridBody.innerHTML = '';
    if (!monthMatches) {
      const monthNamesCap = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
      const targetLabel = proj.targetMonth != null ? `${monthNamesCap[proj.targetMonth]} ${proj.targetYear}` : '—';
      summaryEl.textContent = `La proyección activa es para ${targetLabel}; el rango de fechas filtrado no cae en ese mes.`;
    } else {
      summaryEl.textContent = 'La proyección activa no tiene palancas para el país filtrado.';
    }
    return;
  }

  gridBody.innerHTML = allMatchingLevers.map(l => {
    const isActive = l.active !== false;
    return `
    <div class="lever-item">
      <label class="lever-toggle">
        <input type="checkbox" data-top-lever-toggle="${l.id}" ${isActive ? 'checked' : ''}>
        <span class="toggle-slider"></span>
        <span class="lever-name"${isActive ? '' : ' style="color:var(--text-muted);text-decoration:line-through;"'}>${l.name}</span>
      </label>
      <div class="lever-value mono"${isActive ? '' : ' style="color:var(--text-muted);"'}>${projLeverAmountLabel(l)}</div>
      <div style="font-size:11px;color:var(--text-muted);">${projScopeValueLabels(l.scope)}</div>
    </div>`;
  }).join('');

  gridBody.querySelectorAll('[data-top-lever-toggle]').forEach(cb => {
    cb.addEventListener('change', () => {
      const id = cb.dataset.topLeverToggle;
      const lever = (state.metaProjection.levers || []).find(l => l.id === id);
      if (lever) lever.active = cb.checked;
      saveMetaProjection();
      syncAppliedSavedLevers();
      renderAll();
    });
  });

  const activeMatchingLevers = allMatchingLevers.filter(l => l.active !== false);
  const fxCountry = metaFxCountryFor(countries);
  const totalUSD = activeMatchingLevers.reduce((s, l) => s + (l.amountUSD || 0), 0);
  const impactDisplay = fmtMoney(fxValue(totalUSD * (FX[fxCountry] || 1), fxCountry));
  summaryEl.textContent = `Impacto total: ${impactDisplay} | ${activeMatchingLevers.length}/${allMatchingLevers.length} palanca${allMatchingLevers.length === 1 ? '' : 's'} activa${activeMatchingLevers.length === 1 ? '' : 's'}`;
}

// Las 5 son promociones/ajustes que solo existieron en Colombia (ver la nota en
// getLeverImpactsForScope, app.js) — todas quedan countryOnly:'COL', no solo
// Ería Quadra, para que no aparezcan (ni sumen a la Meta) al filtrar otro país.
const LEGACY_LEVER_DEFS = [
  { key: 'pastaNova', name: 'Pasta Nova', scopeLabel: 'Todas las marcas · Solo Colombia', countryOnly: 'COL' },
  { key: 'pastaLab', name: 'Pasta Lab', scopeLabel: 'Todas las marcas · Solo Colombia', countryOnly: 'COL' },
  { key: 'turboMarkups', name: 'Turbo Markups', scopeLabel: 'Marcas Turbo · Solo Colombia', countryOnly: 'COL' },
  { key: 'newPoint', name: 'New Point', scopeLabel: 'Todas las marcas · Solo Colombia', countryOnly: 'COL' },
  { key: 'eriaQuadra', name: 'Ería Quadra', scopeLabel: 'Solo Colombia', countryOnly: 'COL' }
];

// Dibuja y deja apagar/prender las 5 palancas por defecto que getLeverImpactsForScope()
// usa cuando no hay una Proyección de Metas activa — mismo look que el grid de
// palancas custom, para que sea obvio que es el mismo mecanismo con nombres reales.
function renderLegacyLeversGrid(gridBody, summaryEl, countries) {
  // Coincide exactamente con países filtrados, no con "incluido en la selección" —
  // así "Todos los países" (que técnicamente incluye COL) no muestra estas
  // palancas COL-only, igual que el gate de getLeverImpactsForScope() en app.js.
  const visible = LEGACY_LEVER_DEFS.filter(d => !d.countryOnly || (countries.length === 1 && countries[0] === d.countryOnly));
  const fxCountry = metaFxCountryFor(countries);

  if (visible.length === 0) {
    gridBody.innerHTML = '';
    summaryEl.textContent = 'Ninguna de las palancas por defecto aplica a este país (todas son exclusivas de Colombia). Filtra Colombia para verlas.';
    return;
  }

  gridBody.innerHTML = visible.map(d => {
    const lever = state.levers[d.key];
    const isActive = lever.active;
    const amountDisplay = fmtMoney(fxValue(lever.incrementUSD * (FX[fxCountry] || 1), fxCountry));
    return `
    <div class="lever-item">
      <label class="lever-toggle">
        <input type="checkbox" data-legacy-lever-toggle="${d.key}" ${isActive ? 'checked' : ''}>
        <span class="toggle-slider"></span>
        <span class="lever-name"${isActive ? '' : ' style="color:var(--text-muted);text-decoration:line-through;"'}>${d.name}</span>
      </label>
      <div class="lever-value mono"${isActive ? '' : ' style="color:var(--text-muted);"'}>${amountDisplay}</div>
      <div style="font-size:11px;color:var(--text-muted);">${d.scopeLabel}</div>
    </div>`;
  }).join('');

  gridBody.querySelectorAll('[data-legacy-lever-toggle]').forEach(cb => {
    cb.addEventListener('change', () => {
      const key = cb.dataset.legacyLeverToggle;
      state.levers[key].active = cb.checked;
      saveLegacyLevers();
      renderAll();
    });
  });

  const activeVisible = visible.filter(d => state.levers[d.key].active);
  const totalUSD = activeVisible.reduce((s, d) => s + state.levers[d.key].incrementUSD, 0);
  const impactDisplay = fmtMoney(fxValue(totalUSD * (FX[fxCountry] || 1), fxCountry));
  summaryEl.textContent = `Impacto total: ${impactDisplay} | ${activeVisible.length}/${visible.length} palanca${visible.length === 1 ? '' : 's'} activa${activeVisible.length === 1 ? '' : 's'} (valores por defecto — sin Proyección de Metas configurada)`;
}

// Main tab switching
const setupMainTabs = () => {
  const mainTabBtns = document.querySelectorAll('[data-main-tab]');
  const mainTabContents = document.querySelectorAll('.main-tab-content');

  mainTabBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const tabId = btn.dataset.mainTab;

      // Deactivate all main tabs
      mainTabBtns.forEach(b => b.classList.remove('active'));
      mainTabContents.forEach(c => c.classList.remove('active'));

      // Activate selected tab
      btn.classList.add('active');
      const contentEl = document.getElementById(tabId + '-content');
      if (contentEl) {
        contentEl.classList.add('active');
      }
    });
  });
};

// Run on DOMContentLoaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', setupMainTabs);
} else {
  setupMainTabs();
}
