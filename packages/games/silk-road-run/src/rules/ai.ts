/**
 * Deterministic selective lookahead: rank actions with the preview heuristic,
 * then search actual timeline decisions with budgeted alpha-beta minimax.
 */
import {hexDistance, hexKey} from '@canvas/engine/server';
import {AI, CAMEL, HEROES} from './config';
import {
  hostile,
  isImmobilized,
  isRanged,
  isStunned,
  movementCap,
  reachableHexes,
  roadDistance,
  unitAt,
} from './board';
import {abilitiesOf, unusableReason} from './abilities';
import {allowedTargets} from './choices';
import {threatDamage, threatsTo} from './threat';
import type {Threat} from './threat';
import {RuleError, advanceToDecision, applyTurn, chargeOf, cloneFight, mapOf} from './fight';
import {actionCost as cardCost} from './track';
import {camelOf} from './resolve';
import {MAPS} from './map';
import type {FightState, Side, TurnInput, Unit} from './types';

export interface ScoredOption {
  input: TurnInput;
  score: number;
  /** The fight right after the option. */
  after: FightState;
}

/**
 * What one of `u`'s turns is worth, in damage: its hit (its power, at
 * least 1, since hail's worth is its control), or for the camel a step
 * toward the exit.
 */
function turnValue(u: Unit): number {
  return u.hero === CAMEL ? AI.perCamelHex : Math.max(1, u.power);
}

/** A unit whose attack reaches beyond its neighbours (the bow, hail). */
function attacksFromAfar(u: Unit): boolean {
  return isRanged(u) || HEROES[u.hero].abilities.includes('hail');
}

/**
 * What `u`'s statuses cost its side, in damage: Stunned a turn lost,
 * Immobilized the share of a turn it loses (all of the camel's, which only
 * walks).
 */
function statusPoints(u: Unit): number {
  if (isStunned(u)) return turnValue(u) * AI.stunnedShare;
  if (!isImmobilized(u)) return 0;
  if (u.hero === CAMEL) return turnValue(u);
  const share = attacksFromAfar(u) ? AI.immobilizedShare.ranged : AI.immobilizedShare.melee;
  return turnValue(u) * share;
}

/**
 * Spaces from the camel to the exit along its road, so the enemy values
 * holding it back; 0 without a living camel.
 */
function camelDistance(state: FightState): number {
  const camel = camelOf(state);
  if (!camel?.alive || !camel.hex) return 0;
  const road = roadDistance(mapOf(state), camel.hex);
  if (Number.isFinite(road)) return road;
  let nearest = Infinity;
  for (const e of MAPS[state.mapId]!.exits) nearest = Math.min(nearest, hexDistance(camel.hex, e));
  return nearest;
}

/**
 * What the camel's walk is worth to `side` (camel.md): AI.perCamelHex for
 * each space it is from the exit, for the enemy; against the player.
 */
function camelProgress(state: FightState, side: Side): number {
  if (!camelOf(state)) return 0;
  return (side === 'enemy' ? 1 : -1) * camelDistance(state) * AI.perCamelHex;
}

/**
 * What the delayed volleys in the air are worth to `side`: each the hit
 * it will deal whoever stands on its space now, only `AI.volleyDodgeShare`
 * of it if that unit can walk out before it lands.
 */
function volleyPoints(state: FightState, side: Side): number {
  let score = 0;
  for (const v of state.volleys ?? []) {
    const source = state.units.find((u) => u.id === v.source);
    const target = unitAt(state, v.hex);
    if (!source?.alive || source.slot === null || !target) continue;
    const hit = Math.min(source.power, target.hp);
    const dodges =
      target.slot !== null &&
      target.slot < source.slot &&
      !isStunned(target) &&
      !isImmobilized(target);
    const value = dodges
      ? hit * AI.volleyDodgeShare
      : hit * (target.hero === CAMEL ? AI.camelHealthWeight : 1) +
        (hit >= target.hp && target.hero !== CAMEL ? AI.kill : 0);
    score += (target.side === side ? -1 : 1) * value;
  }
  return score;
}

