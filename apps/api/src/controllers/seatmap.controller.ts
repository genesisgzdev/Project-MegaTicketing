import { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { db } from '../db';

const ParamsSchema = z.object({ eventId: z.string().uuid() });

export class SeatmapController {
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
        isLocked: true,
        lockedAt: true,
        ticket: { select: { status: true } },
      },
    });
    const lockExpiry = Date.now() - 30_000;

    return reply.send({
      event,
      seats: seats.map((seat) => ({
        id: seat.id,
        seatNumber: seat.seatNumber,
        price: Number(seat.price),
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
