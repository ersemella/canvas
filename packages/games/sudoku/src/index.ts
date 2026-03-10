import type {GameModule, SceneData} from '@canvas/engine';
import {MouseSystem} from '@canvas/engine';
import {SudokuSystem} from './SudokuSystem';
import {SudokuRenderSystem} from './SudokuRenderSystem';

export default {
  register(): void {},
  getSceneData(): SceneData {
    return {
      name: 'sudoku',
      entities: [
        {
          id: 'board',
          components: {
            Transform: {position: {x: 0, y: 0}, rotation: 0, scale: {x: 1, y: 1}},
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
        },
      ],
    };
  },
  getSystems() {
    const game = new SudokuSystem();
    return [new MouseSystem(), game, new SudokuRenderSystem(game)];
  },
  getEvents() {
    return {onDeath: 'sudoku:complete'};
  },
  getCanvas() {
    return {width: 500, height: 520};
  },
} satisfies GameModule;
