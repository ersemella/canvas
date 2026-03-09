import {BaseSystem, type SystemContext} from 'core/System';
import type {IEntity} from 'core/Entity';
import type {DataComponent} from 'core/Component';
import type {TransformComponent} from 'components/TransformComponent';

export interface TriggerData {
  event: string;
  triggered: boolean;
}

export abstract class TriggerSystem<TData extends TriggerData> extends BaseSystem {
  protected abstract readonly componentName: string;

  protected abstract checkCondition(
    entity: IEntity,
    transform: TransformComponent,
    data: TData,
    context: SystemContext
  ): boolean;

  onUpdate(context: SystemContext): void {
    const {scene, events} = context;
    const entities = scene.query({all: [this.componentName, 'Transform']});

    for (const entity of entities) {
      const comp = entity.getComponent<DataComponent<TData>>(this.componentName);
      const transform = entity.getComponent<TransformComponent>('Transform');
      if (!comp || !transform || comp.data.triggered) continue;

      if (this.checkCondition(entity, transform, comp.data, context)) {
        comp.data.triggered = true;
        events.emit(comp.data.event, {entityId: entity.id});
      }
    }
  }
}
