/**
 * The enemy AI (brief section 6): every reachable hex, every legal ability
 * and target from it, each scored by simulating it with the same rules as
 * previews; the best score wins, ties to the first in a fixed order
 * (shorter moves first, then hex index). No randomness.
 */
import {hexDistance, hexKey} from '@canvas/engine/server';
import {ABILITY, AI, RULES} from './config';
import {hostile, isFlanked, reachableHexes, statusSlotsLeft, statusValue} from './board';
import {ABILITIES, abilitiesOf, unusableReason} from './abilities';
import {RuleError, applyTurn, cloneFight, mapOf} from './fight';
import {enterHex, rawDamage} from './resolve';
import {tileAt} from './map';
import type {AbilityDef} from './abilities';
import type {FightState, TurnInput, Unit} from './types';

export interface ScoredOption {
  input: TurnInput;
  score: number;
  /** The fight right after the option (a charged ability resolved as if now). */
  after: FightState;
}

/** Status points for scoring: Slowed per point, Immobilized per slot, Vulnerable per %. */
function statusPoints(u: Unit, slot: number): number {
  return (
    AI.perSlowed * statusValue(u, 'slowed') +
    AI.perImmobilizedSlot * statusSlotsLeft(u, 'immobilized', slot) +
    AI.perVulnerablePercent * statusValue(u, 'vulnerable')
  );
}

/** Scores the fight after a turn by `actor`, from its side's point of view. */
export function scoreOutcome(before: FightState, after: FightState, actor: Unit): number {
  let score = 0;
  for (const b of before.units) {
    if (!b.alive) continue;
    const a = after.units.find((u) => u.id === b.id)!;
    const lost = b.hp - a.hp;
    const statusDelta = statusPoints(a, before.currentSlot) - statusPoints(b, before.currentSlot);
    if (hostile(b, actor)) {
      score += Math.max(0, lost) + statusDelta;
      if (!a.alive) score += AI.kill;
      if (lost > 0 && isFlanked(before, b)) score += AI.flankedTarget;
    } else {
      // Healing counts as damage; friendly fire only when clearly worth it.
      score += lost > 0 ? -lost * AI.friendlyDamageFactor : -lost;
      score -= statusDelta;
      if (isFlanked(before, b) && a.alive && !isFlanked(after, a)) score += AI.breaksAllyFlank;
    }
  }
  const me = after.units.find((u) => u.id === actor.id)!;
  if (me.slot !== null) score -= (me.slot - before.currentSlot) * AI.perSlotMoved;
  // Ending on quicksand costs its damage again at the start of the next turn.
  if (me.alive && me.hex && tileAt(mapOf(after), me.hex) === 'hazard') {
    score -= rawDamage(after, me, RULES.hazardDamage) * AI.friendlyDamageFactor;
  }
  if (me.hex) {
    const gaps = after.units.filter((u) => u.alive && u.hex && hostile(u, me)).map((u) => hexDistance(u.hex!, me.hex!));
    if (gaps.length > 0) score -= Math.min(...gaps) * AI.perHexFromEnemy;
  }
  return score;
}

/**
 * The area of a ground-targeted ability (hail, Volley, Freeze), whose
 * effect doesn't depend on where the user stands; undefined for others.
 */
function groundRadius(def: AbilityDef): number | undefined {
  return {hail: 0, volley: ABILITY.volley.radius, freeze: ABILITY.freeze.radius}[def.id as string];
}

/**
 * Every option for `unit` this turn (moving first), scored. A ground
 * target is only tried where it would affect a unit, and only from the
 * cheapest hex that reaches it (the outcome doesn't depend on the hex).
 */
export function scoreOptions(state: FightState, unit: Unit): ScoredOption[] {
  const map = mapOf(state);
  const out: ScoredOption[] = [];
  const groundTried = new Set<string>();
  const reaches = reachableHexes(state, map, unit).sort((a, b) => a.path.length - b.path.length);
  for (const reach of reaches) {
    // Where the unit stands after this move, to list targets from there.
    const moved = cloneFight(state);
    const mu = moved.units.find((u) => u.id === unit.id)!;
    for (const h of reach.path) if (mu.alive) enterHex({state: moved, map, slot: state.currentSlot}, mu, h);
    if (!mu.alive) continue;

    for (const def of abilitiesOf(unit)) {
      if (unusableReason(mu, def)) continue;
      const radius = groundRadius(def);
      for (const target of def.targets(moved, map, mu, mu.hex!)) {
        if (radius !== undefined) {
          const key = `${def.id}:${hexKey(target.hex!)}`;
          if (groundTried.has(key)) continue;
          if (!moved.units.some((u) => u.alive && u.hex && hexDistance(u.hex, target.hex!) <= radius)) continue;
          groundTried.add(key);
        }
        const input: TurnInput = {action: {ability: def.id, target}};
        if (reach.path.length > 0) input.move = reach.path;
        const after = simulate(state, unit.id, input, true);
        if (!after) continue;
        out.push({input, score: scoreOutcome(state, after, unit), after});
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
export function simulate(state: FightState, unitId: string, input: TurnInput, trustTarget = false): FightState | null {
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
    def.resolve({state: sim, map: mapOf(sim), slot: sim.currentSlot}, su, {hex: su.charging.target});
  }
  return sim;
}

/** The AI's turn: the highest score, ties to the first option found. */
export function chooseAiTurn(state: FightState, unit: Unit): TurnInput {
  let best: ScoredOption | undefined;
  for (const option of scoreOptions(state, unit)) {
    if (!best || option.score > best.score) best = option;
  }
  return best?.input ?? {action: {ability: 'hold'}};
}
