import { z } from 'zod';

const configSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(3001),
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().default(6379),
  REDIS_PASSWORD: z.string().optional(),
  STRIPE_SECRET_KEY: z.string().min(1, 'Stripe secret key is required'),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  DATABASE_URL: z.string().min(1, 'Database URL is required'),
  JWT_SECRET: z.string().min(32, 'JWT Secret must be at least 32 characters'),
  GCP_PROJECT_ID: z.string().optional(),
  PUBSUB_ORDERS_TOPIC: z.string().default('orders-topic'),
  CORS_ORIGINS: z.string().default('http://localhost:5173'),
  WS_ADMIN_TOKEN: z.string().optional(),
});

export const config = configSchema.parse(process.env);

export type Config = z.infer<typeof configSchema>;

