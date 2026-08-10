import { FastifyRequest, FastifyReply, FastifyInstance } from 'fastify';
import { ReservationService } from '../services/reservation.service';
import Stripe from 'stripe';
import redis from '../redis';
import { config } from '../config';

const stripe = new Stripe(config.STRIPE_SECRET_KEY, { apiVersion: '2026-03-25.dahlia' });

export class WebhookController {
  private service: ReservationService;
  constructor(private app: FastifyInstance) { this.service = new ReservationService(); }

  async handleStripeWebhook(request: FastifyRequest, reply: FastifyReply) {
    const sig = request.headers['stripe-signature'] as string;
    let event: any;

    try {
      event = stripe.webhooks.constructEvent(request.body as Buffer, sig, process.env.STRIPE_WEBHOOK_SECRET || '');
    } catch (err: unknown) {
      return reply.status(400).send(`Webhook Error: ${(err as Error).message}`);
    }

    // [SECURITY FIX] Atomic Idempotency Lock via Redis to prevent TOCTOU race conditions
    const idempotencyKey = `webhook:processed:${event.id}`;
    const acquired = await redis.set(idempotencyKey, 'processing', 'PX', 10000, 'NX');
    if (!acquired) {
      this.app.log.warn({ eventId: event.id }, 'Concurrent webhook request detected or already processed');
      return reply.status(200).send({ received: true, status: 'duplicate_blocked' });
    }

    try {
      const isProcessed = await this.service.isEventProcessed(event.id);
      if (isProcessed) return reply.status(200).send({ received: true });

      if (event.type === 'checkout.session.completed') {
        const session = event.data.object as any;
        const { eventId, seatId } = session.metadata || {};
        if (eventId && seatId) await this.service.confirmReservation(eventId, seatId, event.id);
      }
    } finally {
      // Keep the lock for a bit longer than the process to ensure full propagation
      await redis.expire(idempotencyKey, 60); 
    }

    return reply.status(200).send({ received: true });
  }
}
