import { FastifyInstance } from 'fastify';
import { SecurityService } from '../services/security.service';

/**
 * Controller to handle security management and real-time updates via WebSocket.
 */
export class SecurityController {
  constructor(private securityService: SecurityService) {}

  /**
   * Registers the WebSocket route and handles real-time signaling.
   * 
   * @param fastify - The server instance with @fastify/websocket registered.
   */
  registerRoutes(fastify: FastifyInstance): void {
    fastify.register(async (instance) => {
      instance.get('/ws', { websocket: true }, (connection) => {
        connection.socket.on('message', (message) => {
          try {
            const data = JSON.parse(message.toString());
            
            // Atomic handling of security defense signals
            if (data.type === 'ACTIVATE_DEFENSE') {
              this.securityService.activate();
              instance.log.info('Security shield engaged via WebSocket command');
            }
            if (data.type === 'DEACTIVATE_DEFENSE') {
              this.securityService.deactivate();
              instance.log.info('Security shield disengaged via WebSocket command');
            }
          } catch (e) {
            instance.log.warn('Failed to parse incoming WebSocket payload');
          }
        });
      });
    });
  }
}
