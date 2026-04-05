import Stripe from 'stripe';
import { config } from './config';

// Handle Stripe constructor in ESM environment using validated config
const stripe = new (Stripe as any)(config.STRIPE_SECRET_KEY, {
  apiVersion: '2024-11-20.acacia',
});

export const createPaymentIntent = async (amount: number, currency: string = 'usd', metadata: any) => {
  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Ensure integer for cents
      currency,
      metadata,
      automatic_payment_methods: {
        enabled: true,
      },
    });
    
    return paymentIntent;
  } catch (error) {
    // Error logic should be handled by the global Fastify error handler
    throw error;
  }
};

export default stripe;
