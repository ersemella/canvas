import {BaseSystem, type SystemContext} from 'core/System';
import type {DataComponent} from 'core/Component';
import type {TransformComponent} from 'components/TransformComponent';

export interface CollectibleData {
  collected: boolean;
}

export class CollectSystem extends BaseSystem {
  readonly priority = 205;

  onUpdate(context: SystemContext): void {
    const {scene, events} = context;
    const collectors = scene.query({all: ['GridMovement', 'Transform']});
    const collectibles = scene.query({all: ['Collectible', 'Transform']});

    for (const collector of collectors) {
      const ct = collector.getComponent<TransformComponent>('Transform');
      if (!ct) continue;

      for (const collectible of collectibles) {
        const colComp = collectible.getComponent<DataComponent<CollectibleData>>('Collectible');
        const colT = collectible.getComponent<TransformComponent>('Transform');
        if (!colComp || !colT || colComp.data.collected) continue;

        if (ct.position.x === colT.position.x && ct.position.y === colT.position.y) {
          colComp.data.collected = true;
          events.emit('entity:collected', {
            collectorId: collector.id,
            collectibleId: collectible.id,
          });
        }
      }
    }
  }
}
