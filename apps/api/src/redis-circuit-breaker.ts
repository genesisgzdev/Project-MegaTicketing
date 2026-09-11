export class RedisCircuitBreaker {
  private failures = 0;
  private openedAt = 0;

  constructor(
    private readonly failureThreshold = 3,
    private readonly resetTimeoutMs = 60_000,
  ) {}

  async execute<T>(
    operation: () => Promise<T>,
    fallback: () => Promise<T>,
    maxRetries = 3,
    baseDelayMs = 100,
  ): Promise<T> {
    if (this.failures >= this.failureThreshold && Date.now() - this.openedAt < this.resetTimeoutMs) {
      return fallback();
    }

    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      try {
        const result = await operation();
        this.failures = 0;
        return result;
      } catch (error) {
        if (attempt === maxRetries) {
          this.failures += 1;
          if (this.failures >= this.failureThreshold) this.openedAt = Date.now();
          return fallback();
        }
        await new Promise((resolve) => setTimeout(resolve, baseDelayMs * 2 ** attempt));
      }
    }

    return fallback();
  }
}
