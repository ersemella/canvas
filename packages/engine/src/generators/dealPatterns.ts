import type {DealPatternConfig} from 'components/DeckConfigComponent';

export interface DealtCard {
  rank: number;
  suit: string;
}

/** Where one card of the shuffled deck goes. Cards land in each pile in the order returned. */
export interface DealPlacement {
  pileId: string;
  card: DealtCard;
  faceUp: boolean;
}

/**
 * Lays out a shuffled deck. `pattern` is the manifest's `DeckConfig.dealPattern`
 * (its `type` picked this function); the rest of its fields are the pattern's own.
 */
export type DealPatternFn = (deck: DealtCard[], pattern: DealPatternConfig) => DealPlacement[];

const registry = new Map<string, DealPatternFn>();

export const dealPatterns = {
  register(name: string, fn: DealPatternFn): void {
    registry.set(name, fn);
  },
  get(name: string): DealPatternFn | undefined {
    return registry.get(name);
  },
};
