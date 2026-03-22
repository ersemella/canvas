import {BaseSystem} from 'core/System';
import type {SystemContext} from 'core/System';
import type {DataComponent} from 'core/Component';
import type {TransformComponent} from 'components/TransformComponent';
import type {RenderableComponent} from 'components/RenderableComponent';
import type {ChildOfData} from 'components/ChildOfComponent';

export class ChildTransformSystem extends BaseSystem {
  readonly priority = 150;

  onUpdate({scene}: SystemContext): void {
    const children = scene.query({all: ['Transform', 'Renderable', 'ChildOf']});

    for (const child of children) {
      const childOf = child.getComponent<DataComponent<ChildOfData>>('ChildOf')!;
      const {parentId, offsetX, offsetY, zIndexOffset} = childOf.data;

      const parent = scene.getEntity(parentId);
      if (!parent) continue;

      const parentT = parent.getComponent<TransformComponent>('Transform');
      const parentR = parent.getComponent<RenderableComponent>('Renderable');
      if (!parentT || !parentR) continue;

      const childT = child.getComponent<TransformComponent>('Transform')!;
      const childR = child.getComponent<RenderableComponent>('Renderable')!;

      childT.position.x = parentT.position.x + offsetX;
      childT.position.y = parentT.position.y + offsetY;
      if (childOf.data.syncZIndex !== false) {
        childR.zIndex = parentR.zIndex + zIndexOffset;
      }
    }
  }
}
