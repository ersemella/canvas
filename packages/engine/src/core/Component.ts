export interface IComponent {
  readonly componentType: string;
}

export abstract class BaseComponent implements IComponent {
  abstract readonly componentType: string;
}

export class DataComponent<T extends object> implements IComponent {
  readonly componentType: string;
  data: T;
  constructor(componentType: string, data: T) {
    this.componentType = componentType;
    this.data = data;
  }
}

type ComponentFactory = (data: Record<string, unknown>) => IComponent;

export class ComponentRegistry {
  private static factories: Map<string, ComponentFactory> = new Map();

  static register(type: string, factory: ComponentFactory): void {
    ComponentRegistry.factories.set(type, factory);
  }

  static create(type: string, data: Record<string, unknown>): IComponent {
    const factory = ComponentRegistry.factories.get(type);
    if (!factory) {
      throw new Error(`Unknown component type: ${type}`);
    }
    return factory(data);
  }

  static has(type: string): boolean {
    return ComponentRegistry.factories.has(type);
  }
}

export function registerDataComponent<T extends object>(type: string): void {
  ComponentRegistry.register(type, (data) => new DataComponent<T>(type, structuredClone(data) as T));
}
