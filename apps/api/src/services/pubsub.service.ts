import { FastifyBaseLogger } from 'fastify';
import redis, { waitForRedisReady } from '../redis';
import { db } from '../db';
import { randomUUID } from 'node:crypto';
import { setTimeout as pause } from 'node:timers/promises';
import { Prisma } from '@mega-ticketing/database';

type ClaimedOutboxEvent = {
  id: string;
  type: string;
  aggregateId: string;
  payload: Prisma.JsonValue;
};


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

function decodeStreamEnvelope(fields: string[]): { outboxId?: string; payload: Record<string, unknown> } {
  const values: Record<string, string> = {};
  for (let index = 0; index + 1 < fields.length; index += 2) values[fields[index]] = fields[index + 1];
  const payload = values.payload ? JSON.parse(values.payload) as Record<string, unknown> : {};
  return { outboxId: values.outboxId, payload: { ...payload, eventType: values.eventType, aggregateId: values.aggregateId } };
}

export class PubSubService {
  private readonly streamName = 'stream:orders:reserved';
  private readonly groupName = 'order_processors';
  private readonly consumerName = `node_${process.pid}_${Date.now()}`;

  private running = false;
  private readonly shutdown = new AbortController();
  // BLOCK must never share the connection used by API locks and health checks.
  private readonly reader = redis.duplicate({ maxRetriesPerRequest: 1, commandTimeout: 7000 });
  private tasks: Promise<void>[] = [];

  constructor(private logger: FastifyBaseLogger) {
    this.reader.on('error', (err) => this.logger.warn({ err }, 'Stream connection error'));
  }

  async start() {
    if (this.running) return;
    await Promise.all([waitForRedisReady(redis), waitForRedisReady(this.reader), db.$connect()]);
    try {
      await redis.xgroup('CREATE', this.streamName, this.groupName, '0', 'MKSTREAM');
    } catch (err) {
      if (!(err instanceof Error) || !err.message.includes('BUSYGROUP')) throw err;
    }
    this.running = true;
    this.tasks = [this.consumeLoop(), this.periodic(() => this.publishOutboxBatch(), 1000),
      this.periodic(() => this.recoverPending(), 30000)];
  }

  async stop() {
    this.running = false;
    this.shutdown.abort();
    this.reader.disconnect();
    await Promise.allSettled(this.tasks);
  }

  private async periodic(work: () => Promise<void>, interval: number) {
    while (this.running) {
      await work();
      await pause(interval, undefined, { signal: this.shutdown.signal }).catch(() => undefined);
    }
  }

  private async publishOutboxBatch() {
    const publishingToken = randomUUID();
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
        SET "publishingAt" = NOW(), "publishingToken" = ${publishingToken}
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
            where: { id: event.id, publishedAt: null, publishingToken },
            data: { publishedAt: new Date(), publishingAt: null, publishingToken: null },
          });
        } catch (err: unknown) {
          await db.outboxEvent.updateMany({
            where: { id: event.id, publishedAt: null, publishingToken },
            data: { attempts: { increment: 1 }, lastError: String(err), publishingAt: null, publishingToken: null },
          }).catch(() => undefined);
          this.logger.error({ err, outboxId: event.id }, 'Outbox publication failed; event remains durable');
        }
      }
    } catch (err: unknown) {
      this.logger.error({ err }, 'Outbox scan failed; durable events will be retried');
    }
  }

  private async processMessage(messageId: string, fields: string[]) {
    const envelope = decodeStreamEnvelope(fields);
    if (!envelope.outboxId) {
      this.logger.warn({ messageId }, 'Ignoring stream event without outboxId');
      return;
    }
    try {
      await db.processedOrderEvent.create({ data: { id: envelope.outboxId } });
    } catch (err: unknown) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        this.logger.info({ messageId, outboxId: envelope.outboxId }, 'Skipping duplicate order event');
        return;
      }
      throw err;
    }
    this.logger.info({ messageId, outboxId: envelope.outboxId, payload: envelope.payload }, 'Order event recorded');
  }

  private async consumeLoop() {
    while (this.running) {
      try {
        const result = await (this.reader.xreadgroup as any)('GROUP', this.groupName, this.consumerName, 'BLOCK', 1000, 'COUNT', 10, 'STREAMS', this.streamName, '>');
        if (result) {
          const messages = result[0][1];
          for (const message of messages) {
            const [messageId, fields] = message;
            await this.processMessage(messageId, fields as string[]);
            await redis.xack(this.streamName, this.groupName, messageId);
          }
        }
      } catch (err) {
        if (!this.running) break;
        this.logger.error(err, 'Stream consumer error');
        await pause(2000, undefined, { signal: this.shutdown.signal }).catch(() => undefined);
      }
    }
  }

  private async recoverPending() {
      try {
        const pending = await redis.xpending(this.streamName, this.groupName, '-', '+', 100);
        for (const p of pending) {
              const [messageId, consumer, idleTime, deliveryCount] = p as any;
          if (idleTime > 60000) {
            this.logger.warn({ messageId, consumer, idleTime }, 'Claiming orphaned message');
            const claimed = await redis.xclaim(this.streamName, this.groupName, this.consumerName, 60000, messageId);
            if (claimed && claimed.length > 0) {
              await this.processMessage(messageId, claimed[0][1] as string[]);
              await redis.xack(this.streamName, this.groupName, messageId);
            }
          }
        }
      } catch (err) {
        this.logger.error(err, 'DLQ recovery error');
      }
  }
}
