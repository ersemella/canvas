import {createGameModule} from '@canvas/engine';
import type {GameModule, GameManifest} from '@canvas/engine';

export interface GameDescriptor {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  load: () => Promise<{default: GameModule}>;
}

export const games: GameDescriptor[] = [
  {
    id: 'snake',
    title: 'Snake',
    description: 'Classic snake game. Eat food, grow longer, avoid walls and yourself.',
    thumbnail: '/thumbnails/snake.png',
    load: () =>
      import('@canvas/games-snake').then((m) => ({
        default: createGameModule(m.default as GameManifest),
      })),
  },
  {
    id: 'solitaire',
    title: 'Solitaire',
    description: 'Classic Klondike solitaire. Build up the foundations from Ace to King.',
    thumbnail: '/thumbnails/solitaire.png',
    load: () => import('@canvas/games-solitaire').then((m) => ({default: m.default})),
  },
];