/** Scores the fight after a turn by `actor`, from its side's point of view. */
export function scoreOutcome(
  before: FightState,
  after: FightState,
  actor: Unit,
  threats: Threat[] = threatsTo(before, mapOf(before), actor)
): number {
  let score = 0;
  for (const b of before.units) {
    if (!b.alive) continue;
    const a = after.units.find((u) => u.id === b.id)!;
    const lost = b.hp - a.hp;
    const statusDelta = statusPoints(a) - statusPoints(b);
    if (hostile(b, actor)) {
      score += lost * (b.hero === CAMEL ? AI.camelHealthWeight : 1) + statusDelta;
      if (!a.alive) score += AI.kill;
    } else {
      // Friendly fire only when clearly worth it.
      score -= lost * AI.friendlyDamageFactor + statusDelta;
    }
  }
  // The camel's walk, whoever moved it; the fight's end outweighs everything
  // (a dead camel is no longer anywhere, so its walk alone would miss it).
  if (after.phase !== 'fight')
    score += ((after.phase === 'won') === (actor.side === 'player') ? 1 : -1) * AI.victory;
  else {
    score += camelProgress(after, actor.side) - camelProgress(before, actor.side);
    score += volleyPoints(after, actor.side) - volleyPoints(before, actor.side);
  }
  const me = after.units.find((u) => u.id === actor.id)!;
  // What enemies could do to it before its next turn (one step of lookahead),
  // weighed by the share of its health it would lose and by the hero's caution.
  const caution = AI.threatFactor * AI.caution[me.hero];
  if (caution > 0 && me.alive) {
    const threat = threatDamage(threats, after, me);
    if (threat > 0) {
      score -= Math.min(threat, me.hp) * Math.min(1, threat / me.hp) * caution;
      if (threat >= me.hp) score -= AI.kill * caution;
    }
  }
  score -= quarryGap(after, me, huntsTemee(before, actor)) * AI.perHexFromEnemy;
  return score;
}

/** What a turn's charge costs its user: the share of a turn it waits, in damage. */
function chargeCost(actor: Unit, input: TurnInput): number {
  return (chargeOf(input.action.ability) / cardCost(actor)) * turnValue(actor);
}

/**
 * Every option for `unit` this turn, scored, up to `limit` simulations:
 * its abilities where it stands, then its moves, nearest first. A ground
 * target is only tried where it would affect a unit.
 */
export function scoreOptions(
  state: FightState,
  unit: Unit,
  limit = Infinity,
  budget?: SearchBudget,
  includeThreats = true
): ScoredOption[] {
  if (limit <= 0 || (budget && budget.left <= 0)) return [];
  let simulations = 0;
  const map = mapOf(state);
  const threats =
    includeThreats && AI.threatFactor * AI.caution[unit.hero] > 0
      ? threatsTo(state, map, unit)
      : [];
  const inputs: TurnInput[] = [];
  for (const def of abilitiesOf(unit)) {
    if (unusableReason(unit, def)) continue;
    for (const target of allowedTargets(state, map, unit, def)) {
      if (
        def.radius !== undefined &&
        !state.units.some((u) => u.alive && u.hex && hexDistance(u.hex, target.hex!) <= def.radius!)
      )
        continue;
      inputs.push({action: {ability: def.id, target}});
    }
  }
  for (const reach of reachableHexes(state, map, unit).sort(
    (a, b) => a.path.length - b.path.length
  ))
    if (reach.path.length > 0) inputs.push({move: reach.path, action: {ability: 'hold'}});
  const out: ScoredOption[] = [];
  const tried = new Set<string>();
  for (const input of inputs) {
    const key = `${input.action.ability}:${input.action.target?.hex ? hexKey(input.action.target.hex) : ''}:${input.action.target?.to ? hexKey(input.action.target.to) : ''}:${input.move?.map(hexKey).join('/') ?? ''}`;
    if (tried.has(key)) continue;
    tried.add(key);
    if (simulations >= limit || (budget && budget.left <= 0)) return out;
    simulations++;
    if (budget) budget.left--;
    const after = simulate(state, unit.id, input, true);
    if (!after) continue;
    out.push({
      input,
      score: scoreOutcome(state, after, unit, threats) - chargeCost(unit, input),
      after,
    });
  }
  return out;
}

/** The fight after `input` for unit `unitId`, or null if illegal. */
export function simulate(
  state: FightState,
  unitId: string,
  input: TurnInput,
  trustTarget = false
): FightState | null {
  const sim = cloneFight(state);
  const su = sim.units.find((u) => u.id === unitId)!;
  try {
    applyTurn(sim, su, input, trustTarget);
  } catch (e) {
    if (e instanceof RuleError) return null;
    throw e;
  }
  return sim;
}

/** Work left for all AI turns in one request: actions and automatic cards. */
export interface SearchBudget {
  left: number;
}

/** Optional diagnostics; no clocks, randomness or persistent caches affect decisions. */
export interface SearchStats {
  completedDepth: number;
  cutoffs: number;
  work: number;
  value?: number;
}

interface SearchNode {
  state: FightState;
  actor: Unit | undefined;
  options?: ScoredOption[];
  children: Map<ScoredOption, SearchNode>;
}

const exhausted = Symbol('AI search budget exhausted');

