import Redis from 'ioredis';
import { logger } from './logger';

export class EnhancedRedisCircuitBreaker {
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime = 0;
  private readonly failureThreshold = 5;
  private readonly successThreshold = 2;
  private readonly resetTimeout = 60000; // 1 minute
  private baseDelay = 100;

  constructor(private redis: Redis) {}

  async execute<T>(
    operation: () => Promise<T>,
    fallback?: () => Promise<T>,
  ): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.resetTimeout) {
        this.state = 'HALF_OPEN';
        this.successCount = 0;
        logger.info('Circuit breaker transitioning to HALF_OPEN');
      } else if (fallback) {
        logger.warn('Circuit breaker OPEN, using fallback');
        return fallback();
      } else {
        throw new Error('Circuit breaker is OPEN and no fallback provided');
      }
    }

    try {
      const result = await this.withExponentialBackoff(operation);
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      if (fallback && this.state === 'OPEN') {
        return fallback();
      }
      throw error;
    }
  }

  private async withExponentialBackoff<T>(operation: () => Promise<T>, attempt = 0): Promise<T> {
    if (attempt > 0) {
      const delay = this.baseDelay * Math.pow(2, attempt - 1);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    try {
      return await operation();
    } catch (error) {
      if (attempt < 3 && this.isRetryable(error)) {
        logger.warn({ attempt, error: error.message }, 'Retrying operation');
        return this.withExponentialBackoff(operation, attempt + 1);
      }
      throw error;
    }
  }

  private isRetryable(error: any): boolean {
    const retryableErrors = [
      'ECONNREFUSED',
      'ENOTFOUND',
      'TIMEOUT',
      'ETIMEDOUT',
      'EHOSTUNREACH',
    ];
    return retryableErrors.some((msg) => error.message?.includes(msg));
  }

  private onSuccess() {
    this.failureCount = 0;

    if (this.state === 'HALF_OPEN') {
      this.successCount++;
      if (this.successCount >= this.successThreshold) {
        this.state = 'CLOSED';
        this.successCount = 0;
        logger.info('Circuit breaker CLOSED');
      }
    }
  }

  private onFailure() {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.failureCount >= this.failureThreshold) {
      this.state = 'OPEN';
      logger.error(
        { failureCount: this.failureCount },
        'Circuit breaker OPEN due to failures',
      );
    }
  }

  getState() {
    return this.state;
  }
}

export function createEnhancedRedis(url: string) {
  const redis = new Redis(url, {
    retryStrategy: (times) => {
      const delay = Math.min(times * 50, 2000);
      return delay;
    },
    enableReadyCheck: true,
    enableOfflineQueue: true,
    maxRetriesPerRequest: 3,
  });

  redis.on('error', (error) => {
    logger.error({ error }, 'Redis client error');
  });

  redis.on('connect', () => {
    logger.info('Redis connected');
  });

  redis.on('ready', () => {
    logger.info('Redis ready');
  });

  return redis;
}
