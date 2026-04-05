import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { ReservationService } from '../services/reservation.service';

/**
 * Validates the body for the reserve seat route.
 * Replaces the local schema in index.ts for better organization.
 */
const ReserveSchema = z.object({
  seatId: z.string().uuid(),
  eventId: z.string().uuid(),
  userId: z.string().uuid()
});

/**
 * Controller responsible for handling reservation-related HTTP requests.
 */
export class ReservationController {
  constructor(
    private reservationService: ReservationService,
    private broadcast: (data: any) => void
  ) {}

  /**
   * Registers reservation routes with the Fastify instance.
   * 
   * @param fastify - The server instance to register routes on.
   */
  registerRoutes(fastify: FastifyInstance): void {
    fastify.post('/reserve', this.handleReserve.bind(this));
  }

  /**
   * Handles incoming POST requests to reserve a specific seat.
   * Performs validation and orchestrates the reservation process.
   * 
   * @param request - Fastify request object containing reservation details.
   * @param reply - Fastify reply object for sending the result.
   */
  private async handleReserve(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const body = ReserveSchema.parse(request.body);
    const success = await this.reservationService.reserveSeat(body.eventId, body.seatId, body.userId);
    
    if (success) {
      this.broadcast({ type: 'SEAT_LOCKED', seatId: body.seatId, eventId: body.eventId });
      return reply.send({ status: 'success', data: { reserved: true } });
    }
    
    return reply.status(409).send({ 
      status: 'error', 
      message: 'The requested seat is currently unavailable' 
    });
  }
}
