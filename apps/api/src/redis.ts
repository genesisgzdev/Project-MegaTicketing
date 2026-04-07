import Redis from 'ioredis';
import { config } from './config';

/**
 * production Redis client configuration.
 * Implements exponential backoff, structured connection event handling,
 * and high-performance TCP settings.
 */
const redis = new Redis({
  host: config.REDIS_HOST,
  port: config.REDIS_PORT,
  password: config.REDIS_PASSWORD,
  retryStrategy(times) {
    return Math.min(times * 50, 2000);
  },
  maxRetriesPerRequest: null, // Fail fast on timeouts
  enableOfflineQueue: false,  // Do not buffer commands if Redis is offline
  noDelay: true,              // Disable Nagle's algorithm for lowest latency
  keepAlive: 10000            // Enable TCP keep-alive
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
 * Also appends a reservation event to a Redis Stream for real-time updates.
 * @param eventId - Unique identifier for the event
 * @param seatId - Unique identifier for the seat
 * @param userId - Owner of the lock request
 * @returns boolean - True if lock was acquired
 */
export const lockSeat = async (eventId: string, seatId: string, userId: string): Promise<boolean> => {
  const lockKey = `lock:event:${eventId}:seat:${seatId}`;
  const result = await redis.set(lockKey, userId, 'PX', 30000, 'NX');
  
  if (result === 'OK') {
    const streamKey = `stream:event:${eventId}`;
    await redis.xadd(streamKey, '*', 'seatId', seatId, 'userId', userId, 'status', 'RESERVED');
  }
  
  return result === 'OK';
};

/**
 * Releases a distributed lock atomically using Lua.
 * Appends a release event to the Redis Stream.
 * @param eventId - Unique identifier for the event
 * @param seatId - Unique identifier for the seat
 * @param userId - The user ID that should own the lock
 */
export const releaseSeat = async (eventId: string, seatId: string, userId: string): Promise<boolean> => {
  const lockKey = `lock:event:${eventId}:seat:${seatId}`;
  const result = await (redis as any).releaseLockAtomic(lockKey, userId);
  
  if (result === 1) {
    const streamKey = `stream:event:${eventId}`;
    await redis.xadd(streamKey, '*', 'seatId', seatId, 'userId', userId, 'status', 'RELEASED');
  }
  
  return result === 1;
};

/**
 * Persistently marks a seat as PAID in Redis.
 * Appends a paid event to the Redis Stream.
 */
export const markSeatAsPaid = async (eventId: string, seatId: string): Promise<void> => {
  const statusKey = `seat:status:event:${eventId}:seat:${seatId}`;
  await redis.set(statusKey, 'PAID');
  
  const streamKey = `stream:event:${eventId}`;
  await redis.xadd(streamKey, '*', 'seatId', seatId, 'status', 'PAID');
};

export default redis;
