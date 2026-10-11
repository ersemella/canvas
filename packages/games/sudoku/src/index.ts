import {puzzleGenerators} from '@canvas/engine';
import type {GameDefinition, GameManifest} from '@canvas/engine';
import manifest from '../game.json';
import {generateSudoku} from './sudokuGenerator';

export {generateSudoku};

export const sudoku: GameDefinition = {
  id: 'sudoku',
  manifest: manifest as GameManifest,
  register() {
    // GridPuzzleConfig.generator in game.json names this.
    puzzleGenerators.register('sudoku', () => generateSudoku());
  },
};

export default sudoku;
