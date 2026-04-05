import Redis from 'ioredis';
import { config } from './config';

// Industrial Redis Configuration with Robust Retry Strategy
const redis = new Redis({
  host: config.REDIS_HOST,
  port: config.REDIS_PORT,
  password: config.REDIS_PASSWORD,
  retryStrategy(times) {
    // Exponential backoff with a cap of 2 seconds
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  maxRetriesPerRequest: 3
});

redis.on('error', (err) => {
  // Structured logging would go here in a full implementation
  console.error('[!] Redis Connection Error:', err);
});

redis.on('connect', () => {
  console.log(`[+] Connected to Redis at ${config.REDIS_HOST}:${config.REDIS_PORT}`);
});

export const lockSeat = async (eventId: string, seatId: string, userId: string) => {
  const lockKey = `lock:event:${eventId}:seat:${seatId}`;
  // NX = Only set if not exists, PX = Expire in 30s
  const result = await redis.set(lockKey, userId, 'PX', 30000, 'NX');
  return result === 'OK';
};

export const releaseSeat = async (eventId: string, seatId: string) => {
  const lockKey = `lock:event:${eventId}:seat:${seatId}`;
  return await redis.del(lockKey);
};

export default redis;
