import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RedisCircuitBreaker } from '../redis';

describe('RedisCircuitBreaker', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('should execute operation successfully when closed', async () => {
    const breaker = new RedisCircuitBreaker(3, 10000);
    const operation = vi.fn().mockResolvedValue('success');
    const fallback = vi.fn().mockResolvedValue('fallback');

    const result = await breaker.execute(operation, fallback);
    expect(result).toBe('success');
    expect(operation).toHaveBeenCalledTimes(1);
    expect(fallback).not.toHaveBeenCalled();
  });

  it('should retry operation on failure', async () => {
    const breaker = new RedisCircuitBreaker(3, 10000);
    const operation = vi.fn()
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValueOnce('success');
    const fallback = vi.fn().mockResolvedValue('fallback');

    const resultPromise = breaker.execute(operation, fallback, 3, 10);
    
    // Fast-forward the retry delay
    await vi.runAllTimersAsync();
    
    const result = await resultPromise;
    expect(result).toBe('success');
    expect(operation).toHaveBeenCalledTimes(2);
    expect(fallback).not.toHaveBeenCalled();
  });

  it('should open circuit and use fallback after max failures', async () => {
    const breaker = new RedisCircuitBreaker(2, 10000);
    const operation = vi.fn().mockRejectedValue(new Error('fail'));
    const fallback = vi.fn().mockResolvedValue('fallback');

    // First attempt fails entirely (using up maxRetries)
    let p1 = breaker.execute(operation, fallback, 1, 10);
    await vi.runAllTimersAsync();
    await p1;

    // Second attempt fails entirely
    let p2 = breaker.execute(operation, fallback, 1, 10);
    await vi.runAllTimersAsync();
    await p2;

    // Circuit should now be OPEN. Next call returns fallback immediately without trying operation
    operation.mockClear();
    const result3 = await breaker.execute(operation, fallback);
    
    expect(result3).toBe('fallback');
    expect(operation).not.toHaveBeenCalled();
  });
});
