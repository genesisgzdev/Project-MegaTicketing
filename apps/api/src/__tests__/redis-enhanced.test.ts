import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EnhancedRedisCircuitBreaker } from '../../src/redis-enhanced';
import Redis from 'ioredis-mock';

describe('EnhancedRedisCircuitBreaker', () => {
  let redis: Redis.Redis;
  let circuitBreaker: EnhancedRedisCircuitBreaker;

  beforeEach(() => {
    redis = new Redis();
    circuitBreaker = new EnhancedRedisCircuitBreaker(redis);
  });

  afterEach(() => {
    redis.disconnect();
  });

  it('should successfully execute operation when circuit is CLOSED', async () => {
    const operation = vi.fn(async () => 'success');
    const result = await circuitBreaker.execute(operation);
    expect(result).toBe('success');
    expect(operation).toHaveBeenCalledOnce();
  });

  it('should transition to OPEN after multiple failures', async () => {
    const operation = vi.fn(async () => {
      throw new Error('ECONNREFUSED');
    });

    for (let i = 0; i < 5; i++) {
      try {
        await circuitBreaker.execute(operation);
      } catch (e) {
        // Expected
      }
    }

    expect(circuitBreaker.getState()).toBe('OPEN');
  });

  it('should use fallback when circuit is OPEN', async () => {
    const operation = vi.fn(async () => {
      throw new Error('ECONNREFUSED');
    });
    const fallback = vi.fn(async () => 'fallback_result');

    // Trip the circuit
    for (let i = 0; i < 5; i++) {
      try {
        await circuitBreaker.execute(operation);
      } catch (e) {
        // Expected
      }
    }

    const result = await circuitBreaker.execute(operation, fallback);
    expect(result).toBe('fallback_result');
    expect(fallback).toHaveBeenCalled();
  });

  it('should retry with exponential backoff on retryable errors', async () => {
    let attempts = 0;
    const operation = vi.fn(async () => {
      attempts++;
      if (attempts < 2) {
        throw new Error('ETIMEDOUT');
      }
      return 'success';
    });

    const result = await circuitBreaker.execute(operation);
    expect(result).toBe('success');
    expect(attempts).toBe(2);
  });
});