/** A single, symmetric team evaluation, always from the root side's perspective. */
export function evaluatePosition(state: FightState, side: Side): number {
  // Over: an exit reached or the camel dead decides it, whoever is standing.
  if (state.phase !== 'fight')
    return (state.phase === 'won') === (side === 'player') ? AI.victory : -AI.victory;
  const own = state.units.some((u) => u.alive && u.side === side);
  const other = state.units.some((u) => u.alive && u.side !== side);
  if (!own || !other) return own ? AI.victory : other ? -AI.victory : 0;
  let score = camelProgress(state, side) + volleyPoints(state, side);
  for (const u of state.units) {
    if (!u.alive) continue;
    // The camel's death ends the fight, so it has no kill value: its health is weighed instead.
    const value = u.hero === CAMEL ? u.hp * AI.camelHealthWeight : u.hp + AI.kill - statusPoints(u);
    score += (u.side === side ? 1 : -1) * value;
  }
  return score;
}

/** Keep a small heuristic shortlist; equal scores retain the enumeration order. */
function shortlist(options: ScoredOption[]): ScoredOption[] {
  return options.sort((a, b) => b.score - a.score).slice(0, AI.searchWidth);
}

/**
 * Selective minimax: heuristic screening limits breadth, alpha-beta skips
 * successor expansion, and iterative deepening only commits complete depths.
 * `prune=false` is an exhaustive reference over the same selective tree.
 * A depth override supports comparisons at a fixed completed horizon.
 */
export function chooseAiTurn(
  state: FightState,
  unit: Unit,
  budget: SearchBudget = {left: AI.requestSimulations},
  stats?: SearchStats,
  settings: {prune?: boolean; depth?: number} = {}
): TurnInput {
  const initial = Math.max(0, budget.left);
  const local: SearchBudget = {left: Math.min(AI.maxSimulations, initial)};
  if (stats) {
    Object.assign(stats, {completedDepth: 0, cutoffs: 0, work: 0});
    delete stats.value;
  }
  const spend = () => {
    if (local.left <= 0) throw exhausted;
    local.left--;
  };
  const childOf = (node: SearchNode, option: ScoredOption): SearchNode => {
    let child = node.children.get(option);
    if (!child) {
      // Advance lazily: a cutoff never runs this branch's timeline or
      // generates its replies. Cached copies are private to this turn.
      const state = cloneFight(option.after);
      const actor = advanceToDecision(state, spend);
      child = {state, actor, children: new Map()};
      node.children.set(option, child);
    }
    return child;
  };
  const search = (node: SearchNode, depth: number, alpha: number, beta: number): number => {
    // A fight already over: sooner is worth more, a win taken now above one
    // a turn later, a loss now below a later one.
    if (node.state.phase !== 'fight')
      return evaluatePosition(node.state, unit.side) * (1 + depth / 100);
    if (depth === 0 || !node.actor) return evaluatePosition(node.state, unit.side);
    if (!node.options) {
      if (local.left <= 0) throw exhausted;
      const allowance = Math.min(AI.replySimulations, local.left);
      // Replies use the immediate heuristic: their actual consequences
      // are searched, so rebuilding a speculative threat map here is wasteful.
      node.options = shortlist(scoreOptions(node.state, node.actor, allowance, local, false));
      // A partially screened node must not turn an unfinished depth into
      // an apparently complete one when the budget ran out mid-screen.
      if (local.left <= 0 || node.options.length === 0) throw exhausted;
    }
    const maximize = node.actor.side === unit.side;
    let value = maximize ? -Infinity : Infinity;
    for (const option of node.options) {
      const cost = actionCost(node.state, node.actor, option);
      const adjustment = maximize ? -cost : cost;
      const next =
        search(childOf(node, option), depth - 1, alpha - adjustment, beta - adjustment) +
        adjustment;
      value = maximize ? Math.max(value, next) : Math.min(value, next);
      if (maximize) alpha = Math.max(alpha, value);
      else beta = Math.min(beta, value);
      if (settings.prune !== false && alpha >= beta) {
        if (stats) stats.cutoffs++;
        break;
      }
    }
    return value;
  };
  let completedInput: TurnInput = {action: {ability: 'hold'}};
  try {
    if (local.left <= 0) return {action: {ability: 'hold'}};
    // Reserve most work for actual replies, rather than spending it all
    // on the root. Small remaining budgets retain a useful greedy turn.
    const rootLimit = Math.min(AI.rootSimulations, local.left);
    const options = shortlist(scoreOptions(state, unit, rootLimit, local));
    let best = options[0]?.input ?? {action: {ability: 'hold'} as const};
    completedInput = best;
    if (!options.length) return best;
    if (stats) stats.completedDepth = 1;
    const root: SearchNode = {state, actor: unit, options, children: new Map()};
    for (let depth = 2; depth <= (settings.depth ?? AI.searchDepth); depth++) {
      let winner = options[0]!;
      let value = -Infinity;
      const values = new Map<ScoredOption, number>();
      for (const option of options) {
        const cost = actionCost(state, unit, option);
        const next = search(childOf(root, option), depth - 1, value + cost, Infinity) - cost;
        values.set(option, next);
        if (next > value) {
          value = next;
          winner = option;
        }
      }
      // The next, deeper iteration tries this one's best first (stable on
      // ties), so alpha-beta has a strong bound early and cuts off more.
      // A pruned option's value is only an upper bound, which still sorts it
      // below the winner it lost to.
      options.sort((a, b) => values.get(b)! - values.get(a)!);
      best = winner.input;
      completedInput = best;
      if (stats) {
        stats.completedDepth = depth;
        stats.value = value;
      }
    }
    return best;
  } catch (e) {
    if (e !== exhausted) throw e;
    // Updated only after every root candidate has completed the depth.
    return completedInput;
  } finally {
    const used = Math.min(AI.maxSimulations, initial) - local.left;
    budget.left = initial - used;
    if (stats) stats.work = used;
  }
}

