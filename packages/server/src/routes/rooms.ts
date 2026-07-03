import type {Env} from '../types';

/**
 * `/rooms/*` routes. All actual room state lives in per-room GameRoom DOs
 * keyed by `idFromName(roomId)`.
 *
 * Routes:
 *   POST /rooms                 -> create room (returns roomId)
 *   GET  /rooms/:id             -> room metadata
 *   POST /rooms/:id/join        -> validate, return wsUrl
 *   GET  /rooms/:id/ws          -> WebSocket upgrade (forwards to DO)
 */
export async function handleRoomsRoute(
  request: Request,
  env: Env,
  url: URL,
): Promise<Response> {
  // POST /rooms — create a fresh room.
  if (request.method === 'POST' && url.pathname === '/rooms') {
    return createRoom(request, env);
  }

  const match = url.pathname.match(/^\/rooms\/([^/]+)(\/[^?]*)?$/);
  if (!match) return notFound();
  const roomId = match[1]!;
  const sub = match[2] ?? '';
  const stub = env.GAME_ROOM.get(env.GAME_ROOM.idFromName(roomId));

  // GET /rooms/:id  -> /meta on DO
  if (request.method === 'GET' && sub === '') {
    return stub.fetch('https://do/meta');
  }

  // POST /rooms/:id/join  -> /join on DO + wsUrl construction
  if (request.method === 'POST' && sub === '/join') {
    const body = await request.text();
    const r = await stub.fetch('https://do/join', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body,
    });
    if (!r.ok) return r;
    const data = (await r.json()) as {roomId: string; serverSystem: string};
    const wsUrl = buildWsUrl(url, roomId);
    return new Response(
      JSON.stringify({roomId: data.roomId, wsUrl, serverSystem: data.serverSystem}),
      {status: 200, headers: {'Content-Type': 'application/json'}},
    );
  }

  // GET /rooms/:id/ws (Upgrade: websocket) -> /ws on DO
  if (sub === '/ws') {
    const upgrade = request.headers.get('Upgrade');
    if (upgrade !== 'websocket') return new Response('expected websocket', {status: 426});
    const fwd = new URL('https://do/ws');
    fwd.search = url.search;
    return stub.fetch(fwd.toString(), request);
  }

  return notFound();
}

async function createRoom(request: Request, env: Env): Promise<Response> {
  const body = (await request.json().catch(() => ({}))) as {
    hostName?: string;
    serverSystem?: string;
    maxPlayers?: number;
  };
  if (!body.hostName || !body.serverSystem) {
    return new Response(JSON.stringify({error: 'missing hostName or serverSystem'}), {
      status: 400,
      headers: {'Content-Type': 'application/json'},
    });
  }
  const maxPlayers = body.maxPlayers ?? 6;

  // Generate a roomId and seed the DO. `idFromName` is deterministic so
  // collisions deterministically map to the same DO; the DO returns 409 on
  // re-init and we retry with a new id. Probability of collision in 2^40 is
  // effectively zero for our scale.
  for (let attempt = 0; attempt < 5; attempt++) {
    const roomId = generateRoomId();
    const stub = env.GAME_ROOM.get(env.GAME_ROOM.idFromName(roomId));
    const r = await stub.fetch('https://do/init', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({roomId, serverSystem: body.serverSystem, maxPlayers}),
    });
    if (r.ok) {
      const data = (await r.json()) as {roomId: string; serverSystem: string};
      return new Response(
        JSON.stringify({roomId: data.roomId, serverSystem: data.serverSystem}),
        {status: 200, headers: {'Content-Type': 'application/json'}},
      );
    }
    if (r.status !== 409) return r;
    // 409: deterministic id collision; try again.
  }
  return new Response(JSON.stringify({error: 'could_not_allocate_room'}), {
    status: 500,
    headers: {'Content-Type': 'application/json'},
  });
}

/** 8-char uppercase alphanumeric (avoiding ambiguous chars). */
function generateRoomId(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const arr = new Uint32Array(8);
  crypto.getRandomValues(arr);
  let id = '';
  for (let i = 0; i < 8; i++) id += alphabet[arr[i]! % alphabet.length];
  return id;
}

function buildWsUrl(url: URL, roomId: string): string {
  // The frontend appends `?roomId=…&playerName=…` to whatever we return,
  // so we keep the query empty here and provide the path.
  const proto = url.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${url.host}/rooms/${roomId}/ws`;
}

function notFound(): Response {
  return new Response('not found', {status: 404});
}
