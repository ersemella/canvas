import type {IEntity} from 'core/Entity';

export interface QueryDescriptor {
  all?: string[];
  any?: string[];
  none?: string[];
  tags?: string[];
}

export class Query {
  private cache: IEntity[] | null = null;
  private dirty = true;

  constructor(private descriptor: QueryDescriptor) {}

  invalidate(): void {
    this.dirty = true;
    this.cache = null;
  }

  matches(entity: IEntity): boolean {
    const {all = [], any = [], none = [], tags = []} = this.descriptor;

    if (all.length > 0 && !all.every((c) => entity.hasComponent(c))) return false;
    if (any.length > 0 && !any.some((c) => entity.hasComponent(c))) return false;
    if (none.length > 0 && none.some((c) => entity.hasComponent(c))) return false;
    if (tags.length > 0 && !tags.every((t) => entity.hasTag(t))) return false;

    return true;
  }

  resolve(entities: Iterable<IEntity>): IEntity[] {
    if (!this.dirty && this.cache) return this.cache;

    this.cache = [];
    for (const entity of entities) {
      if (!entity.isDestroyed && this.matches(entity)) {
        this.cache.push(entity);
      }
    }
    this.dirty = false;
    return this.cache;
  }
}
