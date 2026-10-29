import {
  RunError,
  abandonRun,
  expireRun,
  outdatedRun,
  playRun,
  runResponse,
  startRun,
} from '@canvas/engine/server';
import type {RunRecord, RunResponse as AnyRunResponse} from '@canvas/engine/server';
import silkRoadRun from '@canvas/games-silk-road-run/run';
import type {DraftPick, HeroId, RunView, TurnInput} from '@canvas/games-silk-road-run';

/** What every answer about a Caravan run carries: the engine's type, with its view. */
export type RunResponse = AnyRunResponse<RunView>;

const GAME = 'silk-road-run';
/** The run, saved after every action: one a browser (docs/plans/client-side-runs.md, L3). */
const RUN_STORAGE = 'canvas:tactics:run';
/** Held by the one tab that plays the run (L3). */
const TAB_LOCK = 'canvas:tactics:tab';

/** The run when storage is blocked: it lasts for this page load only. */
let memory: RunRecord | null = null;

function load(): RunRecord | null {
  try {
    const saved = localStorage.getItem(RUN_STORAGE);
    if (saved) return JSON.parse(saved) as RunRecord;
  } catch {
    // storage blocked or the saved run unreadable: this page load's, if any
  }
  return memory;
}

function save(record: RunRecord): void {
  memory = record;
  try {
    localStorage.setItem(RUN_STORAGE, JSON.stringify(record));
  } catch {
    // storage blocked or full: the run won't survive a reload; play continues
  }
}

/** The saved run with this id, as the rules can still play it. */
function saved(runId: string): RunRecord {
  const record = load();
  if (!record || record.runId !== runId) throw new Error('No such run.');
  if (outdatedRun(silkRoadRun, record)) save(expireRun(record));
  return record;
}

export interface PlayRequest {
  id: number;
  record: RunRecord;
  action: unknown;
}
export type PlayAnswer = {id: number; record: RunRecord} | {id: number; error: string};

/**
 * Actions are played in `aiWorker.ts`, in order, so an AI turn's search
 * never holds up the page; where a module worker can't start, here, with
 * the AI's fixed, quick search.
 */
let worker: Worker | null | undefined;
let nextId = 0;
const pending = new Map<number, {resolve: (r: RunRecord) => void; reject: (e: Error) => void}>();

function startWorker(): Worker | null {
  try {
    const w = new Worker(new URL('./aiWorker.ts', import.meta.url), {type: 'module'});
    w.onmessage = (e: MessageEvent<PlayAnswer>) => {
      const answer = e.data;
      const waiting = pending.get(answer.id);
      pending.delete(answer.id);
      if ('error' in answer) waiting?.reject(new Error(answer.error));
      else waiting?.resolve(answer.record);
    };
    w.onerror = (e) => {
      e.preventDefault();
      for (const waiting of pending.values()) waiting.reject(new Error('Something went wrong.'));
      pending.clear();
    };
    return w;
  } catch {
    return null;
  }
}

function play(record: RunRecord, action: unknown): Promise<RunRecord> {
  if (worker === undefined) worker = startWorker();
  if (!worker) {
    // No clock, so the AI keeps to its fixed cap (a few ms): searching for
    // AI.browser.thinkMs here would stop the page that long every AI turn.
    try {
      return Promise.resolve(playRun(silkRoadRun, record, action));
    } catch (err) {
      return Promise.reject(err instanceof RunError ? err : new Error('Something went wrong.'));
    }
  }
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, {resolve, reject});
    worker!.postMessage({id, record, action} satisfies PlayRequest);
  });
}

async function act(runId: string, action: unknown): Promise<RunResponse> {
  const record = await play(saved(runId), action);
  save(record);
  return runResponse(silkRoadRun, record);
}

/** A run id, as the Worker made them: letters and digits. */
function randomId(): string {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => alphabet[b % 36]).join('');
}

/**
 * The run, played in this browser (docs/plans/client-side-runs.md): the
 * methods and answers the page had from the Worker's `/runs`, each
 * a promise, with the rules' message for a refused action.
 */
export const localRuns = {
  /** The active run, if any; one saved by an older version of the rules ends, with a message. */
  active: async (): Promise<RunResponse | null> => {
    const record = load();
    if (!record || record.status !== 'active') return null;
    if (outdatedRun(silkRoadRun, record)) save(expireRun(record));
    // Throws `expired` for an outdated one, with its message.
    return runResponse(silkRoadRun, record);
  },
  /** A run with the chosen party, or the test stage (test-stage.json in the game's package). */
  start: async (setup: {party: HeroId[]} | {test: true}): Promise<RunResponse> => {
    const seed = crypto.getRandomValues(new Uint32Array(1))[0]!;
    const record = startRun(silkRoadRun, {runId: randomId(), game: GAME, seed, setup});
    // Starting a run abandons the active one, which counts as a death.
    const before = load();
    if (before) save(abandonRun(before));
    save(record);
    return runResponse(silkRoadRun, record);
  },
  turn: (runId: string, body: TurnInput) => act(runId, {...body, type: 'turn'}),
  /** One of the party's picks in the caravanserai's draft, kept for good. */
  draft: (runId: string, pick: DraftPick) => act(runId, {type: 'draft', pick}),
  /** The AI's turn that is due (`view.aiDue`), as deep as this device gets in its time. */
  continue: (runId: string) => act(runId, {type: 'continue'}),
  /** On to the next stage, every pick of the caravanserai's draft (`view.draft`) made. */
  next: (runId: string) => act(runId, {type: 'next'}),
};

/**
 * This tab's claim on the run (L3, owner, 2026-10-25): only one tab plays
 * it. `held` resolves once this tab has it, at once if no other tab does,
 * otherwise when the one that has it closes; `elsewhere` resolves first in
 * that case. Without Web Locks every tab may play.
 */
let claim: {held: Promise<void>; elsewhere: Promise<void>} | null = null;
export function claimTab(): {held: Promise<void>; elsewhere: Promise<void>} {
  if (claim) return claim;
  const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined;
  let elsewhere!: () => void;
  const other = new Promise<void>((resolve) => (elsewhere = resolve));
  const forever = new Promise<void>(() => {});
  const held = new Promise<void>((resolve) => {
    if (!locks) return resolve();
    void locks.request(TAB_LOCK, {ifAvailable: true}, (lock) => {
      if (lock) {
        resolve();
        return forever;
      }
      elsewhere();
      void locks.request(TAB_LOCK, () => {
        resolve();
        return forever;
      });
      return undefined;
    });
  });
  claim = {held, elsewhere: other};
  return claim;
}
