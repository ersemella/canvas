import {BaseSystem, type SystemContext} from 'core/System';
import type {DataComponent} from 'core/Component';
import type {TransformComponent} from 'components/TransformComponent';

export interface CollisionDeathData {
  targetTag: string;
  deathEvent: string;
  dead: boolean;
  graceId: string | null;
}

export class CollisionDeathSystem extends BaseSystem {
  readonly priority = 260;

  onUpdate(context: SystemContext): void {
    const {scene, events} = context;
    const entities = scene.query({all: ['CollisionDeath', 'Transform']});

    for (const entity of entities) {
      const cd = entity.getComponent<DataComponent<CollisionDeathData>>('CollisionDeath');
      const transform = entity.getComponent<TransformComponent>('Transform');
      if (!cd || !transform) continue;

      const data = cd.data;
      const graceId = data.graceId;
      data.graceId = null;

      if (data.dead) continue;

      const targets = scene.query({tags: [data.targetTag]});
      for (const target of targets) {
        if (target.id === graceId) continue;
        const tt = target.getComponent<TransformComponent>('Transform');
        if (!tt) continue;
        if (transform.position.x === tt.position.x && transform.position.y === tt.position.y) {
          data.dead = true;
          events.emit(data.deathEvent, {entityId: entity.id});
          break;
        }
      }
    }
  }
}
