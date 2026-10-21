/**
 * Multiplayer contract between the platform's room server (`GameRoom` in
 * `@canvas/server`) and a game's server-side rules, plus DOM-free helpers
 * a game's server rules share with its client (hex geometry). Free of DOM
 * and of the engine's ECS runtime, so a Worker can depend on it: import it
 * as `@canvas/engine/server`.
 */

export * from './math/Hex';

export interface RoomPlayer {
  connectionId: string;
  name: string;
  chips: number;
  seatIndex: number;
}

export interface ServerSystem<TState = unknown, TAction = unknown> {
  /** Runs in a multiplayer `GameRoom` (the default when omitted). */
  kind?: 'room';
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
  /** How the platform runs this game's rooms. Omit for real-time defaults. */
  room?: RoomPolicy;
}

/**
 * How the platform runs a room for this game: turn timers, how long rooms
 * live, and how players reclaim seats. Every field is optional and defaults
 * to real-time play (the values poker uses):
 *
 * | Field                       | Default        |
 * |-----------------------------|----------------|
 * | `turnTimeoutMs`             | 30 s           |
 * | `disconnectedTurnTimeoutMs` | 10 s           |
 * | `emptyRoomGraceMs`          | 5 min          |
 * | `ttlMs`                     | 24 h           |
 * | `ttlExtendsOn`              | `'connections'`|
 * | `holdLobbySeats`            | `false`        |
 * | `newRoundSeats`             | `'connected'`  |
 * | `seatIdentity`              | `'name'`       |
 *
 * An async game (turns that take hours, games that last days) would set
 * something like `{turnTimeoutMs: null, disconnectedTurnTimeoutMs: null,
 * emptyRoomGraceMs: null, ttlMs: 14 days, ttlExtendsOn: 'activity',
 * holdLobbySeats: true, newRoundSeats: 'all', seatIdentity: 'token'}`.
 */
export interface RoomPolicy {
  /** How long the acting player has before the game's `timeoutAction` applies. `null`: no limit. */
  turnTimeoutMs?: number | null;
  /**
   * Shorter limit while the acting player is disconnected, so a table isn't
   * held up. `null`: being disconnected doesn't shorten the turn.
   */
  disconnectedTurnTimeoutMs?: number | null;
  /** How long a room with nobody connected survives. `null`: an empty room is never deleted for being empty. */
  emptyRoomGraceMs?: number | null;
  /** Room lifetime. */
  ttlMs?: number;
  /**
   * What pushes the expiry back by another `ttlMs`:
   * `'connections'` — only reaching it while someone is connected;
   * `'activity'` — also every join and every committed move.
   */
  ttlExtendsOn?: 'connections' | 'activity';
  /** Keep a player's lobby seat when their socket closes (otherwise it's freed). */
  holdLobbySeats?: boolean;
  /** Who is dealt into the next round (`nextHand`): only connected players, or every seat. */
  newRoundSeats?: 'connected' | 'all';
  /**
   * How a returning player proves a seat is theirs: `'name'` — by joining
   * with the same name; `'token'` — with the secret `seatToken` the server
   * sends in that seat's first `connected` message (the name alone is
   * refused, and a new connection with the token replaces an old one).
   */
  seatIdentity?: 'name' | 'token';
}

/**
 * Rules of a single-player run, played over plain HTTP in its own
 * `RunRoom` Durable Object (one per run, owned by an anonymous player key;
 * docs/plans/roguelike-tactics/architecture.md, D3 and D7). The room
 * stores the state and calls these; the game owns every rule.
 */
export interface RunSystem<TState = unknown, TAction = unknown, TView = unknown> {
  kind: 'run';
  systemName: string;
  /**
   * A new run from a server-chosen seed, which must never reach the player,
   * and the player's choices from the start request (`setup`, unchecked).
   * Throws with a player-facing message for a setup it can't use.
   */
  createRun(seed: number, setup?: unknown): TState;
  /**
   * Applies one player action and everything that follows it up to the
   * player's next decision (AI turns included). Returns the new state
   * without mutating `state`; throws with a player-facing message for an
   * illegal action.
   */
  handleAction(state: TState, action: TAction): TState;
  /** Everything the player may see, sent whole on every response: never the seed. */
  getView(state: TState): TView;
  status(state: TState): 'active' | 'won' | 'lost';
}
