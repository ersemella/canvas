import type {DealPatternFn, DealPlacement} from '@canvas/engine';

export interface KlondikeDealConfig {
  type: 'klondike';
  tableauPrefix: string;
  stockId: string;
  tableauCount: number;
}

/**
 * Tableau column n gets n+1 cards with only the top one face up; the rest go
 * face down to the stock.
 */
export const dealKlondike: DealPatternFn = (deck, config) => {
  const pattern = config as unknown as KlondikeDealConfig;
  const placements: DealPlacement[] = [];
  let deckIndex = 0;

  for (let col = 0; col < pattern.tableauCount; col++) {
    const pileId = `${pattern.tableauPrefix}${col}`;
    for (let pos = 0; pos <= col; pos++) {
      placements.push({pileId, card: deck[deckIndex++]!, faceUp: pos === col});
    }
  }

  while (deckIndex < deck.length) {
    placements.push({pileId: pattern.stockId, card: deck[deckIndex++]!, faceUp: false});
  }
  return placements;
};
