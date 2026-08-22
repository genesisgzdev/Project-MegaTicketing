import { describe, expect, it } from 'vitest';
import { decodeStreamPayload } from '../../src/services/pubsub.service';

describe('Redis Stream payload decoding', () => {
  it('decodes the outbox field layout emitted by the publisher', () => {
    expect(decodeStreamPayload([
      'outboxId', 'evt-1',
      'eventType', 'ticket.reserved',
      'aggregateId', 'seat-1',
      'payload', '{"eventId":"event-1","seatId":"seat-1"}',
    ])).toEqual({ eventId: 'event-1', seatId: 'seat-1' });
  });

  it('retains metadata for legacy payload-only messages', () => {
    expect(decodeStreamPayload(['payload', '{"seatId":"seat-1"}']))
      .toEqual({ seatId: 'seat-1' });
  });
});
