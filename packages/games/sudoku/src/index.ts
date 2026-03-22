import {createGameModule, SystemRegistry} from '@canvas/engine';
import type {EntityData} from '@canvas/engine';
import {SudokuSystem, GRID_X, GRID_Y, CELL_SIZE} from './SudokuSystem';

SystemRegistry.register('SudokuSystem', SudokuSystem);

function buildScene() {
  const entities: EntityData[] = [];

  // Input handler entity
  entities.push({
    id: 'board',
    components: {
      Transform: {position: {x: 0, y: 0}, rotation: 0, scale: {x: 1, y: 1}},
      GridCursor: {rows: 9, cols: 9, cellSize: CELL_SIZE, originX: GRID_X, originY: GRID_Y, selectedRow: -1, selectedCol: -1},
      Input: {
        actionMap: {
          num1: ['Digit1', 'Numpad1'],
          num2: ['Digit2', 'Numpad2'],
          num3: ['Digit3', 'Numpad3'],
          num4: ['Digit4', 'Numpad4'],
          num5: ['Digit5', 'Numpad5'],
          num6: ['Digit6', 'Numpad6'],
          num7: ['Digit7', 'Numpad7'],
          num8: ['Digit8', 'Numpad8'],
          num9: ['Digit9', 'Numpad9'],
          clear: ['Backspace', 'Delete', 'Digit0', 'Numpad0'],
          moveUp: ['ArrowUp'],
          moveDown: ['ArrowDown'],
          moveLeft: ['ArrowLeft'],
          moveRight: ['ArrowRight'],
        },
      },
    },
  });

  // Cell background + number entities
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
          Renderable: {
            renderType: 'text',
            width: 0, height: 0,
            zIndex: 1,
            visible: false,
            text: '',
            fontSize: 24,
            fontFamily: 'Arial',
            bold: false,
            textColor: '#1a5276',
          },
        },
      });
    }
  }

  // Thin grid lines (between cells, not at box borders)
  const thinIndices = [1, 2, 4, 5, 7, 8];
  for (const i of thinIndices) {
    entities.push({
      id: `vline-${i}`,
      components: {
        Transform: {
          position: {x: GRID_X + i * CELL_SIZE, y: GRID_Y + (9 * CELL_SIZE) / 2},
          rotation: 0, scale: {x: 1, y: 1},
        },
        Renderable: {width: 1, height: 9 * CELL_SIZE, color: '#999999', zIndex: 2},
      },
    });
    entities.push({
      id: `hline-${i}`,
      components: {
        Transform: {
          position: {x: GRID_X + (9 * CELL_SIZE) / 2, y: GRID_Y + i * CELL_SIZE},
          rotation: 0, scale: {x: 1, y: 1},
        },
        Renderable: {width: 9 * CELL_SIZE, height: 1, color: '#999999', zIndex: 2},
      },
    });
  }

  // Thick box borders (at box edges: i=0,1,2,3)
  for (let i = 0; i <= 3; i++) {
    entities.push({
      id: `vborder-${i}`,
      components: {
        Transform: {
          position: {x: GRID_X + i * 3 * CELL_SIZE, y: GRID_Y + (9 * CELL_SIZE) / 2},
          rotation: 0, scale: {x: 1, y: 1},
        },
        Renderable: {width: 3, height: 9 * CELL_SIZE, color: '#333333', zIndex: 3},
      },
    });
    entities.push({
      id: `hborder-${i}`,
      components: {
        Transform: {
          position: {x: GRID_X + (9 * CELL_SIZE) / 2, y: GRID_Y + i * 3 * CELL_SIZE},
          rotation: 0, scale: {x: 1, y: 1},
        },
        Renderable: {width: 9 * CELL_SIZE, height: 3, color: '#333333', zIndex: 3},
      },
    });
  }

  // Status text
  entities.push({
    id: 'status',
    components: {
      Transform: {position: {x: 250, y: 495}, rotation: 0, scale: {x: 1, y: 1}},
      Renderable: {
        renderType: 'text',
        width: 0, height: 0,
        zIndex: 4,
        visible: true,
        text: 'Sudoku — use arrow keys or click + 1–9',
        fontSize: 14,
        fontFamily: 'Arial',
        bold: false,
        textColor: '#333333',
      },
    },
  });

  return {name: 'sudoku', entities};
}

export default createGameModule({
  canvas: {width: 500, height: 520},
  systems: ['MouseSystem', 'GridCursorSystem', 'SudokuSystem'],
  events: {onDeath: 'sudoku:complete'},
  scene: buildScene(),
});
