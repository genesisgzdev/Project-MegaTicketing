import Redis from 'ioredis';
import crypto from 'crypto';
import { config } from './config';

class RedlockProcessor {
  private redis: Redis;
  constructor(client: Redis) { this.redis = client; }

  async lock(resource: string, ttl: number): Promise<string | null> {
    // [SECURITY FIX] Use cryptographically secure random bytes for nonces
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
  retryStrategy: (times) => Math.min(times * 50, 2000)
});

const redlock = new RedlockProcessor(redis);

export const lockSeat = async (eventId: string, seatId: string, userId: string): Promise<string | null> => {
  return await redlock.lock(`${eventId}:${seatId}`, 30000);
};

export const releaseSeat = async (eventId: string, seatId: string, lockToken: string): Promise<boolean> => {
  return await redlock.unlock(`${eventId}:${seatId}`, lockToken);
};

export default redis;
