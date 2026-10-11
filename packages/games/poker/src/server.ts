import {startHand, applyAction, getPublicState, timeoutAction} from './serverLogic';
import type {ServerSystem} from '@canvas/engine/server';
import type {ServerPokerGameState} from './serverTypes';
import type {PokerAction} from './types';

export type {ServerPokerGameState} from './serverTypes';
export type {PokerAction} from './types';

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
