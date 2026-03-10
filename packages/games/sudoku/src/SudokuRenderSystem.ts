import {BaseSystem} from '@canvas/engine';
import type {SystemContext} from '@canvas/engine';
import type {SudokuSystem} from './SudokuSystem';
import {GRID_X, GRID_Y, CELL_SIZE} from './SudokuSystem';

// Runs after RendererSystem (990) clears the canvas
export class SudokuRenderSystem extends BaseSystem {
  readonly priority = 995;

  constructor(private readonly game: SudokuSystem) {
    super();
  }

  onUpdate({ctx}: SystemContext): void {
    const state = this.game.state;
    if (!state) return;
    const conflicts = this.game.conflicts;

    const sr = state.selectedRow;
    const sc = state.selectedCol;

    // 1. Cell backgrounds
    for (let row = 0; row < 9; row++) {
      for (let col = 0; col < 9; col++) {
        const x = GRID_X + col * CELL_SIZE;
        const y = GRID_Y + row * CELL_SIZE;
        let bg = '#fff';
        if (sr >= 0 && sc >= 0) {
          const sameBox =
            Math.floor(row / 3) === Math.floor(sr / 3) &&
            Math.floor(col / 3) === Math.floor(sc / 3);
          if (row === sr && col === sc) {
            bg = '#b3d9ff';
          } else if (row === sr || col === sc || sameBox) {
            bg = '#e8f4ff';
          }
        }
        ctx.fillStyle = bg;
        ctx.fillRect(x, y, CELL_SIZE, CELL_SIZE);
      }
    }

    // 2. Numbers
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let row = 0; row < 9; row++) {
      for (let col = 0; col < 9; col++) {
        const val = state.board[row]![col]!;
        if (val === 0) continue;
        const x = GRID_X + col * CELL_SIZE + CELL_SIZE / 2;
        const y = GRID_Y + row * CELL_SIZE + CELL_SIZE / 2;
        const isGiven = state.given[row]![col] !== 0;
        const isConflict = conflicts.has(`${row},${col}`);
        if (isConflict && !isGiven) {
          ctx.fillStyle = '#c0392b';
          ctx.font = '24px Arial';
        } else if (isGiven) {
          ctx.fillStyle = '#1a1a2e';
          ctx.font = 'bold 24px Arial';
        } else {
          ctx.fillStyle = '#1a5276';
          ctx.font = '24px Arial';
        }
        ctx.fillText(String(val), x, y);
      }
    }

    // 3. Grid lines — thin
    ctx.strokeStyle = '#999';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 9; i++) {
      if (i % 3 === 0) continue;
      const px = GRID_X + i * CELL_SIZE;
      const py = GRID_Y + i * CELL_SIZE;
      ctx.beginPath();
      ctx.moveTo(px, GRID_Y);
      ctx.lineTo(px, GRID_Y + 9 * CELL_SIZE);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(GRID_X, py);
      ctx.lineTo(GRID_X + 9 * CELL_SIZE, py);
      ctx.stroke();
    }

    // 3. Grid lines — thick box borders
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 3;
    for (let i = 0; i <= 3; i++) {
      const px = GRID_X + i * 3 * CELL_SIZE;
      const py = GRID_Y + i * 3 * CELL_SIZE;
      ctx.beginPath();
      ctx.moveTo(px, GRID_Y);
      ctx.lineTo(px, GRID_Y + 9 * CELL_SIZE);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(GRID_X, py);
      ctx.lineTo(GRID_X + 9 * CELL_SIZE, py);
      ctx.stroke();
    }

    // 4. Status text
    ctx.fillStyle = '#333';
    ctx.font = '14px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Sudoku — use arrow keys or click + 1–9', 250, 495);
  }
}
