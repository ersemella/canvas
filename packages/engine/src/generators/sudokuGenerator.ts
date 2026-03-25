import {puzzleGenerators} from 'generators/puzzleGenerators';

function shuffleArr<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = a[i]!; a[i] = a[j]!; a[j] = tmp;
  }
  return a;
}

function sudokuIsValid(grid: number[][], row: number, col: number, val: number): boolean {
  for (let c = 0; c < 9; c++) { if (grid[row]![c] === val) return false; }
  for (let r = 0; r < 9; r++) { if (grid[r]![col] === val) return false; }
  const br = Math.floor(row / 3) * 3;
  const bc = Math.floor(col / 3) * 3;
  for (let r = br; r < br + 3; r++) {
    for (let c = bc; c < bc + 3; c++) {
      if (grid[r]![c] === val) return false;
    }
  }
  return true;
}

function fillDiagonalBoxes(grid: number[][]): void {
  for (let box = 0; box < 3; box++) {
    const nums = shuffleArr([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    for (let i = 0; i < 9; i++) {
      grid[box * 3 + Math.floor(i / 3)]![box * 3 + (i % 3)] = nums[i]!;
    }
  }
}

function solveFill(grid: number[][]): boolean {
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (grid[r]![c] === 0) {
        for (const val of shuffleArr([1, 2, 3, 4, 5, 6, 7, 8, 9])) {
          if (sudokuIsValid(grid, r, c, val)) {
            grid[r]![c] = val;
            if (solveFill(grid)) return true;
            grid[r]![c] = 0;
          }
        }
        return false;
      }
    }
  }
  return true;
}

function solveCount(grid: number[][]): number {
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (grid[r]![c] === 0) {
        let count = 0;
        for (let val = 1; val <= 9; val++) {
          if (sudokuIsValid(grid, r, c, val)) {
            grid[r]![c] = val;
            count += solveCount(grid);
            grid[r]![c] = 0;
            if (count >= 2) return count;
          }
        }
        return count;
      }
    }
  }
  return 1;
}

function generateSudoku(): number[][] {
  const grid: number[][] = Array.from({length: 9}, () => Array.from({length: 9}, () => 0));
  fillDiagonalBoxes(grid);
  solveFill(grid);
  const cells = shuffleArr(Array.from({length: 81}, (_, i) => ({r: Math.floor(i / 9), c: i % 9})));
  let removed = 0;
  for (const {r, c} of cells) {
    if (removed >= 47) break;
    const backup = grid[r]![c]!;
    grid[r]![c] = 0;
    if (solveCount(grid.map((row) => [...row])) !== 1) {
      grid[r]![c] = backup;
    } else {
      removed++;
    }
  }
  return grid;
}

puzzleGenerators.register('sudoku', () => generateSudoku());
