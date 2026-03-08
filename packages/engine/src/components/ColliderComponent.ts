import { BaseComponent } from '../core/Component';

export type ColliderShape = 'aabb' | 'circle';

export class ColliderComponent extends BaseComponent {
  readonly componentType = 'Collider';
  static readonly componentType = 'Collider';

  shape: ColliderShape;
  width: number;
  height: number;
  radius: number;
  isTrigger: boolean;
  layer: string;
  mask: string[];

  constructor(
    data: {
      shape?: ColliderShape;
      width?: number;
      height?: number;
      radius?: number;
      isTrigger?: boolean;
      layer?: string;
      mask?: string[];
    } = {}
  ) {
    super();
    this.shape = data.shape ?? 'aabb';
    this.width = data.width ?? 32;
    this.height = data.height ?? 32;
    this.radius = data.radius ?? 16;
    this.isTrigger = data.isTrigger ?? false;
    this.layer = data.layer ?? 'default';
    this.mask = data.mask ?? [];
  }
}
