export type Phase = 'waiting' | 'preflop' | 'flop' | 'turn' | 'river' | 'showdown';
export type ActionType = 'fold' | 'check' | 'call' | 'raise';

export interface Card {
  rank: number; // 2-14 (14=Ace)
  suit: '♠' | '♥' | '♦' | '♣';
}

export interface Player {
  id: number;         // 0 = hero
  name: string;
  chips: number;
  holeCards: [Card, Card] | null;
  currentBet: number; // bet amount this round
  folded: boolean;
  allIn: boolean;
  hasActed: boolean;  // acted this betting round
  isDealer: boolean;
  isSB: boolean;
  isBB: boolean;
  style: 'tight' | 'loose' | 'aggressive';
}

export interface LogEntry {
  text: string;
  timestamp: number;
}

export interface PokerGameState {
  phase: Phase;
  players: Player[];
  deck: Card[];
  communityCards: Card[];
  pot: number;
  currentBet: number;   // highest bet this round
  actingIndex: number;  // whose turn
  dealerIndex: number;
  handNumber: number;
  log: LogEntry[];
  showdownResult: string | null;
}

export interface PokerAction {
  type: ActionType;
  amount?: number;
}

export interface PokerUiState {
  phase: Phase;
  isHeroTurn: boolean;
  availableActions: ActionType[];
  callAmount: number;
  minRaise: number;
  maxRaise: number;
  pot: number;
  players: Array<{
    name: string;
    chips: number;
    currentBet: number;
    folded: boolean;
    isActing: boolean;
    isDealer: boolean;
    isSB: boolean;
    isBB: boolean;
  }>;
  log: LogEntry[];
  showdownResult: string | null;
}
