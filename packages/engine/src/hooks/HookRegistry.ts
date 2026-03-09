import type {AnyHookFactory, AnyLifecycleHook, HookFactory} from 'hooks/types';

export class HookRegistry {
  private static factories: Map<string, AnyHookFactory> = new Map();

  static register<TState, TConfig>(name: string, factory: HookFactory<TState, TConfig>): void {
    HookRegistry.factories.set(name, factory as AnyHookFactory);
  }

  static create(name: string, config: Record<string, unknown>): AnyLifecycleHook {
    const factory = HookRegistry.factories.get(name);
    if (!factory) {
      throw new Error(`Unknown hook: ${name}. Did you forget to register it?`);
    }
    return factory(config);
  }

  static has(name: string): boolean {
    return HookRegistry.factories.has(name);
  }

  static clear(): void {
    HookRegistry.factories.clear();
  }
}
