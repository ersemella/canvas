import type {LifecycleHook, HookContext} from '@canvas/engine';
import type {TransformComponent} from '@canvas/engine';

type Direction = 'up' | 'down' | 'left' | 'right';

export function createSnakeMovementHook(_config: Record<string, unknown>): LifecycleHook {
  return {
    onInit(ctx: HookContext) {
      ctx.state['direction'] = 'right' as Direction;
      ctx.state['directionQueue'] = [] as Direction[];
      ctx.state['moveTimer'] = 0;
      ctx.state['segments'] = [] as string[];

      // Listen for new segments being added
      ctx.state['unsubSegment'] = ctx.events.on('snake:segment:added', (data: unknown) => {
        const {id} = data as {id: string};
        (ctx.state['segments'] as string[]).push(id);
      });
    },

    onUpdate(ctx: HookContext) {
      const speed = (ctx.config['speed'] as number | undefined) ?? 8;
      const gridSize = (ctx.config['gridSize'] as number | undefined) ?? 20;
      const moveInterval = 1 / speed;

      // Buffer directional input into a queue (max 2) — validate each
      // entry against the direction preceding it, not the current one,
      // so consecutive queued turns don't cancel each other out.
      const queue = ctx.state['directionQueue'] as Direction[];
      const opposite: Record<Direction, Direction> = {up: 'down', down: 'up', left: 'right', right: 'left'};
      const actions: [string, Direction][] = [
        ['move_up', 'up'],
        ['move_down', 'down'],
        ['move_left', 'left'],
        ['move_right', 'right'],
      ];
      for (const [action, newDir] of actions) {
        if (!ctx.input.isActionJustPressed(action)) continue;
        const lastQueued = queue.at(-1) ?? (ctx.state['direction'] as Direction);
        if (newDir !== opposite[lastQueued] && queue.length < 2) {
          queue.push(newDir);
        }
        break;
      }

      ctx.state['moveTimer'] = ((ctx.state['moveTimer'] as number) ?? 0) + ctx.deltaTime;
      if ((ctx.state['moveTimer'] as number) < moveInterval) return;
      ctx.state['moveTimer'] = 0;

      // Pop next direction from queue, or hold current
      if (queue.length > 0) {
        ctx.state['direction'] = queue.shift()!;
      }

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
      let prevPos = {x: prevX, y: prevY};
      for (const segId of segments) {
        const seg = ctx.scene.getEntity(segId);
        if (!seg) continue;
        const segTransform = seg.getComponent<TransformComponent>('Transform');
        if (!segTransform) continue;
        const tempX = segTransform.position.x;
        const tempY = segTransform.position.y;
        segTransform.position.x = prevPos.x;
        segTransform.position.y = prevPos.y;
        prevPos = {x: tempX, y: tempY};
      }

      // Notify other hooks of the new head position
      ctx.events.emit('snake:moved', {x: transform.position.x, y: transform.position.y});
    },

    onDestroy(ctx: HookContext) {
      (ctx.state['unsubSegment'] as (() => void) | undefined)?.();
    },
  };
}
