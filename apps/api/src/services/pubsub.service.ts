import { PubSub } from '@google-cloud/pubsub';
import { FastifyBaseLogger } from 'fastify';
import { config } from '../config';

/**
 * Industrial-grade Pub/Sub Service.
 * Orchestrates asynchronous order fulfillment streams with robust error handling and retries.
 */
export class PubSubService {
  private pubsub: PubSub;
  private topicName: string;

  constructor(private logger: FastifyBaseLogger) {
    this.pubsub = new PubSub({
      projectId: config.GCP_PROJECT_ID,
      // The SDK includes default retry logic for transient errors.
      // We can further customize this if needed.
    });
    this.topicName = config.PUBSUB_ORDERS_TOPIC;
  }

  /**
   * Publishes a 'order.reserved' event to the processing pipeline.
   * Includes exponential backoff retries via the Google Cloud SDK.
   * @param payload - Data containing event, seat, and user IDs.
   */
  async publishOrderReserved(payload: { eventId: string; seatId: string; userId: string }): Promise<void> {
    const data = JSON.stringify({
      ...payload,
      event: 'order.reserved',
      version: '1.0.0',
      occurredAt: new Date().toISOString()
    });

    const dataBuffer = Buffer.from(data);

    try {
      this.logger.debug({ topic: this.topicName, payload }, 'Attempting to publish message to Pub/Sub');
      
      const messageId = await this.pubsub
        .topic(this.topicName)
        .publishMessage({ 
          data: dataBuffer,
          attributes: {
            eventId: payload.eventId,
            userId: payload.userId,
            seatId: payload.seatId,
            origin: 'api-service'
          }
        });

      this.logger.info({ messageId, topic: this.topicName, eventId: payload.eventId }, 'Order event streamed successfully');
    } catch (error) {
      // Professional logging with full error context
      this.logger.error({ 
        err: error, 
        topic: this.topicName, 
        payload,
        message: (error as Error).message 
      }, 'Critical Pub/Sub stream emission failure');

      // In a real-world high-concurrency system, we would implement an Outbox Pattern here:
      // 1. Save the message to a 'pending_messages' table in our DB.
      // 2. A separate background worker would retry publishing these messages.
      // For now, we ensure the failure is logged for DLQ/Manual intervention.
      
      // We don't rethrow to avoid failing the HTTP request if the reservation in DB/Redis was successful.
      // The seat is already locked, so we prioritize UI responsiveness while relying on logging for consistency.
    }
  }
}
