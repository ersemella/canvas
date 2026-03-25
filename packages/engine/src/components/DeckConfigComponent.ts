import {registerDataComponent} from 'core/Component';

export type DealPatternConfig =
  | {type: 'klondike'; tableauPrefix: string; stockId: string; tableauCount: number};

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
