/*
 * Housing Stock view — Census dwelling condition + period of construction
 * (age) by area, for 2021 (StatsCan table 98-10-0233) and 2016 (Census
 * Profile). Pick an area + a view: a point-in-time profile for either census
 * year, or a 2021-vs-2016 comparison of the cross-year-comparable figures
 * (total dwellings, % needing major repairs, common age buckets). Manitoba &
 * Saskatchewan include every municipality (CSD); other provinces are
 * province-level only. Source data produced by r/07.
 */

// Common age buckets for the comparison view — each census's own bands rolled
// up to a shared set so 2021 and 2016 line up despite different banding.
const COMMON_AGE = ['Pre-1961', '1961–1980', '1981–1990', '1991–2000', '2001–2010', '2011 or later'];
const ROLLUP = {
  '2021': [[0, 1, 2], [3, 4], [5], [6, 7], [8, 9], [10, 11]],  // 12 bands → 6
  '2016': [[0], [1], [2], [3], [4, 5], [6]],                   // 7 bands → 6
};

export async function initHousing() {
  const $area = document.getElementById('hsk-area');
  const $tables = document.getElementById('hsk-tables');
  const $headline = document.getElementById('hsk-headline');
  const $view = document.querySelectorAll('input[name="hskView"]');
  if (!$area || !$tables) return;

  const data = await fetch('./data/housing/census_housing.json')
    .then(r => r.ok ? r.json() : null).catch(() => null);
  if (!data || !Array.isArray(data.areas)) {
    $tables.innerHTML = '<p class="text-sm text-red-700">Census housing data not found. Run r/07_scrape_census_housing.R.</p>';
    return;
  }

  const byUid = new Map(data.areas.map(a => [a.uid, a]));
  const fmtN = (v) => v == null ? '**' : Number(v).toLocaleString();
  const fmtP = (v) => v == null ? '—'  : `${v.toFixed(1)}%`;
  const major = (yd) => yd?.condition?.[yd.condition.length - 1];   // last condition cat = major
  const rollAge = (year, age) => ROLLUP[year].map(ix => ix.reduce((s, i) => s + (age?.[i] || 0), 0));

  // Grouped dropdown.
  const pick = (test) => data.areas.filter(test).sort((a, b) => a.name.localeCompare(b.name));
  const country = data.areas.filter(a => a.level === 'country');
  const opt   = (a) => `<option value="${a.uid}">${escapeHtml(a.name)}</option>`;
  const group = (label, arr) => arr.length ? `<optgroup label="${escapeHtml(label)}">${arr.map(opt).join('')}</optgroup>` : '';
  $area.innerHTML =
    country.map(opt).join('') +
    group('Provinces & Territories', pick(a => a.level === 'province')) +
    group('Manitoba municipalities', pick(a => a.level === 'csd' && a.prov === '46')) +
    group('Saskatchewan municipalities', pick(a => a.level === 'csd' && a.prov === '47'));
  $area.value = byUid.has('4611040') ? '4611040' : (country[0]?.uid || $area.options[0]?.value);

  const viewVal = () => [...$view].find(r => r.checked)?.value || '2021';
  let lastTables = [];

  // --- Point-in-time view for one census year --------------------------------
  function renderYear(a, year) {
    const yd = a.census?.[year];
    if (!yd) {
      $headline.innerHTML = `<div class="cmhc-hsk-title">${escapeHtml(a.name)}</div>`;
      $tables.innerHTML = `<p class="text-sm text-neutral-600">No ${year} Census data for this area (boundary change or suppressed).</p>`;
      lastTables = [];
      return;
    }
    const total = yd.total || 0;
    const share = (v) => (total > 0 && v != null) ? (v / total * 100) : null;
    const since = yd.age?.[yd.age.length - 1];   // newest band
    $headline.innerHTML = `
      <div class="cmhc-hsk-title">${escapeHtml(a.name)} — housing stock <span>(${year} Census)</span></div>
      <div class="cmhc-hsk-stats">
        <span><strong>${fmtN(total)}</strong> private dwellings</span>
        <span><strong>${fmtP(share(major(yd)))}</strong> need major repairs</span>
        <span><strong>${fmtP(share(since))}</strong> built ${escapeHtml(data.periodLabels[year].slice(-1)[0] || 'recently')}</span>
      </div>`;

    const ageRows  = data.periodLabels[year].map((lbl, i)    => ({ label: lbl, n: yd.age?.[i],       p: share(yd.age?.[i]) }));
    const condRows = data.conditionLabels[year].map((lbl, i) => ({ label: lbl, n: yd.condition?.[i], p: share(yd.condition?.[i]) }));
    $tables.innerHTML =
      tableHtml('Age — period of construction', ['Category', 'Dwellings', 'Share'], ageRows, total) +
      tableHtml('Condition — repairs needed', ['Category', 'Dwellings', 'Share'], condRows, total);

    const toExport = (suffix, rows) => ({
      title: `${a.name} — ${suffix} (${year})`, columns: ['Dwellings', 'Share'],
      rows: rows.map(r => ({ area: r.label, values: [fmtN(r.n), fmtP(r.p)] }))
              .concat([{ area: 'Total', values: [fmtN(total), '100.0%'] }]),
    });
    lastTables = [toExport('Period of construction', ageRows), toExport('Dwelling condition', condRows)];
  }

  // --- 2021 vs 2016 comparison ----------------------------------------------
  function renderCompare(a) {
    const c21 = a.census?.['2021'], c16 = a.census?.['2016'];
    if (!c21 || !c16) {
      const missing = !c21 ? '2021' : '2016';
      $headline.innerHTML = `<div class="cmhc-hsk-title">${escapeHtml(a.name)} — 2021 vs 2016</div>`;
      $tables.innerHTML = `<p class="text-sm text-neutral-600">Comparison needs both census years; ${missing} data isn't available for this area.</p>`;
      lastTables = [];
      return;
    }
    const t21 = c21.total || 0, t16 = c16.total || 0;
    const mp = (yd, t) => (t > 0 && major(yd) != null) ? major(yd) / t * 100 : null;
    const m21 = mp(c21, t21), m16 = mp(c16, t16);
    const totChg = (t16 > 0) ? (t21 - t16) / t16 * 100 : null;
    const ppChg  = (m21 != null && m16 != null) ? (m21 - m16) : null;
    const fmtDeltaPct = (v) => v == null ? '—' : `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`;
    const fmtDeltaPP  = (v) => v == null ? '—' : `${v >= 0 ? '+' : ''}${v.toFixed(1)} pp`;

    $headline.innerHTML = `
      <div class="cmhc-hsk-title">${escapeHtml(a.name)} — housing stock <span>(2016 → 2021)</span></div>
      <div class="cmhc-hsk-stats">
        <span>Dwellings <strong>${fmtN(t16)} → ${fmtN(t21)}</strong> (${fmtDeltaPct(totChg)})</span>
        <span>Major repairs <strong>${fmtP(m16)} → ${fmtP(m21)}</strong> (${fmtDeltaPP(ppChg)})</span>
      </div>`;

    // Headline metrics table
    const headRows = [
      { area: 'Total private dwellings', values: [fmtN(t16), fmtN(t21), fmtDeltaPct(totChg)] },
      { area: 'Needing major repairs',   values: [`${fmtN(major(c16))} (${fmtP(m16)})`, `${fmtN(major(c21))} (${fmtP(m21)})`, fmtDeltaPP(ppChg)] },
    ];
    // Age buckets (rolled to common set), shown as shares.
    const a21 = rollAge('2021', c21.age), a16 = rollAge('2016', c16.age);
    const ageRows = COMMON_AGE.map((lbl, i) => {
      const s16 = t16 > 0 ? a16[i] / t16 * 100 : null;
      const s21 = t21 > 0 ? a21[i] / t21 * 100 : null;
      return { area: lbl, values: [fmtP(s16), fmtP(s21), fmtDeltaPP(s21 != null && s16 != null ? s21 - s16 : null)] };
    });

    $tables.innerHTML =
      compareTableHtml('Housing stock — 2016 vs 2021', ['', '2016', '2021', 'Change'], headRows) +
      compareTableHtml('Age mix (share of dwellings)', ['Period of construction', '2016', '2021', 'Change'], ageRows);

    lastTables = [
      { title: `${a.name} — housing stock 2016 vs 2021`, columns: ['2016', '2021', 'Change'], rows: headRows },
      { title: `${a.name} — age mix 2016 vs 2021`, columns: ['2016', '2021', 'Change'], rows: ageRows },
    ];
  }

  function tableHtml(title, headers, rows, total) {
    const body = rows.map(r =>
      `<tr><td>${escapeHtml(r.label)}</td><td>${fmtN(r.n)}</td><td>${fmtP(r.p)}</td></tr>`).join('');
    return `<section class="cmhc-table-block">
      <div class="cmhc-table-title">${escapeHtml(title)}</div>
      <table class="cmhc-table"><thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
      <tbody>${body}<tr class="cmhc-table-summary cmhc-table-summary-top"><td>Total</td><td>${fmtN(total)}</td><td>100.0%</td></tr></tbody></table></section>`;
  }
  function compareTableHtml(title, headers, rows) {
    const body = rows.map(r =>
      `<tr><td>${escapeHtml(r.area)}</td>${r.values.map(v => `<td>${v}</td>`).join('')}</tr>`).join('');
    return `<section class="cmhc-table-block">
      <div class="cmhc-table-title">${escapeHtml(title)}</div>
      <table class="cmhc-table"><thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
      <tbody>${body}</tbody></table></section>`;
  }

  function render() {
    const a = byUid.get($area.value);
    if (!a) return;
    const v = viewVal();
    if (v === 'compare') renderCompare(a);
    else renderYear(a, v);
  }

  $area.addEventListener('change', render);
  $view.forEach(r => r.addEventListener('change', render));
  render();

  // --- Exports ---------------------------------------------------------------
  document.getElementById('hsk-download-xlsx')?.addEventListener('click', async () => {
    if (!lastTables.length) return;
    const { exportTablesToExcel } = await import('./excel-export.js');
    await exportTablesToExcel(
      lastTables.map(t => ({ ...t, dwellingSuffix: '' })),
      { filename: `Census_HousingStock_${new Date().toISOString().slice(0, 10)}.xlsx`,
        maxYear: 2021, titleNote: '— Census of Population (StatsCan)' });
  });
  document.getElementById('hsk-copy')?.addEventListener('click', () => {
    const html = lastTables.map(t =>
      `<h4>${escapeHtml(t.title)}</h4>` +
      `<table border="1" cellspacing="0" cellpadding="3"><tr><th></th>${t.columns.map(c => `<th>${c}</th>`).join('')}</tr>` +
      t.rows.map(r => `<tr><td>${escapeHtml(r.area)}</td>${r.values.map(v => `<td>${v}</td>`).join('')}</tr>`).join('') +
      '</table>').join('<br>');
    copyHtml(html);
  });
}

function copyHtml(html) {
  const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  try {
    navigator.clipboard.write([new ClipboardItem({
      'text/html':  new Blob([html], { type: 'text/html' }),
      'text/plain': new Blob([text], { type: 'text/plain' }),
    })]);
  } catch {
    navigator.clipboard?.writeText(text);
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}
