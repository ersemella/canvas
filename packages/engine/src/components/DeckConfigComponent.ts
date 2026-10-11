import {registerDataComponent} from '../core/Component';

/**
 * How a generated deck is dealt. `type` names a function registered with
 * `dealPatterns.register` (a game registers its own in `register()`); the other fields are
 * that pattern's own options.
 */
export interface DealPatternConfig {
  type: string;
  [option: string]: unknown;
}

export interface DeckConfigData {
  suits: string[];
  ranks: number;
  cardWidth: number;
  cardHeight: number;
  dealPattern: DealPatternConfig;
  /** Suffixes for per-card label entities: `{cardId}-label-{suffix}`. Defaults to ['tl', 'br']. */
  labelSuffixes?: string[];
}

registerDataComponent<DeckConfigData>('DeckConfig');
