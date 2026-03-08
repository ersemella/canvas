import type { LifecycleHook, HookContext } from '@canvas/engine';
import type { TransformComponent } from '@canvas/engine';

type Direction = 'up' | 'down' | 'left' | 'right';

export function createSnakeMovementHook(_config: Record<string, unknown>): LifecycleHook {
  return {
    onInit(ctx: HookContext) {
      ctx.state['direction'] = 'right' as Direction;
      ctx.state['nextDirection'] = 'right' as Direction;
      ctx.state['moveTimer'] = 0;
      ctx.state['segments'] = [] as string[];

      // Listen for new segments being added
      ctx.state['unsubSegment'] = ctx.events.on('snake:segment:added', (data: unknown) => {
        const { id } = data as { id: string };
        (ctx.state['segments'] as string[]).push(id);
      });
    },

    onUpdate(ctx: HookContext) {
      const speed = (ctx.config['speed'] as number | undefined) ?? 8;
      const gridSize = (ctx.config['gridSize'] as number | undefined) ?? 20;
      const moveInterval = 1 / speed;

      // Buffer directional input — prevent reversing
      const dir = ctx.state['direction'] as Direction;
      if (ctx.input.isActionJustPressed('move_up') && dir !== 'down') {
        ctx.state['nextDirection'] = 'up';
      } else if (ctx.input.isActionJustPressed('move_down') && dir !== 'up') {
        ctx.state['nextDirection'] = 'down';
      } else if (ctx.input.isActionJustPressed('move_left') && dir !== 'right') {
        ctx.state['nextDirection'] = 'left';
      } else if (ctx.input.isActionJustPressed('move_right') && dir !== 'left') {
        ctx.state['nextDirection'] = 'right';
      }

      ctx.state['moveTimer'] = ((ctx.state['moveTimer'] as number) ?? 0) + ctx.deltaTime;
      if ((ctx.state['moveTimer'] as number) < moveInterval) return;
      ctx.state['moveTimer'] = 0;

      // Commit buffered direction
      ctx.state['direction'] = ctx.state['nextDirection'];

      const transform = ctx.entity.getComponent<TransformComponent>('Transform');
      if (!transform) return;

      const prevX = transform.position.x;
      const prevY = transform.position.y;

      // Move head
      const d = ctx.state['direction'] as Direction;
      if (d === 'up') transform.position.y -= gridSize;
      else if (d === 'down') transform.position.y += gridSize;
      else if (d === 'left') transform.position.x -= gridSize;
      else if (d === 'right') transform.position.x += gridSize;

      // Move body segments — each follows the one before it
      const segments = (ctx.state['segments'] as string[]) ?? [];
      let prevPos = { x: prevX, y: prevY };
      for (const segId of segments) {
        const seg = ctx.scene.getEntity(segId);
        if (!seg) continue;
        const segTransform = seg.getComponent<TransformComponent>('Transform');
        if (!segTransform) continue;
        const tempX = segTransform.position.x;
        const tempY = segTransform.position.y;
        segTransform.position.x = prevPos.x;
        segTransform.position.y = prevPos.y;
        prevPos = { x: tempX, y: tempY };
      }

      // Notify other hooks of the new head position
      ctx.events.emit('snake:moved', { x: transform.position.x, y: transform.position.y });
    },

    onDestroy(ctx: HookContext) {
      (ctx.state['unsubSegment'] as (() => void) | undefined)?.();
    },
  };
}
