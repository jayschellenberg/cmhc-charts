import { describe, it, expect } from 'vitest';
import { monthlyPayment } from '../src/affordability.js';

describe('monthlyPayment (amortized mortgage payment)', () => {
  it('computes a standard payment ($300k @ 5% over 25y ≈ $1,753.77/mo)', () => {
    expect(Math.round(monthlyPayment(300000, 5, 25))).toBe(1754);
  });

  it('handles a 0% rate as principal / months', () => {
    expect(monthlyPayment(120000, 0, 25)).toBeCloseTo(120000 / 300, 6);
  });

  it('returns null for a non-positive principal', () => {
    expect(monthlyPayment(0, 5, 25)).toBeNull();
    expect(monthlyPayment(-100, 5, 25)).toBeNull();
  });

  it('scales linearly with principal at a fixed rate', () => {
    const one = monthlyPayment(100000, 4.64, 25);
    const two = monthlyPayment(200000, 4.64, 25);
    expect(two).toBeCloseTo(one * 2, 6);
  });
});
