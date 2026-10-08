/**
 * Server-side types. Mirrors the contract previously defined in
 * `packages/handlers/src/games/ServerGameModule.ts` so `@canvas/games-poker/server`
 * can be plugged in via a structural type assertion.
 */

export interface RoomPlayer {
  connectionId: string;
  name: string;
  chips: number;
  seatIndex: number;
}

export interface ServerSystem<TState = unknown, TAction = unknown> {
  systemName: string;
  /**
   * Deals a new round for `players`. `previous` is the last round's state, so
   * games can carry things like the dealer button forward. May throw (e.g.
   * not enough players); the message is sent back to whoever asked.
   */
  createInitialState(players: RoomPlayer[], previous?: TState | null): TState;
  /** Returns the new state, or throws with a player-facing message for an illegal action. */
  handleAction(state: TState, connectionId: string, action: TAction): TState;
  getPublicState(state: TState, viewerConnectionId: string): unknown;
  actingConnectionId(state: TState): string | null;
  /** True once the round is finished and a new one may be dealt. */
  isHandOver(state: TState): boolean;
  /** Action applied for the acting player when their turn timer expires. */
  timeoutAction(state: TState): TAction | null;
}

/** Persisted in DO storage under the `meta` key. */
export interface RoomRecord {
  roomId: string;
  serverSystem: string;
  hostConnectionId: string;
  players: RoomPlayer[];
  maxPlayers: number;
  status: 'waiting' | 'in_progress';
  createdAt: number;
  expiresAt: number;
  /** When the acting player's turn times out; null when nobody is to act. */
  turnDeadline?: number | null;
  /** When the last socket closed; the room is deleted after a grace period. */
  emptySince?: number | null;
}

/** Per-WebSocket attachment surviving hibernation. */
export interface SocketAttachment {
  connectionId: string;
  playerName: string;
}

/** Inbound WS messages from the client. */
export interface WsClientMessage {
  action?: 'sync' | 'startGame' | 'playerAction' | 'nextHand';
  payload?: unknown;
}

/** Outbound WS messages to the client. */
export type WsServerMessage =
  | {type: 'connected'; connectionId: string; players: PublicPlayerSummary[]}
  | {type: 'playerJoined'; players: PublicPlayerSummary[]}
  | {type: 'playerLeft'; connectionId: string; players: PublicPlayerSummary[]}
  | {type: 'gameStarted'; state: unknown; turnDeadline?: number | null}
  | {type: 'stateUpdate'; state: unknown; turnDeadline?: number | null}
  | {type: 'error'; message: string};

export interface PublicPlayerSummary {
  name: string;
  seatIndex: number;
  isHost: boolean;
  /** False while the player's socket is gone; their seat is held for them. */
  connected: boolean;
}

export interface Env {
  GAME_ROOM: DurableObjectNamespace;
  MANIFEST_REGISTRY: DurableObjectNamespace;
  MANIFEST_ADMIN_TOKEN: string;
}
