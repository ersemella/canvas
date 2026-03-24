import {ReactiveSystem} from 'core/System';
import type {SystemContext} from 'core/System';
import type {EventBus} from 'core/EventBus';
import type {Scene} from 'core/Scene';
import type {DataComponent} from 'core/Component';
import type {RenderableComponent} from 'components/RenderableComponent';
import {inputService} from 'systems/InputSystem';
import type {GridCursorPayload} from 'systems/GridCursorSystem';
import type {GridPuzzleConfigData, GridPuzzleData, PuzzleConstraint} from 'components/GridPuzzleConfigComponent';

const DEFAULT_VISUALS = {
  selectedColor: '#b3d9ff',
  relatedColor: '#e8f4ff',
  conflictTextColor: '#c0392b',
  givenTextColor: '#1a1a2e',
  playerTextColor: '#1a5276',
};

// --- Sudoku generator ---

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

// --- System ---

export class GridPuzzleSystem extends ReactiveSystem {
  readonly priority = 100;

  private config: GridPuzzleConfigData | null = null;
  private scene: Scene | null = null;
  private eventsRef: EventBus | null = null;

  private cellBg: RenderableComponent[][] = [];
  private cellNum: RenderableComponent[][] = [];

  onInit({scene, events}: Omit<SystemContext, 'deltaTime'>): void {
    this.scene = scene;
    this.eventsRef = events;

    const configEntity = scene.query({all: ['GridPuzzleConfig']})[0];
    if (!configEntity) return;
    this.config = configEntity.getComponent<DataComponent<GridPuzzleConfigData>>('GridPuzzleConfig')!.data;
    const config = this.config;

    const puzzleEntity = scene.query({all: ['GridPuzzle']})[0];
    if (!puzzleEntity) return;
    const puzzle = puzzleEntity.getComponent<DataComponent<GridPuzzleData>>('GridPuzzle')!.data;

    // Generate puzzle if requested and not already populated
    if (config.generator === 'sudoku' && (!puzzle.given || puzzle.given.length === 0)) {
      const generated = generateSudoku();
      puzzle.given = generated;
      puzzle.board = generated.map((row) => [...row]);
    }

    const {rows, cols} = config;
    const vis = {...DEFAULT_VISUALS, ...config.visuals};

    // Cache cell renderables and set initial given-digit state
    for (let row = 0; row < rows; row++) {
      this.cellBg[row] = [];
      this.cellNum[row] = [];
      for (let col = 0; col < cols; col++) {
        const bg = scene.getEntity(`cell-${row}-${col}`)?.getComponent<RenderableComponent>('Renderable');
        const num = scene.getEntity(`cell-${row}-${col}-num`)?.getComponent<RenderableComponent>('Renderable');
        if (bg) this.cellBg[row]![col] = bg;
        if (num) {
          this.cellNum[row]![col] = num;
          const val = puzzle.given?.[row]?.[col] ?? 0;
          if (val !== 0) {
            num.text = String(val);
            num.bold = true;
            num.textColor = vis.givenTextColor ?? DEFAULT_VISUALS.givenTextColor;
            num.visible = true;
          }
        }
      }
    }

    events.on<GridCursorPayload>('cursor:moved', ({row, col}: GridCursorPayload) => {
      const pe = scene.query({all: ['GridPuzzle']})[0];
      if (!pe) return;
      const p = pe.getComponent<DataComponent<GridPuzzleData>>('GridPuzzle')!.data;
      p.selectedRow = row;
      p.selectedCol = col;
      this.markDirty();
    });
  }

  onUpdate(context: SystemContext): void {
    this.handleDigitInput();
    super.onUpdate(context);
  }

  private handleDigitInput(): void {
    const config = this.config;
    if (!config) return;

    const puzzle = this.getPuzzleData();
    if (!puzzle || puzzle.complete || !puzzle.board) return;

    const r = puzzle.selectedRow;
    const c = puzzle.selectedCol;
    if (r < 0 || c < 0 || (puzzle.given?.[r]?.[c] ?? 0) !== 0) return;

    const digitPrefix = config.inputActions?.digitPrefix ?? 'num';
    for (let d = config.minValue; d <= config.maxValue; d++) {
      if (inputService.isActionJustPressed(`${digitPrefix}${d}`)) {
        puzzle.board[r]![c] = d;
        this.markDirty();
        return;
      }
    }

    if (inputService.isActionJustPressed(config.inputActions?.clear ?? 'clear')) {
      puzzle.board[r]![c] = 0;
      this.markDirty();
    }
  }

