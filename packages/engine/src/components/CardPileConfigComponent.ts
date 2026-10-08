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
  /** CSS label text color per color group name. E.g. `{red: '#cc0000', black: '#000000'}`. */
  groupColors?: Record<string, string>;
  rankLabels?: string[];
  faceUpColor?: string;
  faceDownColor?: string;
  dropRules: DropRule[];
  behaviors: BehaviorConfig[];
  winCondition?: WinCondition;
  events?: {onWin?: string};
  /** Clicking `buttonId` undoes the last move (drop, draw, auto-move). */
  undo?: {buttonId: string; maxDepth?: number};
  /**
   * Double-clicking/tapping a playable top card moves it to the first pile
   * matching `targets` that legally accepts it (e.g. the foundations).
   */
  autoMove?: {targets: TargetMatch};
  /**
   * Once stock and waste are empty and every card is face up, cards are moved
   * to the autoMove targets one by one until the game is won.
   */
  autoFinish?: {intervalMs?: number};
  /** Text entity that reports "no moves left" and other status messages. */
  statusTextId?: string;
  /**
   * Clicking `buttonId` cycles the dealFromStock count through `options`
   * (e.g. draw 1 / draw 3); `labelId` shows the current mode.
   */
  drawToggle?: {buttonId: string; labelId: string; options: number[]};
}

registerDataComponent<CardPileConfigData>('CardPileConfig');
