import {Scene} from 'core/Scene';
import {loadEntity, type EntityData} from 'loader/EntityLoader';

export interface SceneData {
  name: string;
  entities: EntityData[];
}

export function loadScene(data: SceneData): Scene {
  const scene = new Scene(data.name);
  for (const entityData of data.entities) {
    scene.addEntity(loadEntity(entityData));
  }
  return scene;
}

export async function loadSceneFromURL(url: string): Promise<Scene> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load scene from ${url}: ${response.statusText}`);
  }
  const data = (await response.json()) as SceneData;
  return loadScene(data);
}
