import { FastifyRequest, FastifyReply, FastifyInstance } from 'fastify';
import { ReservationService } from '../services/reservation.service';
import { PubSubService } from '../services/pubsub.service';
import { FraudService } from '../services/fraud.service';
import { z } from 'zod';
import { authenticateUser } from '../auth';

const ReserveSchema = z.object({
  seatId: z.string().uuid(),
  eventId: z.string().uuid(),
  userId: z.string().uuid()
});

/**
 * ReservationController: Manages API lifecycle for seat bookings.
 * Handles reservation logic and downstream event streaming.
 */
export class ReservationController {
  private service: ReservationService;
  private pubsubService: PubSubService;
  private fraudService: FraudService;

  constructor(private app: FastifyInstance) {
    this.service = new ReservationService();
    this.pubsubService = new PubSubService(app.log);
    this.fraudService = new FraudService();
  }

  /**
   * Entry point for seat reservation requests.
   * Ensures atomic locking before initiating the order workflow.
   */
  async handleReservation(request: FastifyRequest, reply: FastifyReply) {
    try {
      const body = ReserveSchema.parse(request.body);

      if (!(await authenticateUser(request, body.userId))) {
        return reply.status(401).send({ status: 'error', message: 'Authentication required' });
      }
      
      // 1. Fraud Detection (Velocity & Pattern Matching)
      const isFraudulent = await this.fraudService.detectFraud(request.ip, body.eventId);
      
      if (isFraudulent) {
        this.app.log.warn({ ip: request.ip, ...body }, 'Security Alert: Suspicious reservation pattern detected');
        return reply.status(403).send({ 
          status: 'error', 
          message: 'Security policy violation: Suspicious activity detected' 
        });
      }

      // 2. Attempt to acquire distributed lock in Redis (production approach)
      const lockToken = await this.service.reserveSeat(body.eventId, body.seatId, body.userId);
      
      if (lockToken) {
        this.app.log.info({ ...body }, 'Seat lock acquired successfully');

        // 3. Stream event to Pub/Sub for asynchronous order processing (fulfillment, payment, etc.)
        // We await this to ensure we log any immediate SDK failures, 
        // though the service itself handles errors internally.
        await this.pubsubService.publishOrderReserved({
          eventId: body.eventId,
          seatId: body.seatId,
          userId: body.userId
        });

        return reply.status(201).send({ 
          status: 'success', 
          data: { 
            reserved: true,
            eventId: body.eventId,
            seatId: body.seatId,
          } 
        });
      }
      
      this.app.log.warn({ ...body }, 'Reservation conflict: Seat already locked');
      return reply.status(409).send({ 
        status: 'error', 
        message: 'The requested seat is currently unavailable or being processed by another user' 
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ status: 'error', message: 'Invalid request data', details: error.errors });
      }
      
      this.app.log.error({ err: error }, 'Unexpected error during reservation lifecycle');
      throw error; // Handled by global error handler
    }
  }
}
