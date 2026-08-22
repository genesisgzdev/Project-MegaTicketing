import { jwtVerify } from 'jose';
import { FastifyRequest } from 'fastify';
import { config } from './config';

export async function authenticateUser(request: FastifyRequest, userId: string): Promise<boolean> {
  if (config.NODE_ENV === 'test' && config.AUTH_TEST_BYPASS) return true;
  const authorization = request.headers.authorization;
  if (!authorization?.startsWith('Bearer ')) return false;

  try {
    const { payload } = await jwtVerify(
      authorization.slice('Bearer '.length),
      new TextEncoder().encode(config.JWT_SECRET),
      { algorithms: ['HS256'] },
    );
    return typeof payload.sub === 'string' && payload.sub === userId;
  } catch {
    return false;
  }
}
