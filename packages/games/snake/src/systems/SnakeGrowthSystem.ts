import {
  BaseSystem,
  DataComponent,
  TransformComponent,
  RenderableComponent,
  registerDataComponent,
} from '@canvas/engine';
import type {SystemContext, GridMovementData, CollectibleData, CollisionDeathData} from '@canvas/engine';

export interface SnakeBodyData {
  segments: string[];
  newSegmentId: string | null;
}

let registered = false;
export function registerSnakeComponents(): void {
  if (registered) return;
  registered = true;
  registerDataComponent<SnakeBodyData>('SnakeBody');
}

export class SnakeGrowthSystem extends BaseSystem {
  readonly priority = 210;

  onUpdate(context: SystemContext): void {
    const {scene, world} = context;

    const headEntities = scene.query({all: ['SnakeBody', 'GridMovement']});
    const head = headEntities[0];
    if (!head) return;

    const gm = head.getComponent<DataComponent<GridMovementData>>('GridMovement');
    const sb = head.getComponent<DataComponent<SnakeBodyData>>('SnakeBody');
    if (!gm || !sb) return;

    const gmData = gm.data;
    const sbData = sb.data;

    if (!gmData.moved) return;

    // Save tail position before cascade (for growth)
    let tailPos: {x: number; y: number};
    if (sbData.segments.length === 0) {
      tailPos = {x: gmData.prevX, y: gmData.prevY};
    } else {
      const lastSegId = sbData.segments[sbData.segments.length - 1] ?? '';
      const lastSeg = scene.getEntity(lastSegId);
      const lastT = lastSeg?.getComponent<TransformComponent>('Transform');
      tailPos = lastT
        ? {x: lastT.position.x, y: lastT.position.y}
        : {x: gmData.prevX, y: gmData.prevY};
    }

    // Cascade body segments
    let prevPos = {x: gmData.prevX, y: gmData.prevY};
    for (const segId of sbData.segments) {
      const seg = scene.getEntity(segId);
      if (!seg) continue;
      const segT = seg.getComponent<TransformComponent>('Transform');
      if (!segT) continue;
      const tempX = segT.position.x;
      const tempY = segT.position.y;
      segT.position.x = prevPos.x;
      segT.position.y = prevPos.y;
      prevPos = {x: tempX, y: tempY};
    }

    // Check for growth
    const collectibles = scene.query({all: ['Collectible']});
    for (const collectible of collectibles) {
      const colComp = collectible.getComponent<DataComponent<CollectibleData>>('Collectible');
      if (!colComp?.data.collected) continue;

      const newSeg = world.spawn(scene, (seg) => {
        seg.addComponent(
          new TransformComponent({position: {x: tailPos.x, y: tailPos.y}})
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
        seg.addTag('snake-body');
      });

      sbData.segments.push(newSeg.id);
      sbData.newSegmentId = newSeg.id;

      const cd = head.getComponent<DataComponent<CollisionDeathData>>('CollisionDeath');
      if (cd) {
        cd.data.graceId = newSeg.id;
      }

      break;
    }
  }
}
