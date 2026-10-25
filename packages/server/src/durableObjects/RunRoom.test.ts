import {describe, expect, it} from 'vitest';
import type {Env, RunRecord} from '../types';
import {RunRoom} from './RunRoom';

/** A RunRoom over in-memory storage, with a ledger that records what it's told. */
function room() {
  const stored = new Map<string, unknown>();
  let alarm: number | null = null;
  const storage = {
    get: async (key: string) => structuredClone(stored.get(key)),
    put: async (key: string, value: unknown) => void stored.set(key, structuredClone(value)),
    deleteAll: async () => stored.clear(),
    setAlarm: async (at: number) => void (alarm = at),
  };
  const ledger: {path: string; body: unknown}[] = [];
  const env = {
    PLAYER_LEDGER: {
      idFromName: (name: string) => name,
      get: () => ({
        fetch: async (url: string, init?: RequestInit) => {
          ledger.push({path: new URL(url).pathname, body: JSON.parse(String(init?.body))});
          return Response.json({ok: true});
        },
      }),
    },
  } as unknown as Env;
  const run = new RunRoom({storage} as unknown as DurableObjectState, env);
  const call = (path: string, init: RequestInit = {}) =>
    run.fetch(new Request(`https://do${path}`, init));
  const view = (owner = 'owner') => call('/view', {headers: {'X-Owner': owner}});
  return {stored, ledger, call, view, alarm: () => alarm};
}

async function started() {
  const r = room();
  const init = await r.call('/init', {
    method: 'POST',
    body: JSON.stringify({runId: 'r1', game: 'silk-road-run', ownerHash: 'owner', seed: 7}),
  });
  expect(init.status).toBe(200);
  return r;
}

describe('RunRoom', () => {
  it('shows a run only to its owner', async () => {
    const r = await started();
    expect((await r.view()).status).toBe(200);
    expect((await r.view('someone else')).status).toBe(403);
  });

  it('ends a run saved by an older version of the rules, and never shows it', async () => {
    const r = await started();
    // As saved before the run's format existed.
    const record = r.stored.get('run') as RunRecord;
    delete (record.state as {format?: number}).format;

    const first = await r.view();
    expect(first.status).toBe(410);
    expect(((await first.json()) as {error: string}).error).toBe('expired');
    expect((r.stored.get('run') as RunRecord).status).toBe('expired');
    // It leaves the ledger's active slot, and is deleted in a few days.
    expect(r.ledger).toEqual([{path: '/ended', body: {runId: 'r1'}}]);
    expect(r.alarm()).not.toBeNull();

    // Ended once: every later request is refused the same way, actions too.
    expect((await r.view()).status).toBe(410);
    const action = await r.call('/action', {
      method: 'POST',
      headers: {'X-Owner': 'owner'},
      body: JSON.stringify({type: 'turn', action: {ability: 'hold'}}),
    });
    expect(action.status).toBe(410);
    expect(r.ledger).toHaveLength(1);
  });

  it('leaves a finished run from an older version as it was', async () => {
    const r = await started();
    const record = r.stored.get('run') as RunRecord;
    record.status = 'won';
    delete (record.state as {format?: number}).format;
    expect((await r.view()).status).toBe(410);
    expect((r.stored.get('run') as RunRecord).status).toBe('won');
    expect(r.ledger).toEqual([]);
  });
});
