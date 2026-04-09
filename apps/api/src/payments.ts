import Stripe from 'stripe';
import { config } from './config';

// Handle Stripe constructor in ESM environment using validated config
const stripe = new Stripe(config.STRIPE_SECRET_KEY, {
  apiVersion: '2024-11-20.acacia',
});

export const createPaymentIntent = async (amount: number, currency: string = 'usd', metadata: Record<string, string>) => {
  try {
    // Generate an idempotency key from seat and event
    const idempotencyKey = `pay_${metadata.eventId}_${metadata.seatId}`;

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Ensure integer for cents
      currency,
      metadata,
      automatic_payment_methods: {
        enabled: true,
      },
    }, {
      idempotencyKey
    });
    
    return paymentIntent;
  } catch (error) {
    // Error logic should be handled by the global Fastify error handler
    throw error;
  }
};

export default stripe;


