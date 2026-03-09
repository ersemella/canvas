import type {LifecycleHook, HookContext} from '@canvas/engine';
import {MathUtils} from '@canvas/engine';
import type {TransformComponent} from '@canvas/engine';

export function createFoodSpawnHook(_config: Record<string, unknown>): LifecycleHook {
  return {
    onInit(ctx: HookContext) {
      // Reposition food whenever the snake eats it
      ctx.state['unsubscribe'] = ctx.events.on('snake:eat', () => {
        repositionFood(ctx);
      });

      // Set initial random position
      repositionFood(ctx);
    },

    onUpdate(_ctx: HookContext) {},

    onDestroy(ctx: HookContext) {
      (ctx.state['unsubscribe'] as (() => void) | undefined)?.();
    },
  };
}

function repositionFood(ctx: HookContext): void {
  const gridSize = (ctx.config['gridSize'] as number | undefined) ?? 20;
  const w = (ctx.config['canvasWidth'] as number | undefined) ?? 600;
  const h = (ctx.config['canvasHeight'] as number | undefined) ?? 400;

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
