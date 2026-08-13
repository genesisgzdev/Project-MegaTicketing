import { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { authenticateUser } from '../auth';
import { db } from '../db';
import { createPaymentIntent } from '../payments';

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
      include: { seat: { select: { price: true, lockedAt: true } } },
    });
    if (!ticket || !ticket.seat.lockedAt || ticket.seat.lockedAt.getTime() <= Date.now() - 30_000) {
      return reply.status(409).send({ status: 'error', message: 'Reservation is missing or expired' });
    }

    const paymentIntent = await createPaymentIntent(Number(ticket.seat.price), input.currency.toLowerCase(), {
      eventId: input.eventId,
      seatId: input.seatId,
      userId: input.userId,
    });
    return reply.status(201).send({
      status: 'success',
      data: { paymentIntentId: paymentIntent.id, clientSecret: paymentIntent.client_secret },
    });
  }
}
