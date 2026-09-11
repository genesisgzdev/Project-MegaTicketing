import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  root: path.resolve(import.meta.dirname),
  test: {
    environment: 'node',
    globals: true,
    setupFiles: [path.resolve(import.meta.dirname, './vitest.setup.ts')],
    include: ['src/__tests__/**/*.test.ts'],
    exclude: process.env.RUN_INTEGRATION === 'true'
      ? []
      : ['src/__tests__/runtime.integration.test.ts'],
  },
  resolve: {
    alias: {
      '@mega-ticketing/database': path.resolve(import.meta.dirname, '../../packages/database/src/index.ts'),
      '@mega-ticketing/shared': path.resolve(import.meta.dirname, '../../packages/shared/src/index.ts'),
    },
  },
});
