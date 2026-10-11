/**
 * Multiplayer contract between the platform's room server (`GameRoom` in
 * `@canvas/server`) and a game's server-side rules. Types only and free of
 * DOM and engine runtime imports, so a Worker can depend on it: import it as
 * `@canvas/engine/server`.
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
