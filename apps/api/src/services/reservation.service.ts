import { lockSeat, releaseSeat } from '../redis';
import { db } from '../db';
import { config } from '../config';
import { Prisma } from '@mega-ticketing/database';

type PaymentConfirmation = { id: string; amountMinor: number; currency: string };

/** Serialize every reservation/payment transition on the same PostgreSQL row. */
async function lockInventory(transaction: Prisma.TransactionClient, eventId: string, seatId: string) {
  const rows = await transaction.$queryRaw<Array<{ id: string }>>`
    SELECT "id" FROM "Seat" WHERE "id" = ${seatId} AND "eventId" = ${eventId} FOR UPDATE
  `;
  if (rows.length !== 1) throw new ReservationConflictError('Seat does not exist');
}

async function preservePayment(transaction: Prisma.TransactionClient, ticket: {
  id: string; userId: string; createdAt: Date; paymentIntentId: string | null;
  paymentAmountMinor: number | null; paymentCurrency: string | null; refundId: string | null; status: string;
}, eventId: string, seatId: string) {
  if (!ticket.paymentIntentId || ticket.paymentAmountMinor === null || !ticket.paymentCurrency) return;
  await transaction.paymentAttempt.upsert({
    where: { id: ticket.paymentIntentId },
    create: {
      id: ticket.paymentIntentId, eventId, seatId, userId: ticket.userId, ticketId: ticket.id,
      reservationCreatedAt: ticket.createdAt, amountMinor: ticket.paymentAmountMinor,
      currency: ticket.paymentCurrency, refundId: ticket.refundId,
      status: ticket.refundId ? 'REFUNDED' : ticket.status === 'PAID' ? 'PAID' : ticket.status === 'CANCELLED' ? 'REFUND_PENDING' : 'PENDING',
    },
    update: {},
  });
}

export class ReservationService {
  async reserveSeat(eventId: string, seatId: string, userId: string): Promise<string | null> {
    const token = await lockSeat(eventId, seatId, userId);
    if (!token) return null;
    try {
      await db.$transaction(async (transaction) => {
        await lockInventory(transaction, eventId, seatId);
        const seat = await transaction.seat.findUniqueOrThrow({ where: { id: seatId }, include: { ticket: true } });
        const user = await transaction.user.findUnique({ where: { id: userId } });
        if (!user || seat.ticket?.status === 'PAID') throw new ReservationConflictError('Seat or user unavailable');
        if (seat.isLocked && seat.lockedAt && seat.lockedAt.getTime() > Date.now() - config.SEAT_LOCK_TTL_MS) {
          throw new ReservationConflictError('Seat is already reserved');
        }
        if (seat.ticket) await preservePayment(transaction, seat.ticket, eventId, seatId);
        const now = new Date();
        await transaction.seat.update({ where: { id: seatId }, data: { isLocked: true, lockedAt: now } });
        await transaction.ticket.upsert({
          where: { seatId },
          create: { userId, seatId, status: 'LOCKED' },
          update: {
            userId, status: 'LOCKED', createdAt: now, paymentIntentId: null,
            paymentAmountMinor: null, paymentCurrency: null, paidAt: null, refundId: null,
          },
        });
        await transaction.outboxEvent.create({
          data: { type: 'ticket.reserved', aggregateId: seatId, payload: { eventId, seatId, userId } },
        });
      });
      return token;
    } catch (error) {
      await releaseSeat(eventId, seatId, token);
      if (error instanceof ReservationConflictError) return null;
      throw error;
    }
  }

  async bindPaymentIntent(input: PaymentConfirmation & {
    eventId: string; seatId: string; userId: string; ticketId: string; reservationCreatedAt: Date;
  }): Promise<boolean> {
    return db.$transaction(async (transaction) => {
      await lockInventory(transaction, input.eventId, input.seatId);
      // Preserve every returned intent even when its reservation expired while
      // Stripe was responding. A later successful charge remains refundable.
      await transaction.paymentAttempt.upsert({
        where: { id: input.id },
        create: {
          id: input.id, eventId: input.eventId, seatId: input.seatId, userId: input.userId,
          ticketId: input.ticketId, reservationCreatedAt: input.reservationCreatedAt,
          amountMinor: input.amountMinor, currency: input.currency,
        },
        update: {},
      });
      const bound = await transaction.ticket.updateMany({
        where: {
          id: input.ticketId, userId: input.userId, createdAt: input.reservationCreatedAt, status: 'LOCKED',
          OR: [{ paymentIntentId: null }, { paymentIntentId: input.id }],
          seat: { isLocked: true, lockedAt: { gt: new Date(Date.now() - config.SEAT_LOCK_TTL_MS) } },
        },
        data: { paymentIntentId: input.id, paymentAmountMinor: input.amountMinor, paymentCurrency: input.currency },
      });
      return bound.count === 1;
    });
  }

