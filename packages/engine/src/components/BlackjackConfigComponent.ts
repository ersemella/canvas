import {registerDataComponent} from 'core/Component';

export interface BlackjackConfigData {
  // Game rules
  startingBalance: number;
  minBet: number;
  numDecks: number;
  dealerHitSoft17: boolean;
  // Card layout
  dealerCenterY: number;
  playerCenterY: number;
  canvasCenterX: number;
  cardWidth: number;
  cardHeight: number;
  cardGap: number;
  maxCards: number;
  // Entity ID prefixes
  // Dealer card bg entities: `${dealerCardPrefix}-${i}`
  // Dealer card label entities: `${dealerCardPrefix}-${i}-label`
  dealerCardPrefix: string;
  // Player card bg entities: `${playerCardPrefix}-${i}`
  // Player card label entities: `${playerCardPrefix}-${i}-label`
  playerCardPrefix: string;
  // Named entity IDs for UI text
  balanceTextId: string;
  betTextId: string;
  dealerValueTextId: string;
  playerValueTextId: string;
  statusTextId: string;
  // Named entity IDs for buttons
  hitButtonId: string;
  standButtonId: string;
  doubleButtonId: string;
  dealButtonId: string;
  betUpButtonId: string;
  betDownButtonId: string;
}

registerDataComponent<BlackjackConfigData>('BlackjackConfig');
