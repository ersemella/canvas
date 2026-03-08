import { nanoid } from 'nanoid';
import type { IComponent } from './Component';

export interface IEntity {
  readonly id: string;
  tags: Set<string>;
  getComponent<T extends IComponent>(type: string): T | undefined;
  hasComponent(type: string): boolean;
  addComponent(component: IComponent): void;
  removeComponent(type: string): void;
  hasTag(tag: string): boolean;
  addTag(tag: string): void;
  removeTag(tag: string): void;
  destroy(): void;
  readonly isDestroyed: boolean;
}

export class Entity implements IEntity {
  readonly id: string;
  tags: Set<string> = new Set();
  private components: Map<string, IComponent> = new Map();
  private _isDestroyed = false;
  private onDestroyCallbacks: Array<() => void> = [];

  constructor(id?: string) {
    this.id = id ?? nanoid();
  }

  get isDestroyed(): boolean {
    return this._isDestroyed;
  }

  getComponent<T extends IComponent>(type: string): T | undefined {
    return this.components.get(type) as T | undefined;
  }

  hasComponent(type: string): boolean {
    return this.components.has(type);
  }

  addComponent(component: IComponent): void {
    this.components.set(component.componentType, component);
  }

  removeComponent(type: string): void {
    this.components.delete(type);
  }

  hasTag(tag: string): boolean {
    return this.tags.has(tag);
  }

  addTag(tag: string): void {
    this.tags.add(tag);
  }

  removeTag(tag: string): void {
    this.tags.delete(tag);
  }

  onDestroy(callback: () => void): void {
    this.onDestroyCallbacks.push(callback);
  }

  destroy(): void {
    if (this._isDestroyed) return;
    this._isDestroyed = true;
    this.onDestroyCallbacks.forEach((cb) => cb());
    this.onDestroyCallbacks = [];
  }
}
