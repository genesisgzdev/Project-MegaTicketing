import { FastifyInstance } from 'fastify';

/**
 * SecurityController: Manages real-time security signals and defenses.
 */
export class SecurityController {
  constructor(private app: FastifyInstance, private onDefenseToggle: (status: boolean) => void) {}

  /**
   * Handles incoming WebSocket connections for security monitoring.
   * Using any for connection to bypass Fastify version-specific type mismatches.
   */
  handleConnection(connection: any) {
    connection.socket.on('message', (message: Buffer) => {
      try {
        const data = JSON.parse(message.toString());
        if (data.type === 'ACTIVATE_DEFENSE') {
          this.onDefenseToggle(true);
          this.app.log.info('Security shield engaged');
        }
        if (data.type === 'DEACTIVATE_DEFENSE') {
          this.onDefenseToggle(false);
          this.app.log.info('Security shield disengaged');
        }
      } catch (e) {
        this.app.log.warn('Malformed WebSocket payload');
      }
    });
  }
}


