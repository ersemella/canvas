import {BaseSystem} from 'core/System';
import type {SystemContext} from 'core/System';
import type {DataComponent} from 'core/Component';
import type {TransformComponent} from 'components/TransformComponent';
import type {RenderableComponent} from 'components/RenderableComponent';
import type {ClickableData} from 'components/ClickableComponent';
import {mouseService} from 'systems/MouseSystem';

export interface ClickPayload {
  entityId: string;
}

export class ClickSystem extends BaseSystem {
  readonly priority = 55;

  onUpdate({scene, events}: SystemContext): void {
    if (!mouseService.justUp || mouseService.upConsumed) return;

    const entities = scene.query({all: ['Clickable', 'Transform', 'Renderable']});
    let best = null;
    let bestZ = -Infinity;

    for (const entity of entities) {
      const clickable = entity.getComponent<DataComponent<ClickableData>>('Clickable')!;
      if (!clickable.data.enabled) continue;

      const transform = entity.getComponent<TransformComponent>('Transform')!;
      const renderable = entity.getComponent<RenderableComponent>('Renderable')!;

      const hw = renderable.width / 2;
      const hh = renderable.height / 2;
      const {x, y} = mouseService.position;

      if (
        x >= transform.position.x - hw &&
        x <= transform.position.x + hw &&
        y >= transform.position.y - hh &&
        y <= transform.position.y + hh
      ) {
        if (renderable.zIndex > bestZ) {
          bestZ = renderable.zIndex;
          best = entity;
        }
      }
    }

    if (best) {
      events.emit<ClickPayload>('click', {entityId: best.id});
    }
  }
}
