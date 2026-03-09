import type {IEntity} from 'core/Entity';
import type {World} from 'core/World';
import type {Scene} from 'core/Scene';
import type {EventBus} from 'core/EventBus';
import type {Entity} from 'core/Entity';

export interface HookContext<TState = Record<string, unknown>, TConfig = Record<string, unknown>> {
  entity: IEntity;
  world: World;
  scene: Scene;
  events: EventBus;
  deltaTime: number;
  input: InputService;
  state: TState;
  config: TConfig;
  spawn(setup: (entity: Entity) => void): IEntity;
  destroy(id: string): void;
}

export interface InputService {
  isActionPressed(action: string): boolean;
  isActionJustPressed(action: string): boolean;
  isActionJustReleased(action: string): boolean;
}

export interface LifecycleHook<TState = Record<string, unknown>, TConfig = Record<string, unknown>> {
  onInit?(ctx: HookContext<TState, TConfig>): void;
  onUpdate?(ctx: HookContext<TState, TConfig>): void;
  onDestroy?(ctx: HookContext<TState, TConfig>): void;
  onCollisionEnter?(ctx: HookContext<TState, TConfig>, other: IEntity): void;
  onCollisionExit?(ctx: HookContext<TState, TConfig>, other: IEntity): void;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyLifecycleHook = LifecycleHook<any, any>;

export type HookFactory<TState, TConfig> = (config: TConfig) => LifecycleHook<TState, TConfig>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyHookFactory = HookFactory<any, any>;
