import { FastifyInstance } from 'fastify';
import { Redis } from 'ioredis';
import { PrismaClient } from '@prisma/client';
import { logger } from './logger';

const SHUTDOWN_TIMEOUT = 30000; // 30 seconds

export function setupGracefulShutdown(
  app: FastifyInstance,
  db: PrismaClient,
  redis: Redis,
) {
  const signals = ['SIGTERM', 'SIGINT'];

  signals.forEach((signal) => {
    process.on(signal, async () => {
      logger.info(`Received ${signal}, starting graceful shutdown...`);

      const shutdownTimer = setTimeout(() => {
        logger.error('Shutdown timeout exceeded, forcing exit');
        process.exit(1);
      }, SHUTDOWN_TIMEOUT);

      try {
        // Stop accepting new connections
        await app.close();
        logger.info('Fastify instance closed');

        // Close database connection
        await db.$disconnect();
        logger.info('Database disconnected');

        // Close Redis connection
        redis.disconnect();
        logger.info('Redis disconnected');

        clearTimeout(shutdownTimer);
        logger.info('Graceful shutdown completed');
        process.exit(0);
      } catch (error) {
        clearTimeout(shutdownTimer);
        logger.error({ error }, 'Error during shutdown');
        process.exit(1);
      }
    });
  });
}
