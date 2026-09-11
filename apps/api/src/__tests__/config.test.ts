import { afterEach, describe, expect, it, vi } from 'vitest';

const originalEnv = { ...process.env };

afterEach(() => {
  for (const key of Object.keys(process.env)) delete process.env[key];
  Object.assign(process.env, originalEnv);
  vi.resetModules();
});

function productionEnv() {
  Object.assign(process.env, {
    NODE_ENV: 'production',
    AUTH_TEST_BYPASS: 'false',
    STRIPE_SECRET_KEY: 'sk_test_configuration_check',
    DATABASE_URL: 'postgresql://postgres:password@localhost:5432/megaticketing',
    JWT_SECRET: 'configuration-test-secret-that-is-at-least-32-chars',
  });
  delete process.env.JWT_ISSUER;
  delete process.env.JWT_AUDIENCE;
}

describe('production authentication configuration', () => {
  it('refuses to start without issuer and audience', async () => {
    productionEnv();

    await expect(import('../config?missing-production-claims')).rejects.toThrow(/JWT_ISSUER|JWT_AUDIENCE/);
  });

  it('loads when issuer and audience are explicitly configured', async () => {
    productionEnv();
    process.env.JWT_ISSUER = 'https://issuer.example.test';
    process.env.JWT_AUDIENCE = 'mega-ticketing-api';

    const { config } = await import('../config?valid-production-claims');
    expect(config.JWT_ISSUER).toBe('https://issuer.example.test');
    expect(config.JWT_AUDIENCE).toBe('mega-ticketing-api');
  });
});
