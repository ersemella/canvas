export interface GameDescriptor {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  load: () => Promise<{default: GameModule}>;
}

export interface GameModule {
  register(): void;
  getSceneData(): import('@canvas/engine').SceneData;
  getSystems(): import('@canvas/engine').BaseSystem[];
}

export const games: GameDescriptor[] = [
  {
    id: 'snake',
    title: 'Snake',
    description: 'Classic snake game. Eat food, grow longer, avoid walls and yourself.',
    thumbnail: '/thumbnails/snake.png',
    load: () => import('@canvas/games-snake') as Promise<{default: GameModule}>,
  },
];
