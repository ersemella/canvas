import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@canvas/engine': new URL('../../engine/src/index.ts', import.meta.url).pathname,
    },
  },
});
