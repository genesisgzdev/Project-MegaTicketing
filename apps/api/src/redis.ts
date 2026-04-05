import Redis from 'ioredis';

// Industrial Redis Configuration with Retry Strategy
const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: Number(process.env.REDIS_PORT) || 6379,
  password: process.env.REDIS_PASSWORD,
  retryStrategy(times) {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  maxRetriesPerRequest: 3
});

redis.on('error', (err) => {
  console.error('[!] Redis Connection Error:', err);
});

redis.on('connect', () => {
  console.log('[+] Connected to Redis - Distributed Locking Active');
});

export const lockSeat = async (eventId: string, seatId: string, userId: string) => {
  const lockKey = `lock:event:${eventId}:seat:${seatId}`;
  const result = await redis.set(lockKey, userId, 'PX', 30000, 'NX');
  return result === 'OK';
};

export const releaseSeat = async (eventId: string, seatId: string) => {
  const lockKey = `lock:event:${eventId}:seat:${seatId}`;
  return await redis.del(lockKey);
};

export default redis;
