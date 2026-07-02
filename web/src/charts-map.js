/*
 * Rental Charts survey-zone map — the CMHC-geography counterpart of the
 * census-boundary maps. Follows the charts tab's (geoLevel, geoUid) selection:
 * when a survey zone, neighbourhood or surveyed CMA is selected, it shows that
 * CMA's zone (or neighbourhood) polygons as a click-to-select picker — a visual
 * alternative to the opaque zone/neighbourhood name dropdowns. Clicking a
 * polygon drives the same filters state the dropdowns use (filters.setGeo).
 *
 * v1 is a SELECTOR (uniform fill + hover names + selected outline), not a
 * choropleth — per-zone metric shading needs a per-CMA summary file the
 * pipeline doesn't emit yet.
 *
 * Boundaries: adapted from CMHC RMS survey geographies (r/21 build step).
 * A handful of historical year-variant uids have no polygon of their own
 * (their area is on the map under the sibling uid) — those stay selectable
 * via the dropdowns; the map simply shows no selection outline for them.
 */

import { mapCard } from './map.js';
import { cmaGeo, hasCmaGeo } from './geo.js';

const FILL_SELECTABLE = '#bfdbfe';   // light blue — selectable polygon
const LEVEL_NOUN = { zone: 'survey zones', neighbourhood: 'neighbourhoods' };

export function initChartsMap({ geographies, onSelect }) {
  const $host = document.getElementById('charts-map');
  if (!$host) return { render: () => {} };

  const levels = geographies.levels || {};
  const uidSet = (lvl) => new Set((levels[lvl] || []).map(it => String(it.uid)));
  const appUids = { zone: uidSet('zone'), neighbourhood: uidSet('neighbourhood') };
  const cmaName = (code) => (levels.cma || []).find(it => String(it.uid) === String(code))?.name || `CMA ${code}`;

  const map = mapCard($host);
  let token = 0;

  // Which CMA + polygon layer does the current selection imply?
  function target(state) {
    const { geoLevel, geoUid } = state;
    if (geoLevel === 'zone' || geoLevel === 'neighbourhood') {
      return { cma: String(geoUid).split('-')[0], layer: geoLevel };
    }
    if (geoLevel === 'cma') return { cma: String(geoUid), layer: 'zone' };
    return null;                       // province / csd — no zone map
  }

  async function render(state) {
    const t = target(state);
    if (!t || !hasCmaGeo(t.cma)) { map.card.style.display = 'none'; return; }
    const my = ++token;
    const geojson = await cmaGeo(t.cma, t.layer);
    if (my !== token) return;                        // superseded by a newer render
    if (!geojson) { map.card.style.display = 'none'; return; }
    map.card.style.display = '';

    const uids = appUids[t.layer];
    const values = new Map();
    for (const f of geojson.features) {
      const id = String(f.properties.id);
      if (uids.has(id)) values.set(id, { fill: FILL_SELECTABLE, label: `${f.properties.name} — click to view` });
    }
    const noun = LEVEL_NOUN[t.layer];
    map.render({
      geojson,
      values,
      selectedId: state.geoUid,
      onSelect: (id) => onSelect(t.layer, id),
      title: `${cmaName(t.cma)} — ${noun}`,
      sub: `Click a ${noun.replace(/s$/, '')} to load its charts. The dropdowns above stay in sync.`,
      source: 'Boundaries: adapted from CMHC Rental Market Survey geographies; not endorsed by CMHC',
      legend: [],
      filename: `rental_map_${t.cma}_${t.layer}.png`,
    });
  }

  return { render };
}
