import type {Env} from './types';
import {GameRoom} from './durableObjects/GameRoom';
import {ManifestRegistry} from './durableObjects/ManifestRegistry';
import {handleRoomsRoute} from './routes/rooms';
import {handleManifestsRoute} from './routes/manifests';
import {withCors, preflight} from './cors';

// DO classes must be re-exported so the runtime can find them.
export {GameRoom, ManifestRegistry};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return preflight(url);

    if (url.pathname === '/' || url.pathname === '/health') {
      return withCors(
        new Response(JSON.stringify({ok: true, service: 'canvas-server'}), {
          status: 200,
          headers: {'Content-Type': 'application/json'},
        }),
        url,
      );
    }

    if (url.pathname.startsWith('/rooms')) {
      return withCors(await handleRoomsRoute(request, env, url), url);
    }

    if (url.pathname.startsWith('/manifests')) {
      return withCors(await handleManifestsRoute(request, env, url), url);
    }

    return withCors(new Response('not found', {status: 404}), url);
  },
} satisfies ExportedHandler<Env>;
