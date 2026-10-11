import {createGameModule} from '@canvas/engine';
import type {GameDefinition, GameModule} from '@canvas/engine';
import {PLATFORM_GAMES} from 'platform.games';

export interface GameDescriptor {
  id: string;
  title: string;
  description: string;
  load: () => Promise<{default: GameModule}>;
}

/** Builds the engine module for a game: its manifest plus its own `register()`. */
export function createModuleFor(game: GameDefinition): GameModule {
  return createGameModule(game.manifest, () => game.register?.());
}

/** Looks a built-in game up by id. */
export function findGame(id: string): GameDefinition | undefined {
  return PLATFORM_GAMES.find((g) => g.id === id);
}

const descriptors: GameDescriptor[] = PLATFORM_GAMES.map((game) => ({
  id: game.id,
  title: game.manifest.meta?.title ?? game.id,
  description: game.manifest.meta?.description ?? '',
  load: () => Promise.resolve({default: createModuleFor(game)}),
}));

/**
 * Returns the full game list. Games are bundled into the web build from
 * `platform.games.ts`, so this never touches the network; it stays async so
 * pages don't care where games come from.
 */
export function getGames(): Promise<GameDescriptor[]> {
  return Promise.resolve(descriptors);
}
