import type {Env, LedgerRecord} from '../types';
import {json} from '../json';

/**
 * One Durable Object per player key, `idFromName(keyHash)`
 * (docs/plans/roguelike-tactics/architecture.md, D9). Phase 1 keeps only
 * the active run, so a returning player resumes it with their key alone and
 * starting a new run can abandon the old one (D3). Called only through DO
 * stubs: by the `/runs` routes and by `RunRoom` when a run ends.
 */
export class PlayerLedger implements DurableObject {
  private state: DurableObjectState;

  constructor(state: DurableObjectState, _env: Env) {
    this.state = state;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const record = (await this.state.storage.get<LedgerRecord>('ledger')) ?? {
      activeRunId: null,
      runsStarted: 0,
    };

    if (request.method === 'GET' && url.pathname === '/active') {
      return json({activeRunId: record.activeRunId});
    }
    if (request.method === 'POST' && url.pathname === '/start') {
      const {runId} = (await request.json()) as {runId: string};
      const previous = record.activeRunId;
      await this.state.storage.put('ledger', {
        activeRunId: runId,
        runsStarted: record.runsStarted + 1,
      });
      return json({previousRunId: previous});
    }
    if (request.method === 'POST' && url.pathname === '/ended') {
      const {runId} = (await request.json()) as {runId: string};
      if (record.activeRunId === runId)
        await this.state.storage.put('ledger', {...record, activeRunId: null});
      return json({ok: true});
    }
    return json({error: 'not_found'}, 404);
  }
}
