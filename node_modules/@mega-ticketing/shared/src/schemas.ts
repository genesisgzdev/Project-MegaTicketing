import { z } from 'zod';

/**
 * Validates a request to reserve a specific seat at an event.
 * @internal
 */
export const ReserveSeatSchema = z.object({
  /** Unique identifier for the event */
  eventId: z.string().uuid({ message: "Invalid Event ID format" }),
  /** Unique identifier for the seat in the venue */
  seatId: z.string().min(1, { message: "Seat ID is required" }),
  /** Unique identifier for the reserving user */
  userId: z.string().min(1, { message: "User ID is required" })
});

/**
 * Immutable input structure for seat reservation operations.
 */
export type ReserveSeatInput = Readonly<z.infer<typeof ReserveSeatSchema>>;

/**
 * Defines the structure of a ticket record.
 */
export const TicketSchema = z.object({
  /** Unique identifier for the ticket */
  id: z.string().uuid(),
  /** The event this ticket grants access to */
  eventId: z.string().uuid(),
  /** The specific seat assigned to this ticket */
  seatId: z.string(),
  /** The current owner of the ticket */
  ownerId: z.string(),
  /** Operational status of the ticket */
  status: z.enum(['LOCKED', 'PAID', 'CANCELLED']),
  /** ISO 8601 timestamp of ticket creation */
  createdAt: z.string().datetime()
});

/**
 * Immutable entity representing a ticket in the system.
 */
export type Ticket = Readonly<z.infer<typeof TicketSchema>>;
