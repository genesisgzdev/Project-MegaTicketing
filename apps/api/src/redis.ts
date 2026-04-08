import Redis from 'ioredis';
import { config } from './config';

/**
 * Industrial-grade Redis client configuration.
 * Implements exponential backoff and structured connection event handling.
 */
const redis = new Redis({
  host: config.REDIS_HOST,
  port: config.REDIS_PORT,
  password: config.REDIS_PASSWORD,
  retryStrategy(times) {
    return Math.min(times * 50, 2000);
  },
  maxRetriesPerRequest: 3
});

redis.on('error', (err) => console.error('Redis Connection Fault:', err));
redis.on('connect', () => console.log('Redis Connectivity Established'));

/**
 * Lua script for atomic lock release.
 * Ensures that only the lock owner can delete the key.
 */
const RELEASE_LOCK_LUA = `
  if redis.call("get", KEYS[1]) == ARGV[1] then
    return redis.call("del", KEYS[1])
  else
    return 0
  end
`;

redis.defineCommand('releaseLockAtomic', {
  numberOfKeys: 1,
  lua: RELEASE_LOCK_LUA
});

/**
 * Attempts to acquire a distributed lock for a specific seat.
 */
export const lockSeat = async (eventId: string, seatId: string, userId: string): Promise<boolean> => {
  const lockKey = `lock:event:${eventId}:seat:${seatId}`;
  const result = await redis.set(lockKey, userId, 'PX', 30000, 'NX');
  return result === 'OK';
};

/**
 * Releases a distributed lock atomically using Lua.
 */
export const releaseSeat = async (eventId: string, seatId: string, userId: string): Promise<boolean> => {
  const lockKey = `lock:event:${eventId}:seat:${seatId}`;
  const result = await (redis as any).releaseLockAtomic(lockKey, userId);
  return result === 1;
};

export default redis;
