import {BaseSystem} from 'core/System';
import type {SystemContext} from 'core/System';
import type {DataComponent} from 'core/Component';
import type {TransformComponent} from 'components/TransformComponent';
import type {RenderableComponent} from 'components/RenderableComponent';
import type {DraggableData} from 'components/DraggableComponent';
import type {DropTargetData} from 'components/DropTargetComponent';
import {mouseService} from 'systems/MouseSystem';

export interface DragDropBeforePayload {
  primaryId: string;
  addToDrag: (id: string) => void;
}

export interface DragDropDroppedPayload {
  entityIds: string[];
  targetId: string | null;
  accept: () => void;
  reject: () => void;
}

export class DragDropSystem extends BaseSystem {
  readonly priority = 50;

  private drag: {
    entityIds: string[];
    offsets: Array<{x: number; y: number}>;
    originPositions: Array<{x: number; y: number}>;
    originZIndices: number[];
  } | null = null;

  onUpdate(context: SystemContext): void {
    const {scene, events} = context;
    const {justDown, isDown, justUp, position} = mouseService;

    if (justDown) {
      // Find top-z draggable entity at mouse position
      const entities = scene.query({all: ['Draggable', 'Transform', 'Renderable']});
      let best = null;
      let bestZ = -Infinity;

      for (const entity of entities) {
        const draggable = entity.getComponent<DataComponent<DraggableData>>('Draggable')!;
        if (!draggable.data.enabled) continue;

        const transform = entity.getComponent<TransformComponent>('Transform')!;
        const renderable = entity.getComponent<RenderableComponent>('Renderable')!;

        const hw = renderable.width / 2;
        const hh = renderable.height / 2;
        if (
          position.x >= transform.position.x - hw &&
          position.x <= transform.position.x + hw &&
          position.y >= transform.position.y - hh &&
          position.y <= transform.position.y + hh
        ) {
          if (renderable.zIndex > bestZ) {
            bestZ = renderable.zIndex;
            best = entity;
          }
        }
      }

      if (best) {
        const primaryId = best.id;
        const entityIds: string[] = [primaryId];

        // Let the game add group members synchronously
        events.emit<DragDropBeforePayload>('dragdrop:before', {
          primaryId,
          addToDrag: (id: string) => {
            entityIds.push(id);
          },
        });

        // Capture state and elevate zIndex for all entities
        const offsets: Array<{x: number; y: number}> = [];
        const originPositions: Array<{x: number; y: number}> = [];
        const originZIndices: number[] = [];

        for (const id of entityIds) {
          const entity = id === primaryId ? best : scene.getEntity(id);
          if (!entity) continue;
          const t = entity.getComponent<TransformComponent>('Transform')!;
          const r = entity.getComponent<RenderableComponent>('Renderable')!;
          offsets.push({x: t.position.x - position.x, y: t.position.y - position.y});
          originPositions.push({x: t.position.x, y: t.position.y});
          originZIndices.push(r.zIndex);
          r.zIndex = 999;
        }

        this.drag = {entityIds, offsets, originPositions, originZIndices};
      }
    }

    if (isDown && this.drag) {
      for (let i = 0; i < this.drag.entityIds.length; i++) {
        const entity = scene.getEntity(this.drag.entityIds[i]!);
        if (!entity) continue;
        const t = entity.getComponent<TransformComponent>('Transform')!;
        t.position.x = position.x + this.drag.offsets[i]!.x;
        t.position.y = position.y + this.drag.offsets[i]!.y;
      }
    }

    if (justUp && this.drag) {
      const drag = this.drag;

      // Find overlapping drop target using primary entity's position and size
      const primaryEntity = scene.getEntity(drag.entityIds[0]!);
      let targetId: string | null = null;

      if (primaryEntity) {
        const primaryT = primaryEntity.getComponent<TransformComponent>('Transform')!;
        const primaryR = primaryEntity.getComponent<RenderableComponent>('Renderable')!;

        const dropTargets = scene.query({all: ['DropTarget', 'Transform', 'Renderable']});
        for (const target of dropTargets) {
          const targetT = target.getComponent<TransformComponent>('Transform')!;
          if (
            Math.abs(primaryT.position.x - targetT.position.x) < primaryR.width &&
            Math.abs(primaryT.position.y - targetT.position.y) < primaryR.height
          ) {
            const dropTarget = target.getComponent<DataComponent<DropTargetData>>('DropTarget')!;
            targetId = dropTarget.data.targetId;
            break;
          }
        }
      }

      let accepted = false;

      events.emit<DragDropDroppedPayload>('dragdrop:dropped', {
        entityIds: drag.entityIds,
        targetId,
        accept: () => {
          accepted = true;
        },
        reject: () => {
          accepted = false;
        },
      });

      if (!accepted) {
        // Snap back to origin
        for (let i = 0; i < drag.entityIds.length; i++) {
          const entity = scene.getEntity(drag.entityIds[i]!);
          if (!entity) continue;
          const t = entity.getComponent<TransformComponent>('Transform')!;
          const r = entity.getComponent<RenderableComponent>('Renderable')!;
          t.position.x = drag.originPositions[i]!.x;
          t.position.y = drag.originPositions[i]!.y;
          r.zIndex = drag.originZIndices[i]!;
        }
      }

      this.drag = null;
    }
  }
}
