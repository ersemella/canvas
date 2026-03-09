import {BaseSystem, type SystemContext} from 'core/System';
import type {DataComponent} from 'core/Component';
import type {TransformComponent} from 'components/TransformComponent';
import type {CollectibleData} from 'systems/CollectSystem';

export interface RespawnData {
  gridSize: number;
  width: number;
  height: number;
}

export class RespawnSystem extends BaseSystem {
  readonly priority = 215;

  onUpdate(context: SystemContext): void {
    const {scene} = context;
    const entities = scene.query({all: ['Collectible', 'Respawn', 'Transform']});

    for (const entity of entities) {
      const collectible = entity.getComponent<DataComponent<CollectibleData>>('Collectible');
      const respawn = entity.getComponent<DataComponent<RespawnData>>('Respawn');
      const transform = entity.getComponent<TransformComponent>('Transform');
      if (!collectible || !respawn || !transform || !collectible.data.collected) continue;

      const {gridSize, width, height} = respawn.data;
      const cols = Math.floor(width / gridSize);
      const rows = Math.floor(height / gridSize);
      transform.position.x = Math.floor(Math.random() * cols) * gridSize;
      transform.position.y = Math.floor(Math.random() * rows) * gridSize;
      collectible.data.collected = false;
    }
  }
}
