import type {Env, RunResponse} from '../types';
import {playerKeyHash} from '../playerKey';
import {runSystemRegistry} from '../games/registry';

/**
 * `/runs/*` routes: single-player runs, one `RunRoom` Durable Object each,
 * owned by an anonymous player key (docs/plans/roguelike-tactics/
 * architecture.md, D3, D4, D7). Plain HTTP; every response carries the
 * run's whole view. Every route needs `Authorization: Bearer <player key>`.
 *
 * Routes:
 *   POST /runs                {game}       -> start a run; abandons the key's active one
 *   GET  /runs/active                      -> {activeRunId} for this key
 *   GET  /runs/:id                         -> the current view (resume after a reload)
 *   POST /runs/:id/deploy     {placements} -> place the party; starts the clock
 *   POST /runs/:id/turn       {move?, action, actFirst?} -> one turn, then AI turns up to yours
 *   POST /runs/:id/abandon                 -> give up the run
 */
export async function handleRunsRoute(request: Request, env: Env, url: URL): Promise<Response> {
  const owner = await playerKeyHash(request);
  if (!owner)
    return json({error: 'no_player_key', message: 'Missing or malformed player key.'}, 401);

  if (url.pathname === '/runs' && request.method === 'POST') return startRun(request, env, owner);
  if (url.pathname === '/runs/active' && request.method === 'GET') {
    return ledger(env, owner).fetch('https://do/active');
  }

  const match = url.pathname.match(/^\/runs\/([A-Za-z0-9]{1,32})(\/[a-z]+)?$/);
  if (!match) return json({error: 'not_found'}, 404);
  const room = runRoom(env, match[1]!);
  const sub = match[2] ?? '';
  const headers = {'X-Owner': owner, 'Content-Type': 'application/json'};

  if (request.method === 'GET' && sub === '') return room.fetch('https://do/view', {headers});
  if (request.method === 'POST' && (sub === '/deploy' || sub === '/turn')) {
    const body = await readBody(request);
    if (body === undefined)
      return json({error: 'bad_request', message: 'Malformed request body.'}, 400);
    const action = {...(body as object), type: sub === '/deploy' ? 'deploy' : 'turn'};
    return room.fetch('https://do/action', {method: 'POST', headers, body: JSON.stringify(action)});
  }
  if (request.method === 'POST' && sub === '/abandon')
    return room.fetch('https://do/abandon', {method: 'POST', headers});
  return json({error: 'not_found'}, 404);
}

async function startRun(request: Request, env: Env, owner: string): Promise<Response> {
  // Each run is its own Durable Object, so cap how fast one client starts them.
  if (env.ROOM_CREATE_LIMITER) {
    const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
    const {success} = await env.ROOM_CREATE_LIMITER.limit({key: `runs:${ip}`});
    if (!success) {
      return json(
        {error: 'too_many_runs', message: 'Too many runs started — try again in a minute'},
        429
      );
    }
  }
  const body = ((await readBody(request)) ?? {}) as {game?: unknown};
  const game = typeof body.game === 'string' ? body.game : '';
  if (!runSystemRegistry.has(game))
    return json({error: 'unknown_game', message: 'Unknown game.'}, 400);

  for (let attempt = 0; attempt < 5; attempt++) {
    const runId = randomId();
    const seed = crypto.getRandomValues(new Uint32Array(1))[0]!;
    const init = await runRoom(env, runId).fetch('https://do/init', {
      method: 'POST',
      body: JSON.stringify({runId, game, ownerHash: owner, seed}),
    });
    if (init.status === 409) continue; // id collision: try another
    if (!init.ok) return init;
    const run = (await init.json()) as RunResponse;

    // One active run per key (D3): the previous one is abandoned.
    const started = await ledger(env, owner).fetch('https://do/start', {
      method: 'POST',
      body: JSON.stringify({runId}),
    });
    const {previousRunId} = (await started.json()) as {previousRunId: string | null};
    if (previousRunId && previousRunId !== runId) {
      await runRoom(env, previousRunId).fetch('https://do/abandon', {
        method: 'POST',
        headers: {'X-Owner': owner},
      });
    }
    return json(run, 201);
  }
  return json({error: 'could_not_allocate_run'}, 500);
}

function runRoom(env: Env, runId: string): DurableObjectStub {
  return env.RUN_ROOM.get(env.RUN_ROOM.idFromName(`run:${runId}`));
}

function ledger(env: Env, owner: string): DurableObjectStub {
  return env.PLAYER_LEDGER.get(env.PLAYER_LEDGER.idFromName(owner));
}

/** The JSON body, or undefined if it's missing, too large or malformed. */
async function readBody(request: Request): Promise<unknown> {
  const text = await request.text();
  if (text.length > 16_000) return undefined;
  if (text === '') return {};
  try {
    const value: unknown = JSON.parse(text);
    return value && typeof value === 'object' && !Array.isArray(value) ? value : undefined;
  } catch {
    return undefined;
  }
}

/** 16 random characters from a 62-symbol alphabet (about 95 bits). */
function randomId(): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return [...bytes].map((b) => alphabet[b % alphabet.length]).join('');
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {'Content-Type': 'application/json'},
  });
}
