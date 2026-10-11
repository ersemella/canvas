import type {BaseSystem} from '../core/System';
import type {SceneData} from '../types/manifest';
import {SystemRegistry} from '../core/SystemRegistry';
import type {GameManifest, SystemName} from '../types/manifest';

export type {GameManifest, SystemName} from '../types/manifest';

export interface GameModule {
  register(): void;
  getSceneData(): SceneData;
  getSystems(): BaseSystem[];
  getEvents(): Record<string, string>;
  getCanvas(): {width: number; height: number} | undefined;
  getSidePanel?(): unknown;
}

/**
 * What a game package exports: its manifest plus a hook that registers the
 * game's own systems, components, puzzle generators and deal patterns (see
 * the plugin API in the engine's index). The platform builds games in from a
 * list of these. A multiplayer game's server rules are a separate,
 * DOM-free `./server` entry exporting a `ServerSystem`.
 */
export interface GameDefinition {
  /** URL-safe id, e.g. `blackjack` (the shell serves it at `/play/<id>`). */
  id: string;
  manifest: GameManifest;
  /** Called before the game's systems are created; may run more than once. */
  register?(): void;
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
      `Register engine built-ins with registerBuiltinSystems() and game systems in the game's register() before loading it.`
    );
  }
}

export async function loadGameManifestFromURL(url: string): Promise<GameModule> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load game manifest from ${url}: ${res.statusText}`);
  const manifest = (await res.json()) as GameManifest;
  return createGameModule(manifest);
}

export function createGameModule(manifest: GameManifest, register: () => void = () => {}): GameModule {
  return {
    register,
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
      if (manifest.events?.onWin) result['onWin'] = manifest.events.onWin;
      if (manifest.events?.onScore) result['onScore'] = manifest.events.onScore;
      return result;
    },
    getCanvas(): {width: number; height: number} | undefined {
      return manifest.canvas;
    },
  };
}
