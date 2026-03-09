import type {HookFactory} from '@canvas/engine';
import type {TransformComponent} from '@canvas/engine';

type Direction = 'up' | 'down' | 'left' | 'right';

interface SnakeMovementState {
  direction: Direction;
  directionQueue: Direction[];
  moveTimer: number;
  segments: string[];
  unsubSegment: () => void;
}

interface SnakeMovementConfig {
  speed: number;
  gridSize: number;
}

export const createSnakeMovementHook: HookFactory<SnakeMovementState, SnakeMovementConfig> = (
  _config
) => ({
  onInit(ctx) {
    ctx.state.direction = 'right';
    ctx.state.directionQueue = [];
    ctx.state.moveTimer = 0;
    ctx.state.segments = [];

    ctx.state.unsubSegment = ctx.events.on('snake:segment:added', (data: unknown) => {
      const {id} = data as {id: string};
      ctx.state.segments.push(id);
    });
  },

  onUpdate(ctx) {
    const speed = ctx.config.speed ?? 8;
    const gridSize = ctx.config.gridSize ?? 20;
    const moveInterval = 1 / speed;

    const opposite: Record<Direction, Direction> = {
      up: 'down',
      down: 'up',
      left: 'right',
      right: 'left',
    };
    const actions: [string, Direction][] = [
      ['move_up', 'up'],
      ['move_down', 'down'],
      ['move_left', 'left'],
      ['move_right', 'right'],
    ];
    for (const [action, newDir] of actions) {
      if (!ctx.input.isActionJustPressed(action)) continue;
      const lastQueued = ctx.state.directionQueue.at(-1) ?? ctx.state.direction;
      if (newDir !== opposite[lastQueued] && ctx.state.directionQueue.length < 2) {
        ctx.state.directionQueue.push(newDir);
      }
      break;
    }

    ctx.state.moveTimer += ctx.deltaTime;
    if (ctx.state.moveTimer < moveInterval) return;
    ctx.state.moveTimer = 0;

    if (ctx.state.directionQueue.length > 0) {
      ctx.state.direction = ctx.state.directionQueue.shift()!;
    }

    const transform = ctx.entity.getComponent<TransformComponent>('Transform');
    if (!transform) return;

    const prevX = transform.position.x;
    const prevY = transform.position.y;

    const d = ctx.state.direction;
    if (d === 'up') transform.position.y -= gridSize;
    else if (d === 'down') transform.position.y += gridSize;
    else if (d === 'left') transform.position.x -= gridSize;
    else if (d === 'right') transform.position.x += gridSize;

    let prevPos = {x: prevX, y: prevY};
    for (const segId of ctx.state.segments) {
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

    ctx.events.emit('snake:moved', {x: transform.position.x, y: transform.position.y});
  },

  onDestroy(ctx) {
    ctx.state.unsubSegment();
  },
});
