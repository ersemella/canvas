import {BaseSystem, type SystemContext} from 'core/System';
import type {DataComponent} from 'core/Component';
import type {TransformComponent} from 'components/TransformComponent';
import {inputService} from 'systems/InputSystem';

type Direction = 'up' | 'down' | 'left' | 'right';

export interface GridMovementData {
  direction: Direction;
  directionQueue: Direction[];
  moveTimer: number;
  speed: number;
  gridSize: number;
  prevX: number;
  prevY: number;
  moved: boolean;
}

export class GridMovementSystem extends BaseSystem {
  readonly priority = 150;

  onUpdate(context: SystemContext): void {
    const {scene, deltaTime} = context;
    const entities = scene.query({all: ['GridMovement', 'Transform']});

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

    for (const entity of entities) {
      const gm = entity.getComponent<DataComponent<GridMovementData>>('GridMovement');
      const transform = entity.getComponent<TransformComponent>('Transform');
      if (!gm || !transform) continue;

      const data = gm.data;
      data.moved = false;

      for (const [action, newDir] of actions) {
        if (!inputService.isActionJustPressed(action)) continue;
        const lastQueued = data.directionQueue.at(-1) ?? data.direction;
        if (newDir !== opposite[lastQueued] && data.directionQueue.length < 2) {
          data.directionQueue.push(newDir);
        }
        break;
      }

      data.moveTimer += deltaTime;
      const moveInterval = 1 / data.speed;
      if (data.moveTimer < moveInterval) continue;
      data.moveTimer -= moveInterval;

      if (data.directionQueue.length > 0) {
        data.direction = data.directionQueue.shift()!;
      }

      data.prevX = transform.position.x;
      data.prevY = transform.position.y;

      const d = data.direction;
      if (d === 'up') transform.position.y -= data.gridSize;
      else if (d === 'down') transform.position.y += data.gridSize;
      else if (d === 'left') transform.position.x -= data.gridSize;
      else transform.position.x += data.gridSize;

      data.moved = true;
    }
  }
}
