import {createGameModule, loadGameManifestFromURL} from '@canvas/engine';
import type {GameModule, GameManifest} from '@canvas/engine';

export interface GameDescriptor {
  id: string;
  title: string;
  description: string;
  load: () => Promise<{default: GameModule}>;
}

/** Shape of each entry in the S3 index.json file. */
export interface RemoteGameEntry {
  id: string;
  title: string;
  description: string;
  url: string;
}

// Games with custom TypeScript logic that cannot be expressed as pure manifests.
const STATIC_GAMES: GameDescriptor[] = [
  {
    id: 'poker',
    title: "Texas Hold'em Poker",
    description: "Single-player Texas Hold'em against 5 bots. 5/10 blinds, 1000 starting chips.",
    load: () => import('@canvas/games-poker').then((m) => ({default: m.default})),
  },
];

// Local manifest games — used as fallback when VITE_MANIFESTS_BASE_URL is not set (dev).
const LOCAL_MANIFEST_GAMES: GameDescriptor[] = [
  {
    id: 'snake',
    title: 'Snake',
    description: 'Classic snake game. Eat food, grow longer, avoid walls and yourself.',
    load: () =>
      import('@canvas/games-snake').then((m) => ({default: createGameModule(m.default as GameManifest)})),
  },
  {
    id: 'solitaire',
    title: 'Solitaire',
    description: 'Classic Klondike solitaire. Build up the foundations from Ace to King.',
    load: () =>
      import('@canvas/games-solitaire').then((m) => ({default: createGameModule(m.default as GameManifest)})),
  },
  {
    id: 'sudoku',
    title: 'Sudoku',
    description: 'Classic 9×9 Sudoku. Fill the grid with digits 1–9, no repeats in any row, column, or box.',
    load: () =>
      import('@canvas/games-sudoku').then((m) => ({default: createGameModule(m.default as GameManifest)})),
  },
];

async function loadManifestGames(): Promise<GameDescriptor[]> {
  const baseUrl = import.meta.env.VITE_MANIFESTS_BASE_URL;
  if (!baseUrl) return LOCAL_MANIFEST_GAMES;

  try {
    const res = await fetch(`${baseUrl}/index.json`);
    if (!res.ok) return LOCAL_MANIFEST_GAMES;
    const entries = (await res.json()) as RemoteGameEntry[];
    return entries.map((entry) => ({
      id: entry.id,
      title: entry.title,
      description: entry.description,
      load: () => loadGameManifestFromURL(entry.url).then((module) => ({default: module})),
    }));
  } catch {
    return LOCAL_MANIFEST_GAMES;
  }
}

let _promise: Promise<GameDescriptor[]> | null = null;

/**
 * Returns the full game list. The result is memoized — subsequent calls
 * return the same promise without re-fetching.
 *
 * In production (VITE_MANIFESTS_BASE_URL set): fetches index.json from S3
 * and builds descriptors that lazy-load each manifest on demand.
 *
 * In development (no env var): falls back to local static imports.
 */
export function getGames(): Promise<GameDescriptor[]> {
  if (!_promise) {
    _promise = loadManifestGames().then((manifests) => [...manifests, ...STATIC_GAMES]);
  }
  return _promise;
}
