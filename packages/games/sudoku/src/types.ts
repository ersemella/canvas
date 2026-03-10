export interface SudokuState {
  given: ReadonlyArray<ReadonlyArray<number>>;
  board: number[][];
  selectedRow: number;
  selectedCol: number;
  complete: boolean;
}
