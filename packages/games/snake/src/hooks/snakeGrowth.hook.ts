import type {LifecycleHook, HookContext} from '@canvas/engine';
import {TransformComponent, RenderableComponent, ColliderComponent} from '@canvas/engine';
import type {TransformComponent as TC, Entity} from '@canvas/engine';

export function createSnakeGrowthHook(_config: Record<string, unknown>): LifecycleHook {
  return {
    onInit(ctx: HookContext) {
      // Detect food collision and handle growth
      ctx.state['unsubCollision'] = ctx.events.on('collision:enter', (event: unknown) => {
        const {entityA, entityB} = event as {entityA: string; entityB: string};
        const headId = ctx.entity.id;
        if (entityA !== headId && entityB !== headId) return;

        const otherId = entityA === headId ? entityB : entityA;
        const other = ctx.scene.getEntity(otherId);
        if (!other?.hasTag('food')) return;

        // Signal food was eaten so foodSpawn hook can reposition
        ctx.events.emit('snake:eat', {foodId: otherId});

        // Spawn a new body segment at the head's current position
        const headTransform = ctx.entity.getComponent<TC>('Transform');
        if (!headTransform) return;

        const newSeg = ctx.spawn((seg: Entity) => {
          seg.addComponent(
            new TransformComponent({
              position: {x: headTransform.position.x, y: headTransform.position.y},
            })
          );
          seg.addComponent(
            new RenderableComponent({
              width: 18,
              height: 18,
              zIndex: 8,
              layer: 'entities',
              color: '#22c55e',
            })
          );
          seg.addComponent(
            new ColliderComponent({
              shape: 'aabb',
              width: 16,
              height: 16,
              isTrigger: false,
              layer: 'snake-body',
              mask: [],
            })
          );
          seg.addTag('snake-body');
        });

        // Let snakeMovement track the new segment
        ctx.events.emit('snake:segment:added', {id: newSeg.id});
        // Update score
        ctx.events.emit('score:increment', {});
      });
    },

    onUpdate(_ctx: HookContext) {},

    onDestroy(ctx: HookContext) {
      (ctx.state['unsubCollision'] as (() => void) | undefined)?.();
    },
  };
}
