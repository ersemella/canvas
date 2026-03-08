import { BaseComponent } from '../core/Component';
import { Vec2 } from '../math/Vec2';

export class RigidBodyComponent extends BaseComponent {
  readonly componentType = 'RigidBody';
  static readonly componentType = 'RigidBody';

  velocity: Vec2;
  isKinematic: boolean;
  gravityScale: number;

  constructor(
    data: {
      velocity?: { x: number; y: number };
      isKinematic?: boolean;
      gravityScale?: number;
    } = {}
  ) {
    super();
    this.velocity = data.velocity ? Vec2.from(data.velocity) : Vec2.zero();
    this.isKinematic = data.isKinematic ?? false;
    this.gravityScale = data.gravityScale ?? 1;
  }
}
