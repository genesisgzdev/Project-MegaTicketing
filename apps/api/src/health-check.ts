import { FastifyInstance } from 'fastify';
import { Redis } from 'ioredis';
import { getHeapStatistics } from 'node:v8';
import { PrismaClient } from '@prisma/client';

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: {
    database: { status: string; latency: number };
    redis: { status: string; latency: number };
    memory: { status: string; percentage: number };
  };
  timestamp: string;
}

export async function setupHealthCheck(
  app: FastifyInstance,
  db: PrismaClient,
  redis: Redis,
) {
  app.get('/health/live', async () => ({ live: true }));
  app.get('/health', async (request, reply) => {
    const checks = await Promise.all([
      checkDatabase(db),
      checkRedis(redis),
      checkMemory(),
    ]);

    const [database, redisCheck, memory] = checks;
    const allHealthy = [database, redisCheck, memory].every((c) => c.status === 'healthy');
    const anyUnhealthy = [database, redisCheck, memory].some((c) => c.status === 'unhealthy');

    const health: HealthStatus = {
      status: anyUnhealthy ? 'unhealthy' : allHealthy ? 'healthy' : 'degraded',
      checks: {
        database,
        redis: redisCheck,
        memory,
      },
      timestamp: new Date().toISOString(),
    };

    const statusCode = health.status === 'unhealthy' ? 503 : 200;
    reply.status(statusCode).send(health);
  });

  app.get('/health/ready', async (request, reply) => {
    try {
      await Promise.all([bounded(db.$queryRaw`SELECT 1`), bounded(redis.ping())]);
      reply.send({ ready: true });
    } catch (error) {
      reply.status(503).send({ ready: false, error: 'Dependency unavailable' });
    }
  });
}

async function checkDatabase(db: PrismaClient) {
  const start = Date.now();
  try {
    await bounded(db.$queryRaw`SELECT 1`);
    return {
      status: 'healthy',
      latency: Date.now() - start,
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      latency: Date.now() - start,
    };
  }
}

async function checkRedis(redis: Redis) {
  const start = Date.now();
  try {
    await bounded(redis.ping());
    return {
      status: 'healthy',
      latency: Date.now() - start,
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      latency: Date.now() - start,
    };
  }
}

function checkMemory() {
  const used = process.memoryUsage();
  const heapUsedPercent = (used.heapUsed / getHeapStatistics().heap_size_limit) * 100;
  const status = heapUsedPercent > 90 ? 'unhealthy' : heapUsedPercent > 75 ? 'degraded' : 'healthy';

  return {
    status,
    percentage: Math.round(heapUsedPercent),
  };
}

async function bounded<T>(operation: PromiseLike<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  try {
    return await Promise.race([Promise.resolve(operation), new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('Dependency timeout')), 2000);
    })]);
  } finally { clearTimeout(timer!); }
}
