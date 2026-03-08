import type { Scene } from './Scene';
import type { World } from './World';
import type { EventBus } from './EventBus';

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
  abstract onUpdate(context: SystemContext): void;
  onDestroy(_context: Omit<SystemContext, 'deltaTime'>): void {}
}
