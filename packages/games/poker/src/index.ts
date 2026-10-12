// Poker package. The client entry (this file) is the game definition the web
// shell builds in: the table's systems under ./client. The server-authoritative
// rules are the DOM-free `./server` entry (server.ts), imported by the
// platform Worker. The server is the only place the rules run; the client
// sends actions and draws the state it is sent.

import {SystemRegistry, registerDataComponent} from '@canvas/engine';
import type {GameDefinition, GameManifest} from '@canvas/engine';
import manifest from '../game.json';
import {PokerSystem} from './client/PokerSystem';
import {PokerRendererSystem} from './client/PokerRendererSystem';
import type {PokerConfigData} from './client/PokerConfigComponent';

export {PokerSystem, PokerRendererSystem};
export type {PokerConfigData};

export const poker: GameDefinition = {
  id: 'poker',
  manifest: manifest as GameManifest,
  register() {
    SystemRegistry.register('PokerSystem', PokerSystem);
    SystemRegistry.register('PokerRendererSystem', PokerRendererSystem);
    registerDataComponent<PokerConfigData>('PokerConfig');
  },
};

export default poker;
