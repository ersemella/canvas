/**
 * Deterministic selective lookahead: rank actions with the preview heuristic,
 * then search actual timeline decisions with budgeted alpha-beta minimax.
 */
import {hexDistance, hexEquals, hexKey, hexNeighbors} from '@canvas/engine/server';
import type {Hex} from '@canvas/engine/server';
import {ABILITY, AI, CAMEL, RULES} from './config';
import {
  cleaveAreas,
  hostile,
  isImmobilized,
  firstInLane,
  isRanged,
  isStunned,
  kitOf,
  movementCap,
  reachableHexes,
  roadDistance,
  shotLane,
  unitAt,
} from './board';
import {
  ABILITIES,
  abilitiesOf,
  elixirAmount,
  elixirCaught,
  elixirHeals,
  grappling,
  unusableReason,
} from './abilities';
import {allowedTargets} from './choices';
import {threatDamage, threatsTo} from './threat';
import type {Threat} from './threat';
import {RuleError, advanceToDecision, applyTurn, cloneFight, mapOf} from './fight';
import {actionCost as cardCost, chargeOf} from './track';
import {camelOf, damageOf, shotEmpower} from './resolve';
import {MAPS} from './map';
import type {AbilityId, FightState, Side, TurnInput, Unit} from './types';

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

/** A unit whose attack reaches beyond its neighbours (Longshot, Hail, Gale, Volley, Cleave). */
function attacksFromAfar(u: Unit): boolean {
  const kit = kitOf(u);
  return (
    isRanged(u) || ['hail', 'gale', 'volley', 'cleave'].some((a) => kit.includes(a as AbilityId))
  );
}

/**
 * What `u`'s statuses cost its side, in damage: Stunned a turn lost,
 * Immobilized the share of a turn it loses (all of the camel's, which only
 * walks), less what an Empower gains it.
 */
function statusPoints(state: FightState, u: Unit): number {
  return statusCost(u) + weakenLoss(state, u) - empowerGain(state, u) - rescueGain(state, u);
}

/**
 * What a grappled unit's status is less worth while one of its side's units
 * that can act could strike the Grappler holding it (`strikable`): a hit
 * breaks the grapple. `AI.rescueShare` of it, so stepping into reach of the
 * Grappler counts and the hit that frees the unit still does. Without it a
 * wolf behind its grappled packmate Held: the hit was past the search's
 * horizon, and the Grappler's threat outweighed closing in.
 */
function rescueGain(state: FightState, u: Unit): number {
  const held = u.statuses.find((x) => x.grapple?.target === u.id)?.grapple;
  if (!held) return 0;
  const champion = state.units.find((c) => c.id === held.champion);
  if (!champion?.alive) return 0;
  const rescuer = state.units.some(
    (a) =>
      a !== u &&
      a.alive &&
      a.side === u.side &&
      a.power > 0 &&
      !isStunned(a) &&
      strikable(state, a).includes(champion)
  );
  return rescuer ? AI.rescueShare * statusCost(u) : 0;
}

/**
 * What an Empower is worth (balance.md): its extra damage on `u`'s next
 * hit, if an enemy is within reach (`strikable`), plus a kill's worth if
 * that hit would kill only with it, and for a Grappler grappling a unit
 * the squeeze's extra too (`ABILITY.grapple.empoweredSqueeze`), all times
 * `AI.empoweredShare`, the share of Empowers that get used. Once its turn
 * has begun it is being spent, so it no longer counts: spending it on a
 * hit must not score as losing it.
 */
function empowerGain(state: FightState, u: Unit): number {
  if (!u.empower || u.empowerStarted || u.power <= 0) return 0;
  const targets = strikable(state, u);
  if (targets.length === 0) return 0;
  const squeezes =
    ABILITY.grapple.empoweredSqueeze &&
    state.units.some((t) => t.alive && t.statuses.some((x) => x.grapple?.champion === u.id));
  const reach = u.power + u.empower;
  const kill = targets.some((t) => t.hero !== CAMEL && t.hp > u.power && t.hp <= reach);
  return AI.empoweredShare * (u.empower * (squeezes ? 2 : 1) + (kill ? AI.kill : 0));
}

/**
 * What a Weaken costs `u` (the Alchemist's Elixir), as `empowerGain` is
 * an Empower's worth: the damage it takes off `u`'s next hit, if an enemy
 * is within reach, plus a kill's worth if that hit would kill only without
 * it, all times `AI.empoweredShare`. Once its turn has begun it no longer
 * counts.
 */
