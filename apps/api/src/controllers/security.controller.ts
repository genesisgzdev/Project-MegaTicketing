import { FastifyInstance } from 'fastify';
import redis from '../redis';

/**
 * SecurityController: Manages real-time security signals and defenses.
 * It also handles real-time WebSocket state reconciliation by consuming Redis Streams via XREAD BLOCK.
 */
export class SecurityController {
  constructor(private app: FastifyInstance) {}

  /**
   * Handles incoming WebSocket connections for security monitoring and state sync.
   * Using SocketStream for connection.
   */
  handleConnection(connection: { socket: import('ws').WebSocket }, canControlDefense = false) {
    let subscriber: import('ioredis').Redis | null = null;
    let isClosed = false;
    let subscriptionGeneration = 0;
    let subscriptionChange = Promise.resolve();

    const stopSubscriber = async () => {
      subscriptionGeneration += 1;
      const current = subscriber;
      subscriber = null;
      if (current) await current.quit().catch(() => undefined);
    };

    connection.socket.on('message', async (message: Buffer) => {
      try {
        const data = JSON.parse(message.toString());
        
        if (data.type === 'ACTIVATE_DEFENSE') {
          if (canControlDefense) this.app.log.warn('Defense control is not wired to a runtime policy and was rejected');
        }
        
        if (data.type === 'DEACTIVATE_DEFENSE') {
          if (canControlDefense) this.app.log.warn('Defense control is not wired to a runtime policy and was rejected');
        }
        
        if (data.type === 'SUBSCRIBE_STREAM') {
          const eventId = data.eventId;
          const lastId = data.lastId || '0-0';

          if (typeof eventId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(eventId)) return;
          if (typeof lastId !== 'string' || !/^\d+-\d+$/.test(lastId)) return;

          // Serialize replacements so two rapid subscribe messages cannot
          // start readers out of order. Each reader keeps its own client and
          // generation, rather than closing over the mutable `subscriber`.
          subscriptionChange = subscriptionChange.then(async () => {
            await stopSubscriber();
            if (isClosed) return;

            const generation = subscriptionGeneration;
            const client = redis.duplicate();
            subscriber = client;
            this.app.log.info({ eventId, lastId }, 'Client subscribed to Redis Stream');

            const streamKey = `stream:event:${eventId}`;
            let cursor = lastId;
            try {
              while (!isClosed && generation === subscriptionGeneration) {
                try {
                  const result = await client.xread('BLOCK', 5000, 'STREAMS', streamKey, cursor);
                  if (!result) continue;
                  const [, messages] = result[0];
                  for (const [id, fields] of messages) {
                    cursor = id;
                    const payload: Record<string, string> = {};
                    for (let i = 0; i < fields.length; i += 2) payload[fields[i]] = fields[i + 1];
                    if (!isClosed && generation === subscriptionGeneration) {
                      connection.socket.send(JSON.stringify({ type: 'STREAM_EVENT', id, eventId, payload }));
                    }
                  }
                } catch (err: unknown) {
                  if (generation !== subscriptionGeneration || (err as Error).message?.includes('Connection is closed')) break;
                  this.app.log.error(err, 'Redis stream read error');
                  await new Promise(resolve => setTimeout(resolve, 1000));
                }
              }
            } finally {
              if (subscriber === client) subscriber = null;
              await client.quit().catch(() => undefined);
            }
          }).catch((err: unknown) => this.app.log.error({ err }, 'WebSocket subscription replacement failed'));
          await subscriptionChange;
        }
      } catch (e) {
        this.app.log.warn('Malformed WebSocket payload');
      }
    });

    connection.socket.on('close', () => {
      isClosed = true;
      void stopSubscriber();
    });
  }
}
