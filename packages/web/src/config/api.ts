/**
 * Base URL of the canvas-server Worker. Empty in dev, where Vite proxies
 * /rooms and /manifests to `wrangler dev`. In prod it is baked in at build
 * time from VITE_API_URL; a trailing slash is stripped so `${API_URL}/rooms`
 * never becomes `//rooms`, which the Worker's routes don't match.
 */
export const API_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/+$/, '');