function weakenLoss(state: FightState, u: Unit): number {
  if (!u.weaken || u.weakenStarted || u.power <= 0) return 0;
  const targets = strikable(state, u);
  if (targets.length === 0) return 0;
  const full = u.power + (u.empower ?? 0);
  const left = damageOf(u);
  const kill = targets.some((t) => t.hero !== CAMEL && t.hp > left && t.hp <= full);
  return AI.empoweredShare * (full - left + (kill ? AI.kill : 0));
}

/**
 * The enemies standing where `u` could hit them from where it is, roughly:
 * next to it for melee, on hail's ring for the Storm Caller, on one of
 * Longshot's lines, or of Skirmish's from a space next to it (ignoring what
 * blocks them), for the Horse Archer.
 */
function strikable(state: FightState, u: Unit): Unit[] {
  if (!u.hex) return [];
  const has = (a: AbilityId) => kitOf(u).includes(a);
  return state.units.filter((e) => {
    if (!e.alive || !e.hex || !hostile(e, u)) return false;
    const d = hexDistance(u.hex!, e.hex);
    if (d <= 1) return true;
    if (has('hail') && d === ABILITY.hail.range) return true;
    if (has('volley') && d <= ABILITY.volley.range) return true;
    if (has('gale') && d <= ABILITY.gale.range + 1) return true;
    const dq = e.hex.q - u.hex!.q;
    const dr = e.hex.r - u.hex!.r;
    const inLine = dq === 0 || dr === 0 || dq === -dr;
    if (has('longshot') && inLine) return true;
    // Cleave: straight up or down within its reach, or a side cone's far space (yurts aside).
    if (has('cleave') && ABILITY.cleave.shape !== 'built')
      return cleaveAreas(mapOf(state), u.hex!).some((a) => a.some((h) => hexEquals(h, e.hex!)));
    if (has('cleave') && dq === 0 && d <= ABILITY.cleave.reach) return true;
    if (has('cleave') && d === 2 && dq === -2 * dr) return true;
    // Skirmish: a line from a space next to it (one step off a line).
    return has('skirmish') && Math.min(Math.abs(dq), Math.abs(dr), Math.abs(dq + dr)) <= 1;
  });
}

