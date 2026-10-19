/**
 * A Phase 1 run: a single fight (brief section 1). The run keeps the seed;
 * the view is the fight, which never contains it.
 */
import type {Hex} from '@canvas/engine/server';
import {ABILITIES} from './abilities';
import {chooseAiTurn} from './ai';
import {RuleError, actingUnit, advance, applyTurn, cloneFight, createFight, deploy} from './fight';
import type {AbilityId, ActionTarget, FightState, RunAction} from './types';

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

export function createRun(seed: number): RunState {
  return {seed, version: 0, fight: createFight(seed)};
}

const isInt = (n: unknown): n is number => Number.isInteger(n) && Math.abs(n as number) < 1000;

function parseHex(raw: unknown): Hex {
  const h = raw as Hex | null;
  if (!h || typeof h !== 'object' || !isInt(h.q) || !isInt(h.r)) throw new RuleError('Malformed hex.');
  return {q: h.q, r: h.r};
}

/** Checks an action from the network and copies only the fields the rules read. */
export function parseAction(raw: unknown): RunAction {
  const a = raw as Record<string, unknown> | null;
  if (!a || typeof a !== 'object') throw new RuleError('Malformed action.');
  if (a.type === 'deploy') {
    if (!Array.isArray(a.placements) || a.placements.length > 10) throw new RuleError('Malformed placements.');
    return {
      type: 'deploy',
      placements: a.placements.map((p: {unitId?: unknown; hex?: unknown}) => {
        if (typeof p?.unitId !== 'string') throw new RuleError('Malformed placement.');
        return {unitId: p.unitId, hex: parseHex(p.hex)};
      }),
    };
  }
  if (a.type === 'turn') {
    const action = a.action as {ability?: unknown; target?: {hex?: unknown; to?: unknown}} | undefined;
    if (!action || typeof action.ability !== 'string' || !Object.hasOwn(ABILITIES, action.ability)) {
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
  if (action.type === 'deploy') {
    deploy(fight, action.placements);
  } else if (action.type === 'turn') {
    if (fight.phase !== 'fight') throw new RuleError('The fight is not in progress.');
    const unit = actingUnit(fight);
    if (!unit) throw new RuleError('It is not your turn.');
    const {type: _type, ...input} = action;
    applyTurn(fight, unit, input);
  }
  advance(fight, chooseAiTurn);
  return {seed: run.seed, version: run.version + 1, fight};
}

export function runView(run: RunState): RunView {
  return {version: run.version, fight: run.fight};
}

export function runStatus(run: RunState): 'active' | 'won' | 'lost' {
  return run.fight.phase === 'won' ? 'won' : run.fight.phase === 'lost' ? 'lost' : 'active';
}
