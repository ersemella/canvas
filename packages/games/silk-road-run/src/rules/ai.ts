/**
 * Deterministic selective lookahead: rank actions with the preview heuristic,
 * then search actual timeline decisions with budgeted alpha-beta minimax.
 */
import {hexDistance, hexKey} from '@canvas/engine/server';
import type {Hex} from '@canvas/engine/server';
import {ABILITY, AI, CAMEL, HEROES} from './config';
import {
  hostile,
  isImmobilized,
  isRanged,
  isStunned,
  movementCap,
  reachableHexes,
  roadDistance,
  shotLane,
  unitAt,
} from './board';
import {abilitiesOf, unusableReason} from './abilities';
import {allowedTargets} from './choices';
import {threatDamage, threatsTo} from './threat';
import type {Threat} from './threat';
import {RuleError, advanceToDecision, applyTurn, cloneFight, mapOf} from './fight';
import {actionCost as cardCost, chargeOf} from './track';
import {camelOf, damageOf, shotEnhance} from './resolve';
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

/** A unit whose attack reaches beyond its neighbours (the bow, hail). */
function attacksFromAfar(u: Unit): boolean {
  return isRanged(u) || HEROES[u.hero].abilities.includes('hail');
}

/**
 * What `u`'s statuses cost its side, in damage: Stunned a turn lost,
 * Immobilized the share of a turn it loses (all of the camel's, which only
 * walks), less what an Enhance gains it.
 */
function statusPoints(state: FightState, u: Unit): number {
  return statusCost(u) - enhanceGain(state, u) - rescueGain(state, u);
}

/**
 * What a grappled unit's status is less worth while one of its side's units
 * that can act could strike the Champion holding it (`strikable`): a hit
 * breaks the grapple. `AI.rescueShare` of it, so stepping into reach of the
 * Champion counts and the hit that frees the unit still does. Without it a
 * wolf behind its grappled packmate Held: the hit was past the search's
 * horizon, and the Champion's threat outweighed closing in.
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
 * What an Enhance is worth (balance.md): its extra damage on `u`'s next
 * hit, if an enemy is within reach (`strikable`), plus a kill's worth if
 * that hit would kill only with it, and for a Champion grappling a unit
 * the squeeze's extra too (`ABILITY.grapple.enhancedSqueeze`), all times
 * `AI.enhancedShare`, the share of Enhances that get used. Once its turn
 * has begun it is being spent, so it no longer counts: spending it on a
 * hit must not score as losing it.
 */
function enhanceGain(state: FightState, u: Unit): number {
  if (!u.enhance || u.enhanceStarted || u.power <= 0) return 0;
  const targets = strikable(state, u);
  if (targets.length === 0) return 0;
  const squeezes =
    ABILITY.grapple.enhancedSqueeze &&
    state.units.some((t) => t.alive && t.statuses.some((x) => x.grapple?.champion === u.id));
  const reach = u.power + u.enhance;
  const kill = targets.some((t) => t.hero !== CAMEL && t.hp > u.power && t.hp <= reach);
  return AI.enhancedShare * (u.enhance * (squeezes ? 2 : 1) + (kill ? AI.kill : 0));
}

/**
 * The enemies standing where `u` could hit them from where it is, roughly:
 * next to it for melee, within hail's range for the Storm Caller, on one of
 * the bow's lines, or of Skirmish's from a space next to it (ignoring what
 * blocks them), for the Outrider.
 */
