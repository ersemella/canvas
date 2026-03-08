import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'CanvasSnake',
      fileName: 'canvas-snake',
      formats: ['es'],
    },
    rollupOptions: {
      external: ['@canvas/engine'],
    },
  },
  resolve: {
    alias: {
      '@canvas/engine': resolve(__dirname, '../../engine/src/index.ts'),
    },
  },
});
