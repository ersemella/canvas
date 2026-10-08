import {pokerServerSystem} from '@canvas/games-poker/server';
import type {PokerAction, ServerPokerGameState} from '@canvas/games-poker/server';
import type {ServerSystem} from '../types';

// Checked against the server's own ServerSystem type (no cast), so the copy
// of the interface inlined in the poker package can't silently drift.
const poker: ServerSystem<ServerPokerGameState, PokerAction> = pokerServerSystem;

/**
 * Map of `serverSystem` name -> ServerSystem implementation.
 * To add a new server-driven game, import its server module, type-check it
 * the same way as `poker` above, and register it here.
 */
export const serverSystemRegistry = new Map<string, ServerSystem>([
  [poker.systemName, poker as ServerSystem],
]);
