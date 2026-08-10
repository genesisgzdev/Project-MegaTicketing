import { FastifyInstance, FastifyRequest } from 'fastify';
import { randomUUID } from 'crypto';

export interface RequestContext {
  requestId: string;
  userId?: string;
  traceId: string;
  startTime: number;
  metadata: Record<string, any>;
}

declare global {
  namespace FastifyInstance {
    interface FastifyRequest {
      context: RequestContext;
    }
  }
}

export function setupRequestContext(app: FastifyInstance) {
  app.addHook('onRequest', async (request, reply) => {
    const requestId = request.headers['x-request-id'] as string || randomUUID();
    const traceId = request.headers['x-trace-id'] as string || randomUUID();

    request.context = {
      requestId,
      traceId,
      startTime: Date.now(),
      metadata: {},
    };

    reply.header('x-request-id', requestId);
    reply.header('x-trace-id', traceId);
  });

  app.addHook('onResponse', async (request, reply) => {
    const duration = Date.now() - request.context.startTime;
    request.log.info(
      {
        requestId: request.context.requestId,
        traceId: request.context.traceId,
        method: request.method,
        url: request.url,
        statusCode: reply.statusCode,
        duration: `${duration}ms`,
      },
      'Request completed',
    );
  });
}
