import { lockSeat, markSeatAsPaid } from '../redis';

/**
 * ReservationService: Encapsulates industrial logic for seat availability and locking.
 */
export class ReservationService {
  /**
   * Attempts to reserve a seat using distributed locking.
   */
  async reserveSeat(eventId: string, seatId: string, userId: string): Promise<boolean> {
    // Industrial check: Ensure the lock is acquired atomically in Redis
    return await lockSeat(eventId, seatId, userId);
  }

  /**
   * Marks a reserved ticket as PAID after webhook confirmation.
   */
  async markAsPaid(eventId: string, seatId: string): Promise<void> {
    await markSeatAsPaid(eventId, seatId);
  }
}