function strikable(state: FightState, u: Unit): Unit[] {
  if (!u.hex) return [];
  const has = (a: AbilityId) => HEROES[u.hero].abilities.includes(a);
  return state.units.filter((e) => {
    if (!e.alive || !e.hex || !hostile(e, u)) return false;
    const d = hexDistance(u.hex!, e.hex);
    if (d <= 1) return true;
    if (has('hail') && d <= ABILITY.hail.range) return true;
    const dq = e.hex.q - u.hex!.q;
    const dr = e.hex.r - u.hex!.r;
    if (has('bow') && (dq === 0 || dr === 0 || dq === -dr)) return true;
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
    const hit = Math.min(damageOf(source, shotEnhance(source, v)), target.hp);
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

/** A turn as a string, to tell turns apart. */
function inputKey(input: TurnInput): string {
  const t = input.action.target;
  return `${input.action.ability}:${t?.hex ? hexKey(t.hex) : ''}:${t?.to ? hexKey(t.to) : ''}:${input.move?.map(hexKey).join('/') ?? ''}`;
}

/**
 * Every distinct turn `unit` could take: its abilities where it stands,
 * then its moves, nearest first. A ground target is only tried where it
 * would affect a unit.
 */
function candidateInputs(state: FightState, unit: Unit): TurnInput[] {
  const map = mapOf(state);
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
  const tried = new Set<string>();
  return inputs.filter((input) => {
    const key = inputKey(input);
    if (tried.has(key)) return false;
    tried.add(key);
    return true;
  });
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
    : input.action.ability === 'skirmish' && target?.to
      ? target.to
      : unit.hex!;
  const closing = -gapFrom(state, unit, end, hunting) * AI.perHexFromEnemy;
  if (input.move?.length || input.action.ability === 'hold') return closing;
  const hit = target?.hex ? unitAt(state, target.hex) : undefined;
  // Hail on an empty space: denying it is seldom the best turn.
  if (!hit) return closing - 1;
  // Sunlight: an Enhance, for a side's own unit that could hit with it.
  if (input.action.ability === 'sunlight') {
    const gain = hit.power > 0 && !hit.enhance ? 1 + enhanceGuess(state, hit) : 0;
    return closing + (hostile(hit, unit) ? -gain : gain);
  }
  const damage = Math.min(damageOf(unit), hit.hp);
  let value = damage * (hit.hero === CAMEL ? AI.camelHealthWeight : 1);
  if (damage > 0 && damage >= hit.hp && hit.hero !== CAMEL) value += AI.kill;
  if (input.action.ability === 'grapple') value += turnValue(hit) * AI.stunnedShare;
  if (input.action.ability === 'hail') value += turnValue(hit) * AI.immobilizedShare.melee;
  return closing + (hostile(hit, unit) ? 1 + value : -1 - value * AI.friendlyDamageFactor);
}

/** What Sunlight's Enhance on `u` might be worth (`enhanceGain`, before it has an Enhance). */
function enhanceGuess(state: FightState, u: Unit): number {
  const targets = strikable(state, u);
  if (targets.length === 0) return 0;
  const reach = u.power + ABILITY.sunlight.enhance;
  const kill = targets.some((t) => t.hero !== CAMEL && t.hp > u.power && t.hp <= reach);
  return AI.enhancedShare * (ABILITY.sunlight.enhance + (kill ? AI.kill : 0));
}

/**
 * `unit`'s turns, best guess first (`guessValue`): the search plays only
 * the first few at a reply, so they must be the likely best, not the
 * first listed (ai-search.md, "Searching smarter").
 */
function orderedInputs(state: FightState, unit: Unit): TurnInput[] {
  const inputs = candidateInputs(state, unit);
  const hunting = huntsTemee(state, unit);
  const guesses = new Map(inputs.map((i) => [i, guessValue(state, unit, i, hunting)]));
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

/** Keep a small heuristic shortlist; equal scores keep the order they were tried in. */
function shortlist<T extends ScoredOption>(options: T[]): T[] {
  return [...options].sort((a, b) => b.score - a.score).slice(0, AI.searchWidth);
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
  const prune = settings.prune !== false;
  const spend = () => {
    if (local.left <= 0) throw exhausted;
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
  const search = (node: SearchNode, depth: number, alpha: number, beta: number): number => {
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
      node.options = shortlist(node.scored);
      if (node.options.length === 0) throw exhausted;
    }
    for (const option of node.options) {
      const adjustment = maximize ? -option.cost : option.cost;
      const next =
        search(childOf(node, option), depth - 1, alpha - adjustment, beta - adjustment) +
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
    const options = shortlist(root.scored);
    root.options = options;
    if (!options.length) return {action: {ability: 'hold'}};
    completed = options[0]!;
    if (stats) stats.completedDepth = 1;
    for (let depth = 2; depth <= (settings.depth ?? AI.searchDepth); depth++) {
      let winner = options[0]!;
      let value = -Infinity;
      const values = new Map<ScoredOption, number>();
      for (const option of options) {
        const next =
          search(childOf(root, option), depth - 1, value + option.cost, Infinity) - option.cost;
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
    }
    return completed.input;
  } catch (e) {
    if (e !== exhausted) throw e;
    // Updated only after every root candidate has completed the depth.
    return completed?.input ?? {action: {ability: 'hold'}};
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
  if (!me.alive || !me.hex) return 0;
  return gapFrom(state, me, me.hex, hunting);
}

/** `quarryGap` were `me` standing on `at`. */
function gapFrom(state: FightState, me: Unit, at: Hex, hunting: boolean): number {
  if (me.hero === CAMEL) return 0;
  const camel = hunting ? camelOf(state) : undefined;
  if (camel?.alive && camel.hex) return hexDistance(at, camel.hex);
  let nearest = Infinity;
  for (const e of state.units) {
    if (e.alive && e.hex && hostile(e, me)) nearest = Math.min(nearest, hexDistance(at, e.hex));
  }
  return Number.isFinite(nearest) ? nearest : 0;
}
