import type {HookFactory, HookContext} from '@canvas/engine';
import {MathUtils} from '@canvas/engine';
import type {TransformComponent} from '@canvas/engine';

interface FoodSpawnState {
  unsubscribe: () => void;
}

interface FoodSpawnConfig {
  gridSize: number;
  canvasWidth: number;
  canvasHeight: number;
}

export const createFoodSpawnHook: HookFactory<FoodSpawnState, FoodSpawnConfig> = (_config) => ({
  onInit(ctx) {
    ctx.state.unsubscribe = ctx.events.on('snake:eat', () => {
      repositionFood(ctx);
    });

    repositionFood(ctx);
  },

  onDestroy(ctx) {
    ctx.state.unsubscribe();
  },
});

function repositionFood(ctx: HookContext<FoodSpawnState, FoodSpawnConfig>): void {
  const gridSize = ctx.config.gridSize ?? 20;
  const w = ctx.config.canvasWidth ?? 600;
  const h = ctx.config.canvasHeight ?? 400;

  const cols = Math.floor(w / gridSize);
  const rows = Math.floor(h / gridSize);

  const col = MathUtils.randomInt(0, cols - 1);
  const row = MathUtils.randomInt(0, rows - 1);

  const transform = ctx.entity.getComponent<TransformComponent>('Transform');
  if (transform) {
    transform.position.x = col * gridSize;
    transform.position.y = row * gridSize;
  }
}
