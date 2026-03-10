import {createGameModule} from '@canvas/engine';
import type {GameModule, GameManifest} from '@canvas/engine';

export interface GameDescriptor {
  id: string;
  title: string;
  description: string;
  route?: string;
  load?: () => Promise<{default: GameModule}>;
}

export const games: GameDescriptor[] = [
  {
    id: 'snake',
    title: 'Snake',
    description: 'Classic snake game. Eat food, grow longer, avoid walls and yourself.',
    load: () =>
      import('@canvas/games-snake').then((m) => ({
        default: createGameModule(m.default as GameManifest),
      })),
  },
  {
    id: 'solitaire',
    title: 'Solitaire',
    description: 'Classic Klondike solitaire. Build up the foundations from Ace to King.',
    load: () => import('@canvas/games-solitaire').then((m) => ({default: m.default})),
  },
  {
    id: 'poker',
    title: 'Texas Hold\'em Poker',
    description: 'Single-player Texas Hold\'em against 5 bots. 5/10 blinds, 1000 starting chips.',
    route: '/play/poker',
  },
];
