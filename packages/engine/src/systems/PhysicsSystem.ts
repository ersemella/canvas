import { BaseSystem, type SystemContext } from '../core/System';
import type { TransformComponent } from '../components/TransformComponent';
import type { RigidBodyComponent } from '../components/RigidBodyComponent';

const GRAVITY = 980; // pixels/s²

export class PhysicsSystem extends BaseSystem {
  readonly priority = 100;

  onUpdate(context: SystemContext): void {
    const { scene, deltaTime } = context;
    const entities = scene.query({ all: ['Transform', 'RigidBody'] });

    for (const entity of entities) {
      const transform = entity.getComponent<TransformComponent>('Transform')!;
      const body = entity.getComponent<RigidBodyComponent>('RigidBody')!;

      if (!body.isKinematic) {
        body.velocity.y += GRAVITY * body.gravityScale * deltaTime;
      }

      transform.position.x += body.velocity.x * deltaTime;
      transform.position.y += body.velocity.y * deltaTime;
    }
  }
}
