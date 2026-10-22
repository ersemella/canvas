/**
 * A run: its fights (stages, STAGES in config.ts) one after another, each
 * against a bigger enemy band. Heroes who fall are gone for the run; the
 * survivors and the camel go on to the next fight. The run keeps the seed;
 * the view is the fight, which never contains it.
 */
import type {Hex} from '@canvas/engine/server';
import {ABILITIES} from './abilities';
import {chooseAiTurn} from './ai';
import type {SearchBudget} from './ai';
import {AI, CAMEL, PARTY, STAGES} from './config';
import {
  RuleError,
  actingUnit,
  advance,
  applyTurn,
  cloneFight,
  createFight,
  refreshStats,
  seededRandom,
} from './fight';
import {shuffled} from './track';
import type {AbilityId, ActionTarget, FightState, HeroId, RunAction} from './types';

export interface RunState {
  seed: number;
  /** Bumped on every action; the view carries it (brief section 8). */
  version: number;
  /** Which of STAGES the fight is; missing in a run saved before stages (the first). */
  stage?: number;
  fight: FightState;
}

export interface RunView {
  version: number;
  /** Which fight of the run this is, from 0, of `stages`. */
  stage: number;
  stages: number;
  fight: FightState;
}

/**
 * A new run with the party chosen on the start menu (`{party}`; all three
 * heroes if none is given), its fight advanced to the player's first turn
 * (the enemy may move first).
 */
export function createRun(seed: number, setup?: unknown): RunState {
  return {seed, version: 0, stage: 0, fight: stageFight(seed, 0, parseParty(setup))};
}

/**
 * The enemy for a stage: its number of heroes, picked at random from the
 * run's seed, then its wolves.
 */
export function stageEnemies(seed: number, stage: number): HeroId[] {
  const {heroes, wolves} = STAGES[stage]!;
  const picked = shuffled(PARTY, seededRandom(stageSeed(seed, stage) ^ 0x5bd1e995));
  return [...picked.slice(0, heroes), ...Array<HeroId>(wolves).fill('wolf')];
}

/** Each stage's map and start from its own seed; the first stage's is the run's. */
const stageSeed = (seed: number, stage: number) => (seed + stage * 0x9e3779b9) >>> 0;

/** A stage's fight, advanced to the player's first turn (the enemy may move first). */
function stageFight(seed: number, stage: number, party: HeroId[]): FightState {
  const fight = createFight(stageSeed(seed, stage), party, stageEnemies(seed, stage));
  fight.events = [];
  advance(fight, (state, unit) => chooseAiTurn(state, unit, {left: AI.requestSimulations}));
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

/** Checks a start menu's party from the network: one to all of the heroes, each at most once. */
export function parseParty(setup: unknown): HeroId[] {
  const party = (setup as {party?: unknown} | null | undefined)?.party;
  if (party === undefined) return PARTY;
  if (
    !Array.isArray(party) ||
    party.length === 0 ||
    party.length > PARTY.length ||
    party.some((h, i) => !PARTY.includes(h as HeroId) || party.indexOf(h) !== i)
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
    if (a.actFirst === true) out.actFirst = true;
    return out;
  }
  throw new RuleError('Unknown action.');
}

export function handleRunAction(run: RunState, raw: RunAction): RunState {
  const action = parseAction(raw);
  const stage = run.stage ?? 0;
  if (action.type === 'next') {
    if (run.fight.phase !== 'won' || stage >= lastStage)
      throw new RuleError('There is no next fight to go on to.');
    const fight = stageFight(run.seed, stage + 1, survivors(run.fight));
    return {seed: run.seed, version: run.version + 1, stage: stage + 1, fight};
  }
  const fight = cloneFight(run.fight, true);
  refreshStats(fight);
  // What this action sets off, for the page to play back.
  fight.events = [];
  if (fight.phase !== 'fight') throw new RuleError('The fight is not in progress.');
  const unit = actingUnit(fight);
  if (!unit) throw new RuleError('It is not your turn.');
  const {type: _type, ...input} = action;
  applyTurn(fight, unit, input);
  // The AI turns this action sets off share one search budget (AI.requestSimulations).
  const budget: SearchBudget = {left: AI.requestSimulations};
  advance(fight, (state, unit) => chooseAiTurn(state, unit, budget));
  return {seed: run.seed, version: run.version + 1, stage, fight};
}

export function runView(run: RunState): RunView {
  // A run saved before a stat change shows, and previews with, today's stats.
  refreshStats(run.fight);
  return {version: run.version, stage: run.stage ?? 0, stages: STAGES.length, fight: run.fight};
}

/** Won once the last stage's fight is won; a fight before it, won, waits for `next`. */
export function runStatus(run: RunState): 'active' | 'won' | 'lost' {
  if (run.fight.phase === 'lost') return 'lost';
  return run.fight.phase === 'won' && (run.stage ?? 0) >= lastStage ? 'won' : 'active';
}
