import { FastifyInstance } from 'fastify';

export interface Metrics {
  requestCount: number;
  requestDuration: number[];
  errorCount: number;
  dbQueryCount: number;
  redisCommandCount: number;
  activeSessions: number;
}

class MetricsCollector {
  private metrics: Metrics = {
    requestCount: 0,
    requestDuration: [],
    errorCount: 0,
    dbQueryCount: 0,
    redisCommandCount: 0,
    activeSessions: 0,
  };

  recordRequest(duration: number) {
    this.metrics.requestCount++;
    this.metrics.requestDuration.push(duration);
    // Keep only last 1000 durations
    if (this.metrics.requestDuration.length > 1000) {
      this.metrics.requestDuration.shift();
    }
  }

  recordError() {
    this.metrics.errorCount++;
  }

  recordDbQuery() {
    this.metrics.dbQueryCount++;
  }

  recordRedisCommand() {
    this.metrics.redisCommandCount++;
  }

  updateActiveSessions(count: number) {
    this.metrics.activeSessions = count;
  }

  getMetrics() {
    const durations = this.metrics.requestDuration;
    return {
      ...this.metrics,
      avgRequestDuration: durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0,
      p99RequestDuration: this.calculatePercentile(durations, 99),
      p95RequestDuration: this.calculatePercentile(durations, 95),
    };
  }

  private calculatePercentile(values: number[], percentile: number): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }
}

export const metricsCollector = new MetricsCollector();

export function setupMetrics(app: FastifyInstance) {
  app.get('/metrics', async (request, reply) => {
    return metricsCollector.getMetrics();
  });
}
