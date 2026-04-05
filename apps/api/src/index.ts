import Fastify from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import rateLimit from '@fastify/rate-limit';
import { z } from 'zod';
import { lockSeat, releaseSeat } from './redis';
import { db } from './db';
import { createPaymentIntent } from './payments';
import { getSystemHealth, watchFiles } from './game-state';

const server = Fastify({ logger: true });

server.register(cors);
server.register(websocket);

// Rate Limiter (The Defense Shield)
let defenseActive = false;
server.register(rateLimit, {
  max: 100,
  timeWindow: '1 minute',
  skip: () => !defenseActive // Only limit if defense is active
});

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
  if (requestCount > 50) { // Threshold for "Boss Battle"
    broadcast({ type: 'ATTACK_STATUS', status: 'ATTACK', intensity: requestCount });
  } else {
    broadcast({ type: 'ATTACK_STATUS', status: 'SECURE' });
  }
  requestCount = 0;
}, 2000);

// Monitor Files
watchFiles((file) => {
  broadcast({ type: 'FILE_CHANGE', file });
  broadcast({ type: 'ERROR_BOUNCE', file }); // Make it bounce on change
});

server.register(async (fastify) => {
  fastify.get('/ws', { websocket: true }, (connection) => {
    connection.socket.on('message', (message) => {
      const data = JSON.parse(message.toString());
      if (data.type === 'ACTIVATE_DEFENSE') {
        defenseActive = true;
        broadcast({ type: 'LOG', message: 'SHIELD ACTIVATED: Rate Limiting Enabled' });
      }
      if (data.type === 'DEACTIVATE_DEFENSE') {
        defenseActive = false;
        broadcast({ type: 'LOG', message: 'SHIELD DEACTIVATED' });
      }
    });
  });
});

server.post('/reserve', async (request, reply) => {
  const { seatId, eventId, userId } = request.body as any;
  const success = await lockSeat(eventId, seatId, userId);
  if (success) broadcast({ type: 'SEAT_LOCKED', seatId, eventId });
  return { success };
});

const start = async () => {
  try {
    await server.listen({ port: 3001, host: '0.0.0.0' });
    console.log('Battle-Ready API running on http://localhost:3001');
  } catch (err) {
    process.exit(1);
  }
};

start();
