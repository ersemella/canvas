import {startHand, applyAction, getPublicState} from './serverLogic';
import type {ServerPokerGameState, RoomPlayer} from './serverTypes';
import type {PokerAction} from './types';

// ServerGameModule interface inlined here to avoid a circular workspace dependency.
// The type is structurally compatible with handlers/src/games/ServerGameModule.ts.
interface ServerGameModule<TState = unknown, TAction = unknown> {
  gameType: string;
  createInitialState(players: RoomPlayer[]): TState;
  handleAction(state: TState, connectionId: string, action: TAction): TState;
  getPublicState(state: TState, viewerConnectionId: string): unknown;
  actingConnectionId(state: TState): string | null;
}

export const pokerServerConfig: ServerGameModule<ServerPokerGameState, PokerAction> = {
  gameType: 'poker',
  createInitialState: startHand,
  handleAction: applyAction,
  getPublicState,
  actingConnectionId: (state) => state.players[state.actingIndex]?.connectionId ?? null,
};
