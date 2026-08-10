import Redis from 'ioredis';
import { logger } from './logger';

export interface WebhookRetryConfig {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

const DEFAULT_CONFIG: WebhookRetryConfig = {
  maxRetries: 5,
  initialDelayMs: 1000,
  maxDelayMs: 60000,
  backoffMultiplier: 2,
};

export class WebhookRetryManager {
  constructor(
    private redis: Redis,
    private config: WebhookRetryConfig = DEFAULT_CONFIG,
  ) {}

  async scheduleRetry(
    webhookId: string,
    payload: any,
    attempt: number = 0,
  ): Promise<void> {
    if (attempt >= this.config.maxRetries) {
      logger.error(
        { webhookId, attempt },
        'Webhook exhausted retry attempts',
      );
      return;
    }

    const delay = this.calculateDelay(attempt);
    const retryKey = `webhook_retry:${webhookId}:${attempt + 1}`;

    await this.redis.setex(
      retryKey,
      Math.ceil(delay / 1000),
      JSON.stringify({ payload, attempt: attempt + 1 }),
    );

    logger.info(
      { webhookId, attempt, delayMs: delay },
      'Webhook retry scheduled',
    );
  }

  private calculateDelay(attempt: number): number {
    const exponentialDelay =
      this.config.initialDelayMs *
      Math.pow(this.config.backoffMultiplier, attempt);
    return Math.min(exponentialDelay, this.config.maxDelayMs);
  }

  async getPendingRetries(): Promise<Array<{ webhookId: string; payload: any }>> {
    const keys = await this.redis.keys('webhook_retry:*');
    const retries = [];

    for (const key of keys) {
      const data = await this.redis.get(key);
      if (data) {
        const webhookId = key.split(':')[1];
        retries.push({
          webhookId,
          payload: JSON.parse(data),
        });
        await this.redis.del(key);
      }
    }

    return retries;
  }
}
