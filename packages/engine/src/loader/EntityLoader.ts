import {Entity} from 'core/Entity';
import {loadComponents} from 'loader/ComponentLoader';

export interface EntityData {
  id?: string;
  tags?: string[];
  components?: Record<string, Record<string, unknown>>;
}

export function loadEntity(data: EntityData): Entity {
  const entity = new Entity(data.id);

  if (data.tags) {
    for (const tag of data.tags) {
      entity.addTag(tag);
    }
  }

  if (data.components) {
    const components = loadComponents(data.components);
    for (const component of components) {
      entity.addComponent(component);
    }
  }

  return entity;
}
