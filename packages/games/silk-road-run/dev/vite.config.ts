import {fileURLToPath} from 'node:url';
import {defineConfig} from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';

// `pnpm dev` (vite --config dev/vite.config.ts) serves dev/index.html: this
// game alone against the engine source. Kept in dev/ so Vitest, which reads
// a package-root vite.config, doesn't pick it up.
export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  plugins: [tsconfigPaths({root: fileURLToPath(new URL('..', import.meta.url))})],
});