  onDirty({events}: SystemContext): void {
    const config = this.config;
    if (!config) return;

    const puzzle = this.getPuzzleData();
    if (!puzzle?.board) return;

    const conflicts = this.evaluateConstraints(puzzle.board, config.constraints, config);
    const vis = {...DEFAULT_VISUALS, ...config.visuals};
    const sr = puzzle.selectedRow;
    const sc = puzzle.selectedCol;
    const {rows, cols} = config;

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const bg = this.cellBg[row]![col];
        const num = this.cellNum[row]![col];

        if (bg) {
          let color = '#ffffff';
          if (sr >= 0 && sc >= 0) {
            if (row === sr && col === sc) {
              color = vis.selectedColor;
            } else if (this.isRelated(row, col, sr, sc, config)) {
              color = vis.relatedColor;
            }
          }
          bg.color = color;
        }

        if (num) {
          const val = puzzle.board[row]![col]!;
          if (val === 0) {
            num.visible = false;
          } else {
            const isGiven = (puzzle.given?.[row]?.[col] ?? 0) !== 0;
            const isConflict = conflicts.has(`${row},${col}`);
            num.text = String(val);
            num.visible = true;
            if (isConflict && !isGiven) {
              num.textColor = vis.conflictTextColor;
              num.bold = false;
            } else if (isGiven) {
              num.textColor = vis.givenTextColor;
              num.bold = true;
            } else {
              num.textColor = vis.playerTextColor;
              num.bold = false;
            }
          }
        }
      }
    }

    if (!puzzle.complete) {
      let hasEmpty = false;
      outer: for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (puzzle.board[r]![c] === 0) {hasEmpty = true; break outer;}
        }
      }
      if (!hasEmpty && conflicts.size === 0) {
        puzzle.complete = true;
        const onWin = config.events?.onWin;
        if (onWin) events.emit(onWin, {});
      }
    }
  }

  private getPuzzleData(): GridPuzzleData | null {
    const entity = this.scene?.query({all: ['GridPuzzle']})[0];
    if (!entity) return null;
    return entity.getComponent<DataComponent<GridPuzzleData>>('GridPuzzle')!.data;
  }

  private evaluateConstraints(board: number[][], constraints: PuzzleConstraint[], config: GridPuzzleConfigData): Set<string> {
    const conflicts = new Set<string>();
    const {rows, cols} = config;

    for (const constraint of constraints) {
      if (constraint === 'noRepeatInRow') {
        for (let row = 0; row < rows; row++) {
          for (let col = 0; col < cols; col++) {
            const val = board[row]![col]!;
            if (val === 0) continue;
            for (let c2 = 0; c2 < cols; c2++) {
              if (c2 !== col && board[row]![c2] === val) {
                conflicts.add(`${row},${col}`); conflicts.add(`${row},${c2}`);
              }
            }
          }
        }
      } else if (constraint === 'noRepeatInCol') {
        for (let row = 0; row < rows; row++) {
          for (let col = 0; col < cols; col++) {
            const val = board[row]![col]!;
            if (val === 0) continue;
            for (let r2 = 0; r2 < rows; r2++) {
              if (r2 !== row && board[r2]![col] === val) {
                conflicts.add(`${row},${col}`); conflicts.add(`${r2},${col}`);
              }
            }
          }
        }
      } else if (constraint === 'noRepeatInBox') {
        const bRows = config.boxRows ?? 3;
        const bCols = config.boxCols ?? 3;
        for (let row = 0; row < rows; row++) {
          for (let col = 0; col < cols; col++) {
            const val = board[row]![col]!;
            if (val === 0) continue;
            const br = Math.floor(row / bRows) * bRows;
            const bc = Math.floor(col / bCols) * bCols;
            for (let r2 = br; r2 < br + bRows; r2++) {
              for (let c2 = bc; c2 < bc + bCols; c2++) {
                if ((r2 !== row || c2 !== col) && board[r2]![c2] === val) {
                  conflicts.add(`${row},${col}`); conflicts.add(`${r2},${c2}`);
                }
              }
            }
          }
        }
      }
    }

    return conflicts;
  }

  private isRelated(row: number, col: number, sr: number, sc: number, config: GridPuzzleConfigData): boolean {
    if (row === sr || col === sc) return true;
    if (config.constraints.includes('noRepeatInBox')) {
      const bRows = config.boxRows ?? 3;
      const bCols = config.boxCols ?? 3;
      if (Math.floor(row / bRows) === Math.floor(sr / bRows) && Math.floor(col / bCols) === Math.floor(sc / bCols)) {
        return true;
      }
    }
    return false;
  }
}
