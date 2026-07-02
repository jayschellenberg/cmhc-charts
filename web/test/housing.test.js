import { describe, it, expect } from 'vitest';
import { housingMetric, housingMetricLatest } from '../src/housing.js';

// yd = one census year's { total, age[], condition:[ok, major] }.
// ROLLUP['2021'] = [[0,1,2],[3,4],[5],[6,7],[8,9],[10,11]] → pre1961 = bands 0-2.
describe('housingMetric', () => {
  it('major = major / (ok + major) as a percent', () => {
    expect(housingMetric('major', { condition: [900, 100] }, '2021')).toBeCloseTo(10, 6);
  });

  it('total returns the dwelling count', () => {
    expect(housingMetric('total', { total: 1234 }, '2021')).toBe(1234);
  });

  it('pre1961 sums the 2021 rollup first band (age indices 0,1,2)', () => {
    const age = [10, 20, 30, 0, 0, 0, 0, 0, 0, 0, 0, 340]; // total 400, pre-1961 = 60
    expect(housingMetric('pre1961', { age }, '2021')).toBeCloseTo(15, 6);
  });

  it('post2000 sums the 2021 rollup last two bands (age indices 8-11)', () => {
    const age = [0, 0, 0, 0, 0, 0, 0, 0, 25, 25, 25, 25]; // total 100, post-2000 = 100
    expect(housingMetric('post2000', { age }, '2021')).toBeCloseTo(100, 6);
  });

  it('returns null when the metric is suppressed / unavailable', () => {
    expect(housingMetric('major', { condition: [] }, '2021')).toBeNull();
    expect(housingMetric('pre1961', { age: [] }, '2021')).toBeNull();
    expect(housingMetric('total', { total: {} }, '2021')).toBeNull();   // {} = census suppression
    expect(housingMetric('pre1961', { age: [1] }, '2099')).toBeNull();  // no rollup for the year
  });
});

describe('housingMetricLatest', () => {
  it('picks the newest census year that has the metric', () => {
    const area = { census: {
      '2016': { condition: [80, 20] },   // 20%
      '2021': { condition: [90, 10] },   // 10% — newer wins
    } };
    expect(housingMetricLatest(area, 'major')).toBeCloseTo(10, 6);
  });

  it('falls back to an earlier year when the newest lacks the metric', () => {
    const area = { census: {
      '2016': { condition: [80, 20] },
      '2021': { total: 500 },            // no condition array
    } };
    expect(housingMetricLatest(area, 'major')).toBeCloseTo(20, 6);
  });

  it('returns null when no year has the metric', () => {
    expect(housingMetricLatest({ census: { '2021': { total: 5 } } }, 'major')).toBeNull();
    expect(housingMetricLatest({ census: {} }, 'major')).toBeNull();
  });
});
