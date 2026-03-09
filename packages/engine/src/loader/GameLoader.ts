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

const EXCLUSIVE_FAMILIES: string[][] = [
  ['PhysicsSystem', 'GridMovementSystem'],
  ['CollisionSystem', 'GridMovementSystem'],
];

function validateExclusiveFamilies(names: string[]): void {
  for (const family of EXCLUSIVE_FAMILIES) {
    const found = family.filter((n) => names.includes(n));
    if (found.length > 1) {
      throw new Error(
        `Incompatible systems: [${found.join(', ')}]. Pick at most one from [${family.join(', ')}].`
      );
    }
  }
}

export function createGameModule(manifest: GameManifest): GameModule {
  return {
    register(): void {},
    getSceneData(): SceneData {
      return manifest.scene;
    },
    getSystems(): BaseSystem[] {
      validateExclusiveFamilies(manifest.systems);
      return manifest.systems.map((name) => SystemRegistry.create(name));
    },
  };
}
