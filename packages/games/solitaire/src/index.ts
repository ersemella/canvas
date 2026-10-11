import {dealPatterns} from '@canvas/engine';
import type {GameDefinition, GameManifest} from '@canvas/engine';
import manifest from '../game.json';
import {dealKlondike} from './klondikeDeal';

export {dealKlondike};
export type {KlondikeDealConfig} from './klondikeDeal';

export const solitaire: GameDefinition = {
  id: 'solitaire',
  manifest: manifest as GameManifest,
  register() {
    // DeckConfig.dealPattern.type in game.json names this.
    dealPatterns.register('klondike', dealKlondike);
  },
};

export default solitaire;
