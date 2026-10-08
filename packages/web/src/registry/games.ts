import {loadGameManifestFromURL} from '@canvas/engine';
import type {GameModule} from '@canvas/engine';
import {API_URL} from 'config/api';

export interface GameDescriptor {
  id: string;
  title: string;
  description: string;
  load: () => Promise<{default: GameModule}>;
}

/** Shape of each entry in the Worker's index.json. */
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
  // In prod, API_URL is the Worker URL (https://canvas-server.<acct>.workers.dev).
  const indexUrl = `${API_URL}/manifests/index.json`;

  let res: Response;
  try {
    res = await fetch(indexUrl);
  } catch {
    // DNS failure, CORS rejection, or the server being down all land here.
    throw new Error(`Couldn't reach the game server at ${indexUrl}`);
  }
  if (!res.ok) {
    throw new Error(`The game server returned ${res.status} for ${indexUrl}`);
  }
  const entries = (await res.json()) as RemoteGameEntry[];
  return entries.map((entry) => ({
    id: entry.id,
    title: entry.title,
    description: entry.description,
    // entry.url is a path like `/manifests/poker/game.json` produced by
    // the Worker; resolve it against the API origin.
    load: () =>
      loadGameManifestFromURL(`${API_URL}${entry.url}`).then((module) => ({default: module})),
  }));
}

let _promise: Promise<GameDescriptor[]> | null = null;

/**
 * Returns the full game list. A successful result is memoized — subsequent
 * calls return the same promise without re-fetching. A failed fetch rejects
 * with a user-facing message and is not memoized, so callers can retry.
 *
 * Manifests are served by the Cloudflare Worker (`/manifests/index.json` and
 * `/manifests/<id>/game.json`), which is backed by the ManifestRegistry
 * Durable Object. In dev, Vite proxies these paths to a local `wrangler dev`.
 */
export function getGames(): Promise<GameDescriptor[]> {
  if (!_promise) {
    _promise = loadManifestGames().then((manifests) => [...manifests, ...STATIC_GAMES]);
    _promise.catch(() => {
      _promise = null;
    });
  }
  return _promise;
}
