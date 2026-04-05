import Fastify from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import rateLimit from '@fastify/rate-limit';
import { config } from './config';
import { ReservationController } from './controllers/reservation.controller';
import { SecurityController } from './controllers/security.controller';
import { HealthController } from './controllers/health.controller';

/**
 * Industrial API Entrypoint.
 * Architecture: Controller/Service Pattern with High-Availability Redis Locking.
 */
const server = Fastify({ 
  logger: {
    level: config.NODE_ENV === 'production' ? 'info' : 'debug'
  } 
});

server.register(cors);
server.register(websocket);

// Security Shield Configuration
let defenseActive = false;
server.register(rateLimit, {
  max: 100,
  timeWindow: '1 minute',
  skip: () => !defenseActive
} as any);

/**
 * Route Registration - Production Grade Orchestration.
 */
server.register(async (app) => {
  const reservationController = new ReservationController(app);
  const healthController = new HealthController();
  const securityController = new SecurityController(app, (status: boolean) => {
    defenseActive = status;
  });

  // REST Interface
  app.post('/reserve', (req, rep) => reservationController.handleReservation(req, rep));
  app.get('/health', (req, rep) => healthController.getHealth(req, rep));

  // Full-Duplex Real-time Security Hub
  app.get('/ws', { websocket: true }, (connection: any) => {
    securityController.handleConnection(connection);
  });
});

/**
 * Fatal Error Protection Layer.
 */
server.setErrorHandler((error: any, request, reply) => {
  server.log.error(error);
  reply.status(500).send({ status: 'error', code: 'INTERNAL_SERVER_FAULT' });
});

/**
 * Server Lifecycle Management.
 */
const start = async () => {
  try {
    await server.listen({ port: config.PORT, host: '0.0.0.0' });
    console.log(`[DEPLOYED] MegaTicketing API v1.0.0 listening on ${config.PORT}`);
  } catch (err) {
    server.log.fatal(err as any);
    process.exit(1);
  }
};

start();
