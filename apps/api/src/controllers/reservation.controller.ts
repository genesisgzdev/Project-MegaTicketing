import { FastifyRequest, FastifyReply, FastifyInstance } from 'fastify';
import { ReservationService } from '../services/reservation.service';
import { z } from 'zod';

const ReserveSchema = z.object({
  seatId: z.string().uuid(),
  eventId: z.string().uuid(),
  userId: z.string().uuid()
});

/**
 * ReservationController: Orchestrates the API lifecycle for seat bookings.
 */
export class ReservationController {
  private service: ReservationService;

  constructor(private app: FastifyInstance) {
    this.service = new ReservationService();
  }

  /**
   * Entry point for seat reservation requests.
   */
  async handleReservation(request: FastifyRequest, reply: FastifyReply) {
    try {
      const body = ReserveSchema.parse(request.body);
      const success = await this.service.reserveSeat(body.eventId, body.seatId, body.userId);
      
      if (success) {
        // Broadcast via the app's websocket server if needed
        return reply.status(201).send({ status: 'success', data: { reserved: true } });
      }
      
      return reply.status(409).send({ 
        status: 'error', 
        message: 'The requested seat is currently unavailable' 
      });
    } catch (error) {
      throw error; // Handled by global error handler
    }
  }
}
