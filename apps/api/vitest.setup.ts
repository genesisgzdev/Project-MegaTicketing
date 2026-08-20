process.env.NODE_ENV = 'test';
process.env.AUTH_TEST_BYPASS = 'true';
process.env.STRIPE_SECRET_KEY ??= 'sk_test_vitest';
process.env.DATABASE_URL ??= 'postgresql://postgres:password@localhost:5432/megaticketing';
process.env.JWT_SECRET ??= 'vitest-only-secret-that-is-at-least-32-chars';
