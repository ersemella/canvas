import type {HookFactory} from '@canvas/engine';
import {TransformComponent, RenderableComponent, ColliderComponent} from '@canvas/engine';
import type {TransformComponent as TC, Entity} from '@canvas/engine';

interface SnakeGrowthState {
  unsubCollision: () => void;
}

export const createSnakeGrowthHook: HookFactory<SnakeGrowthState, Record<string, never>> = (
  _config
) => ({
  onInit(ctx) {
    ctx.state.unsubCollision = ctx.events.on('collision:enter', (event: unknown) => {
      const {entityA, entityB} = event as {entityA: string; entityB: string};
      const headId = ctx.entity.id;
      if (entityA !== headId && entityB !== headId) return;

      const otherId = entityA === headId ? entityB : entityA;
      const other = ctx.scene.getEntity(otherId);
      if (!other?.hasTag('food')) return;

      ctx.events.emit('snake:eat', {foodId: otherId});

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

      ctx.events.emit('snake:segment:added', {id: newSeg.id});
      ctx.events.emit('score:increment', {});
    });
  },

  onDestroy(ctx) {
    ctx.state.unsubCollision();
  },
});
