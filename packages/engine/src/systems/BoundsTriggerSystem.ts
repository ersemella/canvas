import {BaseSystem, type SystemContext} from 'core/System';
import type {DataComponent} from 'core/Component';
import type {TransformComponent} from 'components/TransformComponent';

export interface BoundsTriggerData {
  width: number;
  height: number;
  event: string;
  triggered: boolean;
}

export class BoundsTriggerSystem extends BaseSystem {
  readonly priority = 255;

  onUpdate(context: SystemContext): void {
    const {scene, events} = context;
    const entities = scene.query({all: ['BoundsTrigger', 'Transform']});

    for (const entity of entities) {
      const bt = entity.getComponent<DataComponent<BoundsTriggerData>>('BoundsTrigger');
      const transform = entity.getComponent<TransformComponent>('Transform');
      if (!bt || !transform || bt.data.triggered) continue;

      const {x, y} = transform.position;
      if (x < 0 || y < 0 || x >= bt.data.width || y >= bt.data.height) {
        bt.data.triggered = true;
        events.emit(bt.data.event, {entityId: entity.id});
      }
    }
  }
}
