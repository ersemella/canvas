import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'CanvasEngine',
      fileName: 'canvas-engine',
      formats: ['es', 'cjs'],
    },
    rollupOptions: {
      external: ['nanoid'],
    },
  },
});
