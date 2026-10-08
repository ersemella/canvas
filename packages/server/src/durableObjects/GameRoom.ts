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
/** How long a connected player has to act before the timeout action is applied. */
const TURN_MS = 30_000;
/** Shorter limit when the acting player's socket is gone, so the table isn't held up. */
const DISCONNECTED_TURN_MS = 10_000;
/** How long an empty room survives, so everyone refreshing at once doesn't lose the game. */
const EMPTY_ROOM_GRACE_MS = 5 * 60 * 1000;

/**
 * One DurableObject instance per room. The room ID maps deterministically via
 * `idFromName(roomId)` so any Worker request reaches the same DO.
 *
 * Uses the WebSocket Hibernation API: `state.acceptWebSocket` lets the DO
 * evict from memory while connections stay open at the edge. Wake-up on
 * incoming message is ~10ms.
 *
 * A single storage alarm drives three timers: the acting player's turn
 * deadline, the empty-room grace period, and the 24h room TTL.
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
      turnDeadline: null,
      emptySince: null,
    };
    this.meta = meta;
    await this.state.storage.put('meta', meta);
    await this.scheduleAlarm();
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
    const hasLiveSocket = existingPlayer ? this.liveNames().has(playerName) : false;

    if (existingPlayer && !hasLiveSocket) {
      // Reclaim the seat: swap the connectionId.
      const oldId = existingPlayer.connectionId;
      existingPlayer.connectionId = connectionId;
      if (this.meta.hostConnectionId === oldId) {
        this.meta.hostConnectionId = connectionId;
      }
      // The player's seat in the game state (if any) also needs the new id.
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
      const player: RoomPlayer = {
        connectionId,
        name: playerName,
        chips: DEFAULT_CHIPS,
        seatIndex: this.firstFreeSeat(),
      };
      this.meta.players.push(player);
      if (!this.meta.hostConnectionId) this.meta.hostConnectionId = connectionId;
    } else {
      // existingPlayer && hasLiveSocket — duplicate name conflict.
      return new Response('player name taken', {status: 409});
    }

    this.meta.emptySince = null;
    await this.state.storage.put('meta', this.meta);

    // Open the socket and accept it via Hibernation API.
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair) as [WebSocket, WebSocket];
    server.serializeAttachment({connectionId, playerName} satisfies SocketAttachment);
    this.state.acceptWebSocket(server);

    // A disconnected acting player who comes back gets a full turn again.
    if (this.isActing(connectionId)) await this.resetTurnTimer();

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
      sendError(ws, 'invalid json');
      return;
    }

    const gameModule = serverSystemRegistry.get(this.meta.serverSystem);
    if (!gameModule) {
      sendError(ws, 'Unknown server system');
      return;
    }

    switch (body.action) {
      case 'sync':
        return this.handleSync(ws, att, gameModule);
      case 'startGame':
        return this.handleStartGame(ws, att, gameModule);
      case 'playerAction':
        return this.handlePlayerAction(ws, att, gameModule, body.payload);
      case 'nextHand':
        return this.handleNextHand(ws, gameModule);
      default:
        sendError(ws, `Unknown action: ${body.action ?? ''}`);
    }
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    await this.handleSocketGone(ws);
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    await this.handleSocketGone(ws);
  }

  async alarm(): Promise<void> {
    if (!this.meta) return;
    const now = Date.now();
    const noSockets = this.state.getWebSockets().length === 0;

    if (noSockets && this.meta.emptySince && now >= this.meta.emptySince + EMPTY_ROOM_GRACE_MS) {
      return this.deleteRoom();
    }
    if (now >= this.meta.expiresAt) {
      if (noSockets) return this.deleteRoom();
      // Still in use: keep it for another TTL period.
      this.meta.expiresAt = now + TTL_MS;
      await this.state.storage.put('meta', this.meta);
    }
    if (this.meta.turnDeadline && now >= this.meta.turnDeadline) {
      await this.applyTurnTimeout();
    }
    await this.scheduleAlarm();
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
          turnDeadline: this.meta.turnDeadline ?? null,
        }),
      );
    }
  }

  private async handleStartGame(
    ws: WebSocket,
    att: SocketAttachment,
    gameModule: ServerSystem,
  ): Promise<void> {
    if (!this.meta || this.meta.status === 'in_progress') return;
    if (att.connectionId !== this.meta.hostConnectionId) {
      sendError(ws, 'Only the host can start the game');
      return;
    }
    let newState: unknown;
    try {
      newState = gameModule.createInitialState(this.meta.players, null);
    } catch (err) {
      sendError(ws, errorMessage(err));
      return;
    }
    this.gameState = newState;
    this.meta.status = 'in_progress';
    await this.commitGameState(gameModule, 'gameStarted');
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
      sendError(ws, 'Not your turn');
      return;
    }
    try {
      this.gameState = gameModule.handleAction(this.gameState, att.connectionId, payload);
    } catch (err) {
      sendError(ws, errorMessage(err));
      return;
    }
    await this.commitGameState(gameModule, 'stateUpdate');
  }

  /**
   * Deals the next hand once the current one is over. Any seated player may
   * ask, but only after showdown — a request mid-hand (or a second click after
   * someone else already dealt) is ignored. Disconnected players sit out.
   */
  private async handleNextHand(ws: WebSocket, gameModule: ServerSystem): Promise<void> {
    if (!this.meta || this.meta.status !== 'in_progress' || !this.gameState) return;
    if (!gameModule.isHandOver(this.gameState)) return;

    const gs = this.gameState as {players: Array<{connectionId: string; chips: number}>};
    this.meta.players = this.meta.players.map((rp) => {
      const sp = gs.players.find((p) => p.connectionId === rp.connectionId);
      return {...rp, chips: sp?.chips ?? rp.chips};
    });
    await this.state.storage.put('meta', this.meta);

    const live = this.liveNames();
    const dealtIn = this.meta.players.filter((p) => live.has(p.name));
    let newState: unknown;
    try {
      newState = gameModule.createInitialState(dealtIn, this.gameState);
    } catch (err) {
      sendError(ws, errorMessage(err));
      return;
    }
    this.gameState = newState;
    await this.commitGameState(gameModule, 'gameStarted');
  }

  /** Applies the game's timeout action for whoever is acting, then broadcasts. */
  private async applyTurnTimeout(): Promise<void> {
    if (!this.meta || !this.gameState) return;
    const gameModule = serverSystemRegistry.get(this.meta.serverSystem);
    if (!gameModule) return;
    const actingId = gameModule.actingConnectionId(this.gameState);
    const action = gameModule.timeoutAction(this.gameState);
    if (!actingId || !action) {
      this.meta.turnDeadline = null;
      await this.state.storage.put('meta', this.meta);
      return;
    }
    try {
      this.gameState = gameModule.handleAction(this.gameState, actingId, action);
    } catch {
      // The timeout action is always legal; if not, stop the timer rather than loop.
      this.meta.turnDeadline = null;
      await this.state.storage.put('meta', this.meta);
      return;
    }
    await this.commitGameState(gameModule, 'stateUpdate');
  }

  /** Persists the game state, restarts the turn timer, and sends each viewer their view. */
  private async commitGameState(
    gameModule: ServerSystem,
    type: 'gameStarted' | 'stateUpdate',
  ): Promise<void> {
    if (!this.meta) return;
    const state = this.gameState;
    this.meta.turnDeadline = this.computeTurnDeadline(gameModule);
    await this.state.storage.put({meta: this.meta, gameState: state});
    await this.scheduleAlarm();
    const turnDeadline = this.meta.turnDeadline;
    this.broadcastPerViewer((cid) => ({
      type,
      state: gameModule.getPublicState(state, cid),
      turnDeadline,
    }));
  }

  // --- Disconnects, timers, and cleanup ---

  /**
   * In the lobby, a closed socket frees the seat. Once a game is running the
   * seat (and chips) are held so the player can reconnect by name; their
   * turns time out meanwhile and they sit out new hands until they return.
   */
  private async handleSocketGone(ws: WebSocket): Promise<void> {
    const att = attachmentOf(ws);
    if (!att || !this.meta) return;

    if (this.meta.status === 'waiting') {
      this.meta.players = this.meta.players.filter((p) => p.connectionId !== att.connectionId);
    }

    const live = this.liveNames(ws);
    if (this.meta.hostConnectionId === att.connectionId) {
      // Hand the host role to someone still connected; if nobody is, the
      // first player to (re)join an empty lobby becomes host.
      const nextHost = this.meta.players.find((p) => live.has(p.name));
      if (nextHost) this.meta.hostConnectionId = nextHost.connectionId;
      else if (this.meta.status === 'waiting') this.meta.hostConnectionId = '';
    }

    if (live.size === 0) this.meta.emptySince = Date.now();

    // Don't hold the table for a full turn while the acting player is gone.
    if (this.isActing(att.connectionId) && this.meta.turnDeadline) {
      this.meta.turnDeadline = Math.min(this.meta.turnDeadline, Date.now() + DISCONNECTED_TURN_MS);
    }

    await this.state.storage.put('meta', this.meta);
    await this.scheduleAlarm();

    this.broadcastExcept(att.connectionId, {
      type: 'playerLeft',
      connectionId: att.connectionId,
      players: this.publicPlayers(ws),
    });
  }

  private async resetTurnTimer(): Promise<void> {
    if (!this.meta) return;
    const gameModule = serverSystemRegistry.get(this.meta.serverSystem);
    if (!gameModule) return;
    this.meta.turnDeadline = this.computeTurnDeadline(gameModule);
    await this.state.storage.put('meta', this.meta);
    await this.scheduleAlarm();
  }

  private computeTurnDeadline(gameModule: ServerSystem): number | null {
    if (!this.meta || !this.gameState || this.meta.status !== 'in_progress') return null;
    const actingId = gameModule.actingConnectionId(this.gameState);
    if (!actingId) return null;
    const acting = this.meta.players.find((p) => p.connectionId === actingId);
    const connected = acting ? this.liveNames().has(acting.name) : false;
    return Date.now() + (connected ? TURN_MS : DISCONNECTED_TURN_MS);
  }

  /** Points the storage alarm at whichever timer is due first. */
  private async scheduleAlarm(): Promise<void> {
    if (!this.meta) return;
    const due = [
      this.meta.expiresAt,
      this.meta.turnDeadline ?? Infinity,
      this.meta.emptySince ? this.meta.emptySince + EMPTY_ROOM_GRACE_MS : Infinity,
    ];
    await this.state.storage.setAlarm(Math.min(...due));
  }

  private async deleteRoom(): Promise<void> {
    await this.state.storage.deleteAll();
    this.meta = null;
    this.gameState = null;
  }

  // --- Helpers ---

  private isActing(connectionId: string): boolean {
    if (!this.meta || !this.gameState) return false;
    const gameModule = serverSystemRegistry.get(this.meta.serverSystem);
    return gameModule?.actingConnectionId(this.gameState) === connectionId;
  }

  /** Names with an open socket, optionally ignoring one that is closing. */
  private liveNames(except?: WebSocket): Set<string> {
    const names = new Set<string>();
    for (const s of this.state.getWebSockets()) {
      if (s === except) continue;
      const a = attachmentOf(s);
      if (a) names.add(a.playerName);
    }
    return names;
  }

  private firstFreeSeat(): number {
    const taken = new Set(this.meta?.players.map((p) => p.seatIndex));
    let seat = 0;
    while (taken.has(seat)) seat++;
    return seat;
  }

  private publicPlayers(closing?: WebSocket): PublicPlayerSummary[] {
    const live = this.liveNames(closing);
    return (this.meta?.players ?? []).map((p) => ({
      name: p.name,
      seatIndex: p.seatIndex,
      isHost: p.connectionId === this.meta?.hostConnectionId,
      connected: live.has(p.name),
    }));
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

function sendError(ws: WebSocket, message: string): void {
  ws.send(json_str<WsServerMessage>({type: 'error', message}));
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'Something went wrong';
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
