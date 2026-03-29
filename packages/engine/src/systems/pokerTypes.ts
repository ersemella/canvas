/**
 * Shared types for PokerSystem and PokerRendererSystem.
 * Internal to the engine — not exported from index.ts.
 */

import type {PokerCard} from 'util/handEvaluator';
export type {PokerCard};

export type Phase = 'waiting' | 'preflop' | 'flop' | 'turn' | 'river' | 'showdown';
export type ActionType = 'fold' | 'check' | 'call' | 'raise';

export interface PokerPlayer {
  id: number; // 0 = hero in single-player; rotated so viewer is 0 in multiplayer
  name: string;
  chips: number;
  holeCards: [PokerCard, PokerCard] | null;
  currentBet: number;
  folded: boolean;
  allIn: boolean;
  hasActed: boolean;
  isDealer: boolean;
  isSB: boolean;
  isBB: boolean;
  style: 'tight' | 'loose' | 'aggressive';
  /** connectionId for multiplayer mode; null in single-player */
  connectionId: string | null;
}

export interface PokerGameState {
  phase: Phase;
  players: PokerPlayer[];
  deck: PokerCard[];
  communityCards: PokerCard[];
  pot: number;
  currentBet: number;
  actingIndex: number;
  dealerIndex: number;
  handNumber: number;
  /** Last 50 log lines, newest pushed last */
  log: string[];
  showdownResult: string | null;
}

export interface PokerAction {
  type: ActionType;
  amount?: number;
}
