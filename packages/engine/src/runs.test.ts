import {describe, expect, it} from 'vitest';
import {RunError, abandonRun, expireRun, outdatedRun, playRun, runResponse, startRun} from './runs';
import type {RunContext, RunSystem} from './runs';

/** A run that counts up to 3 and is won there; `format` 2 is today's. */
type State = {format: number; seed: number; count: number};
const counter: RunSystem<State, {add?: number}, {count: number}> = {
  kind: 'run',
  systemName: 'Counter',
  createRun: (seed, setup) => {
    if (setup === 'bad') throw new Error('No such setup.');
    return {format: 2, seed, count: 0};
  },
  handleAction: (state, action) => {
    if (action?.add !== 1) throw new Error('Add one.');
    return {...state, count: state.count + 1};
  },
  getView: (state) => ({count: state.count}),
  status: (state) => (state.count >= 3 ? 'won' : 'active'),
  outdated: (state) => state.format !== 2,
};
const system = counter as RunSystem;
const fresh = () => startRun(system, {runId: 'r1', game: 'counter', seed: 9}, 100);

describe('the run host', () => {
  it('starts a run and answers its view, never its state', () => {
    const record = fresh();
    expect(record).toMatchObject({runId: 'r1', status: 'active', createdAt: 100, updatedAt: 100});
    expect(runResponse(system, record)).toEqual({
      runId: 'r1',
      game: 'counter',
      status: 'active',
      view: {count: 0},
    });
    expect(() => startRun(system, {runId: 'r2', game: 'counter', seed: 1, setup: 'bad'})).toThrow(
      new RunError('bad_setup', 'No such setup.')
    );
  });

  it('plays actions without changing the record, and refuses illegal ones with the rules’ message', () => {
    const record = fresh();
    const next = playRun(system, record, {add: 1}, undefined, 200);
    expect(record.state).toEqual({format: 2, seed: 9, count: 0});
    expect(next).toMatchObject({status: 'active', updatedAt: 200, state: {count: 1}});
    expect(() => playRun(system, record, {add: 2})).toThrow(new RunError('illegal', 'Add one.'));
  });

  it('passes the host’s clock to the rules', () => {
    let seen: RunContext | undefined;
    const clocked = {
      ...system,
      handleAction: (s: unknown, _a: unknown, c?: RunContext) => ((seen = c), s),
    };
    const now = () => 5;
    playRun(clocked, fresh(), {add: 1}, {now});
    expect(seen?.now).toBe(now);
  });

  it('ends a run once the rules say so, and refuses to play on', () => {
    let record = fresh();
    for (let i = 0; i < 3; i++) record = playRun(system, record, {add: 1});
    expect(record.status).toBe('won');
    expect(() => playRun(system, record, {add: 1})).toThrow(
      new RunError('finished', 'This run is over.')
    );
    expect(abandonRun(record).status).toBe('won');
    expect(abandonRun(fresh(), 300)).toMatchObject({status: 'abandoned', updatedAt: 300});
  });

  it('ends a run saved by an older version of the rules, never showing or playing it', () => {
    const old = {...fresh(), state: {format: 1, seed: 9, count: 0}};
    expect(outdatedRun(system, old)).toBe(true);
    expect(() => runResponse(system, old)).toThrow(RunError);
    expect(() => playRun(system, old, {add: 1})).toThrow(
      expect.objectContaining({code: 'expired'})
    );
    const expired = expireRun(old, 400);
    expect(expired).toMatchObject({status: 'expired', updatedAt: 400});
    expect(outdatedRun(system, {...fresh(), status: 'expired'})).toBe(true);
  });
});
