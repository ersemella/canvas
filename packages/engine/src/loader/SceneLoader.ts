import { Scene } from '../core/Scene';
import { loadEntity, type EntityData } from './EntityLoader';
import { loadHooks } from './HookLoader';
import { ScriptComponent } from '../components/ScriptComponent';

export interface SceneData {
  name: string;
  entities: EntityData[];
}

export function loadScene(data: SceneData): Scene {
  const scene = new Scene(data.name);

  for (const entityData of data.entities) {
    const entity = loadEntity(entityData);

    const script = entity.getComponent<ScriptComponent>('Script');
    if (script) {
      loadHooks(script);
    }

    scene.addEntity(entity);
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
