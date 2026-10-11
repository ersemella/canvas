import type {GameDefinition, GameManifest} from '@canvas/engine';
import manifest from '../game.json';

export const blackjack: GameDefinition = {
  id: 'blackjack',
  manifest: manifest as GameManifest,
};

export default blackjack;
