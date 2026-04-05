import { z } from 'zod';

export const ReserveSeatSchema = z.object({
  eventId: z.string().uuid({ message: "Invalid Event ID format" }),
  seatId: z.string().min(1, { message: "Seat ID is required" }),
  userId: z.string().min(1, { message: "User ID is required" })
});

export type ReserveSeatInput = z.infer<typeof ReserveSeatSchema>;

export const TicketSchema = z.object({
  id: z.string().uuid(),
  eventId: z.string().uuid(),
  seatId: z.string(),
  ownerId: z.string(),
  status: z.enum(['LOCKED', 'PAID', 'CANCELLED']),
  createdAt: z.string().datetime()
});

export type Ticket = z.infer<typeof TicketSchema>;
