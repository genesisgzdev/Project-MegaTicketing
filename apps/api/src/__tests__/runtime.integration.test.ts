import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import Fastify from 'fastify';
import { randomUUID } from 'node:crypto';
import { setupRequestContext } from '../request-context';
import { setupIdempotency } from '../idempotency';
import redis, { releaseSeat } from '../redis';
import { db } from '../db';
import { ReservationService } from '../services/reservation.service';
import { PubSubService } from '../services/pubsub.service';
import { config } from '../config';

const integration = process.env.RUN_INTEGRATION === 'true' ? describe : describe.skip;

integration('PostgreSQL and Redis runtime gates', () => {
  const service = new ReservationService();
  const eventId = randomUUID();
  const userId = randomUUID();
  const secondUserId = randomUUID();
  const seatId = randomUUID();
  let lockToken: string | null = null;
  let initialized = false;

  beforeAll(async () => {
    await db.$connect();
    await redis.ping();
    await db.user.create({ data: { id: userId, email: `${userId}@example.test` } });
    await db.user.create({ data: { id: secondUserId, email: `${secondUserId}@example.test` } });
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
    await db.outboxEvent.deleteMany({ where: { aggregateId: seatId } });
    await db.paymentAttempt.deleteMany({ where: { seatId } });
    await db.ticket.deleteMany({ where: { seatId } });
    await db.seat.delete({ where: { id: seatId } });
    await db.event.delete({ where: { id: eventId } });
    await db.user.delete({ where: { id: userId } });
    await db.user.delete({ where: { id: secondUserId } });
    await db.$disconnect();
    await redis.quit();
  });

  it('enforces single-seat reservation with PostgreSQL authority and Redis lock', async () => {
    const attempts = await Promise.all(Array.from({ length: 32 }, () => service.reserveSeat(eventId, seatId, userId)));
    const winners = attempts.filter((token): token is string => token !== null);
    expect(winners).toHaveLength(1);
    lockToken = winners[0];
    // Lose this test seat's Redis lease: PostgreSQL must still reject a
    // competing owner while the persisted reservation remains valid.
    await redis.del(`lock:${eventId}:${seatId}`);
    const afterLeaseLoss = await Promise.all(Array.from({ length: 16 }, () => service.reserveSeat(eventId, seatId, secondUserId)));
    expect(afterLeaseLoss.every(token => token === null)).toBe(true);

    const ticket = await db.ticket.findUnique({ where: { seatId } });
    expect(ticket?.status).toBe('LOCKED');
    expect(await db.outboxEvent.count({ where: { aggregateId: seatId, type: 'ticket.reserved' } })).toBe(1);

    // Stripe may win the race between PaymentIntent creation and the local
    // binding update. A webhook must be retryable, never an implicit sale.
    await expect(service.confirmReservation(eventId, seatId, `binding-race-${randomUUID()}`, {
      id: 'pi_integration', amountMinor: 1000, currency: 'usd',
    })).rejects.toThrow(/binding/i);
    expect((await db.ticket.findUnique({ where: { seatId } }))?.status).toBe('LOCKED');
    await db.ticket.update({
      where: { seatId },
      data: { paymentIntentId: 'pi_integration', paymentAmountMinor: 1000, paymentCurrency: 'usd' },
    });

    expect(await service.confirmReservation(eventId, seatId, `stripe-event-${randomUUID()}`, {
      id: 'pi_integration', amountMinor: 1000, currency: 'usd',
    })).toBe('paid');
    // A second Stripe event for the same payment must not enter the expiry/refund path.
    expect(await service.confirmReservation(eventId, seatId, `stripe-event-${randomUUID()}`, {
      id: 'pi_integration', amountMinor: 1000, currency: 'usd',
    })).toBe('duplicate');
    expect((await db.ticket.findUnique({ where: { seatId } }))?.status).toBe('PAID');
  });

  it('does not recycle a paid seat when its historical lock timestamp is old', async () => {
    if (lockToken) {
      await releaseSeat(eventId, seatId, lockToken);
      lockToken = null;
    }
    await db.seat.update({
      where: { id: seatId },
      data: { lockedAt: new Date(Date.now() - config.SEAT_LOCK_TTL_MS - 1_000) },
    });

    expect(await service.reserveSeat(eventId, seatId, secondUserId)).toBeNull();
    expect((await db.ticket.findUnique({ where: { seatId } }))?.status).toBe('PAID');
    expect((await db.seat.findUnique({ where: { id: seatId } }))?.isLocked).toBe(true);
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
    const reordered = await app.inject({ method: 'POST', url: '/runtime-gate', headers, payload: { value: 1, another: 'same-shape-check' } });
    expect(reordered.statusCode).toBe(409);
    const canonicalKey = `canonical-${randomUUID()}`;
    const canonicalFirst = await app.inject({ method: 'POST', url: '/runtime-gate', headers: { 'idempotency-key': canonicalKey }, payload: { value: 1, another: 'same-shape-check' } });
    const canonicalSecond = await app.inject({ method: 'POST', url: '/runtime-gate', headers: { 'idempotency-key': canonicalKey }, payload: { another: 'same-shape-check', value: 1 } });
    expect(canonicalFirst.statusCode).toBe(200);
    expect(canonicalSecond.headers['idempotent-replayed']).toBe('true');
    await app.close();
  });

  it('cancels an expired lock instead of accepting a late payment webhook', async () => {
    await db.seat.update({
      where: { id: seatId },
      data: { isLocked: true, lockedAt: new Date(Date.now() - config.SEAT_LOCK_TTL_MS - 1_000) },
    });
    await db.ticket.update({
      where: { seatId },
      data: {
        status: 'LOCKED',
        paidAt: null,
        paymentIntentId: 'pi_expired',
        paymentAmountMinor: 1000,
        paymentCurrency: 'usd',
      },
    });

    expect(await service.confirmReservation(eventId, seatId, `late-payment-${randomUUID()}`, {
      id: 'pi_expired', amountMinor: 1000, currency: 'usd',
    })).toBe('expired');
    expect((await db.ticket.findUnique({ where: { seatId } }))?.status).toBe('CANCELLED');
    expect((await db.seat.findUnique({ where: { id: seatId } }))?.isLocked).toBe(false);

    const pendingRefund = await service.findPendingRefund(eventId, seatId, 'pi_expired');
    expect(pendingRefund).toEqual({ id: expect.any(String) });
    await service.markRefundCompleted(pendingRefund!.id, 're_integration');
    expect(await service.findPendingRefund(eventId, seatId, 'pi_expired')).toBeNull();

    // Reusing the same Ticket row for a new buyer must clear the previous
    // Stripe binding. A late webhook for the old intent must not pay the new
    // reservation while its lock is still fresh.
    lockToken = await service.reserveSeat(eventId, seatId, secondUserId);
    expect(lockToken).toEqual(expect.any(String));
    const recycledTicket = await db.ticket.findUnique({ where: { seatId } });
    expect(recycledTicket?.userId).toBe(secondUserId);
    expect(recycledTicket?.paymentIntentId).toBeNull();
    expect(await service.confirmReservation(eventId, seatId, `old-payment-${randomUUID()}`, {
      id: 'pi_expired', amountMinor: 1000, currency: 'usd',
    })).toBe('duplicate');
    expect((await db.ticket.findUnique({ where: { seatId } }))?.status).toBe('LOCKED');
  });
  it('refunds an old unconfirmed payment after the reservation changes owner', async () => {
    const generation = await db.ticket.findUniqueOrThrow({ where: { seatId } });
    expect(await service.bindPaymentIntent({ eventId, seatId, userId: secondUserId,
      ticketId: generation.id, reservationCreatedAt: generation.createdAt,
      id: 'pi_recycled', amountMinor: 1000, currency: 'usd' })).toBe(true);
    // Retrying the same intent within its generation is successful.
    expect(await service.bindPaymentIntent({ eventId, seatId, userId: secondUserId,
      ticketId: generation.id, reservationCreatedAt: generation.createdAt,
      id: 'pi_recycled', amountMinor: 1000, currency: 'usd' })).toBe(true);
    if (lockToken) await releaseSeat(eventId, seatId, lockToken);
    await db.seat.update({ where: { id: seatId }, data: { lockedAt: new Date(Date.now() - config.SEAT_LOCK_TTL_MS - 1000) } });
    lockToken = await service.reserveSeat(eventId, seatId, userId);
    expect(lockToken).toEqual(expect.any(String));
    const deliveryId = `concurrent-${randomUUID()}`;
    const outcomes = await Promise.all([1, 2].map(() => service.confirmReservation(eventId, seatId, deliveryId,
      { id: 'pi_recycled', amountMinor: 1000, currency: 'usd' })));
    expect(outcomes.sort()).toEqual(['duplicate', 'expired']);
    const current = await db.ticket.findUniqueOrThrow({ where: { seatId } });
    expect(current.userId).toBe(userId);
    expect(current.status).toBe('LOCKED');
    expect(current.paymentIntentId).toBeNull();
    expect(await service.findPendingRefund(eventId, seatId, 'pi_recycled')).toEqual({ id: 'pi_recycled' });
  });

  it('publishes durable events while blocking consumption leaves Redis responsive, then stops', async () => {
    const app = Fastify();
    const worker = new PubSubService(app.log);
    await worker.start();
    try {
      const started = Date.now();
      await redis.ping();
      expect(Date.now() - started).toBeLessThan(900);
      await expect.poll(() => db.outboxEvent.count({ where: { aggregateId: seatId, publishedAt: null } }),
        { timeout: 10000 }).toBe(0);
      const rows = await db.outboxEvent.findMany({ where: { aggregateId: seatId } });
      await expect.poll(() => db.processedOrderEvent.count({ where: { id: { in: rows.map(row => row.id) } } }),
        { timeout: 10000 }).toBe(rows.length);
    } finally { await worker.stop(); await app.close(); }
  });

});
