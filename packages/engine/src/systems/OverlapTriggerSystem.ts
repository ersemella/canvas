import {BaseSystem, type SystemContext} from 'core/System';
import type {DataComponent} from 'core/Component';
import type {TransformComponent} from 'components/TransformComponent';

export interface OverlapTriggerData {
  targetTag: string;
  event: string;
  triggered: boolean;
}

export class OverlapTriggerSystem extends BaseSystem {
  readonly priority = 260;

  private graceId: string | null = null;
  private unsub?: () => void;

  onInit({events}: Omit<SystemContext, 'deltaTime'>): void {
    this.unsub = events.on<{entityId: string}>('trail:segmentSpawned', ({entityId}) => {
      this.graceId = entityId;
    });
  }

  onUpdate(context: SystemContext): void {
    const {scene, events} = context;
    const grace = this.graceId;
    this.graceId = null;

    const entities = scene.query({all: ['OverlapTrigger', 'Transform']});

    for (const entity of entities) {
      const ot = entity.getComponent<DataComponent<OverlapTriggerData>>('OverlapTrigger');
      const transform = entity.getComponent<TransformComponent>('Transform');
      if (!ot || !transform) continue;

      const data = ot.data;
      if (data.triggered) continue;

      const targets = scene.query({tags: [data.targetTag]});
      for (const target of targets) {
        if (target.id === grace) continue;
        const tt = target.getComponent<TransformComponent>('Transform');
        if (!tt) continue;
        if (transform.position.x === tt.position.x && transform.position.y === tt.position.y) {
          data.triggered = true;
          events.emit(data.event, {entityId: entity.id});
          break;
        }
      }
    }
  }

  onDestroy(_context: Omit<SystemContext, 'deltaTime'>): void {
    this.unsub?.();
  }
}
