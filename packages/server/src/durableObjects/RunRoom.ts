import type {Env, RunRecord, RunResponse, RunStatus, RunSystem} from '../types';
import {runSystemRegistry} from '../games/registry';
import {json} from '../json';

/** How long a finished run is kept before its storage is deleted (D3). */
const KEEP_FINISHED_MS = 3 * 24 * 60 * 60 * 1000;

/** A run that can still be shown: everything but one saved by an older version of its rules. */
type ShownRecord = RunRecord & {status: RunStatus};

function shown(record: RunRecord): record is ShownRecord {
  return record.status !== 'expired';
}

const EXPIRED = {
  error: 'expired',
  message: 'That run was saved by an older version of the game, so it has ended. Start a new one.',
};

/**
 * One Durable Object per run, `idFromName('run:' + runId)`, for its whole
 * life (docs/plans/roguelike-tactics/architecture.md, D3 and D7). Plain
 * HTTP, called only by the Worker's `/runs` routes: the run's state is one
 * stored value, written once per action; the game's `RunSystem` owns every
 * rule. Every request names the caller's player-key hash (`X-Owner`), and
 * only the run's owner may see or act on it.
 */
export class RunRoom implements DurableObject {
  private state: DurableObjectState;
  private env: Env;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === 'POST' && url.pathname === '/init') return this.init(request);

    const record = await this.state.storage.get<RunRecord>('run');
    if (!record) return json({error: 'not_found', message: 'No such run.'}, 404);
    if (request.headers.get('X-Owner') !== record.ownerHash) {
      return json({error: 'forbidden', message: 'This run belongs to another player.'}, 403);
    }
    const system = runSystemRegistry.get(record.game);
    if (!system) return json({error: 'unknown_game', message: 'This game no longer runs.'}, 410);

    // Saved by an older version of the rules: never shown or played on, and
    // ended if it was still going, so the rules only see their own format.
    if (!shown(record) || system.outdated?.(record.state)) {
      if (record.status === 'active') {
        record.status = 'expired';
        record.updatedAt = Date.now();
        await this.state.storage.put('run', record);
        await this.finish(record);
      }
      return json(EXPIRED, 410);
    }

    if (request.method === 'GET' && url.pathname === '/view') return json(respond(record, system));
    if (request.method === 'POST' && url.pathname === '/action')
      return this.action(request, record, system);
    if (request.method === 'POST' && url.pathname === '/abandon')
      return this.abandon(record, system);
    return json({error: 'not_found'}, 404);
  }

  async alarm(): Promise<void> {
    await this.state.storage.deleteAll();
  }

  private async init(request: Request): Promise<Response> {
    if (await this.state.storage.get('run')) return json({error: 'exists'}, 409);
    const body = (await request.json()) as {
      runId: string;
      game: string;
      ownerHash: string;
      seed: number;
      setup?: unknown;
    };
    const system = runSystemRegistry.get(body.game);
    if (!system) return json({error: 'unknown_game', message: 'Unknown game.'}, 400);
    let state: unknown;
    try {
      state = system.createRun(body.seed, body.setup);
    } catch (err) {
      return json(
        {error: 'bad_setup', message: err instanceof Error ? err.message : 'Bad setup.'},
        400
      );
    }
    const now = Date.now();
    const record: ShownRecord = {
      runId: body.runId,
      game: body.game,
      ownerHash: body.ownerHash,
      state,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    };
    await this.state.storage.put('run', record);
    return json(respond(record, system));
  }

  private async action(
    request: Request,
    record: ShownRecord,
    system: RunSystem
  ): Promise<Response> {
    if (record.status !== 'active')
      return json({error: 'finished', message: 'This run is over.'}, 409);
    const action = await request.json().catch(() => null);
    let next: unknown;
    try {
      next = system.handleAction(record.state, action);
    } catch (err) {
      return json(
        {error: 'illegal', message: err instanceof Error ? err.message : 'Illegal action.'},
        400
      );
    }
    record.state = next;
    record.status = system.status(next);
    record.updatedAt = Date.now();
    await this.state.storage.put('run', record);
    if (record.status !== 'active') await this.finish(record);
    return json(respond(record, system));
  }

  /** Starting a new run abandons the active one, which counts as a death (D3). */
  private async abandon(record: ShownRecord, system: RunSystem): Promise<Response> {
    if (record.status === 'active') {
      record.status = 'abandoned';
      record.updatedAt = Date.now();
      await this.state.storage.put('run', record);
      await this.finish(record);
    }
    return json(respond(record, system));
  }

  /** A finished run leaves the ledger's active slot and is deleted after a few days. */
  private async finish(record: RunRecord): Promise<void> {
    const ledger = this.env.PLAYER_LEDGER.get(this.env.PLAYER_LEDGER.idFromName(record.ownerHash));
    await ledger.fetch('https://do/ended', {
      method: 'POST',
      body: JSON.stringify({runId: record.runId}),
    });
    await this.state.storage.setAlarm(Date.now() + KEEP_FINISHED_MS);
  }
}

function respond(record: ShownRecord, system: RunSystem): RunResponse {
  return {
    runId: record.runId,
    game: record.game,
    status: record.status,
    view: system.getView(record.state),
  };
}
