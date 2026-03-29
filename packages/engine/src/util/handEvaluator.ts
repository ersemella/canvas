/**
 * Poker hand evaluation utilities.
 * Used by PokerSystem and PokerRendererSystem.
 */

export interface PokerCard {
  rank: number; // 2–14 (14 = Ace)
  suit: '♠' | '♥' | '♦' | '♣';
}

export interface WinnerResult {
  winnerIndex: number;
  handName: string;
}

// ─── Deck helpers ─────────────────────────────────────────────────────────────

const SUITS: PokerCard['suit'][] = ['♠', '♥', '♦', '♣'];
const RANKS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];

export function buildPokerDeck(): PokerCard[] {
  const deck: PokerCard[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({rank, suit});
    }
  }
  return deck;
}

export function shuffleDeck(deck: PokerCard[]): PokerCard[] {
  const d = [...deck];
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = d[i]!;
    d[i] = d[j]!;
    d[j] = tmp;
  }
  return d;
}

export function dealCard(deck: PokerCard[]): {card: PokerCard; remaining: PokerCard[]} {
  if (deck.length === 0) throw new Error('Deck is empty');
  return {card: deck[0]!, remaining: deck.slice(1)};
}

// ─── Hand evaluation ──────────────────────────────────────────────────────────

const HAND_RANKS = {
  HIGH_CARD: 0,
  PAIR: 1,
  TWO_PAIR: 2,
  THREE_OF_A_KIND: 3,
  STRAIGHT: 4,
  FLUSH: 5,
  FULL_HOUSE: 6,
  FOUR_OF_A_KIND: 7,
  STRAIGHT_FLUSH: 8,
};

interface HandScore {
  rank: number;
  tiebreakers: number[];
  name: string;
}

function scoreFiveCards(cards: PokerCard[]): HandScore {
  const ranks = cards.map((c) => c.rank).sort((a, b) => b - a);
  const suits = cards.map((c) => c.suit);
  const isFlush = suits.every((s) => s === suits[0]);

  let isStraight = false;
  let straightHigh = ranks[0]!;
  if (ranks[0]! - ranks[4]! === 4 && new Set(ranks).size === 5) {
    isStraight = true;
    straightHigh = ranks[0]!;
  }
  if (ranks[0] === 14 && ranks[1] === 5 && ranks[2] === 4 && ranks[3] === 3 && ranks[4] === 2) {
    isStraight = true;
    straightHigh = 5;
  }

  const freq = new Map<number, number>();
  for (const r of ranks) freq.set(r, (freq.get(r) ?? 0) + 1);
  const counts = Array.from(freq.entries()).sort((a, b) => b[1] - a[1] || b[0] - a[0]);

  if (isFlush && isStraight) return {rank: HAND_RANKS.STRAIGHT_FLUSH, tiebreakers: [straightHigh], name: 'Straight Flush'};
  if (counts[0]![1] === 4) return {rank: HAND_RANKS.FOUR_OF_A_KIND, tiebreakers: [counts[0]![0], counts[1]![0]], name: 'Four of a Kind'};
  if (counts[0]![1] === 3 && counts[1]![1] === 2) return {rank: HAND_RANKS.FULL_HOUSE, tiebreakers: [counts[0]![0], counts[1]![0]], name: 'Full House'};
  if (isFlush) return {rank: HAND_RANKS.FLUSH, tiebreakers: ranks, name: 'Flush'};
  if (isStraight) return {rank: HAND_RANKS.STRAIGHT, tiebreakers: [straightHigh], name: 'Straight'};
  if (counts[0]![1] === 3) return {rank: HAND_RANKS.THREE_OF_A_KIND, tiebreakers: [counts[0]![0], ...counts.slice(1).map((c) => c[0])], name: 'Three of a Kind'};
  if (counts[0]![1] === 2 && counts[1]![1] === 2) {
    const pairs = [counts[0]![0], counts[1]![0]].sort((a, b) => b - a);
    return {rank: HAND_RANKS.TWO_PAIR, tiebreakers: [...pairs, counts[2]![0]], name: 'Two Pair'};
  }
  if (counts[0]![1] === 2) return {rank: HAND_RANKS.PAIR, tiebreakers: [counts[0]![0], ...counts.slice(1).map((c) => c[0])], name: 'Pair'};
  return {rank: HAND_RANKS.HIGH_CARD, tiebreakers: ranks, name: 'High Card'};
}

function combinations<T>(arr: T[], k: number): T[][] {
  if (k === 0) return [[]];
  if (arr.length < k) return [];
  const [first, ...rest] = arr;
  return [...combinations(rest, k - 1).map((c) => [first!, ...c]), ...combinations(rest, k)];
}

function compareScores(a: HandScore, b: HandScore): number {
  if (a.rank !== b.rank) return a.rank - b.rank;
  for (let i = 0; i < Math.min(a.tiebreakers.length, b.tiebreakers.length); i++) {
    if (a.tiebreakers[i] !== b.tiebreakers[i]) return a.tiebreakers[i]! - b.tiebreakers[i]!;
  }
  return 0;
}

export function evaluate7CardHand(cards: PokerCard[]): HandScore {
  let best: HandScore | null = null;
  for (const combo of combinations(cards, 5)) {
    const score = scoreFiveCards(combo);
    if (!best || compareScores(score, best) > 0) best = score;
  }
  return best!;
}

export function findWinner(
  players: Array<{id: number; holeCards: [PokerCard, PokerCard] | null; folded: boolean}>,
  communityCards: PokerCard[]
): WinnerResult {
  let bestScore: HandScore | null = null;
  let winnerIndex = -1;
  for (const player of players) {
    if (player.folded || !player.holeCards) continue;
    const score = evaluate7CardHand([...player.holeCards, ...communityCards]);
    if (!bestScore || compareScores(score, bestScore) > 0) {
      bestScore = score;
      winnerIndex = player.id;
    }
  }
  return {winnerIndex, handName: bestScore?.name ?? 'Unknown'};
}
