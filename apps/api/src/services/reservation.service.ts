import { lockSeat, markSeatAsPaid, isEventProcessed, markEventProcessed } from '../redis';

/**
 * ReservationService: Encapsulates logic for seat availability and locking.
 */
export class ReservationService {
  /**
   * Attempts to reserve a seat using distributed locking.
   */
  async reserveSeat(eventId: string, seatId: string, userId: string): Promise<boolean> {
    // Ensure the lock is acquired atomically in Redis
    return Boolean(await lockSeat(eventId, seatId, userId));
  }

  /**
   * Marks a reserved ticket as PAID after webhook confirmation.
   */
  async markAsPaid(eventId: string, seatId: string): Promise<void> {
    await markSeatAsPaid(eventId, seatId);
  }

  async confirmReservation(eventId: string, seatId: string, eventIdempotencyKey: string): Promise<void> {
    await markSeatAsPaid(eventId, seatId);
    await markEventProcessed(eventIdempotencyKey);
  }

  async isEventProcessed(eventIdempotencyKey: string): Promise<boolean> {
    return isEventProcessed(eventIdempotencyKey);
  }
}


