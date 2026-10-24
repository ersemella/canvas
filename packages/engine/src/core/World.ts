import {Scene} from './Scene';
import {Entity} from './Entity';
import {EventBus} from './EventBus';
import type {BaseSystem, SystemContext} from './System';

export interface WorldOptions {
  canvas: HTMLCanvasElement;
  targetFPS?: number;
  /**
   * Whole-number factor the scene is drawn at onto the canvas (the
   * manifest's `canvas.scale`): the scene is the canvas size divided by it.
   * Defaults to 1. `setScale` changes it later, keeping the scene's size.
   */
  scale?: number;
  /** No image smoothing, and `image-rendering: pixelated` on the canvas. */
  pixelArt?: boolean;
}

export class World {
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  readonly events: EventBus = new EventBus();
  /** Canvas pixels per scene pixel. */
  scale: number;
  readonly pixelArt: boolean;
  private readonly sceneWidth: number;
  private readonly sceneHeight: number;

  private systems: BaseSystem[] = [];
  /** The systems that say whether a frame can be held (`BaseSystem.holdsFrame`). */
  private frameHolders: BaseSystem[] = [];
  /**
   * This frame draws nothing new: every system implementing `holdsFrame`
   * said so. Drawing systems leave the canvas as it is (`RenderSystem` doesn't clear it).
   */
  frameHeld = false;
  private currentScene: Scene | null = null;
  private rafId: number | null = null;
  private lastTime = 0;
  private running = false;

  constructor(options: WorldOptions) {
    this.canvas = options.canvas;
    const ctx = options.canvas.getContext('2d');
    if (!ctx) throw new Error('Failed to get 2D context from canvas');
    this.ctx = ctx;
    this.scale = options.scale ?? 1;
    this.sceneWidth = options.canvas.width / this.scale;
    this.sceneHeight = options.canvas.height / this.scale;
    this.pixelArt = options.pixelArt ?? false;
    if (this.pixelArt) this.canvas.style.imageRendering = 'pixelated';
  }

  /** Scene width in scene pixels (the canvas width divided by `scale`). */
  get width(): number {
    return this.sceneWidth;
  }

  /** Scene height in scene pixels (the canvas height divided by `scale`). */
  get height(): number {
    return this.sceneHeight;
  }

  /**
   * Draws the scene at `scale` canvas pixels per scene pixel from the next
   * frame, resizing the canvas to match (which clears it). The scene keeps
   * its size, so positions and pointer coordinates don't change. Any
   * factor: the web shell uses it to match the canvas to the screen's pixels.
   */
  setScale(scale: number): void {
    this.scale = scale;
    this.canvas.width = Math.round(this.sceneWidth * scale);
    this.canvas.height = Math.round(this.sceneHeight * scale);
  }

  registerSystem(system: BaseSystem): void {
    this.systems.push(system);
    this.systems.sort((a, b) => a.priority - b.priority);
    this.frameHolders = this.systems.filter((s) => s.holdsFrame);
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
      this.frameHeld =
        this.frameHolders.length > 0 && this.frameHolders.every((s) => s.holdsFrame!(context));
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
