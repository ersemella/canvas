export const CARD_W = 70;
export const CARD_H = 96;
export const COL_STEP = 82;
export const MARGIN_X = 14;
export const MARGIN_Y = 10;
export const TOP_Y = MARGIN_Y + CARD_H / 2;   // 58
export const TABLEAU_Y = 168;
export const FACE_DOWN_STEP = 20;
export const FACE_UP_STEP = 28;

export const suits = ['♠', '♥', '♦', '♣'] as const;
export const rankLabels = ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
export const redSuits = new Set(['♥', '♦']);

export function colX(col: number): number {
  return MARGIN_X + CARD_W / 2 + col * COL_STEP;
}
