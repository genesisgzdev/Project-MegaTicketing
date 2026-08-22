import { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { authenticateUser } from '../auth';
import { db } from '../db';
import { createPaymentIntent, toMinorUnits } from '../payments';
import { config } from '../config';

const PaymentSchema = z.object({
  eventId: z.string().uuid(),
  seatId: z.string().uuid(),
  userId: z.string().uuid(),
  currency: z.string().regex(/^[a-zA-Z]{3}$/).default('usd'),
});

export class PaymentController {
  async createIntent(request: FastifyRequest, reply: FastifyReply) {
    const parsed = PaymentSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ status: 'error', message: 'Invalid payment data', details: parsed.error.flatten() });
    const input = parsed.data;
    if (!(await authenticateUser(request, input.userId))) return reply.status(401).send({ status: 'error', message: 'Authentication required' });

    const ticket = await db.ticket.findFirst({
      where: { seatId: input.seatId, userId: input.userId, status: 'LOCKED', seat: { eventId: input.eventId } },
      include: { seat: { select: { price: true, currency: true, lockedAt: true } } },
    });
    if (!ticket || !ticket.seat.lockedAt || ticket.seat.lockedAt.getTime() <= Date.now() - config.SEAT_LOCK_TTL_MS) {
      return reply.status(409).send({ status: 'error', message: 'Reservation is missing or expired' });
    }

    const currency = input.currency.toLowerCase();
    if (currency !== ticket.seat.currency.toLowerCase()) {
      return reply.status(400).send({ status: 'error', message: 'The requested currency does not match the seat price currency' });
    }
    const amountMinor = toMinorUnits(ticket.seat.price.toString(), currency);
    const paymentIntent = await createPaymentIntent(ticket.seat.price.toString(), currency, {
      eventId: input.eventId,
      seatId: input.seatId,
      userId: input.userId,
      amountMinor: String(amountMinor),
      currency,
    });
    const binding = await db.ticket.updateMany({
      where: { id: ticket.id, status: 'LOCKED', userId: input.userId },
      data: { paymentIntentId: paymentIntent.id, paymentAmountMinor: amountMinor, paymentCurrency: currency },
    });
    if (binding.count !== 1) {
      // Stripe may win a race with expiry or ticket recycling. Never return a
      // client secret as if it were bound to a local reservation that changed
      // before the conditional UPDATE committed.
      return reply.status(409).send({ status: 'error', message: 'Reservation changed before payment binding completed' });
    }
    return reply.status(201).send({
      status: 'success',
      data: { paymentIntentId: paymentIntent.id, clientSecret: paymentIntent.client_secret },
    });
  }
}
