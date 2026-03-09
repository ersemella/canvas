import {registerDataComponent} from 'core/Component';

export interface CardData {
  rank: number;      // 1=A, 11=J, 12=Q, 13=K
  suit: string;      // '♠' | '♥' | '♦' | '♣'
  faceUp: boolean;
  pileId: string;    // 'stock' | 'waste' | 'f0'..'f3' | 't0'..'t6'
  posInPile: number; // 0 = bottom
}

registerDataComponent<CardData>('Card');
