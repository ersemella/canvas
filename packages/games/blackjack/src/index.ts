import {SystemRegistry, registerDataComponent} from '@canvas/engine';
import type {GameDefinition, GameManifest} from '@canvas/engine';
import manifest from '../game.json';
import {BlackjackSystem} from './BlackjackSystem';
import type {BlackjackConfigData} from './BlackjackConfigComponent';

export {BlackjackSystem};
export type {BlackjackConfigData};

export const blackjack: GameDefinition = {
  id: 'blackjack',
  manifest: manifest as GameManifest,
  register() {
    SystemRegistry.register('BlackjackSystem', BlackjackSystem);
    registerDataComponent<BlackjackConfigData>('BlackjackConfig');
  },
};

export default blackjack;
