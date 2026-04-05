import { PrismaClient } from '@prisma/client';

const isProduction = process.env.NODE_ENV === 'production';

export const prisma = new PrismaClient({
  log: isProduction ? ['error'] : ['query', 'info', 'warn', 'error'],
});

prisma.$on('beforeExit' as any, async () => {
  console.log('Database Disconnecting...');
});

export * from '@prisma/client';
