/**
 * Deterministic selective lookahead: rank actions with the preview heuristic,
 * then search actual timeline decisions with budgeted alpha-beta minimax.
 * Preview charges and faithful successors are kept separate.
 */
import {hexDistance, hexEquals, hexKey} from '@canvas/engine/server';
import {ABILITY, AI, RULES, movementRules} from './config';
import {
  hostile,
  isFlanked,
  isRanged,
  obscured,
  reachableHexes,
  statusSlotsLeft,
  statusValue,
} from './board';
import {ABILITIES, abilitiesOf, unusableReason} from './abilities';
import {slotsForward, turnCost} from './track';
import {obeysTaunt, tauntBinds, taunterOf} from './taunt';
import {threatDamage, threatsTo} from './threat';
import type {Threat} from './threat';
import {RuleError, advanceToDecision, applyTurn, cloneFight, mapOf, turnInputCost} from './fight';
import {enterHex, hailDamage, throughDefence} from './resolve';
import {tileAt} from './map';
import type {AbilityDef} from './abilities';
import type {Hex} from '@canvas/engine/server';
import type {FightState, Side, TurnInput, Unit} from './types';

export interface ScoredOption {
  input: TurnInput;
  score: number;
  /** The fight right after the option (a charged ability resolved as if now). */
  after: FightState;
  /** Faithful successor: charges are still waiting on the timeline. */
  position: FightState;
}

/**
 * Status points for scoring: Slowed per point, Immobilized per slot,
 * Vulnerable per %, Crushed per point of damage it has left to deal (after
 * defence), and Taunted per slot.
 */
function statusPoints(u: Unit, slot: number): number {
  return (
    AI.perSlowed * statusValue(u, 'slowed') +
    AI.perImmobilizedSlot * statusSlotsLeft(u, 'immobilized', slot) +
    AI.perVulnerablePercent * statusValue(u, 'vulnerable') +
    (AI.perCrushDamage *
      statusValue(u, 'crushed') *
      statusSlotsLeft(u, 'crushed', slot) *
      RULES.defenceConstant) /
      (u.defence + RULES.defenceConstant) +
    AI.perTauntedSlot * statusSlotsLeft(u, 'taunted', slot)
  );
}

/** What scoring compares against, per living unit: computed once per AI turn, not per option. */
type Baseline = Map<string, {points: number; flanked: boolean}>;

function baselineOf(state: FightState): Baseline {
  return new Map(
    state.units
      .filter((u) => u.alive)
      .map((u) => [
        u.id,
        {points: statusPoints(u, state.currentSlot), flanked: isFlanked(state, u)},
      ])
  );
}

/** Scores the fight after a turn by `actor`, from its side's point of view. */
export function scoreOutcome(
  before: FightState,
  after: FightState,
  actor: Unit,
  baseline = baselineOf(before),
  threats: Threat[] = threatsTo(before, mapOf(before), actor)
): number {
  let score = 0;
  for (const b of before.units) {
    if (!b.alive) continue;
    const a = after.units.find((u) => u.id === b.id)!;
    const base = baseline.get(b.id)!;
    const lost = b.hp - a.hp;
    const statusDelta = statusPoints(a, before.currentSlot) - base.points;
    if (hostile(b, actor)) {
      // Healing an enemy counts against the turn, as damage counts for it.
      score += lost + statusDelta;
      if (!a.alive) score += AI.kill;
      if (lost > 0 && base.flanked) score += AI.flankedTarget;
    } else {
      // Healing counts as damage; friendly fire only when clearly worth it.
      score += lost > 0 ? -lost * AI.friendlyDamageFactor : -lost;
      score -= statusDelta;
      if (base.flanked && a.alive && !isFlanked(after, a)) score += AI.breaksAllyFlank;
    }
  }
  const me = after.units.find((u) => u.id === actor.id)!;
  if (me.slot !== null) score -= (me.slot - before.currentSlot) * AI.perSlotMoved;
  // Ending on quicksand costs its damage every slot until the next turn, at least.
  if (me.alive && me.hex && me.slot !== null && tileAt(mapOf(after), me.hex) === 'hazard') {
    const slots = me.slot - before.currentSlot;
    score -= throughDefence(after, me, slots * RULES.hazardDamage) * AI.friendlyDamageFactor;
  }
  // So does ending on hail.
  const hail =
    me.alive && me.hex ? after.effects.find((e) => hexEquals(e.hex, me.hex!)) : undefined;
  if (hail) score -= hailDamage(after, me, hail) * AI.friendlyDamageFactor;
  // What enemies could do to it within its next turn (one step of lookahead),
  // weighed by the share of its health it would lose and by the hero's caution.
  const caution = AI.threatFactor * AI.caution[me.hero];
  if (caution > 0 && me.alive) {
    const threat = threatDamage(threats, after, mapOf(after), me, before.currentSlot);
    if (threat > 0) {
      score -= Math.min(threat, me.hp) * Math.min(1, threat / me.hp) * caution;
      if (threat >= me.hp) score -= AI.kill * caution;
    }
  }
  if (me.hex) {
    const gaps = after.units
      .filter((u) => u.alive && u.hex && hostile(u, me))
      .map((u) => hexDistance(u.hex!, me.hex!));
    if (gaps.length > 0) score -= Math.min(...gaps) * AI.perHexFromEnemy;
  }
  return score;
}

