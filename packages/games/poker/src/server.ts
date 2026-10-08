import {startHand, applyAction, getPublicState, timeoutAction} from './serverLogic';
import type {ServerPokerGameState, RoomPlayer} from './serverTypes';
import type {PokerAction} from './types';

// ServerSystem interface inlined here to avoid a circular workspace dependency.
// Must stay structurally identical to ServerSystem in @canvas/server/src/types.ts.
interface ServerSystem<TState = unknown, TAction = unknown> {
  systemName: string;
  createInitialState(players: RoomPlayer[], previous?: TState | null): TState;
  handleAction(state: TState, connectionId: string, action: TAction): TState;
  getPublicState(state: TState, viewerConnectionId: string): unknown;
  actingConnectionId(state: TState): string | null;
  isHandOver(state: TState): boolean;
  timeoutAction(state: TState): TAction | null;
}

export const pokerServerSystem: ServerSystem<ServerPokerGameState, PokerAction> = {
  systemName: 'PokerServerSystem',
  createInitialState: startHand,
  handleAction: applyAction,
  getPublicState,
  actingConnectionId: (state) =>
    state.phase === 'showdown' ? null : (state.players[state.actingIndex]?.connectionId ?? null),
  isHandOver: (state) => state.phase === 'showdown',
  timeoutAction,
};
