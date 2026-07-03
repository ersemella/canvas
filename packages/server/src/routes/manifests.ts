import type {Env} from '../types';

/**
 * `/manifests/*` routes. The actual storage and CRUD live in the
 * ManifestRegistry DO. This module owns:
 *   - URL pattern matching
 *   - Edge cache wrapping for GETs (caches.default, 60s)
 *   - Bearer token check for POST /upload
 */
export async function handleManifestsRoute(
  request: Request,
  env: Env,
  url: URL,
): Promise<Response> {
  const stub = env.MANIFEST_REGISTRY.get(env.MANIFEST_REGISTRY.idFromName('global'));

  // GET /manifests/index.json
  if (request.method === 'GET' && url.pathname === '/manifests/index.json') {
    return cached(request, async () => {
      const r = await stub.fetch('https://do/index.json');
      return withManifestHeaders(r);
    });
  }

  // GET /manifests/<id>/game.json
  if (request.method === 'GET') {
    const m = url.pathname.match(/^\/manifests\/([^/]+)\/game\.json$/);
    if (m) {
      const gameId = m[1]!;
      return cached(request, async () => {
        const r = await stub.fetch(`https://do/game/${encodeURIComponent(gameId)}`);
        return withManifestHeaders(r);
      });
    }
  }

  // POST /manifests/upload (bearer-token gated)
  if (request.method === 'POST' && url.pathname === '/manifests/upload') {
    const auth = request.headers.get('Authorization') ?? '';
    if (!env.MANIFEST_ADMIN_TOKEN || auth !== `Bearer ${env.MANIFEST_ADMIN_TOKEN}`) {
      return new Response(JSON.stringify({error: 'unauthorized'}), {
        status: 401,
        headers: {'Content-Type': 'application/json'},
      });
    }
    const r = await stub.fetch('https://do/upload', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: await request.text(),
    });
    // Best-effort cache invalidation for the affected manifests.
    try {
      const cache = caches.default;
      const origin = url.origin;
      await cache.delete(`${origin}/manifests/index.json`);
      // We don't know the per-game ids without re-parsing; rely on 60s TTL.
    } catch {
      // ignore cache errors
    }
    return r;
  }

  return new Response('not found', {status: 404});
}

async function cached(request: Request, build: () => Promise<Response>): Promise<Response> {
  const cache = caches.default;
  const hit = await cache.match(request);
  if (hit) return hit;
  const fresh = await build();
  if (fresh.ok) {
    // clone before caching since the body is single-use
    await cache.put(request, fresh.clone());
  }
  return fresh;
}

function withManifestHeaders(res: Response): Response {
  if (!res.ok) return res;
  const headers = new Headers(res.headers);
  headers.set('Content-Type', 'application/json');
  headers.set('Cache-Control', 'public, max-age=60');
  return new Response(res.body, {status: res.status, statusText: res.statusText, headers});
}
