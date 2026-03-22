import {ReactiveSystem, inputService} from '@canvas/engine';
import type {SystemContext, RenderableComponent, GridCursorPayload} from '@canvas/engine';
import {generatePuzzle} from './generator';
import type {SudokuState} from './types';

export const GRID_X = 25;
export const GRID_Y = 25;
export const CELL_SIZE = 50;

export class SudokuSystem extends ReactiveSystem {
  readonly priority = 100;

  state: SudokuState | null = null;
  conflicts: Set<string> = new Set();

  private cellBg: RenderableComponent[][] = [];
  private cellNum: RenderableComponent[][] = [];

  onInit({scene, events}: Omit<SystemContext, 'deltaTime'>): void {
    events.on<GridCursorPayload>('cursor:moved', ({row, col}) => {
      if (!this.state) return;
      this.state.selectedRow = row;
      this.state.selectedCol = col;
      this.markDirty();
    });
    const given = generatePuzzle();
    this.state = {
      given,
      board: given.map(row => [...row]),
      selectedRow: -1,
      selectedCol: -1,
      complete: false,
    };
    this.conflicts = new Set();

    // Cache entity renderables and set initial state
    for (let row = 0; row < 9; row++) {
      this.cellBg[row] = [];
      this.cellNum[row] = [];
      for (let col = 0; col < 9; col++) {
        const bg = scene.getEntity(`cell-${row}-${col}`)
          ?.getComponent<RenderableComponent>('Renderable');
        const num = scene.getEntity(`cell-${row}-${col}-num`)
          ?.getComponent<RenderableComponent>('Renderable');

        if (bg) this.cellBg[row]![col] = bg;
        if (num) {
          this.cellNum[row]![col] = num;
          const val = given[row]![col]!;
          if (val !== 0) {
            num.text = String(val);
            num.bold = true;
            num.textColor = '#1a1a2e';
            num.visible = true;
          }
        }
      }
    }
  }

  onUpdate(context: SystemContext): void {
    this.handleDigitInput();
    super.onUpdate(context);
  }

  private handleDigitInput(): void {
    const state = this.state;
    if (!state || state.complete) return;
    const r = state.selectedRow;
    const c = state.selectedCol;
    if (r < 0 || c < 0 || state.given[r]![c] !== 0) return;

    for (let d = 1; d <= 9; d++) {
      if (inputService.isActionJustPressed(`num${d}`)) {
        state.board[r]![c] = d;
        this.markDirty();
        return;
      }
    }
    if (inputService.isActionJustPressed('clear')) {
      state.board[r]![c] = 0;
      this.markDirty();
    }
  }

  onDirty({events}: SystemContext): void {
    if (!this.state) return;
    const state = this.state;

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

    // --- Update entity renderables ---
    const sr = state.selectedRow;
    const sc = state.selectedCol;

    for (let row = 0; row < 9; row++) {
      for (let col = 0; col < 9; col++) {
        const bg = this.cellBg[row]![col];
        const num = this.cellNum[row]![col];

        if (bg) {
          let color = '#ffffff';
          if (sr >= 0 && sc >= 0) {
            const sameBox =
              Math.floor(row / 3) === Math.floor(sr / 3) &&
              Math.floor(col / 3) === Math.floor(sc / 3);
            if (row === sr && col === sc) {
              color = '#b3d9ff';
            } else if (row === sr || col === sc || sameBox) {
              color = '#e8f4ff';
            }
          }
          bg.color = color;
        }

        if (num) {
          const val = state.board[row]![col]!;
          if (val === 0) {
            num.visible = false;
          } else {
            const isGiven = state.given[row]![col] !== 0;
            const isConflict = conflicts.has(`${row},${col}`);
            num.text = String(val);
            num.visible = true;
            if (isConflict && !isGiven) {
              num.textColor = '#c0392b';
              num.bold = false;
            } else if (isGiven) {
              num.textColor = '#1a1a2e';
              num.bold = true;
            } else {
              num.textColor = '#1a5276';
              num.bold = false;
            }
          }
        }
      }
    }

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
