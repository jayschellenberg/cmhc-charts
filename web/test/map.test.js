import { describe, it, expect } from 'vitest';
import { quantileChoropleth } from '../src/map.js';

const row = (v, i) => ({ uid: 'u' + i, name: 'N' + i, value: v });

describe('quantileChoropleth', () => {
  it('bins finite values into 5 ramp colours, greys out non-finite', () => {
    const entries = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90].map(row)
      .concat([{ uid: 'x', name: 'X', value: null }]);
    const { values, legend } = quantileChoropleth(entries, {
      label: (v) => `$${v}`, compact: (v) => `${v}`,
    });
    // the 10 finite rows get a fill; the null row does not
    expect(values.size).toBe(10);
    expect(values.has('x')).toBe(false);
    // 5 quantile bins + a "No data" legend row
    expect(legend).toHaveLength(6);
    expect(legend[legend.length - 1].text).toBe('No data');
    // fills come from the blue ramp (≥4 distinct across a spread of values)
    const fills = new Set([...values.values()].map((v) => v.fill));
    expect(fills.size).toBeGreaterThanOrEqual(4);
    // tooltip label uses the caller's formatter
    expect(values.get('u9').label).toBe('N9: $90');
  });

  it('returns only a no-data legend when nothing is finite', () => {
    const { values, legend } = quantileChoropleth(
      [{ uid: 'a', name: 'A', value: null }, { uid: 'b', name: 'B', value: NaN }], {});
    expect(values.size).toBe(0);
    expect(legend).toEqual([{ swatch: '#e5e7eb', text: 'No data' }]);
  });

  it('is monotonic — higher values never get a lighter bin than lower ones', () => {
    const entries = Array.from({ length: 50 }, (_, i) => row(i * 3, i));
    const ramp = ['#dbeafe', '#93c5fd', '#3b82f6', '#1d4ed8', '#1e3a8a'];
    const binOf = (uid) => ramp.indexOf(values.get(uid).fill);
    const { values } = quantileChoropleth(entries, { label: String, compact: String });
    for (let i = 1; i < entries.length; i++) {
      expect(binOf('u' + i)).toBeGreaterThanOrEqual(binOf('u' + (i - 1)));
    }
  });
});
