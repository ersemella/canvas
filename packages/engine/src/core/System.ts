import type {Scene} from 'core/Scene';
import type {World} from 'core/World';
import type {EventBus} from 'core/EventBus';

export interface SystemContext {
  scene: Scene;
  world: World;
  events: EventBus;
  deltaTime: number;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
}

export abstract class BaseSystem {
  abstract readonly priority: number;

  onInit(_context: Omit<SystemContext, 'deltaTime'>): void {}
  onUpdate(_context: SystemContext): void {}
  onDestroy(_context: Omit<SystemContext, 'deltaTime'>): void {}
}

export abstract class ReactiveSystem extends BaseSystem {
  private _dirty = true;

  protected markDirty(): void {
    this._dirty = true;
  }

  abstract onDirty(context: SystemContext): void;

  onUpdate(context: SystemContext): void {
    if (!this._dirty) return;
    this._dirty = false;
    this.onDirty(context);
  }
}
