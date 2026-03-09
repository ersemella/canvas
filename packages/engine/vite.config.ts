import {defineConfig} from 'vite';
import {resolve} from 'path';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
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
