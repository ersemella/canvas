// Regenerates game.json from the layout constants and config.
// Run: node scripts/generate.mjs
import {writeFileSync} from 'fs';
import {fileURLToPath} from 'url';
import {dirname, join} from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const GRID_X = 25;
const GRID_Y = 25;
const CELL_SIZE = 50;

function buildCellEntities() {
  const entities = [];
  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      const cx = GRID_X + col * CELL_SIZE + CELL_SIZE / 2;
      const cy = GRID_Y + row * CELL_SIZE + CELL_SIZE / 2;
      entities.push({
        id: `cell-${row}-${col}`,
        components: {
          Transform: {position: {x: cx, y: cy}, rotation: 0, scale: {x: 1, y: 1}},
          Renderable: {width: CELL_SIZE, height: CELL_SIZE, color: '#ffffff', zIndex: 0},
        },
      });
      entities.push({
        id: `cell-${row}-${col}-num`,
        components: {
          Transform: {position: {x: cx, y: cy}, rotation: 0, scale: {x: 1, y: 1}},
          Renderable: {renderType: 'text', width: 0, height: 0, zIndex: 1, visible: false, text: '', fontSize: 24, fontFamily: 'Arial', bold: false, textColor: '#1a5276'},
        },
      });
    }
  }
  return entities;
}

function buildGridLines() {
  const entities = [];
  const thinIndices = [1, 2, 4, 5, 7, 8];
  const midX = GRID_X + (9 * CELL_SIZE) / 2;
  const midY = GRID_Y + (9 * CELL_SIZE) / 2;
  for (const i of thinIndices) {
    entities.push({
      id: `vline-${i}`,
      components: {
        Transform: {position: {x: GRID_X + i * CELL_SIZE, y: midY}, rotation: 0, scale: {x: 1, y: 1}},
        Renderable: {width: 1, height: 9 * CELL_SIZE, color: '#999999', zIndex: 2},
      },
    });
    entities.push({
      id: `hline-${i}`,
      components: {
        Transform: {position: {x: midX, y: GRID_Y + i * CELL_SIZE}, rotation: 0, scale: {x: 1, y: 1}},
        Renderable: {width: 9 * CELL_SIZE, height: 1, color: '#999999', zIndex: 2},
      },
    });
  }
  for (let i = 0; i <= 3; i++) {
    entities.push({
      id: `vborder-${i}`,
      components: {
        Transform: {position: {x: GRID_X + i * 3 * CELL_SIZE, y: midY}, rotation: 0, scale: {x: 1, y: 1}},
        Renderable: {width: 3, height: 9 * CELL_SIZE, color: '#333333', zIndex: 3},
      },
    });
    entities.push({
      id: `hborder-${i}`,
      components: {
        Transform: {position: {x: midX, y: GRID_Y + i * 3 * CELL_SIZE}, rotation: 0, scale: {x: 1, y: 1}},
        Renderable: {width: 9 * CELL_SIZE, height: 3, color: '#333333', zIndex: 3},
      },
    });
  }
  return entities;
}

const manifest = {
  meta: {title: 'Sudoku', description: 'Classic 9×9 Sudoku. Fill the grid with digits 1–9, no repeats in any row, column, or box.'},
  canvas: {width: 500, height: 520},
  systems: ['MouseSystem', 'GridCursorSystem', 'GridPuzzleSystem'],
  events: {onDeath: 'sudoku:complete'},
  scene: {
    name: 'sudoku',
    entities: [
      {
        id: 'game-config',
        components: {
          GridPuzzleConfig: {
            rows: 9,
            cols: 9,
            minValue: 1,
            maxValue: 9,
            constraints: ['noRepeatInRow', 'noRepeatInCol', 'noRepeatInBox'],
            boxRows: 3,
            boxCols: 3,
            boxHighlight: true,
            winCondition: 'noEmptyNoConflict',
            generator: 'sudoku',
            inputActions: {digitPrefix: 'num', clear: 'clear'},
            visuals: {
              selectedColor: '#b3d9ff',
              relatedColor: '#e8f4ff',
              conflictTextColor: '#c0392b',
              givenTextColor: '#1a1a2e',
              playerTextColor: '#1a5276',
            },
            events: {onWin: 'sudoku:complete'},
          },
        },
      },
      {
        id: 'board',
        components: {
          Transform: {position: {x: 0, y: 0}, rotation: 0, scale: {x: 1, y: 1}},
          GridCursor: {rows: 9, cols: 9, cellSize: CELL_SIZE, originX: GRID_X, originY: GRID_Y, selectedRow: -1, selectedCol: -1},
          Input: {
            actionMap: {
              num1: ['Digit1', 'Numpad1'], num2: ['Digit2', 'Numpad2'], num3: ['Digit3', 'Numpad3'],
              num4: ['Digit4', 'Numpad4'], num5: ['Digit5', 'Numpad5'], num6: ['Digit6', 'Numpad6'],
              num7: ['Digit7', 'Numpad7'], num8: ['Digit8', 'Numpad8'], num9: ['Digit9', 'Numpad9'],
              clear: ['Backspace', 'Delete', 'Digit0', 'Numpad0'],
              moveUp: ['ArrowUp'], moveDown: ['ArrowDown'], moveLeft: ['ArrowLeft'], moveRight: ['ArrowRight'],
            },
          },
          GridPuzzle: {selectedRow: -1, selectedCol: -1, complete: false},
        },
      },
      ...buildCellEntities(),
      ...buildGridLines(),
      {
        id: 'status',
        components: {
          Transform: {position: {x: 250, y: 495}, rotation: 0, scale: {x: 1, y: 1}},
          Renderable: {renderType: 'text', width: 0, height: 0, zIndex: 4, visible: true, text: 'Sudoku — use arrow keys or click + 1–9', fontSize: 14, fontFamily: 'Arial', bold: false, textColor: '#333333'},
        },
      },
    ],
  },
};

const outPath = join(__dirname, '..', 'game.json');
writeFileSync(outPath, JSON.stringify(manifest, null, 2));
console.log(`Written: ${outPath}`);
