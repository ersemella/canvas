import {BaseSystem, inputService, mouseService} from '@canvas/engine';
import type {SystemContext} from '@canvas/engine';
import {generatePuzzle} from './generator';
import type {SudokuState} from './types';

const GRID_X = 25;
const GRID_Y = 25;
const CELL_SIZE = 50;

export class SudokuSystem extends BaseSystem {
  readonly priority = 100;

  state: SudokuState | null = null;
  conflicts: Set<string> = new Set();

  onInit(_context: Omit<SystemContext, 'deltaTime'>): void {
    const given = generatePuzzle();
    this.state = {
      given,
      board: given.map(row => [...row]),
      selectedRow: -1,
      selectedCol: -1,
      complete: false,
    };
    this.conflicts = new Set();
  }

  onUpdate(context: SystemContext): void {
    const {events} = context;
    if (!this.state) return;
    const state = this.state;

    // --- Input ---
    if (!state.complete) {
      if (inputService.isActionJustPressed('moveUp')) {
        if (state.selectedRow === -1) { state.selectedRow = 0; state.selectedCol = 0; }
        else state.selectedRow = Math.max(0, state.selectedRow - 1);
      }
      if (inputService.isActionJustPressed('moveDown')) {
        if (state.selectedRow === -1) { state.selectedRow = 0; state.selectedCol = 0; }
        else state.selectedRow = Math.min(8, state.selectedRow + 1);
      }
      if (inputService.isActionJustPressed('moveLeft')) {
        if (state.selectedCol === -1) { state.selectedRow = 0; state.selectedCol = 0; }
        else state.selectedCol = Math.max(0, state.selectedCol - 1);
      }
      if (inputService.isActionJustPressed('moveRight')) {
        if (state.selectedCol === -1) { state.selectedRow = 0; state.selectedCol = 0; }
        else state.selectedCol = Math.min(8, state.selectedCol + 1);
      }

      if (mouseService.justDown) {
        const col = Math.floor((mouseService.position.x - GRID_X) / CELL_SIZE);
        const row = Math.floor((mouseService.position.y - GRID_Y) / CELL_SIZE);
        if (row >= 0 && row <= 8 && col >= 0 && col <= 8) {
          state.selectedRow = row;
          state.selectedCol = col;
        }
      }

      const r = state.selectedRow;
      const c = state.selectedCol;
      if (r >= 0 && c >= 0 && state.given[r]![c] === 0) {
        for (let d = 1; d <= 9; d++) {
          if (inputService.isActionJustPressed(`num${d}`)) {
            state.board[r]![c] = d;
          }
        }
        if (inputService.isActionJustPressed('clear')) {
          state.board[r]![c] = 0;
        }
      }
    }

    // --- Conflict detection ---
    const conflicts = new Set<string>();
    for (let row = 0; row < 9; row++) {
      for (let col = 0; col < 9; col++) {
        const val = state.board[row]![col]!;
        if (val === 0) continue;
        for (let c2 = 0; c2 < 9; c2++) {
          if (c2 !== col && state.board[row]![c2] === val) {
            conflicts.add(`${row},${col}`);
            conflicts.add(`${row},${c2}`);
          }
        }
        for (let r2 = 0; r2 < 9; r2++) {
          if (r2 !== row && state.board[r2]![col] === val) {
            conflicts.add(`${row},${col}`);
            conflicts.add(`${r2},${col}`);
          }
        }
        const br = Math.floor(row / 3) * 3;
        const bc = Math.floor(col / 3) * 3;
        for (let r2 = br; r2 < br + 3; r2++) {
          for (let c2 = bc; c2 < bc + 3; c2++) {
            if ((r2 !== row || c2 !== col) && state.board[r2]![c2] === val) {
              conflicts.add(`${row},${col}`);
              conflicts.add(`${r2},${c2}`);
            }
          }
        }
      }
    }
    this.conflicts = conflicts;

    // --- Win detection ---
    if (!state.complete) {
      let hasEmpty = false;
      outer: for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
          if (state.board[r]![c] === 0) { hasEmpty = true; break outer; }
        }
      }
      if (!hasEmpty && conflicts.size === 0) {
        state.complete = true;
        events.emit('sudoku:complete', {});
      }
    }
  }
}

// Constants exported for the render system
export {GRID_X, GRID_Y, CELL_SIZE};
