import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';
import { logger } from './logger';

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public context?: Record<string, any>,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function setupErrorHandler(app: FastifyInstance) {
  app.setErrorHandler(async (error, request, reply) => {
    const requestId = request.id;
    const { url, method } = request;

    let statusCode = 500;
    let code = 'INTERNAL_SERVER_ERROR';
    let message = 'An unexpected error occurred';
    let context: Record<string, any> = {};

    if (error instanceof AppError) {
      statusCode = error.statusCode;
      code = error.code;
      message = error.message;
      context = error.context || {};
    } else if (error instanceof ZodError) {
      statusCode = 400;
      code = 'VALIDATION_ERROR';
      message = 'Request validation failed';
      context = {
        errors: error.errors.map((e) => ({
          path: e.path.join('.'),
          message: e.message,
          code: e.code,
        })),
      };
    } else if (error instanceof Error) {
      if (typeof (error as Error & { statusCode?: number }).statusCode === 'number') {
        statusCode = (error as Error & { statusCode: number }).statusCode;
        code = statusCode === 429 ? 'RATE_LIMITED' : 'REQUEST_ERROR';
        message = error.message;
      }
      if (error.message.includes('ECONNREFUSED') || error.message.includes('TIMEOUT')) {
        statusCode = 503;
        code = 'SERVICE_UNAVAILABLE';
        message = 'A dependency is currently unavailable';
      }
    }

    logger.error(
      {
        requestId,
        method,
        url,
        statusCode,
        code,
        error: (error as Error).message,
        stack: (error as Error).stack,
        context,
      },
      'Request failed',
    );

    const errorResponse = {
      statusCode,
      code,
      message,
      requestId,
      timestamp: new Date().toISOString(),
      ...(statusCode === 400 && { context }),
    };

    reply.status(statusCode).send(errorResponse);
  });
}

export function createAppError(
  statusCode: number,
  code: string,
  message: string,
  context?: Record<string, any>,
): AppError {
  return new AppError(statusCode, code, message, context);
}
