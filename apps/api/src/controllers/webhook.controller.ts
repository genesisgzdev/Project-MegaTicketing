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

    if (!config.STRIPE_WEBHOOK_SECRET) {
      this.app.log.error('STRIPE_WEBHOOK_SECRET is not configured');
      return reply.status(503).send({ status: 'error', message: 'Webhook processing is not configured' });
    }

    try {
      event = stripe.webhooks.constructEvent(request.body as Buffer, sig, config.STRIPE_WEBHOOK_SECRET);
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

      if (event.type === 'checkout.session.completed' || event.type === 'payment_intent.succeeded') {
        const payment = event.data.object as any;
        const { eventId, seatId } = payment.metadata || {};
        if (!eventId || !seatId) {
          this.app.log.warn({ eventId: event.id }, 'Stripe event missing reservation metadata');
          return reply.status(400).send({ status: 'error', message: 'Payment metadata is incomplete' });
        }
        const outcome = await this.service.confirmReservation(eventId, seatId, event.id);
        if (outcome === 'expired') {
          const paymentIntentId = event.type === 'payment_intent.succeeded'
            ? payment.id
            : payment.payment_intent;
          if (!paymentIntentId) throw new Error('Expired payment has no PaymentIntent id for refund');
          await stripe.refunds.create(
            { payment_intent: paymentIntentId },
            { idempotencyKey: `refund:${event.id}` },
          );
          this.app.log.warn({ eventId: event.id, seatId }, 'Payment arrived after reservation expiry; refund requested');
        }
      }
    } catch (error) {
      await redis.del(idempotencyKey);
      throw error;
    } finally {
      // Processed events are retained by the durable idempotency marker.
      // Failed events must be retryable by Stripe.
    }

    return reply.status(200).send({ received: true });
  }
}
