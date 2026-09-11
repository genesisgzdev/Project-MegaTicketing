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

import { EventEmitter } from 'node:events';
import { waitForRedisReady } from '../redis';
import type Redis from 'ioredis';
it('waits for actual readiness and removes startup listeners', async () => {
  const client = Object.assign(new EventEmitter(), { status: 'connecting' });
  let completed = false;
  const waiting = waitForRedisReady(client as unknown as Redis).then(() => { completed = true; });
  await Promise.resolve();
  expect(completed).toBe(false);
  client.status = 'ready'; client.emit('ready');
  await waiting;
  expect(completed).toBe(true);
  expect(client.listenerCount('end')).toBe(0);
});
it('bounds startup waiting when the connection never becomes ready', async () => {
  const client = Object.assign(new EventEmitter(), { status: 'connecting' });
  await expect(waitForRedisReady(client as unknown as Redis, 5)).rejects.toThrow(/timeout/);
  expect(client.listenerCount('ready')).toBe(0);
});
