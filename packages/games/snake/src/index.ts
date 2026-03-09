import type {SceneData, BaseSystem} from '@canvas/engine';
import {
  GridMovementSystem,
  CollectSystem,
  RespawnSystem,
  BoundsDeathSystem,
  CollisionDeathSystem,
} from '@canvas/engine';
import {registerSnakeComponents, SnakeGrowthSystem} from 'systems/SnakeGrowthSystem';
import sceneData from '@data/scenes/main.scene.json';

let registered = false;

const snakeGame = {
  register(): void {
    if (registered) return;
    registered = true;
    registerSnakeComponents();
  },

  getSceneData(): SceneData {
    return sceneData as SceneData;
  },

  getSystems(): BaseSystem[] {
    return [
      new GridMovementSystem(),
      new CollectSystem(),
      new SnakeGrowthSystem(),
      new RespawnSystem(),
      new BoundsDeathSystem(),
      new CollisionDeathSystem(),
    ];
  },
};

export default snakeGame;
