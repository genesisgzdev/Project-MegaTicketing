import { FastifyBaseLogger } from 'fastify';
import redis from '../redis';

export class PubSubService {
  private readonly streamName = 'stream:orders:reserved';
  private readonly groupName = 'order_processors';
  private readonly consumerName = `node_${process.pid}_${Date.now()}`;

  constructor(private logger: FastifyBaseLogger) {
    this.initConsumerGroup();
  }

  private async initConsumerGroup() {
    try {
      await redis.xgroup('CREATE', this.streamName, this.groupName, '0', 'MKSTREAM');
      this.logger.info(`Consumer Group '${this.groupName}' initialized on '${this.streamName}'`);
    } catch (err: unknown) {
      const error = err as Error;
      if (!error.message.includes('BUSYGROUP')) {
        this.logger.error(error, 'Failed to initialize Redis Consumer Group');
      }
    }
    this.consumeLoop();
    this.recoveryLoop();
  }

  async publishOrderReserved(payload: Record<string, any>) {
    try {
      await redis.xadd(this.streamName, '*', 'payload', JSON.stringify(payload));
    } catch (err) {
      this.logger.error({ err, payload }, 'Critical failure: Could not append to Redis Stream');
      throw err;
    }
  }

  private async consumeLoop() {
    while (true) {
      try {
        const result = await redis.xreadgroup('GROUP', this.groupName, this.consumerName, 'BLOCK', 5000, 'COUNT', 10, 'STREAMS', this.streamName, '>');
        if (result) {
          const messages = result[0][1];
          for (const message of messages) {
            const [messageId, fields] = message;
            const payload = JSON.parse(fields[1]);
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
              const payload = JSON.parse((claimed[0][1] as string[])[1]);
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
