import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import Redis from 'ioredis';
import { createHash } from 'crypto';

const IDEMPOTENCY_KEY_PREFIX = 'idempotency:';
const IDEMPOTENCY_TTL = 86400; // 24 hours

export interface IdempotencyResult {
  isDuplicate: boolean;
  cachedResponse?: any;
}

export function setupIdempotency(app: FastifyInstance, redis: Redis) {
  app.addHook('onRequest', async (request, reply) => {
    const idempotencyKey = request.headers['idempotency-key'] as string;

    if (!idempotencyKey || request.method === 'GET') {
      return;
    }

    const key = `${IDEMPOTENCY_KEY_PREFIX}${createHash('sha256')
      .update(idempotencyKey)
      .digest('hex')}`;

    const cached = await redis.get(key);
    if (cached) {
      const { statusCode, body } = JSON.parse(cached);
      return reply.status(statusCode).send(body);
    }

    request.context.metadata.idempotencyKey = idempotencyKey;
    request.context.metadata.idempotencyCheckKey = key;
  });
}

export async function cacheIdempotentResponse(
  redis: Redis,
  checkKey: string,
  statusCode: number,
  body: any,
) {
  await redis.setex(
    checkKey,
    IDEMPOTENCY_TTL,
    JSON.stringify({ statusCode, body }),
  );
}
