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
  '2011': [[0], [1], [2], [3], [4, 5], []],                    // 6 bands → 6 (no 2011+ band)
};
// 2006 has only a coarse before/after-1986 age split (no detailed bands), so it
// contributes to the comparable metrics (total dwellings, % major repairs) but
// is left out of the rolled-up age-mix comparison (no ROLLUP entry).
const ALL_YEARS = ['2006', '2011', '2016', '2021'];

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

  // --- Cross-year comparison (whatever years the area has) -------------------
  function renderCompare(a) {
    const years = ALL_YEARS.filter(y => a.census?.[y]);   // ascending: 2011,2016,2021
    if (years.length < 2) {
      $headline.innerHTML = `<div class="cmhc-hsk-title">${escapeHtml(a.name)} — census comparison</div>`;
      $tables.innerHTML = `<p class="text-sm text-neutral-600">Comparison needs at least two census years; this area only has ${years.join(', ') || 'none'}.</p>`;
      lastTables = [];
      return;
    }
    const yd = (y) => a.census[y];
    const tot = (y) => yd(y).total || 0;
    const majPct = (y) => { const t = tot(y), m = major(yd(y)); return (t > 0 && m != null) ? m / t * 100 : null; };
    const first = years[0], last = years[years.length - 1];
    const totChg = tot(first) > 0 ? (tot(last) - tot(first)) / tot(first) * 100 : null;
    const ppChg  = (majPct(last) != null && majPct(first) != null) ? majPct(last) - majPct(first) : null;
    const fmtDeltaPct = (v) => v == null ? '—' : `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`;
    const fmtDeltaPP  = (v) => v == null ? '—' : `${v >= 0 ? '+' : ''}${v.toFixed(1)} pp`;

    $headline.innerHTML = `
      <div class="cmhc-hsk-title">${escapeHtml(a.name)} — housing stock <span>(${first} → ${last})</span></div>
      <div class="cmhc-hsk-stats">
        <span>Dwellings <strong>${fmtN(tot(first))} → ${fmtN(tot(last))}</strong> (${fmtDeltaPct(totChg)})</span>
        <span>Major repairs <strong>${fmtP(majPct(first))} → ${fmtP(majPct(last))}</strong> (${fmtDeltaPP(ppChg)})</span>
      </div>`;

    const headRows = [
      { area: 'Total private dwellings', values: [...years.map(y => fmtN(tot(y))), fmtDeltaPct(totChg)] },
      { area: 'Needing major repairs',   values: [...years.map(y => `${fmtN(major(yd(y)))} (${fmtP(majPct(y))})`), fmtDeltaPP(ppChg)] },
    ];
    const chgCol = `Δ ${first}→${last}`;
    let html = compareTableHtml(`Housing stock — ${years.join(' / ')}`, ['', ...years, chgCol], headRows);
    lastTables = [{ title: `${a.name} — housing stock ${years.join('/')}`, columns: [...years, chgCol], rows: headRows }];

    // Age-mix comparison — only the years with a detailed, roll-up-able age
    // profile (2011/2016/2021); 2006's coarse split is excluded.
    const ageYears = years.filter(y => ROLLUP[y]);
    if (ageYears.length >= 2) {
      const aFirst = ageYears[0], aLast = ageYears[ageYears.length - 1];
      const rolled = Object.fromEntries(ageYears.map(y => [y, rollAge(y, yd(y).age)]));
      const ageRows = COMMON_AGE.map((lbl, i) => {
        const sh = (y) => tot(y) > 0 ? rolled[y][i] / tot(y) * 100 : null;
        return { area: lbl, values: [...ageYears.map(y => fmtP(sh(y))), fmtDeltaPP(sh(aLast) != null && sh(aFirst) != null ? sh(aLast) - sh(aFirst) : null)] };
      });
      const ageChg = `Δ ${aFirst}→${aLast}`;
      html += compareTableHtml('Age mix (share of dwellings)', ['Period of construction', ...ageYears, ageChg], ageRows);
      lastTables.push({ title: `${a.name} — age mix ${ageYears.join('/')}`, columns: [...ageYears, ageChg], rows: ageRows });
    }
    $tables.innerHTML = html;
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
