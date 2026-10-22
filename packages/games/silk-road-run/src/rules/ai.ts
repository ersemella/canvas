/**
 * Deterministic selective lookahead: rank actions with the preview heuristic,
 * then search actual timeline decisions with budgeted alpha-beta minimax.
 * Preview charges and faithful successors are kept separate.
 */
import {hexDistance, hexEquals, hexKey} from '@canvas/engine/server';
import {ABILITY, AI, CAMEL, HEROES, RULES, movementRules} from './config';
import {
  barrierOf,
  hostile,
  isFlanked,
  isImmobilized,
  isRanged,
  obscured,
  reachableHexes,
  roadDistance,
  statusSlotsLeft,
  statusValue,
  unitAt,
} from './board';
import {ABILITIES, abilitiesOf, legalTargets, unusableReason} from './abilities';
import {slotsForward, turnCost} from './track';
import {obeysTaunt, tauntBinds, taunterOf} from './taunt';
import {threatDamage, threatsTo} from './threat';
import type {Threat} from './threat';
import {RuleError, advanceToDecision, applyTurn, cloneFight, mapOf, turnInputCost} from './fight';
import {camelOf, enterHex, hailPushOwed, scaled, throughDefence} from './resolve';
import {MAPS, tileAt} from './map';
import type {AbilityId, FightState, Side, TurnInput, Unit} from './types';

export interface ScoredOption {
  input: TurnInput;
  score: number;
  /** The fight right after the option (a charged ability resolved as if now). */
  after: FightState;
  /** Faithful successor: charges are still waiting on the timeline. */
  position: FightState;
}

/** A unit's damage per slot: its best basic hit over the slots a typical turn takes. */
interface Rate {
  all: number;
  /** From the bow alone, the hit Obscured stops. */
  ranged: number;
}

/**
 * Each side's pressure (the sum of its living units' rates), the sum of
 * their best basic hits (before defence), and its living units.
 */
type Pressure = Record<Side, Rate & {hit: number; alive: number}>;

/** An ability's base damage; none for the rest. */
function baseDamage(id: AbilityId): number {
  return (ABILITY[id] as {damage?: number}).damage ?? 0;
}

function bestHit(u: Unit): number {
  let best = 0;
  for (const def of abilitiesOf(u)) if (!def.ultimate) best = Math.max(best, baseDamage(def.id));
  return scaled(best, u.power);
}

function rateOf(u: Unit): Rate {
  const slots = slotsForward(RULES.cost.typical, u.speed);
  return {
    all: bestHit(u) / slots,
    ranged: isRanged(u) ? scaled(ABILITY.bow.damage, u.power) / slots : 0,
  };
}

const pressures = new WeakMap<FightState, Pressure>();
function pressureOf(state: FightState): Pressure {
  let p = pressures.get(state);
  if (!p) {
    p = {
      player: {all: 0, ranged: 0, hit: 0, alive: 0},
      enemy: {all: 0, ranged: 0, hit: 0, alive: 0},
    };
    for (const u of state.units) {
      if (!u.alive) continue;
      const r = rateOf(u);
      p[u.side].all += r.all;
      p[u.side].ranged += r.ranged;
      p[u.side].hit += bestHit(u);
      p[u.side].alive++;
    }
    pressures.set(state, p);
  }
  return p;
}

/**
 * What `u`'s Barrier saves it: the health of the hits it will take whole,
 * the other side's average best hit through `u`'s defence for each hit its
 * pool can take (the last one's excess is lost, owner, 2026-10-22), for the
 * share of AI.statusHorizon it lasts.
 */
