/** CORS helpers. */

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '3600',
};

export function preflight(): Response {
  return new Response(null, {status: 204, headers: CORS_HEADERS});
}

export function withCors(res: Response): Response {
  // Don't touch WebSocket upgrade responses — those carry their own protocol.
  if (res.status === 101) return res;
  const headers = new Headers(res.headers);
  for (const [k, v] of Object.entries(CORS_HEADERS)) headers.set(k, v);
  return new Response(res.body, {status: res.status, statusText: res.statusText, headers});
}
