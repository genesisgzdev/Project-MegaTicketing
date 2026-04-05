import { FastifyRequest, FastifyReply } from 'fastify';
import { getSystemHealth } from '../game-state';

/**
 * HealthController: Provides diagnostic information about the system.
 */
export class HealthController {
  /**
   * Returns the current system health and security status.
   */
  async getHealth(request: FastifyRequest, reply: FastifyReply) {
    const health = await getSystemHealth();
    return reply.status(200).send(health);
  }
}