function barrierValue(p: Pressure, u: Unit, slot: number): number {
  const barrier = barrierOf(u);
  if (!barrier) return 0;
  const other = p[u.side === 'player' ? 'enemy' : 'player'];
  if (other.alive === 0) return 0;
  const hit = Math.max(1, other.hit / other.alive);
  const hits = Math.ceil(barrier.value / hit);
  const lasts = Math.min(1, statusSlotsLeft(u, 'barrier', slot) / AI.statusHorizon);
  return ((hits * hit * RULES.defenceConstant) / (u.defence + RULES.defenceConstant)) * lasts;
}

/** The share of the other side's pressure that falls on `u`, through its defence. */
function incoming(p: Pressure, u: Unit, kind: keyof Rate): number {
  const other = p[u.side === 'player' ? 'enemy' : 'player'];
  const mine = p[u.side];
  return (
    (other[kind] * RULES.defenceConstant) /
    (u.defence + RULES.defenceConstant) /
    Math.max(1, mine.alive)
  );
}

/** A unit whose basic attack reaches beyond its neighbours (the bow, hail). */
function attacksFromAfar(u: Unit): boolean {
  return isRanged(u) || HEROES[u.hero].abilities.includes('hail');
}

/**
 * What `u`'s statuses cost its side, in damage (AI.statusHorizon): Slowed
 * per point and Taunted per slot (flat), Vulnerable as the extra damage
 * the other side's pressure would deal it, Immobilized as the share of its
 * own pressure it loses, Pinned likewise, Crushed as the damage it has
 * left to deal.
 */
function statusPoints(u: Unit, slot: number, p: Pressure): number {
  // Every term below is zero without a status, and most units have none.
  if (u.statuses.length === 0) return 0;
  const left = (kind: Parameters<typeof statusSlotsLeft>[1]) =>
    Math.min(AI.statusHorizon, statusSlotsLeft(u, kind, slot));
  const far = attacksFromAfar(u);
  const share = far ? AI.immobilizedShare.ranged : AI.immobilizedShare.melee;
  const pinned = far ? AI.pinnedShare.ranged : AI.pinnedShare.melee;
  return (
    AI.perSlowed * statusValue(u, 'slowed') +
    rateOf(u).all * share * left('immobilized') +
    rateOf(u).all * pinned * left('pinned') +
    (statusValue(u, 'vulnerable') / 100) * incoming(p, u, 'all') * left('vulnerable') +
    (AI.perCrushDamage *
      statusValue(u, 'crushed') *
      statusSlotsLeft(u, 'crushed', slot) *
      RULES.defenceConstant) /
      (u.defence + RULES.defenceConstant) +
    AI.perTauntedSlot * statusSlotsLeft(u, 'taunted', slot) -
    barrierValue(p, u, slot)
  );
}

/**
 * What standing Obscured is worth to `u`'s side: the ranged hits it stops
 * on `u` until `u` can move away (its next turn, at least a typical turn
 * ahead). Not the bow shots it costs `u` (an Outrider can't shoot out of
 * a sandstorm): `u` can step out before it shoots, and when Obscured
 * halved hits by its occupant, pricing those kept the Outrider shuffling
 * (over 800 AI-vs-AI fights, 20.5 turns a fight instead of 15, and 6.4%
 * unfinished instead of 3.4%).
 */
function obscuredValue(state: FightState, u: Unit, p: Pressure): number {
  if (!u.hex || u.slot === null || !obscured(state, mapOf(state), u.hex)) return 0;
  const until = Math.max(u.slot, state.currentSlot + slotsForward(RULES.cost.typical, u.speed));
  const slots = Math.max(0, until - state.currentSlot);
  return incoming(p, u, 'ranged') * slots;
}

/** What scoring compares against, per living unit: computed once per AI turn, not per option. */
type Baseline = Map<string, {points: number; flanked: boolean}>;

function baselineOf(state: FightState): Baseline {
  const p = pressureOf(state);
  return new Map(
    state.units
      .filter((u) => u.alive)
      .map((u) => [
        u.id,
        {points: statusPoints(u, state.currentSlot, p), flanked: isFlanked(state, u)},
      ])
  );
}

