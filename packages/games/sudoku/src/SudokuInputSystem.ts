import {BaseSystem, inputService, mouseService} from '@canvas/engine';
import type {SystemContext} from '@canvas/engine';
import {GRID_X, GRID_Y, CELL_SIZE} from './SudokuSystem';
import type {SudokuSystem} from './SudokuSystem';

export class SudokuInputSystem extends BaseSystem {
  readonly priority = 50;

  constructor(private readonly game: SudokuSystem) {
    super();
  }

  onUpdate(_context: SystemContext): void {
    const state = this.game.state;
    if (!state || state.complete) return;

    let changed = false;

    if (inputService.isActionJustPressed('moveUp')) {
      if (state.selectedRow === -1) { state.selectedRow = 0; state.selectedCol = 0; }
      else state.selectedRow = Math.max(0, state.selectedRow - 1);
      changed = true;
    }
    if (inputService.isActionJustPressed('moveDown')) {
      if (state.selectedRow === -1) { state.selectedRow = 0; state.selectedCol = 0; }
      else state.selectedRow = Math.min(8, state.selectedRow + 1);
      changed = true;
    }
    if (inputService.isActionJustPressed('moveLeft')) {
      if (state.selectedCol === -1) { state.selectedRow = 0; state.selectedCol = 0; }
      else state.selectedCol = Math.max(0, state.selectedCol - 1);
      changed = true;
    }
    if (inputService.isActionJustPressed('moveRight')) {
      if (state.selectedCol === -1) { state.selectedRow = 0; state.selectedCol = 0; }
      else state.selectedCol = Math.min(8, state.selectedCol + 1);
      changed = true;
    }

    if (mouseService.justDown) {
      const col = Math.floor((mouseService.position.x - GRID_X) / CELL_SIZE);
      const row = Math.floor((mouseService.position.y - GRID_Y) / CELL_SIZE);
      if (row >= 0 && row <= 8 && col >= 0 && col <= 8) {
        state.selectedRow = row;
        state.selectedCol = col;
        changed = true;
      }
    }

    const r = state.selectedRow;
    const c = state.selectedCol;
    if (r >= 0 && c >= 0 && state.given[r]![c] === 0) {
      for (let d = 1; d <= 9; d++) {
        if (inputService.isActionJustPressed(`num${d}`)) {
          state.board[r]![c] = d;
          changed = true;
        }
      }
      if (inputService.isActionJustPressed('clear')) {
        state.board[r]![c] = 0;
        changed = true;
      }
    }

    if (changed) this.game.triggerUpdate();
  }
}
