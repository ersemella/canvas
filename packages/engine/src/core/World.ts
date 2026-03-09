import {Scene} from 'core/Scene';
import {Entity} from 'core/Entity';
import {EventBus} from 'core/EventBus';
import type {BaseSystem, SystemContext} from 'core/System';

export interface WorldOptions {
  canvas: HTMLCanvasElement;
  targetFPS?: number;
}

export class World {
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  readonly events: EventBus = new EventBus();

  private systems: BaseSystem[] = [];
  private currentScene: Scene | null = null;
  private rafId: number | null = null;
  private lastTime = 0;
  private running = false;

  constructor(options: WorldOptions) {
    this.canvas = options.canvas;
    const ctx = options.canvas.getContext('2d');
    if (!ctx) throw new Error('Failed to get 2D context from canvas');
    this.ctx = ctx;
  }

  registerSystem(system: BaseSystem): void {
    this.systems.push(system);
    this.systems.sort((a, b) => a.priority - b.priority);
  }

  loadScene(scene: Scene): void {
    if (this.currentScene) {
      this.dispatchDestroy();
      this.currentScene.clear();
    }
    this.currentScene = scene;
    if (this.running) {
      this.dispatchInit();
    }
  }

  getScene(): Scene | null {
    return this.currentScene;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    if (this.currentScene) {
      this.dispatchInit();
    }
    this.lastTime = performance.now();
    this.loop(this.lastTime);
  }

  stop(): void {
    this.running = false;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.dispatchDestroy();
  }

  private loop(time: number): void {
    if (!this.running) return;
    const deltaTime = Math.min((time - this.lastTime) / 1000, 0.1);
    this.lastTime = time;

    if (this.currentScene) {
      const context: SystemContext = {
        scene: this.currentScene,
        world: this,
        events: this.events,
        deltaTime,
        canvas: this.canvas,
        ctx: this.ctx,
      };
      for (const system of this.systems) {
        system.onUpdate(context);
      }
    }

    this.rafId = requestAnimationFrame((t) => this.loop(t));
  }

  private dispatchInit(): void {
    if (!this.currentScene) return;
    const context = {
      scene: this.currentScene,
      world: this,
      events: this.events,
      canvas: this.canvas,
      ctx: this.ctx,
    };
    for (const system of this.systems) {
      system.onInit(context);
    }
  }

  private dispatchDestroy(): void {
    if (!this.currentScene) return;
    const context = {
      scene: this.currentScene,
      world: this,
      events: this.events,
      canvas: this.canvas,
      ctx: this.ctx,
    };
    for (const system of this.systems) {
      system.onDestroy(context);
    }
  }

  spawn(scene: Scene, setup: (entity: Entity) => void): Entity {
    const entity = new Entity();
    setup(entity);
    scene.addEntity(entity);
    return entity;
  }

  destroy(scene: Scene, id: string): void {
    scene.removeEntity(id);
  }
}
