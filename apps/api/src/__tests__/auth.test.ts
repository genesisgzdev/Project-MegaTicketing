import { afterEach, describe, expect, it, vi } from 'vitest';
import { SignJWT } from 'jose';

const originalEnv = { ...process.env };
const secret = 'authentication-test-secret-that-is-at-least-32-chars';
const subject = '123e4567-e89b-12d3-a456-426614174000';

afterEach(() => {
  for (const key of Object.keys(process.env)) delete process.env[key];
  Object.assign(process.env, originalEnv);
  vi.resetModules();
});

function testEnv() {
  Object.assign(process.env, {
    NODE_ENV: 'test',
    AUTH_TEST_BYPASS: 'false',
    STRIPE_SECRET_KEY: 'sk_test_authentication',
    DATABASE_URL: 'postgresql://postgres:password@localhost:5432/megaticketing',
    JWT_SECRET: secret,
    JWT_ISSUER: 'https://issuer.example.test',
    JWT_AUDIENCE: 'mega-ticketing-api',
  });
}

async function token(options: { expiry?: string; subject?: string } = {}) {
  const builder = new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(options.subject ?? subject)
    .setIssuer('https://issuer.example.test')
    .setAudience('mega-ticketing-api');
  if (options.expiry) builder.setExpirationTime(options.expiry);
  return builder.sign(new TextEncoder().encode(secret));
}

describe('JWT authentication claims', () => {
  it('accepts a valid, unexpired token for its subject', async () => {
    testEnv();
    const { authenticateUser } = await import('../auth?valid-token');
    const request = { headers: { authorization: `Bearer ${await token({ expiry: '2h' })}` } };

    await expect(authenticateUser(request as never, subject)).resolves.toBe(true);
  });

  it('rejects a signed token that has no expiration', async () => {
    testEnv();
    const { authenticateUser } = await import('../auth?missing-exp');
    const request = { headers: { authorization: `Bearer ${await token()}` } };

    await expect(authenticateUser(request as never, subject)).resolves.toBe(false);
  });

  it('rejects an expired token', async () => {
    testEnv();
    const { authenticateUser } = await import('../auth?expired');
    const request = { headers: { authorization: `Bearer ${await token({ expiry: '0s' })}` } };

    await expect(authenticateUser(request as never, subject)).resolves.toBe(false);
  });
});
