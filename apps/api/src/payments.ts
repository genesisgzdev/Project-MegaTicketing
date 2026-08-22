import Stripe from 'stripe';
import { config } from './config';

// Handle Stripe constructor in ESM environment using validated config
const stripe = new Stripe(config.STRIPE_SECRET_KEY, {
  apiVersion: '2026-03-25.dahlia',
});

const ZERO_DECIMAL_CURRENCIES = new Set(['bif', 'clp', 'djf', 'gnf', 'jpy', 'kmf', 'krw', 'mga', 'pyg', 'rwf', 'ugx', 'vnd', 'vuv', 'xaf', 'xof', 'xpf']);
const THREE_DECIMAL_CURRENCIES = new Set(['bhd', 'jod', 'kwd', 'omr', 'tnd']);

export function toMinorUnits(amount: string | number, currency: string): number {
  const exponent = ZERO_DECIMAL_CURRENCIES.has(currency) ? 0 : THREE_DECIMAL_CURRENCIES.has(currency) ? 3 : 2;
  const text = String(amount).trim();
  if (!/^\d+(?:\.\d+)?$/.test(text)) throw new Error('Amount must be a non-negative decimal');
  const [whole, fraction = ''] = text.split('.');
  if (fraction.length > exponent && /[1-9]/.test(fraction.slice(exponent))) {
    throw new Error(`Amount has more fractional units than ${currency} supports`);
  }
  const minor = BigInt(whole) * (10n ** BigInt(exponent)) + BigInt((fraction + '0'.repeat(exponent)).slice(0, exponent) || '0');
  if (minor > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('Amount exceeds Stripe safe integer range');
  return Number(minor);
}

export function paymentIntentIdempotencyKey(ticketId: string): string {
  return `pay_ticket_${ticketId}`;
}

export const createPaymentIntent = async (amount: string | number, currency: string = 'usd', metadata: Record<string, string>) => {
  try {
    const ticketId = metadata.ticketId;
    if (!ticketId) throw new Error('Payment metadata must include ticketId');

    const paymentIntent = await stripe.paymentIntents.create({
      amount: toMinorUnits(amount, currency),
      currency,
      metadata,
      automatic_payment_methods: {
        enabled: true,
      },
    }, {
      idempotencyKey: paymentIntentIdempotencyKey(ticketId)
    });
    
    return paymentIntent;
  } catch (error) {
    // Error logic should be handled by the global Fastify error handler
    throw error;
  }
};

export default stripe;
