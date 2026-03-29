/**
 * Module-level shared state between PokerSystem and PokerRendererSystem.
 * PokerSystem updates this after every state change;
 * PokerRendererSystem reads it in onUpdate.
 */

import type {PokerGameState} from 'systems/pokerTypes';

export let sharedPokerState: PokerGameState | null = null;

export function setSharedPokerState(state: PokerGameState): void {
  sharedPokerState = state;
}
