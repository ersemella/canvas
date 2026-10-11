// Poker package. The client entry (this file) is the game definition the web
// shell builds in; the server-authoritative rules are the DOM-free `./server`
// entry (`server.ts`), imported by the platform Worker.
// Client-side systems (PokerSystem, PokerRendererSystem) still live in @canvas/engine.

import type {GameDefinition, GameManifest} from '@canvas/engine';
import manifest from '../game.json';

export const poker: GameDefinition = {
  id: 'poker',
  manifest: manifest as GameManifest,
};

export default poker;
