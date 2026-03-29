/**
 * Bot AI for single-player poker.
 * Used by PokerSystem to decide bot actions each tick.
 */

import {evaluate7CardHand, type PokerCard} from 'util/handEvaluator';

type ActionType = 'fold' | 'check' | 'call' | 'raise';

interface BotPlayer {
  holeCards: [PokerCard, PokerCard] | null;
  chips: number;
  currentBet: number;
  style: 'tight' | 'loose' | 'aggressive';
}

interface BotGameState {
  currentBet: number;
  communityCards: PokerCard[];
}

function handStrength(holeCards: [PokerCard, PokerCard], communityCards: PokerCard[]): number {
  const score = evaluate7CardHand([...holeCards, ...communityCards]);
  const baseScore = (score.rank / 8) * 80;
  const topCard = Math.max(holeCards[0].rank, holeCards[1].rank);
  return Math.min(100, baseScore + ((topCard - 2) / 12) * 20);
}

export function decideBotAction(
  player: BotPlayer,
  gameState: BotGameState
): {type: ActionType; amount?: number} {
  if (!player.holeCards) return {type: 'fold'};

  const callAmount = gameState.currentBet - player.currentBet;
  const canCheck = callAmount === 0;
  const costRatio = player.chips > 0 ? callAmount / player.chips : 1;

  let threshold: number;

  if (gameState.communityCards.length === 0) {
    const [c1, c2] = player.holeCards;
    const high = Math.max(c1.rank, c2.rank);
    const low = Math.min(c1.rank, c2.rank);
    const isPair = c1.rank === c2.rank;
    const preFlopScore = isPair ? high * 4 : high * 2 + low;
    threshold = (preFlopScore / 56) * 100;
    if (player.style === 'aggressive') threshold += 15;
    if (player.style === 'tight') threshold -= 10;
    threshold += (Math.random() - 0.5) * 30;
  } else {
    threshold = handStrength(player.holeCards, gameState.communityCards);
    if (player.style === 'tight') threshold -= 10;
    if (player.style === 'loose') threshold += 15;
    if (player.style === 'aggressive') threshold += 5;
    threshold += (Math.random() - 0.5) * 40;
    threshold = Math.max(0, Math.min(100, threshold));
  }

  if (threshold > 70) {
    if (player.chips <= callAmount) {
      return callAmount === 0 ? {type: 'check'} : {type: 'call'};
    }
    const raiseAmount = Math.min(
      player.chips,
      Math.max(gameState.currentBet * 2, gameState.currentBet + 10)
    );
    return {type: 'raise', amount: raiseAmount};
  } else if (threshold > 40) {
    if (canCheck) return {type: 'check'};
    if (costRatio < 0.15) return {type: 'call'};
    return {type: 'fold'};
  } else {
    if (canCheck) return {type: 'check'};
    return {type: 'fold'};
  }
}
