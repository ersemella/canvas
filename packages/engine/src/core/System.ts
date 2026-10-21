import type {Scene} from './Scene';
import type {World} from './World';
import type {EventBus} from './EventBus';

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

  /**
   * Optional, for a game whose drawing systems all implement it: true when
   * this frame would draw exactly what the canvas already shows. Asked of
   * every system that implements it before any system updates; when all say
   * true, `World.frameHeld` is set and `RenderSystem` leaves the canvas as
   * it is, so a still board isn't repainted every frame.
   */
  holdsFrame?(context: SystemContext): boolean;
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
