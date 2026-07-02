import { describe, it, expect } from 'vitest';
import { PROV_LABEL, PROV_ORDER, provOfUid, cleanName } from '../src/geography.js';

describe('province maps', () => {
  it('labels the four covered provinces', () => {
    expect(PROV_LABEL).toEqual({
      '46': 'Manitoba', '47': 'Saskatchewan', '48': 'Alberta', '59': 'British Columbia',
    });
  });
  it('orders provinces and covers exactly the labelled set', () => {
    expect(PROV_ORDER).toEqual(['46', '47', '48', '59']);
    expect([...PROV_ORDER].sort()).toEqual(Object.keys(PROV_LABEL).sort());
  });
});

describe('provOfUid', () => {
  it('maps Winnipeg virtual geographies to Manitoba', () => {
    expect(provOfUid('WPG_Cluster_12')).toBe('46');
    expect(provOfUid('WPG')).toBe('46');
  });
  it('takes the first two digits of a numeric uid', () => {
    expect(provOfUid('4611040')).toBe('46');
    expect(provOfUid('4706021')).toBe('47');
    expect(provOfUid('5915022')).toBe('59');
  });
  it('coerces non-strings safely', () => {
    expect(provOfUid(4611040)).toBe('46');
  });
});

describe('cleanName', () => {
  it('drops the trailing type code for provinces', () => {
    expect(cleanName('Manitoba (Man.)', 'PR')).toBe('Manitoba');
    expect(cleanName('British Columbia (B.C.)', 'PR')).toBe('British Columbia');
  });
  it('rewrites CMA/CA type codes', () => {
    expect(cleanName('Winnipeg (B)', 'CMA')).toBe('Winnipeg (CMA)');
    expect(cleanName('Brandon (D)', 'CMA')).toBe('Brandon (CA)');
    expect(cleanName('Steinbach (K)', 'CMA')).toBe('Steinbach (CA)');
  });
  it('drops the CDR type code for census divisions', () => {
    expect(cleanName('Division No. 1 (CDR)', 'CD')).toBe('Division No. 1');
  });
  it('keeps CSD type codes (they disambiguate municipalities)', () => {
    expect(cleanName('Springfield (RM)', 'CSD')).toBe('Springfield (RM)');
    expect(cleanName('Victoria (CY)', 'CSD')).toBe('Victoria (CY)');
  });
  it('collapses runs of whitespace and trims', () => {
    expect(cleanName('  Portage  la   Prairie (CY) ', 'CSD')).toBe('Portage la Prairie (CY)');
  });
  it('handles null/undefined names', () => {
    expect(cleanName(null, 'PR')).toBe('');
    expect(cleanName(undefined, 'CSD')).toBe('');
  });
});
