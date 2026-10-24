/**
 * A run: its stages (STAGES in config.ts) one after another, each a fight
 * against a bigger enemy band. Heroes who fall are gone for the run; the
 * survivors and the camel go on to the next stage. The run keeps the seed;
 * the view is the fight, which never contains it.
 */
import type {Hex} from '@canvas/engine/server';
import {ABILITIES} from './abilities';
import {chooseAiTurn} from './ai';
import {AI, CAMEL, PARTY, ROSTER, STAGES} from './config';
import {
  RuleError,
  actingUnit,
  advanceToDecision,
  applyTurn,
  cloneFight,
  createFight,
  refreshStats,
  seededRandom,
} from './fight';
import {shuffled} from './track';
import type {AbilityId, ActionTarget, FightState, HeroId, RunAction} from './types';

/**
 * The format of what a run saves. Bump it with any change to `RunState` or
 * `FightState` that a run saved before can't play on (a field added,
 * removed or reinterpreted): older runs are then ended rather than
 * patched (`runOutdated`), so the rules never handle an old shape.
 */
export const RUN_FORMAT = 4;

export interface RunState {
  /** `RUN_FORMAT` when the run was created; missing in runs from before it existed. */
  format: number;
  seed: number;
  /** Bumped on every action; the view carries it (brief section 8). */
  version: number;
  /** Which of STAGES the run is at. */
  stage: number;
  fight: FightState;
}

export interface RunView {
  version: number;
  /** Which stage of the run this is, from 0, of `stages`. */
  stage: number;
  stages: number;
  /**
   * The fight. While an AI unit's turn is due its `awaiting` is null: the
   * page has no unit to control.
   */
  fight: FightState;
  /** An AI unit's turn is due: the page asks for it (`continue`), one a request. */
  aiDue: boolean;
}

/**
 * A new run with the party chosen on the start menu (`{party}`; all three
 * heroes if none is given), its fight advanced to the first decision,
 * the player's or the AI's.
 */
export function createRun(seed: number, setup?: unknown): RunState {
  return {
    format: RUN_FORMAT,
    seed,
    version: 0,
    stage: 0,
    fight: stageFight(seed, 0, parseParty(setup)),
  };
}

/**
 * The enemy for a stage: its number of heroes, picked at random from the
 * run's seed, then its wolves.
 */
export function stageEnemies(seed: number, stage: number): HeroId[] {
  const {heroes, wolves} = STAGES[stage]!;
  const picked = shuffled(ROSTER, seededRandom(stageSeed(seed, stage) ^ 0x5bd1e995));
  return [...picked.slice(0, heroes), ...Array<HeroId>(wolves).fill('wolf')];
}

/** Each stage's map and start from its own seed; the first stage's is the run's. */
const stageSeed = (seed: number, stage: number) => (seed + stage * 0x9e3779b9) >>> 0;

/** A stage's fight, advanced to its first decision, the player's or the AI's. */
function stageFight(seed: number, stage: number, party: HeroId[]): FightState {
  const fight = createFight(stageSeed(seed, stage), party, stageEnemies(seed, stage));
  fight.events = [];
  advanceToDecision(fight);
  return fight;
}

/** The heroes still standing at the end of a fight, in party order. */
function survivors(fight: FightState): HeroId[] {
  return fight.units
    .filter((u) => u.side === 'player' && u.hero !== CAMEL && u.alive)
    .sort((a, b) => a.partyIndex - b.partyIndex)
    .map((u) => u.hero);
}

const lastStage = STAGES.length - 1;

/**
 * Checks a start menu's party from the network: one to three of the
 * roster's heroes, each at most once; none given, the default party.
 */
export function parseParty(setup: unknown): HeroId[] {
  const party = (setup as {party?: unknown} | null | undefined)?.party;
  if (party === undefined) return PARTY;
  if (
    !Array.isArray(party) ||
    party.length === 0 ||
    party.length > PARTY.length ||
    party.some((h, i) => !ROSTER.includes(h as HeroId) || party.indexOf(h) !== i)
  ) {
    throw new RuleError('Choose one to three different heroes.');
  }
  return party as HeroId[];
}

