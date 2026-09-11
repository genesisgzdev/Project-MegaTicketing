import { FastifyInstance } from 'fastify';
import Redis from 'ioredis';
import { createHash, randomUUID } from 'crypto';

const IDEMPOTENCY_KEY_PREFIX = 'idempotency:';
const IDEMPOTENCY_LOCK_PREFIX = 'idempotency:lock:';
const IDEMPOTENCY_TTL = 86400; // 24 hours

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object' && !Buffer.isBuffer(value)) {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, canonicalize(entry)]),
    );
  }
  return value;
}

export interface IdempotencyResult {
  isDuplicate: boolean;
  cachedResponse?: any;
}

export function createIdempotencyFingerprint(
  method: string,
  url: string,
  body: unknown,
  authorization: string | undefined,
): string {
  return createHash('sha256')
    .update(JSON.stringify({
      method,
      url,
      // Keep a cached response inside the authentication boundary. The
      // bearer is hashed with the request and is never stored separately.
      authorization: authorization ?? '',
      body: canonicalize(body ?? null),
    }))
    .digest('hex');
}

export function setupIdempotency(app: FastifyInstance, redis: Redis) {
  app.addHook('preValidation', async (request, reply) => {
    const idempotencyKey = request.headers['idempotency-key'] as string;

    if (!idempotencyKey || request.method === 'GET' || request.url.split('?')[0] === '/webhook') {
      return;
    }

    const fingerprint = createIdempotencyFingerprint(
      request.method,
      request.url,
      request.body,
      request.headers.authorization,
    );
    const key = `${IDEMPOTENCY_KEY_PREFIX}${createHash('sha256').update(idempotencyKey).digest('hex')}`;
    const lockKey = `${IDEMPOTENCY_LOCK_PREFIX}${createHash('sha256').update(idempotencyKey).digest('hex')}`;

    const owner = randomUUID();
    // Cache lookup and claim must be atomic: a response can be committed
    // between a separate GET and SET NX.
    const [state, cached] = await redis.eval(`
      local cached = redis.call('get', KEYS[1])
      if cached then return {0, cached} end
      if redis.call('set', KEYS[2], ARGV[1], 'EX', 120, 'NX') then return {1, ''} end
      return {2, ''}
    `, 2, key, lockKey, owner) as [number, string];
    if (state === 0) {
      const entry = JSON.parse(cached) as { statusCode: number; body: string; fingerprint: string };
      if (entry.fingerprint !== fingerprint) {
        return reply.status(409).send({ status: 'error', message: 'Idempotency key was already used with a different request' });
      }
      reply.header('idempotent-replayed', 'true');
      return reply.status(entry.statusCode).type('application/json').send(entry.body);
    }
    if (state !== 1) {
      return reply.status(409).send({ status: 'error', message: 'A request with this idempotency key is already being processed' });
    }
    request.context.metadata.idempotencyOwner = owner;
    request.context.metadata.idempotencyKey = idempotencyKey;
    request.context.metadata.idempotencyCheckKey = key;
    request.context.metadata.idempotencyLockKey = lockKey;
    request.context.metadata.idempotencyFingerprint = fingerprint;
  });

  app.addHook('onSend', async (request, reply, payload) => {
    const { idempotencyCheckKey, idempotencyLockKey, idempotencyFingerprint } = request.context.metadata;
    if (!idempotencyCheckKey || !idempotencyLockKey) {
      return payload;
    }

    try {
      // An expired request cannot remove or overwrite a successor's lease.
      await redis.eval(`
        if redis.call('get', KEYS[2]) ~= ARGV[1] then return 0 end
        if ARGV[2] == 'cache' then redis.call('setex', KEYS[1], ARGV[3], ARGV[4]) end
        return redis.call('del', KEYS[2])
      `, 2, idempotencyCheckKey, idempotencyLockKey,
      request.context.metadata.idempotencyOwner, reply.statusCode >= 500 ? 'release' : 'cache', IDEMPOTENCY_TTL,
      JSON.stringify({ statusCode: reply.statusCode,
        body: Buffer.isBuffer(payload) ? payload.toString() : String(payload), fingerprint: idempotencyFingerprint }));
    } catch (err) {
      request.log.error({ err }, 'Response cache unavailable after request completion');
    }
    return payload;
  });

  app.addHook('onError', async (request) => {
    const lockKey = request.context?.metadata?.idempotencyLockKey;
    if (lockKey) await redis.eval("if redis.call('get',KEYS[1]) == ARGV[1] then return redis.call('del',KEYS[1]) else return 0 end",
      1, lockKey, request.context.metadata.idempotencyOwner).catch(err => request.log.error({ err }, 'Idempotency release failed'));
  });
}