/**
 * Chooses the AI turns one request sets off, sharing `budget` among them:
 * each gets an equal share of what is left among the AI units due before
 * the next human turn, at most AI.maxSimulations and, once it is spent, a
 * greedy AI.turnFloorSimulations rather than a Hold. Taking the full cap in
 * turn order left the third unit of a stage-one band (a hero, two wolves)
 * nothing, so it Held where it stood, on 1 in 20 of the wolves' turns.
 */
export function requestChooser(budget: SearchBudget): (state: FightState, unit: Unit) => TurnInput {
  return (state, unit) => {
    let human = Infinity;
    for (const u of state.units)
      if (u.alive && u.controller === 'human' && u.slot !== null) human = Math.min(human, u.slot);
    const due = state.units.filter(
      (u) =>
        u !== unit &&
        u.alive &&
        u.controller === 'ai' &&
        !HEROES[u.hero].walksRoad &&
        u.slot !== null &&
        u.slot <= human
    ).length;
    const share: SearchBudget = {
      left: Math.max(AI.turnFloorSimulations, Math.floor(budget.left / (due + 1))),
    };
    const given = share.left;
    const input = chooseAiTurn(state, unit, share);
    budget.left = Math.max(0, budget.left - (given - share.left));
    return input;
  };
}

/**
 * Reward progress toward combat, as a cost (negative for progress), plus
 * the turn's charge (`chargeCost`). Progress belongs to the acting team:
 * subtracting both teams' absolute distances in a static evaluation would
 * cancel out in a duel and make Holding preferable.
 */
function actionCost(before: FightState, unit: Unit, option: ScoredOption): number {
  const hunting = huntsTemee(before, before.units.find((u) => u.id === unit.id)!);
  const gap = (state: FightState) =>
    quarryGap(state, state.units.find((u) => u.id === unit.id)!, hunting);
  return -(gap(before) - gap(option.after)) * AI.perHexFromEnemy + chargeCost(unit, option.input);
}

/**
 * Whether `me`, an enemy unit, hunts Temee this turn: once no hero is
 * within a walk and a hit (its move cap plus one), since Temee's death wins
 * the fight (camel.md, 18.3). Hunting it past heroes in reach left the
 * enemy cut down on the way. Decided where the turn starts, so a move that
 * brings a hero into reach doesn't count as closing in on it.
 */
function huntsTemee(state: FightState, me: Unit): boolean {
  if (me.side !== 'enemy' || !me.hex || !camelOf(state)?.alive) return false;
  const reach = movementCap(me) + 1;
  return !state.units.some(
    (e) =>
      e.alive && e.hex && hostile(e, me) && e.hero !== CAMEL && hexDistance(me.hex!, e.hex) <= reach
  );
}

/**
 * Spaces from `me` to what it closes in on: Temee when it hunts it
 * (`huntsTemee`), otherwise the nearest hostile unit. 0 for the camel,
 * which walks to the exit (its progress is weighed apart), or with nothing
 * to close in on.
 */
function quarryGap(state: FightState, me: Unit, hunting: boolean): number {
  if (!me.alive || !me.hex || me.hero === CAMEL) return 0;
  const camel = hunting ? camelOf(state) : undefined;
  if (camel?.alive && camel.hex) return hexDistance(me.hex, camel.hex);
  let nearest = Infinity;
  for (const e of state.units) {
    if (e.alive && e.hex && hostile(e, me)) nearest = Math.min(nearest, hexDistance(me.hex, e.hex));
  }
  return Number.isFinite(nearest) ? nearest : 0;
}
