import type { Card, Player, PokerAction, PokerGameState } from './types';
import { evaluate7CardHand } from './handEvaluator';

function handStrength(holeCards: [Card, Card], communityCards: Card[]): number {
  const allCards = [...holeCards, ...communityCards];
  const score = evaluate7CardHand(allCards);
  // Normalize: STRAIGHT_FLUSH=8 → 100, HIGH_CARD=0 → depends on cards
  const baseScore = (score.rank / 8) * 80;
  const topCard = Math.max(...holeCards.map(c => c.rank));
  const cardBonus = ((topCard - 2) / 12) * 20;
  return Math.min(100, baseScore + cardBonus);
}

export function decideBotAction(
  player: Player,
  gameState: PokerGameState
): PokerAction {
  if (!player.holeCards) return { type: 'fold' };

  const strength = handStrength(player.holeCards, gameState.communityCards);

  // Apply style modifier
  let threshold = strength;
  if (player.style === 'tight') threshold -= 10;
  if (player.style === 'loose') threshold += 15;
  if (player.style === 'aggressive') threshold += 5;

  // Add randomness ±20%
  threshold += (Math.random() - 0.5) * 40;
  threshold = Math.max(0, Math.min(100, threshold));

  const callAmount = gameState.currentBet - player.currentBet;
  const canCheck = callAmount === 0;
  const costRatio = player.chips > 0 ? callAmount / player.chips : 1;

  // Pre-flop: weaker hand evaluation (no community cards)
  const isPreflop = gameState.communityCards.length === 0;

  if (isPreflop) {
    // Simple pre-flop heuristic
    const [c1, c2] = player.holeCards;
    const high = Math.max(c1.rank, c2.rank);
    const low = Math.min(c1.rank, c2.rank);
    const isPair = c1.rank === c2.rank;
    const preFlopScore = isPair ? high * 4 : high * 2 + low;
    threshold = (preFlopScore / 56) * 100; // 56 = max (14*4)
    if (player.style === 'aggressive') threshold += 15;
    if (player.style === 'tight') threshold -= 10;
    threshold += (Math.random() - 0.5) * 30;
  }

  if (threshold > 70) {
    // Strong hand: raise
    if (player.chips <= callAmount) {
      // Can only call or fold
      return callAmount === 0 ? { type: 'check' } : { type: 'call' };
    }
    const raiseAmount = Math.min(
      player.chips,
      Math.max(gameState.currentBet * 2, gameState.currentBet + 10)
    );
    return { type: 'raise', amount: raiseAmount };
  } else if (threshold > 40) {
    // Medium hand: call/check
    if (canCheck) return { type: 'check' };
    if (costRatio < 0.15) return { type: 'call' };
    return { type: 'fold' };
  } else {
    // Weak hand: fold unless free
    if (canCheck) return { type: 'check' };
    return { type: 'fold' };
  }
}
