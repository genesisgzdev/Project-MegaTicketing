import Redis from 'ioredis';
import { config } from './config';

const redis = new Redis({
  host: config.REDIS_HOST,
  port: config.REDIS_PORT,
  password: config.REDIS_PASSWORD,
  retryStrategy(times) {
    return Math.min(times * 50, 2000);
  },
  maxRetriesPerRequest: null,
  enableOfflineQueue: false,
  noDelay: true,
  keepAlive: 10000
});

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

export const lockSeat = async (eventId: string, seatId: string, userId: string): Promise<boolean> => {
  const lockKey = `lock:event:${eventId}:seat:${seatId}`;
  const result = await redis.set(lockKey, userId, 'PX', 30000, 'NX');
  if (result === 'OK') {
    const streamKey = `stream:event:${eventId}`;
    await redis.xadd(streamKey, '*', 'seatId', seatId, 'userId', userId, 'status', 'RESERVED');
  }
  return result === 'OK';
};

export const releaseSeat = async (eventId: string, seatId: string, userId: string): Promise<boolean> => {       
  const lockKey = `lock:event:${eventId}:seat:${seatId}`;
  const result = await (redis as any).releaseLockAtomic(lockKey, userId);
  if (result === 1) {
    const streamKey = `stream:event:${eventId}`;
    await redis.xadd(streamKey, '*', 'seatId', seatId, 'userId', userId, 'status', 'RELEASED');
  }
  return result === 1;
};

export default redis;