/** What fog centred on `center` is worth to `actor`'s side: units it newly Obscures (see `AI.fogShield`). */
function fogValue(state: FightState, actor: Unit, center: Hex): number {
  const map = mapOf(state);
  const living = state.units.filter((u) => u.alive && u.hex);
  let value = 0;
  for (const u of living) {
    if (hexDistance(u.hex!, center) > ABILITY.fog.radius || obscured(state, map, u.hex!)) continue;
    const side = hostile(u, actor) ? -1 : 1;
    if (living.some((o) => hostile(o, u) && isRanged(o))) value += (side * AI.fogShield) / u.maxHp;
    if (isRanged(u)) value -= side * AI.fogBlind;
  }
  return value;
}

/**
 * The area of a ground-targeted ability (hail, Volley, Freeze), whose
 * effect doesn't depend on where the user stands; undefined for others.
 */
function groundRadius(def: AbilityDef): number | undefined {
  return {
    hail: 0,
    volley: ABILITY.volley.radius,
    freeze: ABILITY.freeze.radius,
    fog: ABILITY.fog.radius,
  }[def.id as string];
}

/**
 * Every option for `unit` this turn (moving first), scored, up to `limit`
 * simulations (nearest moves first). A ground target is only tried where
 * it would affect a unit, and only from the cheapest hex that reaches it
 * (the outcome doesn't depend on the hex).
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
  const baseline = baselineOf(state);
  const map = mapOf(state);
  const threats =
    includeThreats && AI.threatFactor * AI.caution[unit.hero] > 0
      ? threatsTo(state, map, unit)
      : [];
  const out: ScoredOption[] = [];
  const groundTried = new Set<string>();
  // A binding taunt rules out every option that doesn't affect the taunter.
  const taunter = taunterOf(state, unit);
  const bound = taunter !== undefined && tauntBinds(state, map, unit, taunter);
  const reaches = reachableHexes(state, map, unit).sort((a, b) => a.path.length - b.path.length);
  for (const reach of reaches) {
    // Where the unit stands after this move, to list targets from there.
    const moved = cloneFight(state);
    const mu = moved.units.find((u) => u.id === unit.id)!;
    for (const h of reach.path)
      if (mu.alive) enterHex({state: moved, map, slot: state.currentSlot}, mu, h);
    if (!mu.alive) continue;

    for (const def of abilitiesOf(unit)) {
      if (unusableReason(mu, def)) continue;
      if (movementRules(state).separateMovement && reach.path.length > 0 && def.id !== 'hold')
        continue;
      const radius = groundRadius(def);
      for (const target of def.targets(moved, map, mu, mu.hex!)) {
        if (bound && !obeysTaunt(map, def, mu.hex!, target, taunter)) continue;
        if (radius !== undefined) {
          const key = `${def.id}:${hexKey(target.hex!)}`;
          if (groundTried.has(key)) continue;
          if (
            !moved.units.some((u) => u.alive && u.hex && hexDistance(u.hex, target.hex!) <= radius)
          )
            continue;
          groundTried.add(key);
        }
        const input: TurnInput = {action: {ability: def.id, target}};
        if (reach.path.length > 0) input.move = reach.path;
        if (simulations >= limit || (budget && budget.left <= 0)) return out;
        simulations++;
        if (budget) budget.left--;
        const position = simulate(state, unit.id, input, true, false);
        if (!position) continue;
        const charged = position.units.find((u) => u.id === unit.id)!.charging;
        // The preview is only for ordering. Never search through a charge
        // that has already dealt its damage but is still on the timeline.
        let after = position;
        if (charged) {
          if (budget && budget.left <= 0) return out;
          if (budget) budget.left--;
          after = cloneFight(position);
          resolvePreviewCharge(after, unit.id);
        }
        let score = scoreOutcome(state, after, unit, baseline, threats);
        if (def.id === 'fog') score += fogValue(state, unit, target.hex!);
        if (
          def.id === 'hold' &&
          !(movementRules(state).separateMovement && reach.path.length > 0)
        ) {
          // Price the Hold's time as AI.holdScoringCost (see config.ts).
          const hexes = reach.path.length;
          const extra =
            slotsForward(turnCost(AI.holdScoringCost, hexes), unit.speed) -
            slotsForward(turnCost(def.cost, hexes), unit.speed);
          score -= Math.max(0, extra) * AI.perSlotMoved;
        }
        out.push({input, score, after, position});
      }
    }
  }
  return out;
}

/**
 * The fight after `input` for unit `unitId`, or null if illegal. A charged
 * ability is resolved immediately, assuming its targets don't move (brief
 * section 6), so its effect can be scored and previewed. Pass
 * `resolveCharge=false` for a faithful successor used by timeline search.
 */
