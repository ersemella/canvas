import type {GameDefinition, GameManifest} from '@canvas/engine';
import manifest from '../game.json';

export const sudoku: GameDefinition = {
  id: 'sudoku',
  manifest: manifest as GameManifest,
};

export default sudoku;
