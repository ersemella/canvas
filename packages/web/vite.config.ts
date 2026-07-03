import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';

// In dev, run `wrangler dev` from packages/server (default port 8787) and
// leave VITE_API_URL empty in your local .env. Vite then proxies /rooms and
// /manifests to the local Worker, including WebSocket upgrades.
export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  server: {
    port: 3000,
    proxy: {
      '/rooms': {
        target: 'http://localhost:8787',
        ws: true,
        changeOrigin: true,
      },
      '/manifests': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
    },
  },
});
