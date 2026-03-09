import type {HookFactory, LifecycleHook} from 'hooks/types';

export class HookRegistry {
  private static factories: Map<string, HookFactory> = new Map();

  static register(name: string, factory: HookFactory): void {
    HookRegistry.factories.set(name, factory);
  }

  static create(name: string, config: Record<string, unknown>): LifecycleHook {
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
