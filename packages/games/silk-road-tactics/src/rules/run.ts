/**
 * A Phase 1 run: a single fight (brief section 1). The run keeps the seed;
 * the view is the fight, which never contains it.
 */
import type {Hex} from '@canvas/engine/server';
import {ABILITIES} from './abilities';
import {chooseAiTurn} from './ai';
import type {SearchBudget} from './ai';
import {AI, PARTY} from './config';
import {
  RuleError,
  actingUnit,
  advance,
  applyTurn,
  cloneFight,
  createFight,
  refreshStats,
} from './fight';
import type {AbilityId, ActionTarget, FightState, HeroId, RunAction} from './types';

export interface RunState {
  seed: number;
  /** Bumped on every action; the view carries it (brief section 8). */
  version: number;
  fight: FightState;
}

export interface RunView {
  version: number;
  fight: FightState;
}

/**
 * A new run with the party chosen on the start menu (`{party}`; all three
 * heroes if none is given), its fight advanced to the player's first turn
 * (the enemy may move first).
 */
export function createRun(seed: number, setup?: unknown): RunState {
  const fight = createFight(seed, parseParty(setup));
  fight.events = [];
  advance(fight, (state, unit) => chooseAiTurn(state, unit, {left: AI.requestSimulations}));
  return {seed, version: 0, fight};
}

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
  return {seed: run.seed, version: run.version + 1, fight};
}

export function runView(run: RunState): RunView {
  // A run saved before a stat change shows, and previews with, today's stats.
  refreshStats(run.fight);
  return {version: run.version, fight: run.fight};
}

export function runStatus(run: RunState): 'active' | 'won' | 'lost' {
  return run.fight.phase === 'won' ? 'won' : run.fight.phase === 'lost' ? 'lost' : 'active';
}
