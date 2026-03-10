import type {Card, Phase, LogEntry} from './types';

export interface RoomPlayer {
  connectionId: string;
  name: string;
  chips: number;
  seatIndex: number;
}

export interface ServerPlayer {
  connectionId: string;
  seatIndex: number;
  name: string;
  chips: number;
  holeCards: [Card, Card] | null;
  currentBet: number;
  folded: boolean;
  allIn: boolean;
  hasActed: boolean;
  isDealer: boolean;
  isSB: boolean;
  isBB: boolean;
}

export interface ServerPokerGameState {
  phase: Phase;
  players: ServerPlayer[];
  deck: Card[];
  communityCards: Card[];
  pot: number;
  currentBet: number;
  actingIndex: number; // index into players array
  dealerIndex: number; // index into players array
  handNumber: number;
  log: LogEntry[];
  showdownResult: string | null;
}