/**
 * Hexes from the camel to the exit along its road, so the enemy values
 * shoving it off; 0 without a living camel.
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
 * each hex it is from an exit, for the enemy; against the player.
 */
function camelProgress(state: FightState, side: Side): number {
  if (!camelOf(state)) return 0;
  return (side === 'enemy' ? 1 : -1) * camelDistance(state) * AI.perCamelHex;
}

/**
 * A unit's card pushed later by a turn: the damage it doesn't deal while
 * it waits, its rate × the slots (balance.md, principle 11). Only Push
 * moves another unit's card.
 */
function pushValue(before: Unit, after: Unit): number {
  if (!after.alive || before.slot === null || after.slot === null || after.slot <= before.slot)
    return 0;
  return (after.slot - before.slot) * rateOf(before).all * AI.pushShare;
}

/** The Push a unit will owe for starting its next turn on hail, priced as `pushValue` prices a Push. */
function hailTax(state: FightState, u: Unit): number {
  return hailPushOwed(state, u) * rateOf(u).all * AI.pushShare;
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
    const statusDelta = statusPoints(a, before.currentSlot, pressureOf(before)) - base.points;
    // Standing on hail when its next turn starts. The actor pays for this
    // turn's start whatever it does (in its slot), so only where it ends counts.
    const taxDelta = hailTax(after, a) - (b.id === actor.id ? 0 : hailTax(before, b));
    if (hostile(b, actor)) {
      score += taxDelta;
      // Healing an enemy counts against the turn, as damage counts for it.
      score += lost * (b.hero === CAMEL ? AI.camelHealthWeight : 1) + statusDelta;
      score += pushValue(b, a);
      if (!a.alive) score += AI.kill;
      if (lost > 0 && base.flanked) score += AI.flankedTarget;
    } else {
      // Healing counts as damage; friendly fire only when clearly worth it.
      score += lost > 0 ? -lost * AI.friendlyDamageFactor : -lost;
      score -= statusDelta;
      score -= taxDelta * AI.friendlyDamageFactor;
      if (b.id !== actor.id) score -= pushValue(b, a) * AI.friendlyDamageFactor;
      if (base.flanked && a.alive && !isFlanked(after, a)) score += AI.breaksAllyFlank;
    }
  }
  // The camel's walk, whoever moved it; the fight's end outweighs everything
  // (a dead camel is no longer anywhere, so its walk alone would miss it).
  if (after.phase !== 'fight')
    score += ((after.phase === 'won') === (actor.side === 'player') ? 1 : -1) * AI.victory;
  else score += camelProgress(after, actor.side) - camelProgress(before, actor.side);
  const me = after.units.find((u) => u.id === actor.id)!;
  if (me.slot !== null) score -= (me.slot - before.currentSlot) * AI.perSlotMoved;
  // Ending on quicksand costs its damage every slot until the next turn, at least.
  if (me.alive && me.hex && me.slot !== null && tileAt(mapOf(after), me.hex) === 'hazard') {
    const slots = me.slot - before.currentSlot;
    score -= throughDefence(after, me, slots * RULES.hazardDamage) * AI.friendlyDamageFactor;
  }
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
  // The camel walks to the exit, not toward the enemy (its progress above).
  if (me.hex && me.hero !== CAMEL) {
    const gaps = after.units
      .filter((u) => u.alive && u.hex && hostile(u, me))
      .map((u) => hexDistance(u.hex!, me.hex!));
    if (gaps.length > 0) score -= Math.min(...gaps) * AI.perHexFromEnemy;
  }
  return score;
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
      const radius = def.radius;
      for (const target of legalTargets(moved, map, mu, def, mu.hex!)) {
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
        // Sunlight on a hex with no unit and no hail does nothing: a Hold
        // that looks busy (on half the Storm Caller's Sunlights before).
        if (
          def.id === 'sunlight' &&
          !unitAt(moved, target.hex!) &&
          !moved.effects.some((e) => hexEquals(e.hex, target.hex!))
        )
          continue;
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

/**
 * A charge resolved now, for scoring. Units whose cards come before it
 * lands, and that can move, are assumed to step out of it: off the board
 * while it resolves (owner, 2026-10-20; scoring them as hit made the AI
 * charge Volley and Freeze where they mostly missed).
 */
function resolvePreviewCharge(state: FightState, unitId: string): void {
  const unit = state.units.find((u) => u.id === unitId)!;
  if (!unit.charging) return;
  const escaping = state.units.filter(
    (u) =>
      u !== unit &&
      u.alive &&
      u.hex &&
      u.slot !== null &&
      unit.slot !== null &&
      u.slot < unit.slot &&
      !isImmobilized(u)
  );
  const hexes = escaping.map((u) => u.hex);
  for (const u of escaping) u.hex = null;
  try {
    ABILITIES[unit.charging.ability].resolve(
      {state, map: mapOf(state), slot: state.currentSlot},
      unit,
      {hex: unit.charging.target}
    );
  } finally {
    escaping.forEach((u, i) => (u.hex = hexes[i]!));
  }
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

/**
 * A single, symmetric team evaluation, always from the root side's perspective.
 * A charge still on the timeline at the horizon counts as if it landed now,
 * with the preview's assumption that targets acting first step out of it;
 * left out, the search could never see a Volley or Freeze it had started,
 * or one aimed at it, when the charge lands after its last decision.
 */
export function evaluatePosition(state: FightState, side: Side): number {
  // Over: an exit reached or the camel dead decides it, whoever is standing.
  if (state.phase !== 'fight')
    return (state.phase === 'won') === (side === 'player') ? AI.victory : -AI.victory;
  const own = state.units.some((u) => u.alive && u.side === side);
  const other = state.units.some((u) => u.alive && u.side !== side);
  if (!own || !other) return own ? AI.victory : other ? -AI.victory : 0;
  const charging = state.units
    .filter((u) => u.alive && u.charging && u.slot !== null)
    .sort((a, b) => a.slot! - b.slot!);
  if (charging.length === 0) return unitsValue(state, side);
  const landed = cloneFight(state);
  for (const c of charging) {
    // An earlier charge in this preview may have killed this one's caster.
    if (landed.units.find((u) => u.id === c.id)!.alive) resolvePreviewCharge(landed, c.id);
  }
  // Valued unit by unit, never as a victory: the landing is still a forecast.
  return unitsValue(landed, side);
}

function unitsValue(state: FightState, side: Side): number {
  const p = pressureOf(state);
  let score = camelProgress(state, side);
  for (const u of state.units) {
    if (!u.alive) continue;
    // The camel's death ends the fight, so it has no kill value: its health is weighed instead.
    const value =
      u.hero === CAMEL
        ? u.hp * AI.camelHealthWeight
        : u.hp + AI.kill - statusPoints(u, state.currentSlot, p) + obscuredValue(state, u, p);
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
    // A fight already over: sooner is worth more, a win taken now above one
    // a turn later (whose delay the opponent's ply would otherwise pay for,
    // its action cost counting for the root side), a loss now below a later one.
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
 * the next human turn, at most AI.maxSimulations. Taking the full cap in
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
        HEROES[u.hero].routeSlots === undefined &&
        u.slot !== null &&
        u.slot <= human
    ).length;
    const share: SearchBudget = {left: Math.floor(budget.left / (due + 1))};
    const given = share.left;
    const input = chooseAiTurn(state, unit, share);
    budget.left -= given - share.left;
    return input;
  };
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
      : turnInputCost(before, input, unit);
  const gap = (state: FightState): number => {
    const me = state.units.find((u) => u.id === unit.id)!;
    if (!me.alive || !me.hex || me.hero === CAMEL) return 0;
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
