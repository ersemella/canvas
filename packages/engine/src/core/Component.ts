export interface IComponent {
  readonly componentType: string;
}

export abstract class BaseComponent implements IComponent {
  abstract readonly componentType: string;
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
