import { FastifyRequest, FastifyReply, FastifyInstance } from 'fastify';
import stripe from '../payments';
import { ReservationService } from '../services/reservation.service';
import { config } from '../config';

/**
 * WebhookController: Handles Stripe webhook events with signature validation.
 */
export class WebhookController {
  private reservationService: ReservationService;

  constructor(private app: FastifyInstance) {
    this.reservationService = new ReservationService();
  }

  /**
   * Processes Stripe webhook notifications.
   */
  async handleStripeWebhook(request: FastifyRequest, reply: FastifyReply) {
    const sig = request.headers['stripe-signature'] as string;
    let event;

    try {
      // Signature validation using raw body
      event = stripe.webhooks.constructEvent(
        request.body as Buffer,
        sig,
        config.STRIPE_WEBHOOK_SECRET || ''
      );
    } catch (err: unknown) {
      this.app.log.error(`Webhook Signature Error: ${err.message}`);
      return reply.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle specific event types
    if (event.type === 'payment_intent.succeeded') {
      const paymentIntent = event.data.object as import('stripe').Stripe.PaymentIntent;
      const { eventId, seatId } = paymentIntent.metadata;

      if (eventId && seatId) {
        this.app.log.info(`Payment succeeded for event ${eventId}, seat ${seatId}`);
        await this.reservationService.markAsPaid(eventId, seatId);
      }
    }

    return reply.status(200).send({ received: true });
  }
}


