import {BaseSystem, type SystemContext} from 'core/System';
import {DataComponent} from 'core/Component';
import {TransformComponent} from 'components/TransformComponent';
import {RenderableComponent} from 'components/RenderableComponent';
import type {GridMovementData} from 'systems/GridMovementSystem';
import type {CollectibleData} from 'systems/CollectSystem';
import type {CollisionDeathData} from 'systems/CollisionDeathSystem';

export interface TrailSegmentTemplate {
  renderable: {width: number; height: number; zIndex?: number; layer?: string; color?: string};
  tags?: string[];
}

export interface TrailData {
  segments: string[];
  segmentTemplate: TrailSegmentTemplate;
}

export class TrailSystem extends BaseSystem {
  readonly priority = 210;

  onUpdate(context: SystemContext): void {
    const {scene, world} = context;

    const headEntities = scene.query({all: ['Trail', 'GridMovement', 'Transform']});
    const head = headEntities[0];
    if (!head) return;

    const gm = head.getComponent<DataComponent<GridMovementData>>('GridMovement');
    const trail = head.getComponent<DataComponent<TrailData>>('Trail');
    if (!gm || !trail) return;

    const gmData = gm.data;
    const trailData = trail.data;

    if (!gmData.moved) return;

    // Save tail position before cascade (for growth)
    let tailPos: {x: number; y: number};
    if (trailData.segments.length === 0) {
      tailPos = {x: gmData.prevX, y: gmData.prevY};
    } else {
      const lastSegId = trailData.segments[trailData.segments.length - 1] ?? '';
      const lastSeg = scene.getEntity(lastSegId);
      const lastT = lastSeg?.getComponent<TransformComponent>('Transform');
      tailPos = lastT
        ? {x: lastT.position.x, y: lastT.position.y}
        : {x: gmData.prevX, y: gmData.prevY};
    }

    // Cascade trail segments
    let prevPos = {x: gmData.prevX, y: gmData.prevY};
    for (const segId of trailData.segments) {
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

      const template = trailData.segmentTemplate;
      const newSeg = world.spawn(scene, (seg) => {
        seg.addComponent(new TransformComponent({position: {x: tailPos.x, y: tailPos.y}}));
        seg.addComponent(new RenderableComponent(template.renderable));
        for (const tag of template.tags ?? []) {
          seg.addTag(tag);
        }
      });

      trailData.segments.push(newSeg.id);

      const cd = head.getComponent<DataComponent<CollisionDeathData>>('CollisionDeath');
      if (cd) {
        cd.data.graceId = newSeg.id;
      }

      break;
    }
  }
}
