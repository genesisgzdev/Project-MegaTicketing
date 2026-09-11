import { describe, expect, it } from 'vitest';
import { paymentIntentIdempotencyKey, toMinorUnits } from '../payments';

describe('Stripe amount conversion', () => {
  it('converts decimal strings without floating point rounding', () => {
    expect(toMinorUnits('12.34', 'usd')).toBe(1234);
    expect(toMinorUnits('850', 'jpy')).toBe(850);
    expect(toMinorUnits('1.234', 'kwd')).toBe(1234);
  });

  it('rejects fractions unsupported by the currency', () => {
    expect(() => toMinorUnits('12.345', 'usd')).toThrow();
  });

  it('scopes Stripe idempotency to the reservation generation', () => {
    const first = paymentIntentIdempotencyKey({
      eventId: 'event', seatId: 'seat', userId: 'user', reservationKey: 'ticket:old-generation',
    });
    const second = paymentIntentIdempotencyKey({
      eventId: 'event', seatId: 'seat', userId: 'user', reservationKey: 'ticket:new-generation',
    });

    expect(first).not.toBe(second);
  });

  it('rejects payment metadata without a reservation generation', () => {
    expect(() => paymentIntentIdempotencyKey({ eventId: 'event', seatId: 'seat', userId: 'user' })).toThrow(/generation/i);
  });
});
