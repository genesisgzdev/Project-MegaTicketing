import Fastify from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import rateLimit from '@fastify/rate-limit';
import { z } from 'zod';
import { lockSeat, releaseSeat } from './redis';
import { db } from './db';
import { createPaymentIntent } from './payments';
import { getSystemHealth, watchFiles } from './game-state';

const server = Fastify({ 
  logger: {
    level: 'info',
    formatters: {
      level: (label) => ({ level: label.toUpperCase() })
    }
  } 
});

server.register(cors);
server.register(websocket);

// Industrial Error Handler
server.setErrorHandler((error, request, reply) => {
  server.log.error(error);
  if (error.validation) {
    return reply.status(400).send({ error: 'Validation Error', details: error.validation });
  }
  reply.status(500).send({ error: 'Internal Server Error', code: 'INTERNAL_BATTLE_ERROR' });
});

// Rate Limiter
let defenseActive = false;
server.register(rateLimit, {
  max: 100,
  timeWindow: '1 minute',
  skip: () => !defenseActive
} as any);

const broadcast = (data: any) => {
  server.websocketServer.clients.forEach((client) => {
    if (client.readyState === 1) client.send(JSON.stringify(data));
  });
};

// Attack Monitoring logic
let requestCount = 0;
server.addHook('onRequest', async (request, reply) => {
  requestCount++;
});

setInterval(() => {
  if (requestCount > 50) {
    broadcast({ type: 'ATTACK_STATUS', status: 'ATTACK', intensity: requestCount });
  } else {
    broadcast({ type: 'ATTACK_STATUS', status: 'SECURE' });
  }
  requestCount = 0;
}, 2000);

// Watch for file changes (EDR Integration simulation)
watchFiles((file) => {
  broadcast({ type: 'FILE_CHANGE', file });
});

server.register(async (fastify) => {
  fastify.get('/ws', { websocket: true }, (connection) => {
    connection.socket.on('message', (message) => {
      try {
        const data = JSON.parse(message.toString());
        if (data.type === 'ACTIVATE_DEFENSE') {
          defenseActive = true;
          broadcast({ type: 'LOG', message: 'SHIELD ACTIVATED: Rate Limiting Enabled' });
        }
        if (data.type === 'DEACTIVATE_DEFENSE') {
          defenseActive = false;
          broadcast({ type: 'LOG', message: 'SHIELD DEACTIVATED' });
        }
      } catch (e) {
        server.log.warn('Invalid WebSocket message received');
      }
    });
  });
});

const ReserveSchema = z.object({
  seatId: z.string(),
  eventId: z.string(),
  userId: z.string()
});

server.post('/reserve', async (request, reply) => {
  const body = ReserveSchema.parse(request.body);
  const success = await lockSeat(body.eventId, body.seatId, body.userId);
  if (success) {
    broadcast({ type: 'SEAT_LOCKED', seatId: body.seatId, eventId: body.eventId });
    return { success: true };
  }
  return reply.status(409).send({ success: false, error: 'Seat already locked' });
});

server.get('/health', async () => {
  return await getSystemHealth();
});

const start = async () => {
  try {
    await server.listen({ port: 3001, host: '0.0.0.0' });
    console.log('🏟️ MegaTicketing API deployed at http://localhost:3001');
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();
