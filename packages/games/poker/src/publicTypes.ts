import type {Card, Phase, LogEntry} from './types';

export interface PublicPlayer {
  connectionId: string;
  name: string;
  chips: number;
  currentBet: number;
  folded: boolean;
  allIn: boolean;
  isDealer: boolean;
  isSB: boolean;
  isBB: boolean;
  holeCards: [Card, Card] | null;
}

export interface PublicPokerState {
  phase: Phase;
  communityCards: Card[];
  pot: number;
  currentBet: number;
  /** Smallest total bet a raise must reach this street. */
  minRaiseTo: number;
  handNumber: number;
  actingConnectionId: string | null;
  showdownResult: string | null;
  log: LogEntry[];
  players: PublicPlayer[];
}