export function simulate(
  state: FightState,
  unitId: string,
  input: TurnInput,
  trustTarget = false,
  resolveCharge = true
): FightState | null {
  const sim = cloneFight(state);
  const su = sim.units.find((u) => u.id === unitId)!;
  try {
    applyTurn(sim, su, input, trustTarget);
  } catch (e) {
    if (e instanceof RuleError) return null;
    throw e;
  }
  if (resolveCharge) resolvePreviewCharge(sim, unitId);
  return sim;
}

function resolvePreviewCharge(state: FightState, unitId: string): void {
  const unit = state.units.find((u) => u.id === unitId)!;
  if (!unit.charging) return;
  ABILITIES[unit.charging.ability].resolve(
    {state, map: mapOf(state), slot: state.currentSlot},
    unit,
    {hex: unit.charging.target}
  );
}

/** Work left for all AI turns in one request: actions, charge previews and automatic cards. */
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
  const own = state.units.some((u) => u.alive && u.side === side);
  const other = state.units.some((u) => u.alive && u.side !== side);
  if (!own || !other) return own ? AI.victory : other ? -AI.victory : 0;
  const map = mapOf(state);
  let score = 0;
  for (const u of state.units) {
    if (!u.alive) continue;
    let value = u.hp + AI.kill - statusPoints(u, state.currentSlot);
    if (u.hex) {
      let rangedEnemy = false;
      for (const e of state.units) {
        if (!e.alive || !e.hex || !hostile(e, u)) continue;
        rangedEnemy ||= isRanged(e);
      }
      if (obscured(state, map, u.hex)) {
        if (rangedEnemy) value += AI.fogShield / u.maxHp;
        if (isRanged(u)) value -= AI.fogBlind;
      }
    }
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
      const state = cloneFight(option.position);
      const actor = advanceToDecision(state, spend);
      child = {state, actor, children: new Map()};
      node.children.set(option, child);
    }
    return child;
  };
  const search = (node: SearchNode, depth: number, alpha: number, beta: number): number => {
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
      for (const option of options) {
        const cost = actionCost(state, unit, option);
        const next = search(childOf(root, option), depth - 1, value + cost, Infinity) - cost;
        if (next > value) {
          value = next;
          winner = option;
        }
      }
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
 * Price time and reward progress toward combat. Progress belongs to the
 * acting team: subtracting both teams' absolute distances in a static
 * evaluation would cancel out in a duel and make Holding preferable.
 */
function actionCost(before: FightState, unit: Unit, option: ScoredOption): number {
  const input = option.input;
  const hexes = input.move?.length ?? 0;
  const cost =
    input.action.ability === 'hold' && !(movementRules(before).separateMovement && hexes > 0)
      ? turnCost(AI.holdScoringCost, hexes)
      : turnInputCost(before, input);
  const gap = (state: FightState): number => {
    const me = state.units.find((u) => u.id === unit.id)!;
    if (!me.alive || !me.hex) return 0;
    let nearest = Infinity;
    for (const e of state.units) {
      if (e.alive && e.hex && hostile(e, me))
        nearest = Math.min(nearest, hexDistance(me.hex, e.hex));
    }
    return Number.isFinite(nearest) ? nearest : 0;
  };
  return (
    slotsForward(cost, unit.speed) * AI.perSlotMoved -
    (gap(before) - gap(option.position)) * AI.perHexFromEnemy
  );
}
