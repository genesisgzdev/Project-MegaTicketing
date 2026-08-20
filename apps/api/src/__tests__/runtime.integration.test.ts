import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import Fastify from 'fastify';
import { randomUUID } from 'node:crypto';
import { setupRequestContext } from '../request-context';
import { setupIdempotency } from '../idempotency';
import redis, { releaseSeat } from '../redis';
import { db } from '../db';
import { ReservationService } from '../services/reservation.service';

const integration = process.env.RUN_INTEGRATION === 'true' ? describe : describe.skip;

integration('PostgreSQL and Redis runtime gates', () => {
  const service = new ReservationService();
  const eventId = randomUUID();
  const userId = randomUUID();
  const seatId = randomUUID();
  let lockToken: string | null = null;
  let initialized = false;

  beforeAll(async () => {
    await db.$connect();
    await redis.ping();
    await db.user.create({ data: { id: userId, email: `${userId}@example.test` } });
    await db.event.create({ data: { id: eventId, title: 'Integration event', date: new Date(Date.now() + 86_400_000) } });
    await db.seat.create({ data: { id: seatId, eventId, seatNumber: `INT-${seatId.slice(0, 8)}`, price: 10 } });
    initialized = true;
  });

  afterAll(async () => {
    if (!initialized) {
      await db.$disconnect().catch(() => undefined);
      await redis.quit().catch(() => undefined);
      return;
    }
    if (lockToken) await releaseSeat(eventId, seatId, lockToken);
    await db.ticket.deleteMany({ where: { seatId } });
    await db.seat.delete({ where: { id: seatId } });
    await db.event.delete({ where: { id: eventId } });
    await db.user.delete({ where: { id: userId } });
    await db.$disconnect();
    await redis.quit();
  });

  it('enforces single-seat reservation with PostgreSQL authority and Redis lock', async () => {
    lockToken = await service.reserveSeat(eventId, seatId, userId);
    expect(lockToken).toEqual(expect.any(String));
    expect(await service.reserveSeat(eventId, seatId, userId)).toBeNull();

    const ticket = await db.ticket.findUnique({ where: { seatId } });
    expect(ticket?.status).toBe('LOCKED');
  });

  it('replays an idempotent response and does not execute the handler twice', async () => {
    const app = Fastify();
    setupRequestContext(app);
    setupIdempotency(app, redis);
    let executions = 0;
    app.post('/runtime-gate', async () => ({ status: 'ok', execution: ++executions }));
    await app.ready();

    const headers = { 'idempotency-key': `integration-${randomUUID()}` };
    const first = await app.inject({ method: 'POST', url: '/runtime-gate', headers, payload: { value: 1 } });
    const second = await app.inject({ method: 'POST', url: '/runtime-gate', headers, payload: { value: 1 } });

    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(200);
    expect(second.headers['idempotent-replayed']).toBe('true');
    expect(second.json()).toEqual(first.json());
    expect(executions).toBe(1);
    await app.close();
  });
});
