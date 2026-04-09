import Redis from 'ioredis';
import { config } from './config';

enum CircuitState { CLOSED, OPEN, HALF_OPEN }
class RedisCircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount: number = 0;
  private nextAttempt: number = Date.now();
  constructor(private maxFailures: number = 3, private resetTimeout: number = 10000) {}
  async execute<T>(operation: () => Promise<T>, fallback: () => Promise<T>, maxRetries: number = 3, baseDelay: number = 100): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      if (Date.now() > this.nextAttempt) this.state = CircuitState.HALF_OPEN;
      else return fallback();
    }
    let attempt = 0;
    while (attempt <= maxRetries) {
      try {
        const result = await operation();
        this.failureCount = 0; this.state = CircuitState.CLOSED;
        return result;
      } catch (error) {
        attempt++;
        if (attempt > maxRetries) {
          this.failureCount++;
          if (this.failureCount >= this.maxFailures) {
            this.state = CircuitState.OPEN; this.nextAttempt = Date.now() + this.resetTimeout;
          }
          return fallback();
        }
        await new Promise(resolve => setTimeout(resolve, baseDelay * Math.pow(2, attempt - 1)));
      }
    }
    return fallback();
  }
}

const redisBreaker = new RedisCircuitBreaker(3, 10000);
const redis = new Redis({
  host: config.REDIS_HOST, port: config.REDIS_PORT, password: config.REDIS_PASSWORD,
  retryStrategy(times) { return Math.min(times * 50, 2000); },
  maxRetriesPerRequest: null, enableOfflineQueue: false, noDelay: true, keepAlive: 10000
});

redis.defineCommand('releaseLockAtomic', {
  numberOfKeys: 1, lua: `if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end`
});

export const lockSeat = async (eventId: string, seatId: string, userId: string): Promise<boolean> => {
  return redisBreaker.execute(
    async () => {
      const lockKey = `lock:event:${eventId}:seat:${seatId}`;
      const result = await redis.set(lockKey, userId, 'PX', 30000, 'NX');
      if (result === 'OK') await redis.xadd(`stream:event:${eventId}`, '*', 'seatId', seatId, 'userId', userId, 'status', 'RESERVED');
      return result === 'OK';
    },
    async () => { return false; }
  );
};

export const releaseSeat = async (eventId: string, seatId: string, userId: string): Promise<boolean> => {
  return redisBreaker.execute(
    async () => {
      const lockKey = `lock:event:${eventId}:seat:${seatId}`;
      const result = await (redis as any).releaseLockAtomic(lockKey, userId);
      if (result === 1) await redis.xadd(`stream:event:${eventId}`, '*', 'seatId', seatId, 'userId', userId, 'status', 'RELEASED');
      return result === 1;
    },
    async () => { return false; }
  );
};

export const markSeatAsPaid = async (eventId: string, seatId: string): Promise<boolean> => {
  return redisBreaker.execute(
    async () => {
      const statusKey = `seat:status:event:${eventId}:seat:${seatId}`;
      await redis.set(statusKey, 'PAID', 'EX', 86400); 
      await redis.xadd(`stream:event:${eventId}`, '*', 'seatId', seatId, 'status', 'PAID');
      return true;
    },
    async () => { return false; }
  );
};

export { RedisCircuitBreaker };
export default redis;
