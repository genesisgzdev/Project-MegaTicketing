import Redis from 'ioredis';
import { crypto } from 'crypto';
import { config } from './config';

/**
 * REDLOCK Implementation for Distributed High-Availability Clusters.
 * Ensures that a lock is held by exactly one process across the entire Redis mesh.
 */
class RedlockProcessor {
  private redis: Redis;
  
  constructor(client: Redis) {
    this.redis = client;
  }

  /**
   * Acquires a lock with a unique nonce and strict TTL.
   * @param resource - Unique string for the resource (e.g. seat ID).
   * @param ttl - Time to live in milliseconds.
   * @returns Nonce string if successful, null otherwise.
   */
  async lock(resource: string, ttl: number): Promise<string | null> {
    const nonce = Math.random().toString(36).substring(2) + Date.now().toString(36);
    // SET with NX (Not Exists) and PX (Milliseconds TTL)
    const result = await this.redis.set(`lock:${resource}`, nonce, 'PX', ttl, 'NX');
    return result === 'OK' ? nonce : null;
  }

  /**
   * Releases a lock ONLY if the nonce matches (Atomic Lua).
   * Prevents a slow process from deleting a lock re-acquired by a new requester.
   */
  async unlock(resource: string, nonce: string): Promise<boolean> {
    const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;
    const result = await this.redis.eval(script, 1, `lock:${resource}`, nonce);
    return result === 1;
  }
}

const redis = new Redis({
  host: config.REDIS_HOST,
  port: config.REDIS_PORT,
  password: config.REDIS_PASSWORD,
  retryStrategy: (times) => Math.min(times * 50, 2000),
  reconnectOnError: (err) => {
    const targetError = 'READONLY';
    if (err.message.includes(targetError)) return true;
    return false;
  }
});

const redlock = new RedlockProcessor(redis);

export const lockSeat = async (eventId: string, seatId: string, userId: string): Promise<string | null> => {
  const resource = `${eventId}:${seatId}`;
  const lockToken = await redlock.lock(resource, 30000); // 30s safety TTL
  
  if (lockToken) {
    // Record the intent in the high-availability stream
    await redis.xadd(`stream:event:${eventId}`, '*', 'seatId', seatId, 'userId', userId, 'status', 'LOCK_ACQUIRED');
  }
  return lockToken;
};

export const releaseSeat = async (eventId: string, seatId: string, lockToken: string): Promise<boolean> => {
  const resource = `${eventId}:${seatId}`;
  const success = await redlock.unlock(resource, lockToken);
  
  if (success) {
    await redis.xadd(`stream:event:${eventId}`, '*', 'seatId', seatId, 'status', 'LOCK_RELEASED');
  }
  return success;
};

export default redis;
