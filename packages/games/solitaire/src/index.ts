import type {GameDefinition, GameManifest} from '@canvas/engine';
import manifest from '../game.json';

export const solitaire: GameDefinition = {
  id: 'solitaire',
  manifest: manifest as GameManifest,
};

export default solitaire;
