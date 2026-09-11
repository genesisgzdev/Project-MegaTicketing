import Redis from 'ioredis';
import crypto from 'crypto';
import { config } from './config';

export class RedisCircuitBreaker {
  private failures = 0;
  private openedAt = 0;

  constructor(
    private readonly failureThreshold = 3,
    private readonly resetTimeoutMs = 60_000,
  ) {}

  async execute<T>(
    operation: () => Promise<T>,
    fallback: () => Promise<T>,
    maxRetries = 3,
    baseDelayMs = 100,
  ): Promise<T> {
    if (this.failures >= this.failureThreshold && Date.now() - this.openedAt < this.resetTimeoutMs) {
      return fallback();
    }

    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      try {
        const result = await operation();
        this.failures = 0;
        return result;
      } catch (error) {
        if (attempt === maxRetries) {
          this.failures += 1;
          if (this.failures >= this.failureThreshold) this.openedAt = Date.now();
          return fallback();
        }
        await new Promise((resolve) => setTimeout(resolve, baseDelayMs * 2 ** attempt));
      }
    }

    return fallback();
  }
}

/**
 * Single-instance Redis lease for the short reservation race.
 * PostgreSQL remains the authority for the ticket and seat invariant.
 */
class RedisSeatLease {
  private redis: Redis;
  constructor(client: Redis) { this.redis = client; }

  async lock(resource: string, ttl: number): Promise<string | null> {
    const nonce = crypto.randomBytes(16).toString('hex');
    const result = await this.redis.set(`lock:${resource}`, nonce, 'PX', ttl, 'NX');
    return result === 'OK' ? nonce : null;
  }

  async unlock(resource: string, nonce: string): Promise<boolean> {
    const script = `if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end`;
    const result = await this.redis.eval(script, 1, `lock:${resource}`, nonce);
    return result === 1;
  }
}

const redis = new Redis({
  host: config.REDIS_HOST, port: config.REDIS_PORT, password: config.REDIS_PASSWORD,
  retryStrategy: (times) => Math.min(times * 50, 2000),
  maxRetriesPerRequest: 1, commandTimeout: 5000, enableOfflineQueue: false
});

redis.on('error', (err) => console.error('CRITICAL: Redis Connection Lost', err));

const seatLease = new RedisSeatLease(redis);

export const lockSeat = async (eventId: string, seatId: string, userId: string): Promise<string | null> => {
  return await seatLease.lock(`${eventId}:${seatId}`, config.SEAT_LOCK_TTL_MS);
};

export const releaseSeat = async (eventId: string, seatId: string, lockToken: string): Promise<boolean> => {
  return await seatLease.unlock(`${eventId}:${seatId}`, lockToken);
};

export default redis;

export function waitForRedisReady(client: Redis, timeoutMs = 5000): Promise<void> {
  if (client.status === 'ready') return Promise.resolve();
  if (client.status === 'end') return Promise.reject(new Error('Redis connection is closed'));
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timer);
      client.removeListener('ready', ready);
      client.removeListener('end', ended);
    };
    const ready = () => { cleanup(); resolve(); };
    const ended = () => { cleanup(); reject(new Error('Redis connection closed during startup')); };
    const timer = setTimeout(() => { cleanup(); reject(new Error('Redis readiness timeout')); }, timeoutMs);
    client.once('ready', ready);
    client.once('end', ended);
  });
}
