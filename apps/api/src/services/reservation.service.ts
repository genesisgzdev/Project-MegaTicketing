import { lockSeat } from '../redis';

/**
 * Service for managing event seat reservations.
 * Handles the logic of acquiring locks and orchestrating notifications.
 */
export class ReservationService {
  /**
   * Attempts to reserve a seat for a user.
   * 
   * @param eventId - The event to reserve a seat for.
   * @param seatId - The specific seat identifier.
   * @param userId - The user making the reservation.
   * @returns A boolean indicating if the reservation was successful.
   */
  async reserveSeat(eventId: string, seatId: string, userId: string): Promise<boolean> {
    // Acquire the exclusive lock in Redis
    return await lockSeat(eventId, seatId, userId);
  }
}
