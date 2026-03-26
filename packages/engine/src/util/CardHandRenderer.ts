/**
 * Rendering utilities for hand-based card games (Blackjack, Baccarat, etc.).
 *
 * Games pre-allocate card slot entities in their manifest. This module
 * positions and styles those slots based on the current hand state.
 */

import type {PlayingCard} from 'util/Shoe';
import type {RenderableComponent} from 'components/RenderableComponent';
import type {TransformComponent} from 'components/TransformComponent';

/** A card in a player's or dealer's hand. */
export interface HandCard extends PlayingCard {
  faceUp: boolean;
}

/** References to the pre-created ECS entities that represent one card slot. */
export interface CardSlot {
  bg: RenderableComponent;
  label: RenderableComponent;
  transform: TransformComponent;
}

/** Layout parameters for computing card positions. */
export interface CardHandLayout {
  canvasCenterX: number;
  cardWidth: number;
  cardHeight: number;
  cardGap: number;
}

const CARD_FACE_COLOR = '#ffffff';
const CARD_FACE_BORDER = '#888888';
const CARD_BACK_COLOR = '#1a5c96';
const CARD_BACK_BORDER = '#0d3d6b';

/** Display label for a card rank (e.g. 1 → 'A', 11 → 'J'). */
export function rankLabel(rank: number): string {
  if (rank === 1) return 'A';
  if (rank === 11) return 'J';
  if (rank === 12) return 'Q';
  if (rank === 13) return 'K';
  return String(rank);
}

/** Text color for a suit — red for hearts/diamonds, near-black for spades/clubs. */
export function suitColor(suit: string): string {
  return suit === '\u2665' || suit === '\u2666' ? '#cc2200' : '#111111';
}

/** Compute centered X positions for `count` cards within the layout. */
export function cardXPositions(count: number, layout: CardHandLayout): number[] {
  if (count === 0) return [];
  if (count === 1) return [layout.canvasCenterX];
  const maxStep = layout.cardWidth + layout.cardGap;
  const step = Math.min(maxStep, (layout.canvasCenterX * 1.6) / (count - 1));
  const totalW = step * (count - 1) + layout.cardWidth;
  const startX = layout.canvasCenterX - totalW / 2 + layout.cardWidth / 2;
  return Array.from({length: count}, (_, i) => startX + i * step);
}

/**
 * Update the visual state of pre-allocated card slots to match `hand`.
 * Slots beyond the hand length are hidden.
 */
export function renderCardHand(
  hand: HandCard[],
  slots: CardSlot[],
  centerY: number,
  layout: CardHandLayout,
): void {
  const xs = cardXPositions(hand.length, layout);
  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i]!;
    if (i >= hand.length) {
      slot.bg.visible = false;
      slot.label.visible = false;
      continue;
    }
    const card = hand[i]!;
    slot.transform.position.x = xs[i]!;
    slot.transform.position.y = centerY;
    slot.bg.visible = true;
    slot.bg.width = layout.cardWidth;
    slot.bg.height = layout.cardHeight;
    slot.bg.zIndex = 10 + i;
    slot.bg.radius = 4;

    if (card.faceUp) {
      slot.bg.color = CARD_FACE_COLOR;
      slot.bg.borderColor = CARD_FACE_BORDER;
      slot.bg.borderWidth = 1;
      slot.label.visible = true;
      slot.label.text = `${rankLabel(card.rank)}${card.suit}`;
      slot.label.textColor = suitColor(card.suit);
      slot.label.fontSize = 14;
      slot.label.bold = true;
      slot.label.zIndex = 11 + i;
    } else {
      slot.bg.color = CARD_BACK_COLOR;
      slot.bg.borderColor = CARD_BACK_BORDER;
      slot.bg.borderWidth = 1;
      slot.label.visible = false;
    }
  }
}
