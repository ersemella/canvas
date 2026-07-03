import {loadGameManifestFromURL} from '@canvas/engine';
import type {GameModule} from '@canvas/engine';

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
const STATIC_GAMES: GameDescriptor[] = [];

async function loadManifestGames(): Promise<GameDescriptor[]> {
  // In dev (no VITE_API_URL), Vite proxies /manifests -> wrangler dev.
  // In prod, VITE_API_URL is the Worker URL (https://canvas-server.<acct>.workers.dev).
  const apiUrl = import.meta.env.VITE_API_URL ?? '';
  const manifestsBase = `${apiUrl}/manifests`;

  try {
    const res = await fetch(`${manifestsBase}/index.json`);
    if (!res.ok) return [];
    const entries = (await res.json()) as RemoteGameEntry[];
    return entries.map((entry) => ({
      id: entry.id,
      title: entry.title,
      description: entry.description,
      // entry.url is a path like `/manifests/poker/game.json` produced by
      // the Worker; resolve it against the API origin.
      load: () =>
        loadGameManifestFromURL(`${apiUrl}${entry.url}`).then((module) => ({default: module})),
    }));
  } catch {
    return [];
  }
}

let _promise: Promise<GameDescriptor[]> | null = null;

/**
 * Returns the full game list. The result is memoized — subsequent calls
 * return the same promise without re-fetching.
 *
 * Manifests are served by the Cloudflare Worker (`/manifests/index.json` and
 * `/manifests/<id>/game.json`), which is backed by the ManifestRegistry
 * Durable Object. In dev, Vite proxies these paths to a local `wrangler dev`.
 */
export function getGames(): Promise<GameDescriptor[]> {
  if (!_promise) {
    _promise = loadManifestGames().then((manifests) => [...manifests, ...STATIC_GAMES]);
  }
  return _promise;
}
