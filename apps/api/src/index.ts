import './tracing';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import rateLimit from '@fastify/rate-limit';
import metrics from 'fastify-metrics';
import { config } from './config';
import redis from './redis';
import { ReservationController } from './controllers/reservation.controller';
import { SecurityController } from './controllers/security.controller';
import { HealthController } from './controllers/health.controller';
import { WebhookController } from './controllers/webhook.controller';

/**
 * API Entrypoint.
 * Architecture: Controller/Service Pattern with Redis Locking.
 */
const server = Fastify({ 
  logger: {
    level: config.NODE_ENV === 'production' ? 'info' : 'debug'
  } 
});

server.register(cors);
server.register(websocket);

// Prometheus Instrumentation: Metrics exposure at /metrics
server.register(metrics, { endpoint: '/metrics' });

// Rate Limiting Configuration
let defenseActive = false;
server.register(rateLimit, {
  max: 100,
  timeWindow: '1 minute',
  skip: () => !defenseActive,
  redis: redis,
  keyGenerator: (req) => req.ip
});

/**
 * Stripe Webhook Raw Body Parser.
 * Required for signature validation.
 */
server.addContentTypeParser('application/json', { parseAs: 'buffer' }, (req, body, done) => {
  if (req.url === '/webhook') {
    done(null, body);
  } else {
    try {
      const json = JSON.parse(body.toString());
      done(null, json);
    } catch (err: unknown) {
      err.statusCode = 400;
      done(err, undefined);
    }
  }
});

/**
 * Route Registration.
 */
server.register(async (app) => {
  const reservationController = new ReservationController(app);
  const healthController = new HealthController();
  const webhookController = new WebhookController(app);
  const securityController = new SecurityController(app, (status: boolean) => {
    defenseActive = status;
  });

  // REST Interface
  app.post('/reserve', (req, rep) => reservationController.handleReservation(req, rep));
  app.get('/health', (req, rep) => healthController.getHealth(req, rep));
  app.post('/webhook', (req, rep) => webhookController.handleStripeWebhook(req, rep));

  // Real-time WebSocket endpoint
  app.get('/ws', { websocket: true }, (connection: import('@fastify/websocket').SocketStream) => {
    securityController.handleConnection(connection);
  });
});

/**
 * Global Error Handler.
 */
server.setErrorHandler((error: import('fastify').FastifyError, request, reply) => {
  server.log.error(error);
  reply.status(500).send({ status: 'error', code: 'INTERNAL_SERVER_FAULT' });
});

/**
 * Server Initialization.
 */
const start = async () => {
  try {
    await server.listen({ port: config.PORT, host: '0.0.0.0' });
    console.log(`MegaTicketing API v1.0.0 listening on ${config.PORT}`);
  } catch (err) {
    server.log.fatal(err as Error);
    process.exit(1);
  }
};

start();



