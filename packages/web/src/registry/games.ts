import {createGameModule} from '@canvas/engine';
import type {GameModule, GameManifest} from '@canvas/engine';

export interface GameDescriptor {
  id: string;
  title: string;
  description: string;
  load: () => Promise<{default: GameModule}>;
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
    load: () => import('@canvas/games-solitaire').then((m) => ({default: createGameModule(m.default as GameManifest)})),
  },
  {
    id: 'poker',
    title: "Texas Hold'em Poker",
    description: 'Single-player Texas Hold\'em against 5 bots. 5/10 blinds, 1000 starting chips.',
    load: () => import('@canvas/games-poker').then((m) => ({default: m.default})),
  },
  {
    id: 'sudoku',
    title: 'Sudoku',
    description: 'Classic 9×9 Sudoku. Fill the grid with digits 1–9, no repeats in any row, column, or box.',
    load: () => import('@canvas/games-sudoku').then((m) => ({default: createGameModule(m.default as GameManifest)})),
  },
];
