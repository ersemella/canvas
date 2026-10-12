/**
 * The client's view of a hand, built from the server's per-viewer
 * `PublicPokerState` with the viewer rotated to seat 0. Shared by
 * PokerSystem (writes it) and PokerRendererSystem (draws it).
 */

import type {Card, Phase} from '../types';

export type {Card as PokerCard, Phase, ActionType, PokerAction} from '../types';

export interface PokerPlayer {
  name: string;
  chips: number;
  holeCards: [Card, Card] | null;
  currentBet: number;
  folded: boolean;
  allIn: boolean;
  isDealer: boolean;
  isSB: boolean;
  isBB: boolean;
  connectionId: string;
}

export interface PokerGameState {
  phase: Phase;
  /** Seat 0 is the viewer. */
  players: PokerPlayer[];
  communityCards: Card[];
  pot: number;
  currentBet: number;
  actingIndex: number;
  /** Log lines, newest last. */
  log: string[];
  showdownResult: string | null;
}
