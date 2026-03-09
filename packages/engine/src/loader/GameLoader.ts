import type {BaseSystem} from 'core/System';
import type {SceneData} from 'loader/SceneLoader';
import {SystemRegistry} from 'core/SystemRegistry';

export interface GameModule {
  register(): void;
  getSceneData(): SceneData;
  getSystems(): BaseSystem[];
}

export interface GameManifest {
  systems: string[];
  scene: SceneData;
}

export function createGameModule(manifest: GameManifest): GameModule {
  return {
    register(): void {},
    getSceneData(): SceneData {
      return manifest.scene;
    },
    getSystems(): BaseSystem[] {
      return manifest.systems.map((name) => SystemRegistry.create(name));
    },
  };
}
