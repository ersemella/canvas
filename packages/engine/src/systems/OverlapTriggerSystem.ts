import {type SystemContext} from 'core/System';
import type {IEntity} from 'core/Entity';
import type {TransformComponent} from 'components/TransformComponent';
import {TriggerSystem, type TriggerData} from 'systems/TriggerSystem';

export interface OverlapTriggerData extends TriggerData {
  targetTag: string;
}

export class OverlapTriggerSystem extends TriggerSystem<OverlapTriggerData> {
  readonly priority = 260;
  protected readonly componentName = 'OverlapTrigger';

  private graceId: string | null = null;
  private unsub?: () => void;

  onInit({events}: Omit<SystemContext, 'deltaTime'>): void {
    this.unsub = events.on<{entityId: string}>('trail:segmentSpawned', ({entityId}) => {
      this.graceId = entityId;
    });
  }

  // Override to clear graceId after all entities are processed (preserves per-frame semantics).
  onUpdate(context: SystemContext): void {
    super.onUpdate(context);
    this.graceId = null;
  }

  protected checkCondition(
    _entity: IEntity,
    transform: TransformComponent,
    data: OverlapTriggerData,
    context: SystemContext
  ): boolean {
    const targets = context.scene.query({tags: [data.targetTag]});
    for (const target of targets) {
      if (target.id === this.graceId) continue;
      const tt = target.getComponent<TransformComponent>('Transform');
      if (!tt) continue;
      if (transform.position.x === tt.position.x && transform.position.y === tt.position.y) {
        return true;
      }
    }
    return false;
  }

  onDestroy(_context: Omit<SystemContext, 'deltaTime'>): void {
    this.unsub?.();
  }
}
