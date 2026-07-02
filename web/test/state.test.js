import { describe, it, expect } from 'vitest';
import { encodeState, decodeState } from '../src/state.js';

// The shareable-link contract: a copied URL must restore the exact same view.
describe('URL state encode/decode', () => {
  it('round-trips a full valid state', () => {
    const s = {
      geoLevel: 'zone', geoUid: '602-st-boniface', dwellingType: 'Apartment',
      yearFrom: 2010, yearTo: 2025, breakdown: 'Bedroom Type',
    };
    expect(decodeState('?' + encodeState(s))).toEqual(s);
  });

  it('drops null / empty values on encode', () => {
    expect(encodeState({ geoLevel: 'province', geoUid: '', dwellingType: null }))
      .toBe('gl=province');
  });

  it('rejects invalid enum, out-of-range year, and over-long strings', () => {
    const decoded = decodeState('?gl=galaxy&yf=1500&dw=Mansion&gu=' + 'x'.repeat(90));
    expect(decoded).toEqual({});
  });

  it('ignores unknown params', () => {
    expect(decodeState('?foo=bar&gl=cma')).toEqual({ geoLevel: 'cma' });
  });

  it('handles null / empty / bare "?" input safely', () => {
    expect(decodeState(null)).toEqual({});
    expect(decodeState('')).toEqual({});
    expect(decodeState('?')).toEqual({});
  });

  it('encodeState guards non-object input', () => {
    expect(encodeState(null)).toBe('');
    expect(encodeState(undefined)).toBe('');
  });
});
