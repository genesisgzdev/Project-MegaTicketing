import { lockSeat, releaseSeat } from '../redis';
import { db } from '../db';
import { config } from '../config';
import { Prisma } from '@mega-ticketing/database';

/**
 * ReservationService: Encapsulates logic for seat availability and locking.
 */
export class ReservationService {
  /**
   * Attempts to reserve a seat using distributed locking.
   */
  async reserveSeat(eventId: string, seatId: string, userId: string): Promise<string | null> {
    const lockToken = await lockSeat(eventId, seatId, userId);
    if (!lockToken) return null;

    try {
      await db.$transaction(async (transaction) => {
        const expiredBefore = new Date(Date.now() - config.SEAT_LOCK_TTL_MS);
        const expiredSeat = await transaction.seat.findFirst({
          where: { id: seatId, eventId, isLocked: true, lockedAt: { lt: expiredBefore } },
          select: { id: true, ticket: { select: { status: true } } },
        });
        if (expiredSeat?.ticket?.status === 'PAID') {
          throw new ReservationConflictError('Seat has already been sold');
        }
        if (expiredSeat) {
          await transaction.ticket.updateMany({
            where: { seatId, status: 'LOCKED' },
            data: { status: 'CANCELLED' },
          });
          await transaction.seat.updateMany({
            where: { id: seatId, eventId, isLocked: true, lockedAt: { lt: expiredBefore } },
            data: { isLocked: false, lockedAt: null },
          });
        }

        const user = await transaction.user.findUnique({ where: { id: userId } });
        const seat = await transaction.seat.findFirst({ where: { id: seatId, eventId } });
        if (!user || !seat) throw new ReservationConflictError('User or seat does not exist');

        const updated = await transaction.seat.updateMany({
          where: { id: seatId, eventId, isLocked: false },
          data: { isLocked: true, lockedAt: new Date() },
        });
        if (updated.count !== 1) throw new ReservationConflictError('Seat is already reserved');

        const existingTicket = await transaction.ticket.findUnique({ where: { seatId } });
        if (existingTicket) {
          if (existingTicket.status === 'PAID') {
            throw new ReservationConflictError('Seat has already been sold');
          }
          await transaction.ticket.update({
            where: { seatId },
            data: { userId, status: 'LOCKED', createdAt: new Date() },
          });
        } else {
          await transaction.ticket.create({ data: { userId, seatId, status: 'LOCKED' } });
        }

        await transaction.outboxEvent.create({
          data: {
            type: 'ticket.reserved',
            aggregateId: seatId,
            payload: { eventId, seatId, userId },
          },
        });
      });
      return lockToken;
    } catch (error) {
      await releaseSeat(eventId, seatId, lockToken);
      if (error instanceof ReservationConflictError) return null;
      throw error;
    }
  }

  /**
   * Marks a reserved ticket as PAID after webhook confirmation.
   */
  async markAsPaid(eventId: string, seatId: string): Promise<void> {
    await this.confirmReservation(eventId, seatId, `manual:${eventId}:${seatId}`);
  }

  async confirmReservation(
    eventId: string,
    seatId: string,
    eventIdempotencyKey: string,
    payment?: { id?: string; amountMinor?: number; currency?: string },
  ): Promise<'paid' | 'duplicate' | 'expired'> {
    return db.$transaction(async (transaction) => {
      let outcome: 'paid' | 'duplicate' | 'expired' = 'paid';
      try {
        await transaction.processedWebhookEvent.create({ data: { id: eventIdempotencyKey } });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return 'duplicate';
        throw error;
      }

      const ticket = await transaction.ticket.findFirst({
        where: { seatId, seat: { eventId } },
        select: {
          id: true,
          status: true,
          paymentIntentId: true,
          paymentAmountMinor: true,
          paymentCurrency: true,
          seat: { select: { lockedAt: true } },
        },
      });
      if (!ticket) return 'expired';
      // Stripe may deliver checkout.session.completed and payment_intent.succeeded
      // for the same payment. A settled ticket is not an expired reservation.
      if (ticket.status === 'PAID') return 'duplicate';
      if (ticket.status !== 'LOCKED') return 'expired';
      if (payment?.id) {
        // Stripe can deliver the webhook immediately after creating the
        // PaymentIntent, before the local binding UPDATE commits. Never let
        // a NULL or partial binding turn that race into a paid ticket.
        if (ticket.paymentIntentId !== payment.id || ticket.paymentAmountMinor === null || !ticket.paymentCurrency) {
          throw new Error('PaymentIntent binding is missing or does not belong to the reservation');
        }
        if (payment.amountMinor !== undefined && ticket.paymentAmountMinor !== payment.amountMinor) {
          throw new Error('Payment amount does not match the reservation');
        }
        if (payment.currency && ticket.paymentCurrency !== payment.currency.toLowerCase()) {
          throw new Error('Payment currency does not match the reservation');
        }
      }
      const expiredBefore = new Date(Date.now() - config.SEAT_LOCK_TTL_MS);
      if (!ticket.seat.lockedAt || ticket.seat.lockedAt <= expiredBefore) {
        await transaction.ticket.update({
          where: { id: ticket.id },
          data: { status: 'CANCELLED' },
        });
        await transaction.seat.updateMany({
          where: { id: seatId, isLocked: true },
          data: { isLocked: false, lockedAt: null },
        });
        return 'expired';
      }
      await transaction.ticket.update({
        where: { id: ticket.id },
        data: { status: 'PAID', paidAt: new Date() },
      });
      return outcome;
    });
  }

  async isEventProcessed(eventIdempotencyKey: string): Promise<boolean> {
    const event = await db.processedWebhookEvent.findUnique({ where: { id: eventIdempotencyKey } });
    return event !== null;
  }

  async findPendingRefund(eventId: string, seatId: string, paymentIntentId: string): Promise<{ id: string } | null> {
    return db.ticket.findFirst({
      where: {
        seatId,
        paymentIntentId,
        refundId: null,
        status: 'CANCELLED',
        seat: { eventId },
      },
      select: { id: true },
    });
  }

  async markRefundCompleted(ticketId: string, refundId: string): Promise<void> {
    await db.ticket.updateMany({
      where: { id: ticketId, status: 'CANCELLED', refundId: null },
      data: { refundId },
    });
  }
}

export class ReservationConflictError extends Error {}
