import {pokerServerSystem} from '@canvas/games-poker/server';
import type {PokerAction, ServerPokerGameState} from '@canvas/games-poker/server';
import type {ServerSystem} from '../types';

const poker: ServerSystem<ServerPokerGameState, PokerAction> = pokerServerSystem;

/**
 * Map of `serverSystem` name -> ServerSystem implementation.
 * To add a new server-driven game, import its server module and register it here.
 */
export const serverSystemRegistry = new Map<string, ServerSystem>([
  [poker.systemName, poker as ServerSystem],
]);
