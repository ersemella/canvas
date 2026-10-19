import type {Env} from './types';
import {GameRoom} from './durableObjects/GameRoom';
import {ManifestRegistry} from './durableObjects/ManifestRegistry';
import {RunRoom} from './durableObjects/RunRoom';
import {PlayerLedger} from './durableObjects/PlayerLedger';
import {handleRoomsRoute} from './routes/rooms';
import {handleRunsRoute} from './routes/runs';
import {withCors, preflight} from './cors';

// DO classes must be re-exported so the runtime can find them.
export {GameRoom, ManifestRegistry, RunRoom, PlayerLedger};

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
        url
      );
    }

    if (url.pathname.startsWith('/rooms')) {
      return withCors(await handleRoomsRoute(request, env, url), url);
    }

    if (url.pathname === '/runs' || url.pathname.startsWith('/runs/')) {
      return withCors(await handleRunsRoute(request, env, url), url);
    }

    return withCors(new Response('not found', {status: 404}), url);
  },
} satisfies ExportedHandler<Env>;
