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
          let lastId = data.lastId || '0-0';
          
          if (!eventId) return;
          
          if (subscriber) {
            subscriber.quit();
          }
          
          // We must use a separate connection for blocking commands.
          subscriber = redis.duplicate();
          this.app.log.info({ eventId, lastId }, 'Client subscribed to Redis Stream');

          const streamKey = `stream:event:${eventId}`;
          
          // Poll the Redis Stream
          (async () => {
            while (!isClosed) {
              try {
                // Blocks for 5 seconds to periodically check connection state
                const result = await subscriber.xread('BLOCK', 5000, 'STREAMS', streamKey, lastId);
                
                if (result) {
                  const [stream] = result;
                  const [streamName, messages] = stream;
                  
                  for (const msg of messages) {
                    const [id, fields] = msg;
                    lastId = id;
                    
                    const payload: Record<string, string> = {};
                    for (let i = 0; i < fields.length; i += 2) {
                      payload[fields[i]] = fields[i + 1];
                    }
                    
                    if (!isClosed) {
                      connection.socket.send(JSON.stringify({
                        type: 'STREAM_EVENT',
                        id,
                        eventId,
                        payload
                      }));
                    }
                  }
                }
              } catch (err: unknown) {
                if ((err as Error).message?.includes('Connection is closed')) {
                  break;
                }
                this.app.log.error(err, 'Redis stream read error');
                // Brief pause to prevent tight loop on error
                await new Promise(resolve => setTimeout(resolve, 1000));
              }
            }
          })();
        }
      } catch (e) {
        this.app.log.warn('Malformed WebSocket payload');
      }
    });

    connection.socket.on('close', () => {
      isClosed = true;
      if (subscriber) {
        subscriber.quit();
        subscriber = null;
      }
    });
  }
}
