import type {Env} from '../types';

interface ManifestIndexEntry {
  id: string;
  title: string;
  description: string;
  url: string;
}

interface UploadBody {
  games: Array<{
    id: string;
    manifest: unknown;
    title: string;
    description: string;
  }>;
}

/**
 * Singleton DurableObject (`idFromName('global')`) holding all game manifests
 * and the index. Replaces the S3 ManifestsBucket from the old AWS stack.
 *
 * Storage layout:
 *   - 'index' -> ManifestIndexEntry[]
 *   - 'game:<id>' -> game.json contents
 */
export class ManifestRegistry implements DurableObject {
  private state: DurableObjectState;
  private env: Env;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === 'GET' && url.pathname === '/index.json') return this.getIndex();
    if (request.method === 'GET' && url.pathname.startsWith('/game/')) {
      return this.getGame(url.pathname.slice('/game/'.length));
    }
    if (request.method === 'POST' && url.pathname === '/upload') return this.upload(request);
    return new Response('not found', {status: 404});
  }

  private async getIndex(): Promise<Response> {
    const idx = (await this.state.storage.get<ManifestIndexEntry[]>('index')) ?? [];
    return json(idx);
  }

  private async getGame(id: string): Promise<Response> {
    const m = await this.state.storage.get<unknown>(`game:${id}`);
    if (!m) return new Response('not found', {status: 404});
    return json(m);
  }

  private async upload(request: Request): Promise<Response> {
    let body: UploadBody;
    try {
      body = (await request.json()) as UploadBody;
    } catch {
      return json({error: 'invalid_json'}, 400);
    }
    if (!body.games || !Array.isArray(body.games)) {
      return json({error: 'missing_games'}, 400);
    }
    const index: ManifestIndexEntry[] = body.games.map((g) => ({
      id: g.id,
      title: g.title,
      description: g.description,
      url: `/manifests/${g.id}/game.json`,
    }));
    const writes: Record<string, unknown> = {index};
    for (const g of body.games) writes[`game:${g.id}`] = g.manifest;
    await this.state.storage.put(writes);
    return json({ok: true, count: body.games.length});
  }
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {'Content-Type': 'application/json'},
  });
}
