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
import { WebhookController } from './controllers/webhook.controller';
import { setupHealthCheck } from './health-check';
import { db } from './db';
import { setupRequestContext } from './request-context';
import { setupErrorHandler } from './error-handler';
import { SeatmapController } from './controllers/seatmap.controller';
import { PaymentController } from './controllers/payment.controller';
import { setupIdempotency } from './idempotency';

/**
 * API Entrypoint.
 * Architecture: Controller/Service Pattern with Redis Locking.
 */
const server = Fastify({ 
  logger: {
    level: config.NODE_ENV === 'production' ? 'info' : 'debug'
  } 
});

setupRequestContext(server);
setupIdempotency(server, redis);

const allowedOrigins = config.CORS_ORIGINS.split(',').map((origin) => origin.trim()).filter(Boolean);
server.register(cors, { origin: allowedOrigins });
server.register(websocket);

// Prometheus Instrumentation: Metrics exposure at /metrics
server.register(metrics, { endpoint: '/metrics' });

// Rate Limiting Configuration
server.register(rateLimit as any, {
  global: config.NODE_ENV === 'production',
  max: 100,
  timeWindow: '1 minute',
  redis: redis,
  keyGenerator: (req: any) => req.ip
} as any);

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
      const parseError = err as Error & { statusCode?: number };
      parseError.statusCode = 400;
      done(parseError, undefined);
    }
  }
});

/**
 * Route Registration.
 */
server.register(async (app) => {
  const reservationController = new ReservationController(app);
  const webhookController = new WebhookController(app);
  const securityController = new SecurityController(app);
  const seatmapController = new SeatmapController();
  const paymentController = new PaymentController();

  // REST Interface
  app.post('/reserve', (req, rep) => reservationController.handleReservation(req, rep));
  app.get('/events/:eventId/seats', (req, rep) => seatmapController.listSeats(req, rep));
  app.post('/payments/intents', (req, rep) => paymentController.createIntent(req, rep));
  app.post('/webhook', (req, rep) => webhookController.handleStripeWebhook(req, rep));

  // Real-time WebSocket endpoint
  app.get('/ws', { websocket: true }, (connection: { socket: import('ws').WebSocket }, request) => {
    securityController.handleConnection(connection);
  });
});

setupHealthCheck(server, db, redis);

/**
 * Global Error Handler.
 */
setupErrorHandler(server);

/**
 * Server Initialization.
 */
const start = async () => {
  try {
    await server.listen({ port: config.PORT, host: '0.0.0.0' });
    console.log(`MegaTicketing API v2.1.4 listening on ${config.PORT}`);
  } catch (err) {
    server.log.fatal(err as Error);
    process.exit(1);
  }
};

start();
