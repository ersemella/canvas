import type { IEntity } from './Entity';
import { Query, type QueryDescriptor } from './Query';

export class Scene {
  readonly name: string;
  private entities: Map<string, IEntity> = new Map();
  private queryCache: Map<string, Query> = new Map();

  constructor(name: string) {
    this.name = name;
  }

  addEntity(entity: IEntity): void {
    this.entities.set(entity.id, entity);
    this.invalidateQueries();
  }

  removeEntity(id: string): void {
    const entity = this.entities.get(id);
    if (entity) {
      entity.destroy();
      this.entities.delete(id);
      this.invalidateQueries();
    }
  }

  getEntity(id: string): IEntity | undefined {
    return this.entities.get(id);
  }

  getEntities(): IEntity[] {
    return Array.from(this.entities.values()).filter((e) => !e.isDestroyed);
  }

  query(descriptor: QueryDescriptor): IEntity[] {
    const key = JSON.stringify(descriptor);
    if (!this.queryCache.has(key)) {
      this.queryCache.set(key, new Query(descriptor));
    }
    return this.queryCache.get(key)!.resolve(this.entities.values());
  }

  private invalidateQueries(): void {
    for (const query of this.queryCache.values()) {
      query.invalidate();
    }
  }

  clear(): void {
    for (const entity of this.entities.values()) {
      entity.destroy();
    }
    this.entities.clear();
    this.queryCache.clear();
  }
}
