import { describe, expect, it } from 'vitest';
import { toMinorUnits } from '../payments';

describe('Stripe amount conversion', () => {
  it('converts decimal strings without floating point rounding', () => {
    expect(toMinorUnits('12.34', 'usd')).toBe(1234);
    expect(toMinorUnits('850', 'jpy')).toBe(850);
    expect(toMinorUnits('1.234', 'kwd')).toBe(1234);
  });

  it('rejects fractions unsupported by the currency', () => {
    expect(() => toMinorUnits('12.345', 'usd')).toThrow();
  });
});
