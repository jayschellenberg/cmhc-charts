/*
 * Province boundary loader for the map views. Fetches the per-province GeoJSON
 * (mb/sk/ab/bc × csd/cd) on demand and caches it, so a tab only downloads the
 * geometry for the province the user is actually looking at. Files are built by
 * r/20_build_boundaries.R from StatCan 2021 cartographic boundary files; feature
 * ids are the real CSDUID / CDUID codes that join directly to the census data.
 */

const SLUG = { '46': 'mb', '47': 'sk', '48': 'ab', '59': 'bc' };
const cache = new Map();   // `${slug}_${level}` -> Promise<FeatureCollection|null>

/** True if a boundary file exists for this province (SGC code). */
export function hasProvinceGeo(prov) {
  return Object.prototype.hasOwnProperty.call(SLUG, String(prov));
}

/** Fetch (and cache) the boundary FeatureCollection for a province + level. */
export function provinceGeo(prov, level = 'csd') {
  const slug = SLUG[String(prov)];
  if (!slug) return Promise.resolve(null);
  const key = `${slug}_${level}`;
  if (!cache.has(key)) {
    cache.set(key, fetch(`./data/geo/${key}.geojson`)
      .then(r => r.ok ? r.json() : null).catch(() => null));
  }
  return cache.get(key);
}

// CMHC survey-zone / neighbourhood polygons, one file per surveyed CMA
// (built by r/21_build_cmhc_zone_boundaries.R; feature ids join the rental- and
// starts-family GeoUIDs like "602-st-boniface").
const CMHC_CMAS = new Set(['602', '705', '725', '825', '835', '933', '935']);

/** True if CMHC zone/neighbourhood boundary files exist for this CMA code. */
export function hasCmaGeo(cma) {
  return CMHC_CMAS.has(String(cma));
}

/** Fetch (and cache) zone or neighbourhood polygons for one CMA. */
export function cmaGeo(cma, level = 'zone') {
  if (!hasCmaGeo(cma)) return Promise.resolve(null);
  const key = `${level === 'neighbourhood' ? 'nbhd' : 'zones'}_${cma}`;
  if (!cache.has(key)) {
    cache.set(key, fetch(`./data/geo/${key}.geojson`)
      .then(r => r.ok ? r.json() : null).catch(() => null));
  }
  return cache.get(key);
}
