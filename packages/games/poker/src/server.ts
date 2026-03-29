import {startHand, applyAction, getPublicState} from './serverLogic';
import type {ServerPokerGameState, RoomPlayer} from './serverTypes';
import type {PokerAction} from './types';

// ServerSystem interface inlined here to avoid a circular workspace dependency.
// The type is structurally compatible with handlers/src/games/ServerGameModule.ts.
interface ServerSystem<TState = unknown, TAction = unknown> {
  systemName: string;
  createInitialState(players: RoomPlayer[]): TState;
  handleAction(state: TState, connectionId: string, action: TAction): TState;
  getPublicState(state: TState, viewerConnectionId: string): unknown;
  actingConnectionId(state: TState): string | null;
}

export const pokerServerSystem: ServerSystem<ServerPokerGameState, PokerAction> = {
  systemName: 'PokerServerSystem',
  createInitialState: startHand,
  handleAction: applyAction,
  getPublicState,
  actingConnectionId: (state) => state.players[state.actingIndex]?.connectionId ?? null,
};
