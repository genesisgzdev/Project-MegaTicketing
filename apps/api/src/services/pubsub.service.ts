import { FastifyBaseLogger } from 'fastify';
import redis from '../redis';
import { db } from '../db';
import { Prisma } from '@mega-ticketing/database';

type ClaimedOutboxEvent = {
  id: string;
  type: string;
  aggregateId: string;
  payload: Prisma.JsonValue;
};

const OUTBOX_CLAIM_LEASE_MS = 60_000;

export function decodeStreamPayload(fields: string[]): Record<string, unknown> {
  const values: Record<string, string> = {};
  for (let index = 0; index + 1 < fields.length; index += 2) {
    values[fields[index]] = fields[index + 1];
  }
  if (values.payload) return JSON.parse(values.payload) as Record<string, unknown>;
  return {
    outboxId: values.outboxId,
    eventType: values.eventType,
    aggregateId: values.aggregateId,
  };
}

export class PubSubService {
  private readonly streamName = 'stream:orders:reserved';
  private readonly groupName = 'order_processors';
  private readonly consumerName = `node_${process.pid}_${Date.now()}`;

  constructor(private logger: FastifyBaseLogger) {
    void this.initConsumerGroup();
    const publisher = setInterval(() => void this.publishOutboxBatch(), 1000);
    publisher.unref();
  }

  private async publishOutboxBatch() {
    try {
      // Claim rows atomically so three API replicas cannot publish the same
      // pending event at the same time. An expired claim is recoverable after
      // a process dies between the database claim and Redis XADD.
      const events = await db.$transaction(async (transaction) => transaction.$queryRaw<ClaimedOutboxEvent[]>`
        WITH candidates AS (
          SELECT "id"
          FROM "OutboxEvent"
          WHERE "publishedAt" IS NULL
            AND ("publishingAt" IS NULL OR "publishingAt" < NOW() - INTERVAL '60 seconds')
          ORDER BY "createdAt" ASC
          LIMIT 50
          FOR UPDATE SKIP LOCKED
        )
        UPDATE "OutboxEvent" AS event
        SET "publishingAt" = NOW()
        FROM candidates
        WHERE event."id" = candidates."id"
        RETURNING event."id", event."type", event."aggregateId", event."payload"
      `);

      for (const event of events) {
        try {
          await redis.xadd(
            this.streamName,
            '*',
            'outboxId', event.id,
            'eventType', event.type,
            'aggregateId', event.aggregateId,
            'payload', JSON.stringify(event.payload),
          );
          await db.outboxEvent.updateMany({
            where: { id: event.id, publishedAt: null },
            data: { publishedAt: new Date(), publishingAt: null },
          });
        } catch (err: unknown) {
          await db.outboxEvent.updateMany({
            where: { id: event.id, publishedAt: null },
            data: { attempts: { increment: 1 }, lastError: String(err), publishingAt: null },
          }).catch(() => undefined);
          this.logger.error({ err, outboxId: event.id }, 'Outbox publication failed; event remains durable');
        }
      }
    } catch (err: unknown) {
      this.logger.error({ err }, 'Outbox scan failed; durable events will be retried');
    }
  }

  private async initConsumerGroup() {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      try {
        await redis.xgroup('CREATE', this.streamName, this.groupName, '0', 'MKSTREAM');
        this.logger.info(`Consumer Group '${this.groupName}' initialized on '${this.streamName}'`);
        this.consumeLoop();
        this.recoveryLoop();
        return;
      } catch (err: unknown) {
        const error = err as Error;
        if (error.message.includes('BUSYGROUP')) {
          this.consumeLoop();
          this.recoveryLoop();
          return;
        }
        this.logger.warn({ attempt, err: error }, 'Redis stream group not ready; retrying');
        await new Promise((resolve) => setTimeout(resolve, Math.min(1000 * (attempt + 1), 5000)));
      }
    }
    this.logger.error('Redis stream consumer disabled after initialization retries');
  }

  private async consumeLoop() {
    while (true) {
      try {
        const result = await (redis.xreadgroup as any)('GROUP', this.groupName, this.consumerName, 'BLOCK', 5000, 'COUNT', 10, 'STREAMS', this.streamName, '>');
        if (result) {
          const messages = result[0][1];
          for (const message of messages) {
            const [messageId, fields] = message;
            const payload = decodeStreamPayload(fields as string[]);
            this.logger.info({ messageId, payload }, 'Processing reserved order...');
            await redis.xack(this.streamName, this.groupName, messageId);
          }
        }
      } catch (err) {
        this.logger.error(err, 'Stream consumer error');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  }

  private async recoveryLoop() {
    setInterval(async () => {
      try {
        const pending = await redis.xpending(this.streamName, this.groupName, '-', '+', 100);
        for (const p of pending) {
              const [messageId, consumer, idleTime, deliveryCount] = p as any;
          if (idleTime > 60000) {
            this.logger.warn({ messageId, consumer, idleTime }, 'Claiming orphaned message');
            const claimed = await redis.xclaim(this.streamName, this.groupName, this.consumerName, 60000, messageId);
            if (claimed && claimed.length > 0) {
              const payload = decodeStreamPayload(claimed[0][1] as string[]);
              this.logger.info({ messageId, payload }, 'Processing recovered order...');
              await redis.xack(this.streamName, this.groupName, messageId);
            }
          }
        }
      } catch (err) {
        this.logger.error(err, 'DLQ recovery error');
      }
    }, 30000);
  }
}
