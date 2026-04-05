import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { HealthService } from '../services/health.service';

/**
 * Controller for managing and providing health and diagnostic information.
 */
export class HealthController {
  constructor(private healthService: HealthService) {}

  /**
   * Registers health diagnostic routes with the Fastify server.
   * 
   * @param fastify - The server instance.
   */
  registerRoutes(fastify: FastifyInstance): void {
    fastify.get('/health', this.handleHealth.bind(this));
  }

  /**
   * Processes requests for a system-wide health status report.
   * 
   * @param request - Incoming Fastify request.
   * @param reply - Response object used to send diagnostic results.
   */
  private async handleHealth(_request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const health = await this.healthService.check();
    return reply.send(health);
  }
}
