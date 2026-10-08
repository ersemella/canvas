/** CORS helpers. */

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '3600',
};

/**
 * Routes browsers may not call cross-origin. The manifest upload is only used
 * by the deploy script (not a browser), so it gets no CORS headers at all and
 * a page on another origin can't drive it even with a leaked token.
 */
const NO_CORS_PATHS = new Set(['/manifests/upload']);

export function preflight(url: URL): Response {
  if (NO_CORS_PATHS.has(url.pathname)) return new Response(null, {status: 204});
  return new Response(null, {status: 204, headers: CORS_HEADERS});
}

export function withCors(res: Response, url: URL): Response {
  // Don't touch WebSocket upgrade responses — those carry their own protocol.
  if (res.status === 101) return res;
  if (NO_CORS_PATHS.has(url.pathname)) return res;
  const headers = new Headers(res.headers);
  for (const [k, v] of Object.entries(CORS_HEADERS)) headers.set(k, v);
  return new Response(res.body, {status: res.status, statusText: res.statusText, headers});
}
