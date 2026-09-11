import { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { db } from '../db';
import { config } from '../config';

const ParamsSchema = z.object({ eventId: z.string().uuid() });

export class SeatmapController {
  async listEvents(request: FastifyRequest, reply: FastifyReply) {
    const query = z.object({ cursor: z.string().uuid().optional() }).safeParse(request.query);
    if (!query.success) return reply.status(400).send({ message: 'Invalid event cursor' });
    const events = await db.event.findMany({
      where: { date: { gte: new Date() } }, orderBy: [{ date: 'asc' }, { id: 'asc' }], take: 51,
      ...(query.data.cursor ? { cursor: { id: query.data.cursor }, skip: 1 } : {}),
      select: { id: true, title: true, date: true },
    });
    const page = events.slice(0, 50);
    return reply.send({ events: page, nextCursor: events.length > 50 ? page[49].id : null });
  }

  async listSeats(request: FastifyRequest, reply: FastifyReply) {
    const params = ParamsSchema.safeParse(request.params);
    if (!params.success) return reply.status(400).send({ status: 'error', message: 'Invalid event id' });

    const event = await db.event.findUnique({
      where: { id: params.data.eventId },
      select: { id: true, title: true, description: true, date: true },
    });
    if (!event) return reply.status(404).send({ status: 'error', message: 'Event not found' });

    const seats = await db.seat.findMany({
      where: { eventId: event.id },
      orderBy: [{ seatNumber: 'asc' }],
      select: {
        id: true,
        seatNumber: true,
        price: true,
        currency: true,
        isLocked: true,
        lockedAt: true,
        ticket: { select: { status: true } },
      },
    });
    const lockExpiry = Date.now() - config.SEAT_LOCK_TTL_MS;

    return reply.send({
      event,
      seats: seats.map((seat) => ({
        id: seat.id,
        seatNumber: seat.seatNumber,
        price: Number(seat.price),
        currency: seat.currency,
        status: seat.ticket?.status === 'PAID'
          ? 'sold'
          : seat.isLocked && seat.lockedAt && seat.lockedAt.getTime() > lockExpiry
            ? 'held'
            : 'available',
      })),
      generatedAt: new Date().toISOString(),
    });
  }
}
