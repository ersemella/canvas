import type {
  Env,
  RoomRecord,
  RoomPlayer,
  SocketAttachment,
  WsClientMessage,
  WsServerMessage,
  PublicPlayerSummary,
  ServerSystem,
} from '../types';
import {serverSystemRegistry} from '../games/registry';

const TTL_MS = 24 * 60 * 60 * 1000;
const DEFAULT_CHIPS = 1000;

/**
 * One DurableObject instance per room. The room ID maps deterministically via
 * `idFromName(roomId)` so any Worker request reaches the same DO.
 *
 * Uses the WebSocket Hibernation API: `state.acceptWebSocket` lets the DO
 * evict from memory while connections stay open at the edge. Wake-up on
 * incoming message is ~10ms.
 */
export class GameRoom implements DurableObject {
  private state: DurableObjectState;
  private env: Env;
  private meta: RoomRecord | null = null;
  private gameState: unknown | null = null;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
    // Block all event delivery (including webSocketMessage) until storage is loaded.
    void this.state.blockConcurrencyWhile(async () => {
      this.meta = (await state.storage.get<RoomRecord>('meta')) ?? null;
      this.gameState = (await state.storage.get('gameState')) ?? null;
    });
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    switch (url.pathname) {
      case '/init':
        return this.handleInit(request);
      case '/meta':
        return this.handleMeta();
      case '/join':
        return this.handleJoin(request);
      case '/ws':
        return this.handleWsUpgrade(request, url);
    }
    return new Response('not found', {status: 404});
  }

  // --- Internal HTTP routes (called by the Worker via DO stub) ---

  private async handleInit(request: Request): Promise<Response> {
    if (this.meta) return json({error: 'already_initialized'}, 409);
    const body = (await request.json()) as {
      roomId: string;
      serverSystem: string;
      maxPlayers: number;
    };
    if (!body.roomId || !body.serverSystem || !body.maxPlayers) {
      return json({error: 'missing_fields'}, 400);
    }
    const now = Date.now();
    const meta: RoomRecord = {
      roomId: body.roomId,
      serverSystem: body.serverSystem,
      hostConnectionId: '',
      players: [],
      maxPlayers: body.maxPlayers,
      status: 'waiting',
      createdAt: now,
      expiresAt: now + TTL_MS,
    };
    this.meta = meta;
    await this.state.storage.put('meta', meta);
    await this.state.storage.setAlarm(meta.expiresAt);
    return json({ok: true, roomId: meta.roomId, serverSystem: meta.serverSystem});
  }

  private async handleMeta(): Promise<Response> {
    if (!this.meta) return json({error: 'not_found'}, 404);
    return json({
      roomId: this.meta.roomId,
      serverSystem: this.meta.serverSystem,
      status: this.meta.status,
      players: this.publicPlayers(),
      maxPlayers: this.meta.maxPlayers,
    });
  }

  /**
   * Validates that the room exists, is not full, and is not in progress.
   * Returns the canonical `serverSystem`. The Worker is responsible for
   * constructing the `wsUrl` since only it knows the public hostname.
   */
  private async handleJoin(request: Request): Promise<Response> {
    if (!this.meta) return json({error: 'room_not_found'}, 404);
    const body = (await request.json()) as {playerName?: string};
    if (!body.playerName) return json({error: 'missing_player_name'}, 400);
    if (this.meta.status === 'in_progress') {
      // Allow if this is a reconnect-by-name; otherwise reject.
      const existing = this.meta.players.find((p) => p.name === body.playerName);
      if (!existing) return json({error: 'game_in_progress'}, 400);
    } else if (this.meta.players.length >= this.meta.maxPlayers) {
      const existing = this.meta.players.find((p) => p.name === body.playerName);
      if (!existing) return json({error: 'room_full'}, 400);
    }
    return json({roomId: this.meta.roomId, serverSystem: this.meta.serverSystem});
  }

  private async handleWsUpgrade(request: Request, url: URL): Promise<Response> {
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('expected websocket', {status: 426});
    }
    if (!this.meta) return new Response('room not found', {status: 404});
    const playerName = url.searchParams.get('playerName');
    if (!playerName) return new Response('missing playerName', {status: 400});

    // Reconnect-by-name vs new seat
    const connectionId = crypto.randomUUID();
    const existingPlayer = this.meta.players.find((p) => p.name === playerName);
    const liveAttachments = this.state.getWebSockets().map((s) => attachmentOf(s));
    const hasLiveSocket = existingPlayer
      ? liveAttachments.some((a) => a?.playerName === playerName)
      : false;

    if (existingPlayer && !hasLiveSocket) {
      // Reclaim the seat: swap the connectionId.
      const oldId = existingPlayer.connectionId;
      existingPlayer.connectionId = connectionId;
      if (this.meta.hostConnectionId === oldId) {
        this.meta.hostConnectionId = connectionId;
      }
      // The acting player in the game state (if any) also needs the new id.
      if (this.gameState) {
        const gs = this.gameState as {players?: Array<{connectionId: string}>};
        const sp = gs.players?.find((p) => p.connectionId === oldId);
        if (sp) sp.connectionId = connectionId;
        await this.state.storage.put('gameState', this.gameState);
      }
    } else if (!existingPlayer) {
      if (this.meta.players.length >= this.meta.maxPlayers) {
        return new Response('room full', {status: 400});
      }
      if (this.meta.status === 'in_progress') {
        return new Response('game in progress', {status: 400});
      }
      const seatIndex = this.meta.players.length;
      const player: RoomPlayer = {
        connectionId,
        name: playerName,
        chips: DEFAULT_CHIPS,
        seatIndex,
      };
      this.meta.players.push(player);
      if (!this.meta.hostConnectionId) this.meta.hostConnectionId = connectionId;
    } else {
      // existingPlayer && hasLiveSocket — duplicate name conflict.
      return new Response('player name taken', {status: 409});
    }

    await this.state.storage.put('meta', this.meta);

    // Open the socket and accept it via Hibernation API.
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair) as [WebSocket, WebSocket];
    server.serializeAttachment({connectionId, playerName} satisfies SocketAttachment);
    this.state.acceptWebSocket(server);

    // Immediately send `connected` to the new socket and broadcast `playerJoined` to others.
    const players = this.publicPlayers();
    server.send(json_str<WsServerMessage>({type: 'connected', connectionId, players}));
    this.broadcastExcept(connectionId, {type: 'playerJoined', players});

    return new Response(null, {status: 101, webSocket: client});
  }

  // --- Hibernation handlers (invoked by the runtime) ---

  async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer): Promise<void> {
    if (!this.meta) return;
    const att = attachmentOf(ws);
    if (!att) return;

    const text = typeof raw === 'string' ? raw : new TextDecoder().decode(raw);
    let body: WsClientMessage;
    try {
      body = JSON.parse(text) as WsClientMessage;
    } catch {
      ws.send(json_str<WsServerMessage>({type: 'error', message: 'invalid json'}));
      return;
    }

    const gameModule = serverSystemRegistry.get(this.meta.serverSystem);
    if (!gameModule) {
      ws.send(json_str<WsServerMessage>({type: 'error', message: 'Unknown server system'}));
      return;
    }

    switch (body.action) {
      case 'sync':
        return this.handleSync(ws, att, gameModule);
      case 'startGame':
        return this.handleStartGame(gameModule);
      case 'playerAction':
        return this.handlePlayerAction(ws, att, gameModule, body.payload);
      case 'nextHand':
        return this.handleNextHand(gameModule);
      default:
        ws.send(
          json_str<WsServerMessage>({type: 'error', message: `Unknown action: ${body.action ?? ''}`}),
        );
    }
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    await this.removePlayer(ws);
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    await this.removePlayer(ws);
  }

  async alarm(): Promise<void> {
    // TTL-driven cleanup. Only delete if no live sockets remain.
    if (this.state.getWebSockets().length === 0) {
      await this.state.storage.deleteAll();
      this.meta = null;
      this.gameState = null;
    }
  }

  // --- Action handlers ---

  private handleSync(ws: WebSocket, att: SocketAttachment, gameModule: ServerSystem): void {
    if (!this.meta) return;
    ws.send(
      json_str<WsServerMessage>({
        type: 'connected',
        connectionId: att.connectionId,
        players: this.publicPlayers(),
      }),
    );
    if (this.meta.status === 'in_progress' && this.gameState) {
      ws.send(
        json_str<WsServerMessage>({
          type: 'gameStarted',
          state: gameModule.getPublicState(this.gameState, att.connectionId),
        }),
      );
    }
  }

  private async handleStartGame(gameModule: ServerSystem): Promise<void> {
    if (!this.meta || this.meta.status === 'in_progress') return;
    const newState = gameModule.createInitialState(this.meta.players);
    this.gameState = newState;
    this.meta.status = 'in_progress';
    await this.state.storage.put({meta: this.meta, gameState: newState});
    this.broadcastPerViewer((cid) => ({
      type: 'gameStarted',
      state: gameModule.getPublicState(newState, cid),
    }));
  }

  private async handlePlayerAction(
    ws: WebSocket,
    att: SocketAttachment,
    gameModule: ServerSystem,
    payload: unknown,
  ): Promise<void> {
    if (!this.meta || !this.gameState) return;
    const actingId = gameModule.actingConnectionId(this.gameState);
    if (actingId !== att.connectionId) {
      ws.send(json_str<WsServerMessage>({type: 'error', message: 'Not your turn'}));
      return;
    }
    const newState = gameModule.handleAction(this.gameState, att.connectionId, payload);
    this.gameState = newState;
    await this.state.storage.put('gameState', newState);
    this.broadcastPerViewer((cid) => ({
      type: 'stateUpdate',
      state: gameModule.getPublicState(newState, cid),
    }));
  }

  private async handleNextHand(gameModule: ServerSystem): Promise<void> {
    if (!this.meta || this.meta.status !== 'in_progress' || !this.gameState) return;
    const gs = this.gameState as {players: Array<{connectionId: string; chips: number}>};
    const updatedPlayers: RoomPlayer[] = this.meta.players.map((rp) => {
      const sp = gs.players.find((p) => p.connectionId === rp.connectionId);
      return {...rp, chips: sp?.chips ?? rp.chips};
    });
    this.meta.players = updatedPlayers;
    const newState = gameModule.createInitialState(updatedPlayers);
    this.gameState = newState;
    await this.state.storage.put({meta: this.meta, gameState: newState});
    this.broadcastPerViewer((cid) => ({
      type: 'gameStarted',
      state: gameModule.getPublicState(newState, cid),
    }));
  }

  // --- Player removal + broadcast helpers ---

  private async removePlayer(ws: WebSocket): Promise<void> {
    const att = attachmentOf(ws);
    if (!att || !this.meta) return;
    this.meta.players = this.meta.players.filter((p) => p.connectionId !== att.connectionId);

    if (this.meta.players.length === 0) {
      // Empty room — clear all storage immediately.
      await this.state.storage.deleteAll();
      this.meta = null;
      this.gameState = null;
      return;
    }

    if (this.meta.hostConnectionId === att.connectionId) {
      this.meta.hostConnectionId = this.meta.players[0]!.connectionId;
    }
    await this.state.storage.put('meta', this.meta);

    this.broadcastExcept(att.connectionId, {
      type: 'playerLeft',
      connectionId: att.connectionId,
      players: this.publicPlayers(),
    });
  }

  private publicPlayers(): PublicPlayerSummary[] {
    return (this.meta?.players ?? []).map((p) => ({name: p.name, seatIndex: p.seatIndex}));
  }

  private broadcastExcept(connectionId: string, msg: WsServerMessage): void {
    const text = json_str(msg);
    for (const ws of this.state.getWebSockets()) {
      const att = attachmentOf(ws);
      if (!att || att.connectionId === connectionId) continue;
      try {
        ws.send(text);
      } catch {
        // socket may be closing; runtime will fire close event
      }
    }
  }

  private broadcastPerViewer(build: (connectionId: string) => WsServerMessage): void {
    for (const ws of this.state.getWebSockets()) {
      const att = attachmentOf(ws);
      if (!att) continue;
      try {
        ws.send(json_str(build(att.connectionId)));
      } catch {
        // ignore — runtime will fire close
      }
    }
  }
}

// --- Module-level helpers ---

function attachmentOf(ws: WebSocket): SocketAttachment | null {
  const a = ws.deserializeAttachment() as unknown;
  if (!a || typeof a !== 'object') return null;
  const obj = a as Partial<SocketAttachment>;
  if (typeof obj.connectionId !== 'string' || typeof obj.playerName !== 'string') return null;
  return {connectionId: obj.connectionId, playerName: obj.playerName};
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {'Content-Type': 'application/json'},
  });
}

function json_str<T>(value: T): string {
  return JSON.stringify(value);
}
