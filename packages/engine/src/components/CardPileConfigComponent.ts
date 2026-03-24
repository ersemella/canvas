import {registerDataComponent} from 'core/Component';

export type TargetMatch =
  | {prefix: string}
  | {ids: string[]}
  | {tag: string};

export type DropCondition =
  | {type: 'sameSuit'}
  | {type: 'alternateColor'}
  | {type: 'rankDelta'; value: number}
  | {type: 'rankEquals'; value: number};

export interface DropRule {
  target: TargetMatch;
  maxGroupSize?: number;
  conditions: DropCondition[];
  emptyConditions?: DropCondition[];
}

export type BehaviorConfig =
  | {type: 'dealFromStock'; stockId: string; wasteId: string; count?: number}
  | {type: 'flipOriginTopOnDrop'; originMatch: TargetMatch};

export type WinCondition =
  | {type: 'allPilesFull'; piles: string[]; size: number}
  | {type: 'allPilesEmpty'; piles: string[]};

export interface CardPileConfigData {
  pileIds: string[];
  colorGroups?: Record<string, string[]>;
  rankLabels?: string[];
  faceUpColor?: string;
  faceDownColor?: string;
  dropRules: DropRule[];
  behaviors: BehaviorConfig[];
  winCondition?: WinCondition;
  events?: {onWin?: string};
}

registerDataComponent<CardPileConfigData>('CardPileConfig');
