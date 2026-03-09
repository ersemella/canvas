import type {IEntity} from 'core/Entity';
import type {World} from 'core/World';
import type {Scene} from 'core/Scene';
import type {EventBus} from 'core/EventBus';
import type {Entity} from 'core/Entity';

export interface HookContext {
  entity: IEntity;
  world: World;
  scene: Scene;
  events: EventBus;
  deltaTime: number;
  input: InputService;
  state: Record<string, unknown>;
  config: Record<string, unknown>;
  spawn(setup: (entity: Entity) => void): IEntity;
  destroy(id: string): void;
}

export interface InputService {
  isActionPressed(action: string): boolean;
  isActionJustPressed(action: string): boolean;
  isActionJustReleased(action: string): boolean;
}

export interface LifecycleHook {
  onInit?(ctx: HookContext): void;
  onUpdate(ctx: HookContext): void;
  onDestroy?(ctx: HookContext): void;
  onCollisionEnter?(ctx: HookContext, other: IEntity): void;
  onCollisionExit?(ctx: HookContext, other: IEntity): void;
}

export type HookFactory = (config: Record<string, unknown>) => LifecycleHook;
