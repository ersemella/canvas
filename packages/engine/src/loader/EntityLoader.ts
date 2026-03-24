import {Entity} from 'core/Entity';
import {loadComponents} from 'loader/ComponentLoader';
import type {EntityData} from 'types/manifest';

export type {EntityData} from 'types/manifest';

export function loadEntity(data: EntityData): Entity {
  const entity = new Entity(data.id);

  if (data.tags) {
    for (const tag of data.tags) {
      entity.addTag(tag);
    }
  }

  if (data.components) {
    const raw = data.components as Record<string, Record<string, unknown>>;
    const components = loadComponents(raw);
    for (const component of components) {
      entity.addComponent(component);
    }
  }

  return entity;
}
