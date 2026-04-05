import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

export const lockSeat = async (eventId: string, seatId: string, userId: string, ttlSeconds: number = 600) => {
  const lockKey = `lock:event:${eventId}:seat:${seatId}`;
  
  // NX: Only set if not exists, EX: Set expiry
  const result = await redis.set(lockKey, userId, 'EX', ttlSeconds, 'NX');
  
  return result === 'OK';
};

export const releaseSeat = async (eventId: string, seatId: string, userId: string) => {
  const lockKey = `lock:event:${eventId}:seat:${seatId}`;
  
  // Use Lua script to ensure atomicity: only delete if the value matches the userId
  const script = `
    if redis.call("get", KEYS[1]) == ARGV[1] then
      return redis.call("del", KEYS[1])
    else
      return 0
    end
  `;
  
  return await redis.eval(script, 1, lockKey, userId);
};

export default redis;
