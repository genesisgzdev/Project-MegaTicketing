import Fastify from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import rateLimit from '@fastify/rate-limit';
import { config } from './config';
import { ReservationController } from './controllers/ReservationController';
import { SecurityController } from './controllers/SecurityController';
import { HealthController } from './controllers/HealthController';

/**
 * MegaTicketing API Bootstrapper.
 * Orchestrates the industrial-grade Fastify server with security hardening.
 */
const server = Fastify({ 
  logger: {
    level: config.NODE_ENV === 'production' ? 'info' : 'debug',
    formatters: {
      level: (label) => ({ severity: label.toUpperCase() })
    }
  } 
});

// Initialization of core plugins
server.register(cors);
server.register(websocket);

/**
 * Global Error Lifecycle Management.
 * Prevents information leakage and standardizes responses.
 */
server.setErrorHandler((error, request, reply) => {
  server.log.error({ err: error, request: { method: request.method, url: request.url } });
  
  if (error.validation) {
    return reply.status(400).send({ status: 'error', code: 'VAL_001', details: error.validation });
  }

  reply.status(500).send({ status: 'error', code: 'INT_500', traceId: request.id });
});

// Security Shield Configuration
let defenseActive = false;
server.register(rateLimit, {
  max: 100,
  timeWindow: '1 minute',
  skip: () => !defenseActive
} as any);

/**
 * Route Registration - Decoupled Architecture.
 */
server.register(async (app) => {
  const reservationController = new ReservationController(app);
  const healthController = new HealthController();
  const securityController = new SecurityController(app, (status) => {
    defenseActive = status;
  });

  // REST Endpoints
  app.post('/reserve', (req, rep) => reservationController.handleReservation(req, rep));
  app.get('/health', (req, rep) => healthController.getHealth(req, rep));

  // Real-time Event Hub
  app.get('/ws', { websocket: true }, (connection) => {
    securityController.handleConnection(connection);
  });
});

/**
 * Start the industrial server.
 */
const start = async () => {
  try {
    await server.listen({ port: config.PORT, host: '0.0.0.0' });
    server.log.info(`MegaTicketing API fully operational on port ${config.PORT}`);
  } catch (err) {
    server.log.fatal('Fatal system initialization failure', err);
    process.exit(1);
  }
};

start();
