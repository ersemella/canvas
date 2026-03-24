import type {BaseSystem} from 'core/System';
import type {SceneData} from 'types/manifest';
import {SystemRegistry} from 'core/SystemRegistry';
import type {GameManifest, SystemName} from 'types/manifest';

export type {GameManifest, SystemName} from 'types/manifest';

export interface GameModule {
  register(): void;
  getSceneData(): SceneData;
  getSystems(): BaseSystem[];
  getEvents(): Record<string, string>;
  getCanvas(): {width: number; height: number} | undefined;
  getSidePanel?(): unknown;
}

const EXCLUSIVE_FAMILIES: string[][] = [
  ['PhysicsSystem', 'GridMovementSystem'],
  ['CollisionSystem', 'GridMovementSystem'],
];

function validateExclusiveFamilies(names: SystemName[]): void {
  for (const family of EXCLUSIVE_FAMILIES) {
    const found = family.filter((n) => (names as string[]).includes(n));
    if (found.length > 1) {
      throw new Error(
        `Incompatible systems: [${found.join(', ')}]. Pick at most one from [${family.join(', ')}].`
      );
    }
  }
}

export function validateManifestSystems(systems: SystemName[]): void {
  const unknown = systems.filter((name) => !SystemRegistry.has(name));
  if (unknown.length > 0) {
    throw new Error(
      `Game manifest references unregistered system(s): ${unknown.map((n) => `"${n}"`).join(', ')}. ` +
      `Only built-in engine systems can be used in static manifests.`
    );
  }
}

export async function loadGameManifestFromURL(url: string): Promise<GameModule> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load game manifest from ${url}: ${res.statusText}`);
  const manifest = (await res.json()) as GameManifest;
  return createGameModule(manifest);
}

export function createGameModule(manifest: GameManifest): GameModule {
  return {
    register(): void {},
    getSceneData(): SceneData {
      return manifest.scene;
    },
    getSystems(): BaseSystem[] {
      validateExclusiveFamilies(manifest.systems);
      validateManifestSystems(manifest.systems);
      return manifest.systems.map((name) => SystemRegistry.create(name));
    },
    getEvents(): Record<string, string> {
      const result: Record<string, string> = {};
      if (manifest.events?.onDeath) result['onDeath'] = manifest.events.onDeath;
      return result;
    },
    getCanvas(): {width: number; height: number} | undefined {
      return manifest.canvas;
    },
  };
}
