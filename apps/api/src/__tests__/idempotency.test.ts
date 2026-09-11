import { describe, expect, it } from 'vitest';
import { createIdempotencyFingerprint } from '../idempotency';

describe('idempotency request scope', () => {
  it('canonicalizes body key order for the same bearer', () => {
    const first = createIdempotencyFingerprint('POST', '/reserve', { seatId: 'a', eventId: 'b' }, 'Bearer token-a');
    const second = createIdempotencyFingerprint('POST', '/reserve', { eventId: 'b', seatId: 'a' }, 'Bearer token-a');

    expect(second).toBe(first);
  });

  it('does not share a cached response across bearer identities', () => {
    const first = createIdempotencyFingerprint('POST', '/reserve', { seatId: 'a', eventId: 'b' }, 'Bearer token-a');
    const second = createIdempotencyFingerprint('POST', '/reserve', { seatId: 'a', eventId: 'b' }, 'Bearer token-b');

    expect(second).not.toBe(first);
  });
});