  async confirmReservation(eventId: string, seatId: string, eventIdempotencyKey: string,
                           payment: PaymentConfirmation): Promise<'paid' | 'duplicate' | 'expired'> {
    if (!payment?.id || !Number.isSafeInteger(payment.amountMinor) || payment.amountMinor <= 0 ||
        !/^[a-z]{3}$/.test(payment.currency)) throw new Error('Payment confirmation is incomplete');
    return db.$transaction(async (transaction) => {
      await lockInventory(transaction, eventId, seatId);
      // ON CONFLICT avoids aborting PostgreSQL's transaction on duplicate events.
      const marker = await transaction.processedWebhookEvent.createMany({ data: [{ id: eventIdempotencyKey }], skipDuplicates: true });
      if (!marker.count) return 'duplicate';
      const ticket = await transaction.ticket.findUnique({ where: { seatId }, include: { seat: true } });
      if (ticket) await preservePayment(transaction, ticket, eventId, seatId);
      const attempt = await transaction.paymentAttempt.findUnique({ where: { id: payment.id } });
      if (!attempt || attempt.eventId !== eventId || attempt.seatId !== seatId) {
        throw new Error('PaymentIntent binding is missing or does not belong to the reservation');
      }
      if (attempt.amountMinor !== payment.amountMinor || attempt.currency !== payment.currency) {
        throw new Error('Payment amount or currency does not match the reservation');
      }
      if (attempt.status === 'PAID' || attempt.status === 'REFUNDED') return 'duplicate';
      const sameReservation = ticket?.id === attempt.ticketId &&
        ticket.createdAt.getTime() === attempt.reservationCreatedAt.getTime() && ticket.paymentIntentId === payment.id;
      const active = sameReservation && ticket.status === 'LOCKED' && ticket.seat.isLocked &&
        ticket.seat.lockedAt && ticket.seat.lockedAt.getTime() > Date.now() - config.SEAT_LOCK_TTL_MS;
      if (!active) {
        await transaction.paymentAttempt.update({ where: { id: attempt.id }, data: { status: 'REFUND_PENDING' } });
        if (sameReservation && ticket.status === 'LOCKED') {
          await transaction.ticket.update({ where: { id: ticket.id }, data: { status: 'CANCELLED' } });
          await transaction.seat.update({ where: { id: seatId }, data: { isLocked: false, lockedAt: null } });
        }
        return 'expired';
      }
      await transaction.ticket.update({ where: { id: ticket.id }, data: { status: 'PAID', paidAt: new Date() } });
      await transaction.paymentAttempt.update({ where: { id: attempt.id }, data: { status: 'PAID' } });
      await transaction.outboxEvent.create({
        data: { type: 'ticket.paid', aggregateId: seatId, payload: { eventId, seatId, userId: ticket.userId, paymentIntentId: payment.id } },
      });
      return 'paid';
    });
  }

  async isEventProcessed(eventId: string): Promise<boolean> {
    return (await db.processedWebhookEvent.findUnique({ where: { id: eventId } })) !== null;
  }

  async findPendingRefund(eventId: string, seatId: string, paymentIntentId: string): Promise<{ id: string } | null> {
    return db.paymentAttempt.findFirst({
      where: { id: paymentIntentId, eventId, seatId, status: 'REFUND_PENDING', refundId: null }, select: { id: true },
    });
  }

  async markRefundCompleted(paymentIntentId: string, refundId: string): Promise<void> {
    await db.$transaction(async (transaction) => {
      await transaction.paymentAttempt.updateMany({
        where: { id: paymentIntentId, status: 'REFUND_PENDING', refundId: null }, data: { status: 'REFUNDED', refundId },
      });
      await transaction.ticket.updateMany({
        where: { paymentIntentId, status: 'CANCELLED', refundId: null }, data: { refundId },
      });
    });
  }
}

export class ReservationConflictError extends Error {}