const isInt = (n: unknown): n is number => Number.isInteger(n) && Math.abs(n as number) < 1000;

function parseHex(raw: unknown): Hex {
  const h = raw as Hex | null;
  if (!h || typeof h !== 'object' || !isInt(h.q) || !isInt(h.r))
    throw new RuleError('Malformed hex.');
  return {q: h.q, r: h.r};
}

/** Checks an action from the network and copies only the fields the rules read. */
export function parseAction(raw: unknown): RunAction {
  const a = raw as Record<string, unknown> | null;
  if (!a || typeof a !== 'object') throw new RuleError('Malformed action.');
  if (a.type === 'next') return {type: 'next'};
  if (a.type === 'continue') return {type: 'continue'};
  if (a.type === 'turn') {
    const action = a.action as
      | {ability?: unknown; target?: {hex?: unknown; to?: unknown}}
      | undefined;
    if (
      !action ||
      typeof action.ability !== 'string' ||
      !Object.hasOwn(ABILITIES, action.ability)
    ) {
      throw new RuleError('Unknown ability.');
    }
    const out: RunAction = {type: 'turn', action: {ability: action.ability as AbilityId}};
    if (action.target !== undefined) {
      const target: ActionTarget = {};
      if (action.target.hex !== undefined) target.hex = parseHex(action.target.hex);
      if (action.target.to !== undefined) target.to = parseHex(action.target.to);
      out.action.target = target;
    }
    if (a.move !== undefined) {
      if (!Array.isArray(a.move) || a.move.length > 10) throw new RuleError('Malformed move.');
      out.move = a.move.map(parseHex);
    }
    return out;
  }
  throw new RuleError('Unknown action.');
}

/**
 * One action: the player's turn, or the AI's turn that is due
 * (`continue`), each a request of its own, so each AI turn has its own
 * work cap (AI.maxSimulations; owner, 2026-10-24); then the track runs on
 * to the next decision, either side's. Or, once a stage short of the last
 * is won, on to the next.
 */
export function handleRunAction(run: RunState, raw: unknown): RunState {
  const action = parseAction(raw);
  const {stage} = run;
  if (action.type === 'next') {
    if (run.fight.phase !== 'won' || stage >= lastStage)
      throw new RuleError('There is no next stage to go on to.');
    const fight = stageFight(run.seed, stage + 1, survivors(run.fight));
    return {...run, version: run.version + 1, stage: stage + 1, fight};
  }
  const fight = cloneFight(run.fight, true);
  refreshStats(fight);
  // What this action sets off, for the page to play back.
  fight.events = [];
  if (fight.phase !== 'fight') throw new RuleError('The fight is not in progress.');
  const unit = actingUnit(fight);
  if (action.type === 'continue') {
    if (unit?.controller !== 'ai') throw new RuleError('No AI turn is due.');
    applyTurn(fight, unit, chooseAiTurn(fight, unit, {left: AI.maxSimulations}));
  } else {
    if (unit?.controller !== 'human') throw new RuleError('It is not your turn.');
    const {type: _type, ...input} = action;
    applyTurn(fight, unit, input);
  }
  advanceToDecision(fight);
  return {...run, version: run.version + 1, fight};
}

/** Whether the fight waits on an AI unit's turn. */
function aiDue(fight: FightState): boolean {
  return actingUnit(fight)?.controller === 'ai';
}

export function runView(run: RunState): RunView {
  // A run started before the stats were re-tuned shows, and previews with, today's.
  refreshStats(run.fight);
  const due = aiDue(run.fight);
  return {
    version: run.version,
    stage: run.stage,
    stages: STAGES.length,
    fight: due ? {...run.fight, awaiting: null} : run.fight,
    aiDue: due,
  };
}

/** Won once the last stage is won; a stage before it, won, waits for `next`. */
export function runStatus(run: RunState): 'active' | 'won' | 'lost' {
  if (run.fight.phase === 'lost') return 'lost';
  return run.fight.phase === 'won' && run.stage >= lastStage ? 'won' : 'active';
}

/** Saved in another format than this version's (`RUN_FORMAT`): the platform ends it. */
export function runOutdated(run: RunState): boolean {
  return run.format !== RUN_FORMAT;
}
