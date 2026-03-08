import { HookRegistry } from '@canvas/engine';
import type { SceneData } from '@canvas/engine';
import { createSnakeMovementHook } from './hooks/snakeMovement.hook';
import { createSnakeGrowthHook } from './hooks/snakeGrowth.hook';
import { createSnakeDeathHook } from './hooks/snakeDeath.hook';
import { createFoodSpawnHook } from './hooks/foodSpawn.hook';
import { createScoreDisplayHook } from './hooks/scoreDisplay.hook';
import sceneData from '../data/scenes/main.scene.json';

let registered = false;

const snakeGame = {
  register(): void {
    if (registered) return;
    registered = true;

    HookRegistry.register('snakeMovement', createSnakeMovementHook);
    HookRegistry.register('snakeGrowth', createSnakeGrowthHook);
    HookRegistry.register('snakeDeath', createSnakeDeathHook);
    HookRegistry.register('foodSpawn', createFoodSpawnHook);
    HookRegistry.register('scoreDisplay', createScoreDisplayHook);
  },

  getSceneData(): SceneData {
    return sceneData as SceneData;
  },
};

export default snakeGame;