function statusCost(u: Unit): number {
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
 * What the shots in the air are worth to `side`: each the hit it will
 * deal the first unit in its lane now, only `AI.dodgeShare` of it if that
 * unit can walk out before it lands.
 */
function shotPoints(state: FightState, side: Side): number {
  let score = 0;
  for (const v of state.shots ?? []) {
    const source = state.units.find((u) => u.id === v.source);
    if (!source?.alive || source.slot === null) continue;
    const lane = shotLane(state, mapOf(state), v);
    const target = lane.length ? unitAt(state, lane[lane.length - 1]!) : undefined;
    if (!target) continue;
    const hit = Math.min(damageOf(source, shotEmpower(source, v)), target.hp);
    const dodges =
      target.slot !== null &&
      target.slot < source.slot &&
      !isStunned(target) &&
      !isImmobilized(target);
    const value = dodges
      ? hit * AI.dodgeShare
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
    const statusDelta = statusPoints(after, a) - statusPoints(before, b);
    // `AI.trackWorth`: a card moved by the turn, the share of a turn it moved
    // (later is worse for its side), not counting the actor's own placement.
    if (AI.trackWorth && b.id !== actor.id && a.alive && a.slot !== null && b.slot !== null) {
      const later = ((a.slot - b.slot) / cardCost(b)) * turnValue(b) * AI.trackWorth;
      score += hostile(b, actor) ? later : -later;
    }
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
    score += shotPoints(after, actor.side) - shotPoints(before, actor.side);
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
  return (chargeOf(actor, input.action.ability) / cardCost(actor)) * turnValue(actor);
}

/**
 * Every distinct turn `unit` could take: its abilities where it stands,
 * then its moves, nearest first. A ground target is only tried where it
 * would affect a unit.
 */
function candidateInputs(state: FightState, unit: Unit): TurnInput[] {
  const map = mapOf(state);
  const inputs: TurnInput[] = [];
  const tried = new Set<string>();
  for (const def of abilitiesOf(unit)) {
    if (unusableReason(unit, def)) continue;
    for (const target of allowedTargets(state, map, unit, def)) {
      if (
        def.radius !== undefined &&
        !state.units.some((u) => u.alive && u.hex && hexDistance(u.hex, target.hex!) <= def.radius!)
      )
        continue;
      const key = `${def.id}:${target.hex ? hexKey(target.hex) : ''}:${target.to ? hexKey(target.to) : ''}`;
      if (tried.has(key)) continue;
      tried.add(key);
      inputs.push({action: {ability: def.id, target}});
    }
  }
  // Walks need no such check: one path to each space.
  for (const reach of reachableHexes(state, map, unit).sort(
    (a, b) => a.path.length - b.path.length
  ))
    if (reach.path.length > 0) inputs.push({move: reach.path, action: {ability: 'hold'}});
  return inputs;
}

/**
 * A cheap guess at what a turn is worth, without playing it, in the
 * units `scoreOutcome` uses: a hit's damage, a
 * kill's worth and a status's, on an enemy, against an ally; and the
 * spaces the turn leaves between `unit` and what it closes in on
 * (`quarryGap`). Any turn aimed at an enemy ranks above any walk.
 */
function guessValue(state: FightState, unit: Unit, input: TurnInput, hunting: boolean): number {
  const target = input.action.target;
  const end = input.move?.length
    ? input.move[input.move.length - 1]!
    : endsElsewhere(input.action.ability) && target?.to
      ? target.to
      : unit.hex!;
  const closing = -gapFrom(state, unit, end, hunting) * AI.perHexFromEnemy;
  if (input.move?.length || input.action.ability === 'hold') return closing;
  const ability = input.action.ability;
  // What catching a unit in Gale is worth, by its side.
  const sided = (u: Unit, value: number) =>
    hostile(u, unit) ? value : -value * AI.friendlyDamageFactor;
  const caughtBy =
    ability === 'gale'
      ? hexNeighbors(target!.hex!)
      : ability === 'cleave'
        ? ABILITIES.cleave.area!(mapOf(state), unit.hex!, target!.hex!)
        : undefined;
  if (caughtBy) {
    let value = -1;
    for (const h of caughtBy) {
      const u = unitAt(state, h);
      if (!u) continue;
      const damage = Math.min(damageOf(unit), u.hp);
      value += sided(u, damage + (damage >= u.hp && u.hero !== CAMEL ? AI.kill : 0));
      // Cleave's Delay: the share of a turn its card loses.
      if (ability === 'cleave' && ABILITY.cleave.delay > 0 && damage < u.hp)
        value += sided(u, (turnValue(u) * ABILITY.cleave.delay) / cardCost(u));
    }
    return closing + value;
  }
  // Elixir: what it gives each unit it reaches (`elixirCaught`, by its shape).
  if (ability === 'elixir') {
    let value = 0;
    const {fixed, haste, delay, unstoppable} = ABILITY.elixir;
    for (const u of elixirCaught(state, unit, unit.hex!, target!.hex!)) {
      if (!hostile(u, unit)) {
        if (elixirHeals(u))
          value +=
            Math.min(unit.power, u.maxHp - u.hp) * (u.hero === CAMEL ? AI.camelHealthWeight : 1);
        const empowers = elixirAmount('empower');
        if (u.power > 0 && empowers > 0)
          value += u.empower ? 0 : 1 + empowerGuess(state, u, empowers);
        // `haste`: the share of a turn its card gains, as Cleave's Delay is weighed.
        if (haste) value += (turnValue(u) * haste) / cardCost(u);
        // `unstoppable`: the hail holding it lets go (what else it stops is the search's).
        if (unstoppable && u.statuses.some((x) => x.hail)) value += statusCost(u);
        continue;
      }
      // With `fixed`, a hit first, as any attack's.
      const damage = fixed ? Math.min(damageOf(unit), u.hp) : 0;
      value += damage * (u.hero === CAMEL ? AI.camelHealthWeight : 1);
      if (damage > 0 && damage >= u.hp && u.hero !== CAMEL) value += AI.kill;
      else if (u.power > 0 && elixirAmount('weaken') > 0)
        value += u.weaken ? 0 : 1 + weakenGuess(state, u, elixirAmount('weaken'));
      if (delay && damage < u.hp) value += (turnValue(u) * delay) / cardCost(u);
    }
    return closing + value;
  }
  const def = ABILITIES[ability];
  const hit = !target?.hex
    ? undefined
    : def.aimedAt
      ? def.aimedAt(state, unit, target)
      : unitAt(state, target.hex);
  // Hail on an empty space: denying it is seldom the best turn.
  if (!hit) return closing - 1;
  // Sunlight: an Empower, for a side's own unit that could hit with it.
  if (input.action.ability === 'sunlight') {
    const gain =
      hit.power > 0 && !hit.empower ? 1 + empowerGuess(state, hit, ABILITY.sunlight.empower) : 0;
    return closing + (hostile(hit, unit) ? -gain : gain);
  }
  const damage = def.damages === false ? 0 : Math.min(damageOf(unit), hit.hp);
  let value = damage * (hit.hero === CAMEL ? AI.camelHealthWeight : 1);
  if (damage > 0 && damage >= hit.hp && hit.hero !== CAMEL) value += AI.kill;
  // A new grapple Stuns; a throw keeps the one there is.
  if (input.action.ability === 'grapple' && !grappling(unit, hit))
    value += turnValue(hit) * AI.stunnedShare;
  if (input.action.ability === 'hail') value += turnValue(hit) * AI.immobilizedShare.melee;
  // A drawn arrow (Skirmish): its target may step out before it lands, and
  // the charge holds the Horse Archer back (`shotPoints`, `chargeCost`).
  if (chargeOf(unit, input.action.ability) > 0) {
    if (!isStunned(hit) && !isImmobilized(hit)) value *= AI.dodgeShare;
    value -= chargeCost(unit, input);
  }
  return closing + (hostile(hit, unit) ? 1 + value : -1 - value * AI.friendlyDamageFactor);
}

/** An ability whose `to` is where its user ends up (Skirmish's step, Feigned Retreat's walk). */
function endsElsewhere(ability: AbilityId): boolean {
  return ability === 'skirmish' || ability === 'feignedRetreat';
}

/** What an Empower of `amount` on `u` might be worth (`empowerGain`, before it has an Empower). */
function empowerGuess(state: FightState, u: Unit, amount: number): number {
  const targets = strikable(state, u);
  if (targets.length === 0) return 0;
  const reach = u.power + amount;
  const kill = targets.some((t) => t.hero !== CAMEL && t.hp > u.power && t.hp <= reach);
  return AI.empoweredShare * (amount + (kill ? AI.kill : 0));
}

/** What a Weaken of `amount` on `u` might be worth (`weakenLoss`, before it has a Weaken). */
function weakenGuess(state: FightState, u: Unit, amount: number): number {
  const targets = strikable(state, u);
  if (targets.length === 0) return 0;
  const full = damageOf(u);
  const left = Math.max(0, full - amount);
  const kill = targets.some((t) => t.hero !== CAMEL && t.hp > left && t.hp <= full);
  return AI.empoweredShare * (full - left + (kill ? AI.kill : 0));
}

/**
 * What where it stands is worth to `unit`'s side, as `scoreOutcome` weighs
 * a turn's statuses and shots: the enemy's statuses (an Empower with
 * someone in reach, a grappled unit an ally could free) and the shots in
 * the air. A walk's guess is this where it ends, less where it starts:
 * stepping out of an Empowered Grappler's reach, or into reach of the
 * Grappler grappling an ally.
 */
function standing(state: FightState, unit: Unit): number {
  let value = shotPoints(state, unit.side);
  for (const u of state.units)
    if (u.alive) value += (hostile(u, unit) ? 1 : -1) * statusPoints(state, u);
  return value;
}

/**
 * `unit`'s turns, best guess first (`guessValue`): the search plays only
 * the first few at a reply, so they must be the likely best, not the
 * first listed (ai-search.md, "Searching smarter").
 */
function orderedInputs(state: FightState, unit: Unit): TurnInput[] {
  const inputs = candidateInputs(state, unit);
  const hunting = huntsTemee(state, unit);
  const from = unit.hex;
  const here = standing(state, unit);
  const guess = (input: TurnInput) => {
    let value = guessValue(state, unit, input, hunting);
    // Where a walk or Skirmish's step ends: stood there for a moment, and put back.
    const to = input.move?.length
      ? input.move[input.move.length - 1]
      : endsElsewhere(input.action.ability)
        ? input.action.target?.to
        : undefined;
    if (to) {
      unit.hex = to;
      try {
        value += standing(state, unit) - here;
      } finally {
        unit.hex = from;
      }
    }
    return value;
  };
  const guesses = new Map(inputs.map((i) => [i, guess(i)]));
  // Stable: equal guesses keep the listed order.
  return inputs.sort((a, b) => guesses.get(b)! - guesses.get(a)!);
}

/** The threat map `unit`'s options are scored against, if its caution counts it. */
function threatsFor(state: FightState, unit: Unit, includeThreats: boolean): Threat[] {
  return includeThreats && AI.threatFactor * AI.caution[unit.hero] > 0
    ? threatsTo(state, mapOf(state), unit)
    : [];
}

/** `input` played for `unit` and scored (`scoreOutcome`), or null if illegal. */
function scoreOption(
  state: FightState,
  unit: Unit,
  input: TurnInput,
  threats: Threat[]
): ScoredOption | null {
  const after = simulate(state, unit.id, input, true);
  if (!after) return null;
  return {input, score: scoreOutcome(state, after, unit, threats) - chargeCost(unit, input), after};
}

/**
 * Every option for `unit` this turn, scored, up to `limit` simulations,
 * best guess first (`orderedInputs`).
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
  const threats = threatsFor(state, unit, includeThreats);
  const out: ScoredOption[] = [];
  for (const input of orderedInputs(state, unit)) {
    if (simulations >= limit || (budget && budget.left <= 0)) return out;
    simulations++;
    if (budget) budget.left--;
    const option = scoreOption(state, unit, input, threats);
    if (option) out.push(option);
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

/** Work left for an AI turn: actions and automatic cards. */
export interface SearchBudget {
  left: number;
}

/**
 * Optional diagnostics. No randomness or persistent caches affect
 * decisions, and no clock unless the caller passes one (`stop`).
 */
export interface SearchStats {
  completedDepth: number;
  cutoffs: number;
  work: number;
  value?: number;
}

/**
 * An option the search tried, with its `actionCost`. Its `score` is NaN
 * until the node is shortlisted (`scoreAll`): the last decision only
 * evaluates the fight after it.
 */
interface SearchOption extends ScoredOption {
  cost: number;
}

interface SearchNode {
  state: FightState;
  actor: Unit | undefined;
  /** Its actor's turns in the order they're tried (`orderedInputs`), once listed. */
  inputs?: TurnInput[];
  /** How many of `inputs` have been played, illegal ones included. */
  tried: number;
  /** The legal ones of those, scored, in the order played. */
  scored: SearchOption[];
  /** The best of `scored`, searched on, once the node is screened. */
  options?: SearchOption[];
  children: Map<SearchOption, SearchNode>;
  /**
   * The fight ended while the track ran on to the next decision (a shot
   * landing, a squeeze), not with the option itself: a turn later.
   */
  endedLater?: boolean;
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
  let score = camelProgress(state, side) + shotPoints(state, side);
  for (const u of state.units) {
    if (!u.alive) continue;
    // The camel's death ends the fight, so it has no kill value: its health is weighed instead.
    const value =
      u.hero === CAMEL ? u.hp * AI.camelHealthWeight : u.hp + AI.kill - statusPoints(state, u);
    score += (u.side === side ? 1 : -1) * value;
  }
  return score;
}

/**
 * Keep a small heuristic shortlist for a decision `ply` decisions from the
 * root (`widths`, the last for any deeper); equal scores keep the order
 * they were tried in.
 */
function shortlist<T extends ScoredOption>(
  options: T[],
  widths: readonly number[],
  ply: number
): T[] {
  const width = widths[Math.min(ply, widths.length - 1)]!;
  return [...options].sort((a, b) => b.score - a.score).slice(0, width);
}

/** How a search may go on: AI.maxSimulations and AI.searchDepth unless overridden. */
export interface SearchSettings {
  /** False: an exhaustive reference over the same selective tree. */
  prune?: boolean;
  /** The deepest horizon tried, root action included. */
  depth?: number;
  /** Options searched on at each decision from the root (`shortlist`). */
  widths?: readonly number[];
  /** The work cap, in place of AI.maxSimulations. */
  work?: number;
  /**
   * Checked as work is spent: true ends the search as if its work had run
   * out, keeping the last completed depth. A clock makes the turn depend
   * on the machine; without one the search is deterministic.
   */
  stop?: () => boolean;
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
  budget: SearchBudget = {left: AI.maxSimulations},
  stats?: SearchStats,
  settings: SearchSettings = {}
): TurnInput {
  const initial = Math.max(0, budget.left);
  const cap = settings.work ?? AI.maxSimulations;
  const local: SearchBudget = {left: Math.min(cap, initial)};
  const widths = settings.widths ?? AI.searchWidths;
  const {stop} = settings;
  if (stats) {
    Object.assign(stats, {completedDepth: 0, cutoffs: 0, work: 0});
    delete stats.value;
  }
  const prune = settings.prune !== false;
  const spend = () => {
    // A clock is slow to read next to a unit of work: every 32nd.
    if (local.left <= 0 || (stop && (local.left & 31) === 0 && stop())) throw exhausted;
    local.left--;
  };
  const nodeAt = (state: FightState, actor: Unit | undefined): SearchNode => ({
    state,
    actor,
    tried: 0,
    scored: [],
    children: new Map(),
  });
  // Plays a node's next untried turn, spending a unit of work; false once
  // none is left within `limit`.
  const tryNext = (node: SearchNode, limit: number): boolean => {
    node.inputs ??= orderedInputs(node.state, node.actor!);
    if (node.tried >= Math.min(limit, node.inputs.length)) return false;
    spend();
    const input = node.inputs[node.tried++]!;
    const after = simulate(node.state, node.actor!.id, input, true);
    if (after) {
      const option = {input, after, score: NaN};
      node.scored.push({...option, cost: actionCost(node.state, node.actor!, option)});
    }
    return true;
  };
  // Scores a node's played options (`scoreOutcome`) for its shortlist.
  const scoreAll = (node: SearchNode, threats: Threat[] = []) => {
    for (const o of node.scored)
      if (Number.isNaN(o.score))
        o.score =
          scoreOutcome(node.state, o.after, node.actor!, threats) -
          chargeCost(node.actor!, o.input);
  };
  const childOf = (node: SearchNode, option: SearchOption): SearchNode => {
    let child = node.children.get(option);
    if (!child) {
      // Advance lazily: a cutoff never runs this branch's timeline or
      // generates its replies. Cached copies are private to this turn.
      const state = cloneFight(option.after);
      child = nodeAt(state, advanceToDecision(state, spend));
      if (option.after.phase === 'fight' && state.phase !== 'fight') child.endedLater = true;
      node.children.set(option, child);
    }
    return child;
  };
  const search = (
    node: SearchNode,
    ply: number,
    depth: number,
    alpha: number,
    beta: number
  ): number => {
    // A fight already over: sooner is worth more, a win taken now above one
    // a turn later, a loss now below a later one.
    if (node.state.phase !== 'fight')
      return (
        evaluatePosition(node.state, unit.side) * (1 + (depth - (node.endedLater ? 1 : 0)) / 100)
      );
    if (depth === 0 || !node.actor) return evaluatePosition(node.state, unit.side);
    const maximize = node.actor.side === unit.side;
    let value = maximize ? -Infinity : Infinity;
    const consider = (option: SearchOption, next: number): boolean => {
      value = maximize ? Math.max(value, next) : Math.min(value, next);
      if (maximize) alpha = Math.max(alpha, value);
      else beta = Math.min(beta, value);
      if (prune && alpha >= beta) {
        if (stats) stats.cutoffs++;
        return true;
      }
      return false;
    };
    // The last decision: each reply scored as it is
    // played, as the fight it leaves, with no track run on after it, and
    // the rest left unplayed once one settles the node. Replies use the
    // immediate heuristic: their actual consequences are searched, so
    // rebuilding a speculative threat map here is wasteful.
    if (depth === 1 && !node.options) {
      for (let i = 0; ; i++) {
        while (node.scored.length <= i && tryNext(node, AI.replySimulations));
        const option = node.scored[i];
        if (!option) break;
        const adjustment = maximize ? -option.cost : option.cost;
        if (consider(option, evaluatePosition(option.after, unit.side) + adjustment)) break;
      }
      if (node.scored.length === 0) throw exhausted;
      return value;
    }
    if (!node.options) {
      while (tryNext(node, AI.replySimulations));
      scoreAll(node);
      node.options = shortlist(node.scored, widths, ply);
      if (node.options.length === 0) throw exhausted;
    }
    for (const option of node.options) {
      const adjustment = maximize ? -option.cost : option.cost;
      const next =
        search(childOf(node, option), ply + 1, depth - 1, alpha - adjustment, beta - adjustment) +
        adjustment;
      if (consider(option, next)) break;
    }
    return value;
  };
  let completed: SearchOption | undefined;
  try {
    if (local.left <= 0) return {action: {ability: 'hold'}};
    const root = nodeAt(state, unit);
    // Reserve most work for actual replies, rather than spending it all
    // on the root. Small remaining budgets retain a useful greedy turn.
    const rootLimit = Math.min(AI.rootSimulations, local.left);
    while (tryNext(root, rootLimit));
    scoreAll(root, threatsFor(state, unit, true));
    const options = shortlist(root.scored, widths, 0);
    root.options = options;
    if (!options.length) return {action: {ability: 'hold'}};
    completed = options[0]!;
    if (stats) stats.completedDepth = 1;
    for (let depth = 2; depth <= (settings.depth ?? AI.searchDepth); depth++) {
      const before = local.left;
      let winner = options[0]!;
      let value = -Infinity;
      const values = new Map<ScoredOption, number>();
      for (const option of options) {
        const next =
          search(childOf(root, option), 1, depth - 1, value + option.cost, Infinity) - option.cost;
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
      completed = winner;
      if (stats) {
        stats.completedDepth = depth;
        stats.value = value;
      }
      // Nothing new played: every line ended within the horizon, so deeper
      // finds no more.
      if (local.left === before) break;
    }
    return completed.input;
  } catch (e) {
    if (e !== exhausted) throw e;
    // Updated only after every root candidate has completed the depth.
    return completed?.input ?? {action: {ability: 'hold'}};
  } finally {
    const used = Math.min(cap, initial) - local.left;
    budget.left = initial - used;
    if (stats) stats.work = used;
  }
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
  // The Horse Archer's straight move has no cap: weighed as an ordinary walk.
  const reach = Math.min(movementCap(me), RULES.movementCap) + 1;
  return !state.units.some(
    (e) =>
      e.alive && e.hex && hostile(e, me) && e.hero !== CAMEL && hexDistance(me.hex!, e.hex) <= reach
  );
}

/**
 * Spaces from `me` to what it closes in on (for an archer, to a shot:
 * `shotGap`): Temee when it hunts it (`huntsTemee`), otherwise the nearest
 * hostile unit. 0 for the camel,
 * which walks to the exit (its progress is weighed apart), or with nothing
 * to close in on.
 */
function quarryGap(state: FightState, me: Unit, hunting: boolean): number {
  if (!me.alive || !me.hex) return 0;
  return gapFrom(state, me, me.hex, hunting);
}

/**
 * How far `me` on `at` is from shooting `target` (an archer, `isRanged`):
 * 0 with a clear shot down a lane, 1 on one of its lines with a unit in
 * the way, otherwise the steps onto the nearest of its lines. Longshot has
 * no range, so closing in by spaces only walked the Horse Archer into melee
 * once its move became Longshot's shape (balance.md, "The Horse Archer's AI").
 */
function shotGap(state: FightState, me: Unit, at: Hex, target: Unit): number {
  const dq = at.q - target.hex!.q;
  const dr = at.r - target.hex!.r;
  const steps = Math.min(Math.abs(dq), Math.abs(dr), Math.abs(dq + dr));
  if (steps > 0) return steps;
  const map = mapOf(state);
  return [0, 1, 2, 3, 4, 5].some((d) => firstInLane(state, map, at, d, me) === target) ? 0 : 1;
}

/** `quarryGap` were `me` standing on `at`. */
function gapFrom(state: FightState, me: Unit, at: Hex, hunting: boolean): number {
  if (me.hero === CAMEL) return 0;
  const gap = (target: Unit) =>
    isRanged(me) ? shotGap(state, me, at, target) : hexDistance(at, target.hex!);
  const camel = hunting ? camelOf(state) : undefined;
  if (camel?.alive && camel.hex) return gap(camel);
  let nearest = Infinity;
  for (const e of state.units) {
    if (e.alive && e.hex && hostile(e, me)) nearest = Math.min(nearest, gap(e));
  }
  return Number.isFinite(nearest) ? nearest : 0;
}
