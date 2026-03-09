import {BaseSystem, type SystemContext} from 'core/System';
import type {DataComponent} from 'core/Component';
import type {TransformComponent} from 'components/TransformComponent';

export interface BoundsDeathData {
  width: number;
  height: number;
  deathEvent: string;
  dead: boolean;
}

export class BoundsDeathSystem extends BaseSystem {
  readonly priority = 255;

  onUpdate(context: SystemContext): void {
    const {scene, events} = context;
    const entities = scene.query({all: ['BoundsDeath', 'Transform']});

    for (const entity of entities) {
      const bd = entity.getComponent<DataComponent<BoundsDeathData>>('BoundsDeath');
      const transform = entity.getComponent<TransformComponent>('Transform');
      if (!bd || !transform || bd.data.dead) continue;

      const {x, y} = transform.position;
      if (x < 0 || y < 0 || x >= bd.data.width || y >= bd.data.height) {
        bd.data.dead = true;
        events.emit(bd.data.deathEvent, {entityId: entity.id});
      }
    }
  }
}
