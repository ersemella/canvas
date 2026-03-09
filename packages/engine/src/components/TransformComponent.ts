import {BaseComponent} from 'core/Component';
import {Vec2} from 'math/Vec2';

export class TransformComponent extends BaseComponent {
  readonly componentType = 'Transform';
  static readonly componentType = 'Transform';

  position: Vec2;
  rotation: number;
  scale: Vec2;

  constructor(
    data: {
      position?: {x: number; y: number};
      rotation?: number;
      scale?: {x: number; y: number};
    } = {}
  ) {
    super();
    this.position = data.position ? Vec2.from(data.position) : Vec2.zero();
    this.rotation = data.rotation ?? 0;
    this.scale = data.scale ? Vec2.from(data.scale) : Vec2.one();
  }
}
