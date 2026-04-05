import Stripe from 'stripe';

// FIX: Handle Stripe constructor in ESM environment
const stripe = new (Stripe as any)(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder', {
  apiVersion: '2024-11-20.acacia',
});

export const createPaymentIntent = async (amount: number, currency: string = 'usd', metadata: any) => {
  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount * 100, // Stripe uses cents
      currency,
      metadata,
      automatic_payment_methods: {
        enabled: true,
      },
    });
    
    return paymentIntent;
  } catch (error) {
    console.error('Stripe Error:', error);
    throw new Error('Failed to create payment intent');
  }
};

export default stripe;
