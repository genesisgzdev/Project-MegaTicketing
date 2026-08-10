import Redis from 'ioredis';
import crypto from 'crypto';
import { config } from './config';

/**
 * Enterprise Redlock implementation for high-concurrency ticket reservations.
 * Ensures distributed mutual exclusion with cryptographic nonces and strict TTLs.
 */
class RedlockProcessor {
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
  maxRetriesPerRequest: null, enableOfflineQueue: false
});

redis.on('error', (err) => console.error('CRITICAL: Redis Connection Lost', err));

const redlock = new RedlockProcessor(redis);

export const lockSeat = async (eventId: string, seatId: string, userId: string): Promise<string | null> => {
  return await redlock.lock(`${eventId}:${seatId}`, 30000);
};

export const releaseSeat = async (eventId: string, seatId: string, lockToken: string): Promise<boolean> => {
  return await redlock.unlock(`${eventId}:${seatId}`, lockToken);
};

export const markSeatAsPaid = async (eventId: string, seatId: string): Promise<void> => {
  await redis.hset(`seat:${eventId}:${seatId}`, { status: 'PAID', paidAt: new Date().toISOString() });
};

export const markEventProcessed = async (eventId: string): Promise<void> => {
  await redis.set(`event:processed:${eventId}`, '1', 'EX', 60 * 60 * 24 * 30);
};

export const isEventProcessed = async (eventId: string): Promise<boolean> => {
  return (await redis.exists(`event:processed:${eventId}`)) === 1;
};

export default redis;