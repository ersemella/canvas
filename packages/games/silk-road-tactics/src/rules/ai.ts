/**
 * The enemy AI (brief section 6): every reachable hex, every legal ability
 * and target from it, each scored by simulating it with the same rules as
 * previews; the best score wins, ties to the first in a fixed order
 * (shorter moves first, then hex index). No randomness.
 */
import {hexDistance, hexEquals, hexKey} from '@canvas/engine/server';
import {ABILITY, AI, RULES} from './config';
import {
  fogAt,
  hostile,
  isFlanked,
  isRanged,
  reachableHexes,
  statusSlotsLeft,
  statusValue,
} from './board';
import {ABILITIES, abilitiesOf, unusableReason} from './abilities';
import {slotsForward, turnCost} from './track';
import {affectsHex, tauntBinds, taunterOf} from './taunt';
import {RuleError, applyTurn, cloneFight, mapOf} from './fight';
import {enterHex, hailDamage, throughDefence} from './resolve';
import {tileAt} from './map';
import type {AbilityDef} from './abilities';
import type {Hex} from '@canvas/engine/server';
import type {FightState, TurnInput, Unit} from './types';

export interface ScoredOption {
  input: TurnInput;
  score: number;
  /** The fight right after the option (a charged ability resolved as if now). */
  after: FightState;
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
  baseline = baselineOf(before)
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
  if (me.hex) {
    const gaps = after.units
      .filter((u) => u.alive && u.hex && hostile(u, me))
      .map((u) => hexDistance(u.hex!, me.hex!));
    if (gaps.length > 0) score -= Math.min(...gaps) * AI.perHexFromEnemy;
  }
  return score;
}

/** What fog centred on `center` is worth to `actor`'s side (see `AI.fogShield`). */
function fogValue(state: FightState, actor: Unit, center: Hex): number {
  const living = state.units.filter((u) => u.alive && u.hex);
  let value = 0;
  for (const u of living) {
    if (hexDistance(u.hex!, center) > ABILITY.fog.radius || fogAt(state, u.hex!)) continue;
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
  budget?: SearchBudget
): ScoredOption[] {
  let simulations = 0;
  const baseline = baselineOf(state);
  const map = mapOf(state);
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
      const radius = groundRadius(def);
      for (const target of def.targets(moved, map, mu, mu.hex!)) {
        if (bound && !affectsHex(map, def, mu.hex!, target, taunter.hex!)) continue;
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
        if (simulations >= limit) return out;
        simulations++;
        if (budget) budget.left--;
        const after = simulate(state, unit.id, input, true);
        if (!after) continue;
        let score = scoreOutcome(state, after, unit, baseline);
        if (def.id === 'fog') score += fogValue(state, unit, target.hex!);
        if (def.id === 'hold') {
          // Price the Hold's time as AI.holdScoringCost (see config.ts).
          const hexes = reach.path.length;
          const extra =
            slotsForward(turnCost(AI.holdScoringCost, hexes), unit.speed) -
            slotsForward(turnCost(def.cost, hexes), unit.speed);
          score -= Math.max(0, extra) * AI.perSlotMoved;
        }
        out.push({input, score, after});
      }
    }
  }
  return out;
}

/**
 * The fight after `input` for unit `unitId`, or null if illegal. A charged
 * ability is resolved immediately, assuming its targets don't move (brief
 * section 6), so its effect can be scored and previewed.
 */
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
  if (su.charging) {
    const def = ABILITIES[su.charging.ability];
    def.resolve({state: sim, map: mapOf(sim), slot: sim.currentSlot}, su, {
      hex: su.charging.target,
    });
  }
  return sim;
}

/** Simulations left for the AI turns in one request; see `AI.requestSimulations`. */
export interface SearchBudget {
  left: number;
}

/**
 * The AI's turn: the highest score among a capped search, ties to the
 * first option found. With a request's `budget`, the cap shrinks as
 * earlier AI turns spend it, never below `AI.minSimulations`.
 */
export function chooseAiTurn(state: FightState, unit: Unit, budget?: SearchBudget): TurnInput {
  const limit = budget
    ? Math.max(AI.minSimulations, Math.min(AI.maxSimulations, budget.left))
    : AI.maxSimulations;
  let best: ScoredOption | undefined;
  for (const option of scoreOptions(state, unit, limit, budget)) {
    if (!best || option.score > best.score) best = option;
  }
  if (best) return best.input;
  // Nothing scored: Hold, or under a binding taunt the first option that obeys it.
  return scoreOptions(state, unit, 1)[0]?.input ?? {action: {ability: 'hold'}};
}
