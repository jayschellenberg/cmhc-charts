// Shared geography helpers.
//
// The province label map, the region-name cleaner, and the uid→province helper
// were copy-pasted across census.js, affordability.js and housing.js. This
// module is the single source of truth for them.
//
// NOTE: the province→area <select> cascade (fillProv / fillArea) is intentionally
// NOT shared here. Each tab's cascade is bound to its own data shape (census
// regions vs the affordability area model vs housing clusters), optgroup set,
// and default-selection rules, so a single helper would need so much
// parameterisation it would be less clear than the per-tab versions. Only the
// genuinely identical primitives live here.

// Statistics Canada province PR-code → display name, for the four provinces the
// app covers. Used both as picker labels and in chart titles (previously spelled
// PROV_LABEL in some files and PROV_NAME in others — same object).
export const PROV_LABEL = {
  '46': 'Manitoba',
  '47': 'Saskatchewan',
  '48': 'Alberta',
  '59': 'British Columbia',
};

// Provinces in the app's canonical west-to-east-ish display order.
export const PROV_ORDER = ['46', '47', '48', '59'];

// Province PR code for a uid. Winnipeg virtual geographies ("WPG…") belong to
// Manitoba; every other uid starts with its 2-digit PR code.
export const provOfUid = (uid) =>
  /^WPG/.test(String(uid)) ? '46' : String(uid).slice(0, 2);

// Strip cancensus type codes from region names for display, matching the naming
// appraisers expect:
//   "Manitoba (Man.)"  → "Manitoba"        (PR:  drop the trailing type code)
//   "Winnipeg (B)"     → "Winnipeg (CMA)"  (CMA: (B) census metro area)
//   "Brandon (D)"/"(K)"→ "Brandon (CA)"    (CMA: (D)/(K) census agglomeration)
//   "Division No. 1 (CDR)" → "Division No. 1"  (CD:  drop the type code)
// CSD type codes ("(RM)", "(CY)", "(T)", "(IRI)"…) are KEPT — they distinguish
// same-named municipalities.
export const cleanName = (name, level) => {
  let n = String(name || '').replace(/\s{2,}/g, ' ').trim();
  if (level === 'PR')  n = n.replace(/\s*\([^)]*\)$/, '');
  if (level === 'CMA') n = n.replace(/\s*\(B\)$/, ' (CMA)').replace(/\s*\((D|K)\)$/, ' (CA)');
  if (level === 'CD')  n = n.replace(/\s*\(CDR\)$/, '');
  return n;
};
