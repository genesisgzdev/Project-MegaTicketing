import Fastify from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import rateLimit from '@fastify/rate-limit';
import { z } from 'zod';
import { config } from './config';
import { lockSeat } from './redis';
import { watchFiles, getSystemHealth } from './game-state';

const server = Fastify({ 
  logger: {
    level: config.NODE_ENV === 'production' ? 'info' : 'debug',
    formatters: {
      level: (label) => ({ severity: label.toUpperCase() })
    }
  } 
});

server.register(cors);
server.register(websocket);

server.setErrorHandler((error, request, reply) => {
  server.log.error({ err: error, request: { method: request.method, url: request.url } });
  
  if (error.validation) {
    return reply.status(400).send({ 
      status: 'error', 
      message: 'Validation failed', 
      details: error.validation 
    });
  }

  if (error instanceof z.ZodError) {
    return reply.status(400).send({
      status: 'error',
      message: 'Data validation error',
      details: error.errors
    });
  }

  reply.status(500).send({ 
    status: 'error', 
    message: 'An unexpected internal error occurred',
    traceId: request.id
  });
});

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
          server.log.info('Security shield engaged');
        }
        if (data.type === 'DEACTIVATE_DEFENSE') {
          defenseActive = false;
          server.log.info('Security shield disengaged');
        }
      } catch (e) {
        server.log.warn('Malformed WebSocket payload');
      }
    });
  });
});

const ReserveSchema = z.object({
  seatId: z.string().uuid(),
  eventId: z.string().uuid(),
  userId: z.string().uuid()
});

server.post('/reserve', async (request, reply) => {
  const body = ReserveSchema.parse(request.body);
  const success = await lockSeat(body.eventId, body.seatId, body.userId);
  
  if (success) {
    broadcast({ type: 'SEAT_LOCKED', seatId: body.seatId, eventId: body.eventId });
    return { status: 'success', data: { reserved: true } };
  }
  
  return reply.status(409).send({ 
    status: 'error', 
    message: 'The requested seat is currently unavailable' 
  });
});

server.get('/health', async () => {
  return await getSystemHealth();
});

const start = async () => {
  try {
    await server.listen({ port: config.PORT, host: '0.0.0.0' });
    server.log.info(`API server initialized on port ${config.PORT}`);
  } catch (err) {
    server.log.fatal(err);
    process.exit(1);
  }
};

start();
