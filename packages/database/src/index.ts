import { PrismaClient } from '@prisma/client';

/**
 * production Prisma Client Configuration.
 * Optimized for high-concurrency environments with structured logging.
 */
export const db = new PrismaClient({
  log: [
    { emit: 'event', level: 'query' },
    { emit: 'stdout', level: 'error' },
    { emit: 'stdout', level: 'warn' },
  ],
});

export * from '@prisma/client';

