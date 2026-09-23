// Insights Engine - DISABLED
// Using inline functions from dashboard.html instead
// The analytics functions are defined in dashboard.html's inline scripts

/*
// Insights Engine - Strategic Analysis for Foodology Dashboard
// Acts as Head of Strategy for restaurant/dark kitchen company

const HOLIDAYS_INSIGHTS = {
  'COL': ['2026-06-08', '2026-06-15', '2026-07-20'],
  'MEX': ['2026-07-18'],
  'PER': ['2026-06-29', '2026-07-28'],
  'ECU': ['2026-06-08', '2026-07-24']
};

function isHolidayInsights(dateISO, country) {
  return HOLIDAYS_INSIGHTS[country] && HOLIDAYS_INSIGHTS[country].includes(dateISO);
}

function ymd(year, month, day) {
  return year + '-' + String(month + 1).padStart(2, '0') + '-' + String(day).padStart(2, '0');
}

function daysInMonthInsights(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function computeMetaDOWBrand(brandFacts, country, currentMonth, currentYear) {
  const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
  const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;
  const prevFrom = ymd(prevYear, prevMonth, 1);
  const prevTo = ymd(prevYear, prevMonth, 24);

  const series = new Map();
  for (const f of brandFacts) {
    if (f.gran !== 'day' || f.dateISO < prevFrom || f.dateISO > prevTo) continue;
    series.set(f.dateISO, (series.get(f.dateISO) || 0) + f.gmv);
  }

  const dowSums = [0, 0, 0, 0, 0, 0, 0];
  const dowCounts = [0, 0, 0, 0, 0, 0, 0];
  let festivalSum = 0, festivalCount = 0;

  for (let d = 1; d <= 24; d++) {
    const iso = ymd(prevYear, prevMonth, d);
    if (isHolidayInsights(iso, country)) {
      festivalSum += series.get(iso) || 0;
      festivalCount += 1;
    } else {
      const dow = new Date(iso + 'T00:00:00Z').getUTCDay();
      dowSums[dow] += series.get(iso) || 0;
      dowCounts[dow] += 1;
    }
  }

  const dowAvg = dowSums.map((s, i) => dowCounts[i] > 0 ? s / dowCounts[i] : 0);
  const festivalAvg = festivalCount > 0 ? festivalSum / festivalCount : 0;

  const dowCountsInMonth = [0, 0, 0, 0, 0, 0, 0];
  let festivalCountInMonth = 0;
  const nDaysCurrent = daysInMonthInsights(currentYear, currentMonth);
  for (let d = 1; d <= nDaysCurrent; d++) {
    const iso = ymd(currentYear, currentMonth, d);
    if (isHolidayInsights(iso, country)) {
      festivalCountInMonth += 1;
    } else {
      const dow = new Date(iso + 'T00:00:00Z').getUTCDay();
      dowCountsInMonth[dow] += 1;
    }
  }

  let total = 0;
  for (let d = 1; d <= nDaysCurrent; d++) {
    const iso = ymd(currentYear, currentMonth, d);
    const isFestival = isHolidayInsights(iso, country);
    const val = isFestival ? festivalAvg : dowAvg[new Date(iso + 'T00:00:00Z').getUTCDay()];
    total += val;
  }
  return total;
}

function generateInsights(facts) {
  if (!facts || facts.length === 0) return;
  if (typeof state === 'undefined') return;

  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth();
  const lastDay = today.getDate();

  // Filter facts based on current state filters
  const filteredFacts = facts.filter(f => {
    const filt = state.filters;
    if (filt.country && filt.country.length && !filt.country.includes(f.country)) return false;
    if (filt.city && filt.city.length && !filt.city.includes(f.city)) return false;
    if (filt.kitchen && filt.kitchen.length && !filt.kitchen.includes(f.kitchenId)) return false;
    if (filt.brand && filt.brand.length && !filt.brand.includes(f.brandId)) return false;
    return true;
  });

  if (filteredFacts.length === 0) {
    const el = document.getElementById('insight-diagnosis');
    if (el) el.innerHTML = '<p>No hay datos disponibles para el filtro seleccionado.</p>';
    return;
  }

  try {
    // Diagnosis
    renderDiagnosis(analyzeDiagnosis(filteredFacts, currentMonth, currentYear, lastDay));
    // Brands
    renderBrandAnalysis(analyzeBrands(filteredFacts, currentMonth, currentYear));
    // Geography
    renderGeography(analyzeGeography(filteredFacts, currentMonth, currentYear));
    // Recommendations
    const diagnosis = analyzeDiagnosis(filteredFacts, currentMonth, currentYear, lastDay);
    const brandAnalysis = analyzeBrands(filteredFacts, currentMonth, currentYear);
    const geoAnalysis = analyzeGeography(filteredFacts, currentMonth, currentYear);
    renderRecommendations(generateRecommendations(diagnosis, brandAnalysis, geoAnalysis));
  } catch (e) {
    console.error('Error in generateInsights:', e.message);
  }
}

function analyzeDiagnosis(facts, currentMonth, currentYear, lastDay) {
  const currentMonthFacts = facts.filter(f => f.gran === 'day' && f.month === currentMonth);
  const juneFacts = facts.filter(f => f.gran === 'day' && f.month === 5);
  const juneMeta = juneFacts.slice(0, 24).reduce((sum, f) => sum + f.gmv, 0);
  const daysInMonthTotal = new Date(currentYear, currentMonth + 1, 0).getDate();
  const metaProrated = (juneMeta / 24) * daysInMonthTotal;
  const currentGMV = currentMonthFacts.reduce((sum, f) => sum + f.gmv, 0);
  const avgDaily = currentGMV / lastDay;
  const projectedTotal = currentGMV + (avgDaily * (daysInMonthTotal - lastDay));
  const compliance = metaProrated > 0 ? (projectedTotal / metaProrated) * 100 : 0;

  return {
    meta: metaProrated,
    currentGMV: currentGMV,
    runRate: projectedTotal,
    compliance: isNaN(compliance) ? 0 : compliance,
    activeBrands: new Set(currentMonthFacts.map(f => f.brandId)).size,
    activeKitchens: new Set(currentMonthFacts.map(f => f.kitchenId)).size,
    daysData: lastDay
  };
}

function analyzeBrands(facts, currentMonth, currentYear) {
  const monthFacts = facts.filter(f => f.gran === 'day' && f.month === currentMonth);
  const brandMetrics = {};

  for (let i = 0; i < monthFacts.length; i++) {
    const f = monthFacts[i];
    if (!brandMetrics[f.brandId]) {
      brandMetrics[f.brandId] = {
        brandId: f.brandId,
        brandName: f.brandName,
        gmv: 0,
        kitchens: {}
      };
    }
    brandMetrics[f.brandId].gmv += f.gmv;
    if (!brandMetrics[f.brandId].kitchens[f.kitchenId]) {
      brandMetrics[f.brandId].kitchens[f.kitchenId] = {
        kitchenId: f.kitchenId,
        kitchenName: f.kitchenName,
        gmv: 0
      };
    }
    brandMetrics[f.brandId].kitchens[f.kitchenId].gmv += f.gmv;
  }

  const juneFacts = facts.filter(f => f.gran === 'day' && f.month === 5);
  const brandFacts = {};
  const brandCountries = {};
  for (let i = 0; i < juneFacts.length; i++) {
    const f = juneFacts[i];
    if (!brandFacts[f.brandId]) {
      brandFacts[f.brandId] = [];
      brandCountries[f.brandId] = f.country;
    }
    brandFacts[f.brandId].push(f);
  }

  const brandList = Object.values(brandMetrics).map(b => {
    let meta = 0;
    try {
      const factsList = brandFacts[b.brandId] || [];
      if (factsList.length > 0) {
        meta = computeMetaDOWBrand(factsList, brandCountries[b.brandId] || 'COL', currentMonth, currentYear);
      }
      if (!meta || meta === 0) {
        const juneBrandFacts = juneFacts.filter(f => f.brandId === b.brandId);
        const juneTotal = juneBrandFacts.reduce((sum, f) => sum + f.gmv, 0);
        const daysInMonthTotal = new Date(currentYear, currentMonth + 1, 0).getDate();
        meta = (juneTotal / 24) * daysInMonthTotal;
      }
    } catch (e) {
      const juneBrandFacts = juneFacts.filter(f => f.brandId === b.brandId);
      const juneTotal = juneBrandFacts.reduce((sum, f) => sum + f.gmv, 0);
      const daysInMonthTotal = new Date(currentYear, currentMonth + 1, 0).getDate();
      meta = (juneTotal / 24) * daysInMonthTotal;
    }
    const gap = meta - b.gmv;
    return {
      brandId: b.brandId,
      brandName: b.brandName,
      gmv: b.gmv,
      kitchens: b.kitchens,
      meta: meta,
      gap: gap,
      compliance: meta > 0 ? (b.gmv / meta) * 100 : 0
    };
  }).sort((a, b) => b.gap - a.gap).slice(0, 5);

  return brandList.map(b => {
    const topKitchensArray = Object.values(b.kitchens).sort((a, c) => c.gmv - a.gmv).slice(0, 3);
    return {
      brandId: b.brandId,
      brandName: b.brandName,
      gmv: b.gmv,
      meta: b.meta,
      gap: b.gap,
      compliance: b.compliance,
      topKitchens: topKitchensArray
    };
  });
}

function analyzeGeography(facts, currentMonth, currentYear) {
  const monthFacts = facts.filter(f => f.gran === 'day' && f.month === currentMonth);
  const cityMetrics = {};

  for (let i = 0; i < monthFacts.length; i++) {
    const f = monthFacts[i];
    if (!cityMetrics[f.city]) {
      cityMetrics[f.city] = {
        city: f.city,
        gmv: 0
      };
    }
    cityMetrics[f.city].gmv += f.gmv;
  }

  const juneFacts = facts.filter(f => f.gran === 'day' && f.month === 5);
  const cityMetas = {};
  for (let i = 0; i < juneFacts.length; i++) {
    const f = juneFacts[i];
    if (!cityMetas[f.city]) cityMetas[f.city] = 0;
    cityMetas[f.city] += f.gmv;
  }

  const daysInMonthTotal = new Date(currentYear, currentMonth + 1, 0).getDate();
  return Object.values(cityMetrics).map(c => {
    const meta = (cityMetas[c.city] || 0) / 24 * daysInMonthTotal;
    const gap = meta - c.gmv;
    return {
      city: c.city,
      gmv: c.gmv,
      meta: meta,
      gap: gap,
      compliance: meta > 0 ? (c.gmv / meta) * 100 : 0
    };
  }).sort((a, b) => b.gap - a.gap).slice(0, 3);
}

function generateRecommendations(diagnosis, brandAnalysis, geoAnalysis) {
  const recs = [];

  if (diagnosis.compliance < 80) {
    recs.push({
      severity: 'HIGH',
      title: 'Cumplimiento muy bajo',
      action: 'Estamos en ' + diagnosis.compliance.toFixed(1) + '% de cumplimiento. Requiere acción inmediata.'
    });
  }

  const riskBrands = brandAnalysis.filter(b => b.compliance < 70);
  if (riskBrands.length > 0) {
    recs.push({
      severity: 'HIGH',
      title: riskBrands.length + ' marcas en riesgo',
      action: 'Marcas ' + riskBrands.slice(0, 2).map(b => b.brandName).join(', ') + ' están muy por debajo de meta.'
    });
  }

  if (diagnosis.compliance > 100) {
    recs.push({
      severity: 'INFO',
      title: '✨ Cumplimiento excelente',
      action: 'Vamos ' + (diagnosis.compliance - 100).toFixed(1) + '% por encima de meta.'
    });
  }

  return recs.length > 0 ? recs : [{
    severity: 'INFO',
    title: 'Operación normal',
    action: 'Negocio operando dentro de parámetros esperados.'
  }];
}

function renderDiagnosis(diagnosis) {
  const fmt = v => '$' + Math.round(v).toLocaleString('en-US');
  const html = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:20px;">' +
    '<div style="background:rgba(92,184,92,0.1);padding:20px;border-radius:8px;border-left:4px solid #5cb85c;">' +
      '<div style="color:var(--text-muted);font-size:12px;margin-bottom:8px;text-transform:uppercase;letter-spacing:1px;">GMV Meta</div>' +
      '<div style="font-size:24px;font-weight:700;color:#5cb85c;">' + fmt(diagnosis.meta) + '</div>' +
    '</div>' +
    '<div style="background:rgba(74,159,212,0.1);padding:20px;border-radius:8px;border-left:4px solid #4a9fd4;">' +
      '<div style="color:var(--text-muted);font-size:12px;margin-bottom:8px;text-transform:uppercase;letter-spacing:1px;">GMV Run Rate</div>' +
      '<div style="font-size:24px;font-weight:700;color:#4a9fd4;">' + fmt(diagnosis.runRate) + '</div>' +
    '</div>' +
    '</div>';
  const el = document.getElementById('insight-diagnosis');
  if (el) el.innerHTML = html;
}

function renderBrandAnalysis(brands) {
  let html = '<ul style="margin:0;padding:0;list-style:none;">';
  for (let i = 0; i < brands.length; i++) {
    const b = brands[i];
    let kitchensHtml = '';
    for (let k = 0; k < b.topKitchens.length; k++) {
      if (k > 0) kitchensHtml += '<br/>';
      kitchensHtml += '• ' + b.topKitchens[k].kitchenName + ': $' + Math.round(b.topKitchens[k].gmv).toLocaleString('en-US');
    }
    html += '<li style="background:rgba(74,159,212,0.08);padding:15px;margin-bottom:12px;border-radius:6px;">' +
      '<div style="font-weight:600;margin-bottom:5px;">' + (i + 1) + '. ' + b.brandName + '</div>' +
      '<div style="font-size:12px;color:var(--text-muted);margin-bottom:8px;">Gap: $' + Math.round(b.gap).toLocaleString('en-US') + ' | ' + b.compliance.toFixed(1) + '%</div>' +
      '<div style="font-size:12px;color:var(--text-muted);"><strong>Top 3 Cocinas:</strong><br/>' + kitchensHtml + '</div>' +
      '</li>';
  }
  html += '</ul>';
  const el = document.getElementById('insight-brands');
  if (el) el.innerHTML = html;
}

function renderGeography(cities) {
  let html = '<ul style="margin:0;padding:0;list-style:none;">';
  for (let i = 0; i < cities.length; i++) {
    const c = cities[i];
    html += '<li style="background:rgba(156,109,198,0.08);padding:15px;margin-bottom:12px;border-radius:6px;">' +
      '<div style="font-weight:600;margin-bottom:5px;">' + (i + 1) + '. ' + c.city + '</div>' +
      '<div style="font-size:12px;color:var(--text-muted);">Gap: $' + Math.round(c.gap).toLocaleString('en-US') + ' | ' + c.compliance.toFixed(1) + '%</div>' +
      '</li>';
  }
  html += '</ul>';
  const el = document.getElementById('insight-geography');
  if (el) el.innerHTML = html;
}

function renderRecommendations(recommendations) {
  let html = '<ul style="margin:0;padding:0;list-style:none;">';
  for (let i = 0; i < recommendations.length; i++) {
    const rec = recommendations[i];
    const bgColor = rec.severity === 'HIGH' ? 'rgba(201,79,79,0.1)' : 'rgba(92,184,92,0.1)';
    const borderColor = rec.severity === 'HIGH' ? '#c94f4f' : '#5cb85c';
    html += '<li style="background:' + bgColor + ';padding:15px;margin-bottom:12px;border-radius:6px;border-left:3px solid ' + borderColor + ';">' +
      '<div style="font-weight:600;margin-bottom:5px;">' + rec.title + '</div>' +
      '<div style="font-size:13px;color:var(--text-muted);">' + rec.action + '</div>' +
      '</li>';
  }
  html += '</ul>';
  const el = document.getElementById('insight-recommendations');
  if (el) el.innerHTML = html;
}
*/
