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
    const body = await request.text();
    const r = await stub.fetch('https://do/upload', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body,
    });
    if (r.ok) await purgeManifestCache(url.origin, body);
    return r;
  }

  return new Response('not found', {status: 404});
}

/** Drops the cached index and every uploaded game's manifest so new versions are served at once. */
async function purgeManifestCache(origin: string, uploadBody: string): Promise<void> {
  let ids: string[] = [];
  try {
    const parsed = JSON.parse(uploadBody) as {games?: Array<{id?: unknown}>};
    ids = (parsed.games ?? []).map((g) => g.id).filter((id): id is string => typeof id === 'string');
  } catch {
    // The DO already accepted the body, so this shouldn't happen; still purge the index.
  }
  const urls = [
    `${origin}/manifests/index.json`,
    ...ids.map((id) => `${origin}/manifests/${encodeURIComponent(id)}/game.json`),
  ];
  try {
    await Promise.all(urls.map((u) => caches.default.delete(u)));
  } catch {
    // Cache errors only mean a stale entry lives out its 60s TTL.
  }
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
