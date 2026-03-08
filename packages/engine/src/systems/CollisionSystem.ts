import { BaseSystem, type SystemContext } from '../core/System';
import type { TransformComponent } from '../components/TransformComponent';
import type { ColliderComponent } from '../components/ColliderComponent';
import { Rect } from '../math/Rect';

export interface CollisionEvent {
  entityA: string;
  entityB: string;
}

export class CollisionSystem extends BaseSystem {
  readonly priority = 200;

  onUpdate(context: SystemContext): void {
    const { scene, events } = context;
    const entities = scene.query({ all: ['Transform', 'Collider'] });

    for (let i = 0; i < entities.length; i++) {
      for (let j = i + 1; j < entities.length; j++) {
        const a = entities[i]!;
        const b = entities[j]!;

        const transformA = a.getComponent<TransformComponent>('Transform')!;
        const colliderA = a.getComponent<ColliderComponent>('Collider')!;
        const transformB = b.getComponent<TransformComponent>('Transform')!;
        const colliderB = b.getComponent<ColliderComponent>('Collider')!;

        // Layer mask check
        if (
          !colliderA.mask.includes(colliderB.layer) &&
          !colliderB.mask.includes(colliderA.layer)
        ) {
          continue;
        }

        const rectA = new Rect(
          transformA.position.x - colliderA.width / 2,
          transformA.position.y - colliderA.height / 2,
          colliderA.width,
          colliderA.height
        );

        const rectB = new Rect(
          transformB.position.x - colliderB.width / 2,
          transformB.position.y - colliderB.height / 2,
          colliderB.width,
          colliderB.height
        );

        if (rectA.intersects(rectB)) {
          events.emit<CollisionEvent>('collision:enter', { entityA: a.id, entityB: b.id });
        }
      }
    }
  }
}
