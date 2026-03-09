import type {SystemContext} from 'core/System';
import type {IEntity} from 'core/Entity';
import type {TransformComponent} from 'components/TransformComponent';
import {TriggerSystem, type TriggerData} from 'systems/TriggerSystem';

export interface BoundsTriggerData extends TriggerData {
  width: number;
  height: number;
}

export class BoundsTriggerSystem extends TriggerSystem<BoundsTriggerData> {
  readonly priority = 255;
  protected readonly componentName = 'BoundsTrigger';

  protected checkCondition(
    _entity: IEntity,
    transform: TransformComponent,
    data: BoundsTriggerData,
    _context: SystemContext
  ): boolean {
    const {x, y} = transform.position;
    return x < 0 || y < 0 || x >= data.width || y >= data.height;
  }
}
