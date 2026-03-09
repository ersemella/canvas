import type {LifecycleHook, HookContext} from '@canvas/engine';

export function createSnakeDeathHook(_config: Record<string, unknown>): LifecycleHook {
  return {
    onInit(ctx: HookContext) {
      ctx.state['dead'] = false;

      // Listen for body/wall collisions via the collision system
      ctx.state['unsubCollision'] = ctx.events.on('collision:enter', (event: unknown) => {
        if (ctx.state['dead']) return;
        const collision = event as {entityA: string; entityB: string};
        const headId = ctx.entity.id;
        if (collision.entityA !== headId && collision.entityB !== headId) return;

        const otherId = collision.entityA === headId ? collision.entityB : collision.entityA;
        const other = ctx.scene.getEntity(otherId);
        if (!other) return;

        if (other.hasTag('snake-body') || other.hasTag('wall')) {
          ctx.state['dead'] = true;
          ctx.events.emit('snake:died', {});
        }
      });

      // Wall detection via position check (canvas boundary)
      ctx.state['unsubWall'] = ctx.events.on('snake:moved', (pos: unknown) => {
        if (ctx.state['dead']) return;
        const {x, y} = pos as {x: number; y: number};
        if (x < 0 || y < 0 || x >= 600 || y >= 400) {
          ctx.state['dead'] = true;
          ctx.events.emit('snake:died', {});
        }
      });
    },

    onUpdate(_ctx: HookContext) {},

    onDestroy(ctx: HookContext) {
      (ctx.state['unsubCollision'] as (() => void) | undefined)?.();
      (ctx.state['unsubWall'] as (() => void) | undefined)?.();
    },
  };
}
