import type {HookFactory} from '@canvas/engine';

interface SnakeDeathState {
  dead: boolean;
  graceIds: Set<string>;
  unsubCollision: () => void;
  unsubWall: () => void;
}

export const createSnakeDeathHook: HookFactory<SnakeDeathState, Record<string, never>> = (
  _config
) => ({
  onInit(ctx) {
    ctx.state.dead = false;
    ctx.state.graceIds = new Set();

    ctx.events.on('snake:segment:added', (data: unknown) => {
      const {id} = data as {id: string};
      ctx.state.graceIds.add(id);
    });

    ctx.state.unsubCollision = ctx.events.on('collision:enter', (event: unknown) => {
      if (ctx.state.dead) return;
      const collision = event as {entityA: string; entityB: string};
      const headId = ctx.entity.id;
      if (collision.entityA !== headId && collision.entityB !== headId) return;

      const otherId = collision.entityA === headId ? collision.entityB : collision.entityA;
      if (ctx.state.graceIds.has(otherId)) return;

      const other = ctx.scene.getEntity(otherId);
      if (!other) return;

      if (other.hasTag('snake-body') || other.hasTag('wall')) {
        ctx.state.dead = true;
        ctx.events.emit('snake:died', {});
      }
    });

    ctx.state.unsubWall = ctx.events.on('snake:moved', (pos: unknown) => {
      ctx.state.graceIds.clear();

      if (ctx.state.dead) return;
      const {x, y} = pos as {x: number; y: number};
      if (x < 0 || y < 0 || x >= 600 || y >= 400) {
        ctx.state.dead = true;
        ctx.events.emit('snake:died', {});
      }
    });
  },

  onDestroy(ctx) {
    ctx.state.unsubCollision();
    ctx.state.unsubWall();
  },
});
