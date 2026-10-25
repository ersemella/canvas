/**
 * Server-side types. The game contract (`ServerSystem`, `RoomPlayer`) comes
 * from the engine so the server and every game share one definition.
 */

import type {RoomPlayer, RoomPolicy, ServerSystem} from '@canvas/engine/server';
export type {RoomPlayer, RoomPolicy, ServerSystem};

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
  /**
   * Secret per seat, keyed by player name, for games with
   * `seatIdentity: 'token'`. Never sent to anyone but that seat's owner.
   */
  seatTokens?: Record<string, string>;
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
  | {
      type: 'connected';
      connectionId: string;
      players: PublicPlayerSummary[];
      /** Only for `seatIdentity: 'token'` games, only to the seat's owner: keep it to reclaim the seat. */
      seatToken?: string;
    }
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

/** Workers Rate Limiting binding (configured in wrangler.toml). */
export interface RateLimiter {
  limit(options: {key: string}): Promise<{success: boolean}>;
}

export interface Env {
  GAME_ROOM: DurableObjectNamespace;
  /** Retired ManifestRegistry DO; still bound until its class is deleted. Unused. */
  MANIFEST_REGISTRY: DurableObjectNamespace;
  /** Caps room creation per client IP. Optional so a missing binding never blocks play. */
  ROOM_CREATE_LIMITER?: RateLimiter;
}
