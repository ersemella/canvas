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
  createInitialState(players: RoomPlayer[]): TState;
  handleAction(state: TState, connectionId: string, action: TAction): TState;
  getPublicState(state: TState, viewerConnectionId: string): unknown;
  actingConnectionId(state: TState): string | null;
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
  | {type: 'gameStarted'; state: unknown}
  | {type: 'stateUpdate'; state: unknown}
  | {type: 'error'; message: string};

export interface PublicPlayerSummary {
  name: string;
  seatIndex: number;
}

export interface Env {
  GAME_ROOM: DurableObjectNamespace;
  MANIFEST_REGISTRY: DurableObjectNamespace;
  MANIFEST_ADMIN_TOKEN: string;
}
