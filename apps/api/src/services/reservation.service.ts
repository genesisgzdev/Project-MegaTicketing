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
        const expiredSeats = await transaction.seat.findMany({
          where: { id: seatId, eventId, isLocked: true, lockedAt: { lt: expiredBefore } },
          select: { id: true },
        });
        if (expiredSeats.length) {
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

  async confirmReservation(eventId: string, seatId: string, eventIdempotencyKey: string): Promise<void> {
    await db.$transaction(async (transaction) => {
      try {
        await transaction.processedWebhookEvent.create({ data: { id: eventIdempotencyKey } });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return;
        throw error;
      }

      const updated = await transaction.ticket.updateMany({
        where: { seatId, status: 'LOCKED', seat: { eventId } },
        data: { status: 'PAID' },
      });
      if (updated.count !== 1) throw new Error('No locked reservation found for payment confirmation');
    });
  }

  async isEventProcessed(eventIdempotencyKey: string): Promise<boolean> {
    const event = await db.processedWebhookEvent.findUnique({ where: { id: eventIdempotencyKey } });
    return event !== null;
  }
}

export class ReservationConflictError extends Error {}
