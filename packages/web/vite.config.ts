import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@canvas/engine': resolve(__dirname, '../engine/src/index.ts'),
      '@canvas/games-snake': resolve(__dirname, '../games/snake/src/index.ts'),
    },
  },
  server: {
    port: 3000,
  },
});
