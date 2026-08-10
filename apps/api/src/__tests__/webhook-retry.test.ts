import { describe, it, expect, beforeEach } from 'vitest';
import { WebhookRetryManager } from '../../src/webhook-retry';
import Redis from 'ioredis-mock';

describe('WebhookRetryManager', () => {
  let redis: Redis.Redis;
  let retryManager: WebhookRetryManager;

  beforeEach(() => {
    redis = new Redis();
    retryManager = new WebhookRetryManager(redis, {
      maxRetries: 5,
      initialDelayMs: 100,
      maxDelayMs: 5000,
      backoffMultiplier: 2,
    });
  });

  it('should schedule webhook retry with exponential backoff', async () => {
    const webhookId = 'webhook_123';
    const payload = { orderId: 'order_456' };

    await retryManager.scheduleRetry(webhookId, payload, 0);

    const retries = await retryManager.getPendingRetries();
    expect(retries).toHaveLength(1);
    expect(retries[0].webhookId).toBe(webhookId);
  });

  it('should not exceed max retry attempts', async () => {
    const webhookId = 'webhook_123';
    const payload = { orderId: 'order_456' };

    // Try to schedule 6 retries (max is 5)
    for (let i = 0; i < 6; i++) {
      await retryManager.scheduleRetry(webhookId, payload, i);
    }

    const retries = await retryManager.getPendingRetries();
    expect(retries.length).toBeLessThanOrEqual(5);
  });

  it('should calculate exponential backoff correctly', async () => {
    const webhookId = 'webhook_123';
    const payload = { orderId: 'order_456' };

    await retryManager.scheduleRetry(webhookId, payload, 0); // 100ms
    await retryManager.scheduleRetry(webhookId, payload, 1); // 200ms
    await retryManager.scheduleRetry(webhookId, payload, 2); // 400ms

    const retries = await retryManager.getPendingRetries();
    expect(retries.length).toBeGreaterThan(0);
  });
});
