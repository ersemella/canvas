/**
 * Single-player runs: the contract between a game's run rules and whatever
 * hosts its runs, and that host's logic, free of storage and of the DOM.
 * The page plays a run in the browser and keeps its record
 * (docs/plans/client-side-runs.md); these functions are all it does with
 * one: start it, play an action on it, end it.
 */

/** What a host offers a run's rules for one action. */
export interface RunContext {
  /**
   * A clock, in milliseconds (`performance.now`), for open-ended work such
   * as an AI's search, which may then take as long as the rules allow;
   * without one, the rules keep to fixed caps and play the same on every
   * machine.
   */
  now?: () => number;
}

/**
 * Rules of a single-player run. The host stores the state and calls these;
 * the game owns every rule.
 */
export interface RunSystem<TState = unknown, TAction = unknown, TView = unknown> {
  kind: 'run';
  systemName: string;
  /**
   * A new run from a seed and the player's choices from the start menu
   * (`setup`, unchecked). Throws with a player-facing message for a setup
   * it can't use.
   */
  createRun(seed: number, setup?: unknown): TState;
  /**
   * Applies one player action and everything that follows it up to the
   * next decision. Returns the new state without mutating `state`; throws
   * with a player-facing message for an illegal action.
   */
  handleAction(state: TState, action: TAction, context?: RunContext): TState;
  /** Everything the page shows, sent whole with every answer: never the seed. */
  getView(state: TState): TView;
  status(state: TState): 'active' | 'won' | 'lost';
  /**
   * True for a run saved by an older version of the rules, which this one
   * can't play on. The host ends it (`expired`) before calling anything
   * else, so the rules only ever see states in their current format.
   */
  outdated?(state: TState): boolean;
}

/** A run's status, as every answer carries it. */
export type RunStatus = 'active' | 'won' | 'lost' | 'abandoned';

/** Every answer about a run: its whole public view (`RunSystem.getView`). */
export interface RunResponse<TView = unknown> {
  runId: string;
  game: string;
  status: RunStatus;
  view: TView;
}

/** A run as its host keeps it. */
export interface RunRecord {
  runId: string;
  game: string;
  /** The game's run state, seed included. */
  state: unknown;
  /** `expired`: saved by an older version of the game's rules, and ended for it (`RunSystem.outdated`). */
  status: RunStatus | 'expired';
  createdAt: number;
  updatedAt: number;
}

/** Why a run can't do what was asked, with a message for the player. */
export class RunError extends Error {
  constructor(
    readonly code: 'bad_setup' | 'expired' | 'finished' | 'illegal',
    message: string
  ) {
    super(message);
    this.name = 'RunError';
  }
}

const EXPIRED_MESSAGE =
  'That run was saved by an older version of the game, so it has ended. Start a new one.';

const messageOf = (err: unknown, fallback: string) =>
  err instanceof Error && err.message ? err.message : fallback;

/** A new run, `active`. Throws `bad_setup` for a setup the rules refuse. */
export function startRun(
  system: RunSystem,
  run: {runId: string; game: string; seed: number; setup?: unknown},
  now = Date.now()
): RunRecord {
  let state: unknown;
  try {
    state = system.createRun(run.seed, run.setup);
  } catch (err) {
    throw new RunError('bad_setup', messageOf(err, 'Bad setup.'));
  }
  return {
    runId: run.runId,
    game: run.game,
    state,
    status: 'active',
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Whether the run was saved by an older version of its rules: it is never
 * shown or played on again, and is `expired` if it was still going.
 */
export function outdatedRun(system: RunSystem, record: RunRecord): boolean {
  return record.status === 'expired' || Boolean(system.outdated?.(record.state));
}

/** The run, ended as `expired` if it was still going (call once `outdatedRun`). */
export function expireRun(record: RunRecord, now = Date.now()): RunRecord {
  return record.status === 'active' ? {...record, status: 'expired', updatedAt: now} : record;
}

/** The answer about a run that can still be shown; throws `expired` for one that can't. */
export function runResponse<TView>(
  system: RunSystem<unknown, unknown, TView>,
  record: RunRecord
): RunResponse<TView> {
  if (outdatedRun(system as RunSystem, record)) throw new RunError('expired', EXPIRED_MESSAGE);
  return {
    runId: record.runId,
    game: record.game,
    status: record.status as RunStatus,
    view: system.getView(record.state),
  };
}

/**
 * One action on an active run: the new record, its status from the rules.
 * Throws `expired`, `finished`, or `illegal` with the rules' message.
 */
export function playRun(
  system: RunSystem,
  record: RunRecord,
  action: unknown,
  context?: RunContext,
  now = Date.now()
): RunRecord {
  if (outdatedRun(system, record)) throw new RunError('expired', EXPIRED_MESSAGE);
  if (record.status !== 'active') throw new RunError('finished', 'This run is over.');
  let state: unknown;
  try {
    state = system.handleAction(record.state, action, context);
  } catch (err) {
    throw new RunError('illegal', messageOf(err, 'Illegal action.'));
  }
  return {...record, state, status: system.status(state), updatedAt: now};
}

/** Gives up an active run, which counts as a death; a finished one stays as it is. */
export function abandonRun(record: RunRecord, now = Date.now()): RunRecord {
  return record.status === 'active' ? {...record, status: 'abandoned', updatedAt: now} : record;
}
