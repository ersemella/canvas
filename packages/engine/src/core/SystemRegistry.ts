import type {BaseSystem} from 'core/System';

export class SystemRegistry {
  private static ctors: Map<string, new () => BaseSystem> = new Map();

  static register(name: string, ctor: new () => BaseSystem): void {
    SystemRegistry.ctors.set(name, ctor);
  }

  static create(name: string): BaseSystem {
    const Ctor = SystemRegistry.ctors.get(name);
    if (!Ctor) throw new Error(`Unknown system: "${name}". Did you forget to register it?`);
    return new Ctor();
  }

  static has(name: string): boolean {
    return SystemRegistry.ctors.has(name);
  }

  static clear(): void {
    SystemRegistry.ctors.clear();
  }
}
