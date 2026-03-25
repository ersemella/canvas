import {registerDataComponent} from 'core/Component';

export type PuzzleConstraint = 'noRepeatInRow' | 'noRepeatInCol' | 'noRepeatInBox';

export interface PuzzleVisuals {
  selectedColor?: string;
  relatedColor?: string;
  conflictTextColor?: string;
  givenTextColor?: string;
  playerTextColor?: string;
}

export interface GridPuzzleConfigData {
  rows: number;
  cols: number;
  minValue: number;
  maxValue: number;
  constraints: PuzzleConstraint[];
  boxRows?: number;
  boxCols?: number;
  /** Highlight cells in the same box as the selected cell. Requires boxRows/boxCols. */
  boxHighlight?: boolean;
  /** Prefix for cell entity IDs. Cells are named `{cellPrefix}-{row}-{col}`. Defaults to 'cell'. */
  cellPrefix?: string;
  winCondition: 'noEmptyNoConflict';
  generator?: string;
  inputActions?: {digitPrefix?: string; clear?: string};
  visuals?: PuzzleVisuals;
  events?: {onWin?: string};
}

export interface GridPuzzleData {
  given?: ReadonlyArray<ReadonlyArray<number>>;
  board?: number[][];
  selectedRow: number;
  selectedCol: number;
  complete: boolean;
}

registerDataComponent<GridPuzzleConfigData>('GridPuzzleConfig');
registerDataComponent<GridPuzzleData>('GridPuzzle');
