import { FastifyRequest, FastifyReply, FastifyInstance } from 'fastify';
import { ReservationService } from '../services/reservation.service';
import { z } from 'zod';
import Stripe from 'stripe';
import { config } from '../config';

const stripe = new Stripe(config.STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' });

/**
 * Enterprise Webhook Controller.
 * Implements cryptographic signature verification and database idempotency.
 */
export class WebhookController {
  private service: ReservationService;

  constructor(private app: FastifyInstance) {
    this.service = new ReservationService();
  }

  async handleStripeWebhook(request: FastifyRequest, reply: FastifyReply) {
    const sig = request.headers['stripe-signature'] as string;
    let event: Stripe.Event;

    try {
      // Robust Signature Verification (Requires raw body buffer)
      event = stripe.webhooks.constructEvent(
        request.body as Buffer,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET || ''
      );
    } catch (err: unknown) {
      this.app.log.error({ err }, 'Invalid Stripe signature');
      return reply.status(400).send(`Webhook Error: ${(err as Error).message}`);
    }

    // IDEMPOTENCY CHECK: Ensure we haven't processed this event ID before
    const isProcessed = await this.service.isEventProcessed(event.id);
    if (isProcessed) {
      this.app.log.info({ eventId: event.id }, 'Event already processed, skipping');
      return reply.status(200).send({ received: true, duplicated: true });
    }

    this.app.log.info({ type: event.type, id: event.id }, 'Processing Stripe Webhook');

    switch (event.type) {
      case 'checkout.session.completed':
        const session = event.data.object as Stripe.Checkout.Session;
        const { eventId, seatId } = session.metadata || {};
        
        if (eventId && seatId) {
          await this.service.confirmReservation(eventId, seatId, event.id);
          this.app.log.info({ eventId, seatId }, 'Reservation confirmed via Webhook');
        }
        break;

      default:
        this.app.log.debug(`Unhandled event type ${event.type}`);
    }

    return reply.status(200).send({ received: true });
  }
}
