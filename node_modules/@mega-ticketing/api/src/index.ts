import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import { z } from 'zod';

const server = Fastify({
  logger: true
});

// Plugins
server.register(cors);
server.register(jwt, {
  secret: process.env.JWT_SECRET || 'super-secret-key-for-dev'
});

// Validation Schemas
const ReserveSeatSchema = z.object({
  eventId: z.string().uuid(),
  seatId: z.string(),
  userId: z.string()
});

// Routes
server.get('/health', async () => {
  return { status: 'ok', timestamp: new Date().toISOString() };
});

server.post('/reserve', async (request, reply) => {
  try {
    const data = ReserveSeatSchema.parse(request.body);
    
    // TODO: Implement Redis Distributed Lock here
    // For now, simulated response
    server.log.info(`Reserving seat ${data.seatId} for event ${data.eventId}`);
    
    return {
      success: true,
      message: 'Seat locked for 10 minutes',
      expiresAt: new Date(Date.now() + 10 * 60000).toISOString()
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return reply.status(400).send({ error: 'Validation Failed', details: error.errors });
    }
    return reply.status(500).send({ error: 'Internal Server Error' });
  }
});

const start = async () => {
  try {
    await server.listen({ port: 3001, host: '0.0.0.0' });
    console.log('Backend API running on http://localhost:3001');
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();
