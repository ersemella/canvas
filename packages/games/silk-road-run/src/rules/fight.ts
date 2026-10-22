/**
 * The fight's flow: creating it, the track advancing card by
 * card, start-of-turn effects, charged abilities triggering, and applying
 * one turn's move and action (timeline.md; brief sections 2 and 8).
 */
import {hexEquals} from '@canvas/engine/server';
import {CAMEL, HEROES, PARTY, movementRules} from './config';
import {expireStatuses, invalidPath, isImmobilized, stepToExit} from './board';
import {
  ABILITIES,
  holdTheLine,
  legalTargets,
  linesHeld,
  sameTarget,
  unusableReason,
} from './abilities';
import {obeysTaunt, redirectedCharge, tauntBinds, taunterOf} from './taunt';
import {onlyHold} from './choices';
import {
  checkEnd,
  enterHex,
  hailPush,
  hailPushOwed,
  hailStrikes,
  log,
  damageEachSlot,
  push,
  record,
  unitName,
} from './resolve';
import type {Ctx} from './resolve';
import {MAPS, SALT_FLATS, randomTiles} from './map';
import type {MapData, Tile} from './map';
import {nextCard, placeCard, placeStartingCards, shuffled, slotsForward, turnCost} from './track';
import type {FightState, HeroId, Side, TurnInput, Unit} from './types';

/** A player-facing rule violation; the server sends its message back. */
export class RuleError extends Error {}

const fightMaps = new WeakMap<Record<string, Tile>, MapData>();

/** The fight's map, with the fight's own ruins and quicksand. */
export function mapOf(state: FightState): MapData {
  const map = MAPS[state.mapId]!;
  let own = fightMaps.get(state.tiles);
  if (!own) fightMaps.set(state.tiles, (own = {...map, tiles: state.tiles}));
  return own;
}

/**
 * A hero's speed, defence and power, from config.ts. Phase 1 has no gear
 * and no stat changes, so these are always a unit's stats.
 */
function heroStats(hero: HeroId): Pick<Unit, 'speed' | 'defence' | 'power'> {
  const {speed, defence, power} = HEROES[hero];
  return {speed, defence, power};
}

/**
 * Brings a saved fight's unit stats up to date with config.ts. A fight
 * keeps the stats its units started with, so without this a run in
 * progress would play on with the numbers it started with after they're
 * re-tuned. A change to what a run saves ends older runs instead
 * (`RUN_FORMAT` in run.ts).
 */
export function refreshStats(state: FightState): void {
  for (const u of state.units) Object.assign(u, heroStats(u.hero));
}

/** `copy` numbers a second or later unit of the same hero on a side (e-wolf, e-wolf-2). */
function makeUnit(side: Side, partyIndex: number, hero: HeroId, copy = 0): Unit {
  const stats = HEROES[hero];
  return {
    id: `${side === 'player' ? 'p' : 'e'}-${hero}${copy ? `-${copy + 1}` : ''}`,
    hero,
    side,
    // The camel walks itself (owner, 2026-10-22).
    controller: side === 'player' && stats.routeSlots === undefined ? 'human' : 'ai',
    partyIndex,
    hex: null,
    hp: stats.health,
    maxHp: stats.health,
    ...heroStats(hero),
    slot: null,
    statuses: [],
    ultimateCharge: 0,
    ultimateUsed: false,
    charging: null,
    alive: true,
  };
}

/**
 * A new fight on the Salt Flats, already under way: the seed scatters the
 * ruins and quicksand, the player's party along the leftmost column and
 * the enemy's along the rightmost (owner, 2026-10-20; there is no
 * deployment step), and shuffles starting speed ties. The player's camel
 * starts in the top-left corner (camel.md, 18.1; owner, 2026-10-22). The player brings
 * the heroes chosen on the start menu; the enemy brings `enemies`, all three
 * heroes unless the run's stage says otherwise (STAGES).
 */
export function createFight(
  seed: number,
  party: HeroId[] = PARTY,
  enemies: HeroId[] = PARTY
): FightState {
  const map = SALT_FLATS;
  const random = seededRandom(seed);
  const state: FightState = {
    mapId: map.id,
    tiles: randomTiles(random),
    mode: 'solo',
    phase: 'fight',
    currentSlot: 0,
    units: [
      ...party.map((hero, i) => makeUnit('player', i, hero)),
      makeUnit('player', party.length, CAMEL),
      ...enemies.map((hero, i) =>
        makeUnit('enemy', i, hero, enemies.slice(0, i).filter((h) => h === hero).length)
      ),
    ],
    effects: [],
    log: [],
    awaiting: null,
  };
  const camel = state.units.find((u) => u.hero === CAMEL)!;
  camel.hex = map.camelStart;
  for (const side of ['player', 'enemy'] as const) {
    const free = map.startColumns[side].filter((h) => !hexEquals(h, map.camelStart));
    const hexes = shuffled(free, random);
    state.units
      .filter((u) => u.side === side && u !== camel)
      .forEach((u, i) => (u.hex = hexes[i]!));
  }
  placeStartingCards(state, random);
  log({state, map: mapOf(state), slot: 0}, 'The fight begins.');
  return state;
}

/** A deterministic generator in [0, 1) (mulberry32), so a run's seed fixes its start. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The unit whose turn it is, once the track has stopped for a human. */
export function actingUnit(state: FightState): Unit | undefined {
  return state.awaiting ? state.units.find((u) => u.id === state.awaiting) : undefined;
}

/**
 * Runs the track until a human-controlled unit's turn (start-of-turn
 * effects applied) or the fight's end. `chooseAi` picks each AI turn.
 */
export function advance(
  state: FightState,
  chooseAi: (state: FightState, unit: Unit) => TurnInput
): void {
  let unit: Unit | undefined;
  for (let guard = 0; guard < 10_000 && (unit = advanceToDecision(state)); guard++) {
    if (unit.controller === 'human') return;
    applyTurn(state, unit, chooseAi(state, unit));
  }
}

/**
 * Advances automatic effects and charges to the next decision, on either
 * side. Shared by live play and search; resuming a stopped decision does
 * not apply its start-of-turn effects a second time.
 * `spend` lets search bound automatic cards as well as simulated actions.
 */
export function advanceToDecision(state: FightState, spend?: () => void): Unit | undefined {
  if (state.phase !== 'fight') return;
  if (state.awaiting) return actingUnit(state);
  const map = mapOf(state);
  // A safety bound; a fight never takes anywhere near this many cards.
  for (let guard = 0; guard < 10_000 && state.phase === 'fight' && !state.awaiting; guard++) {
    const unit = nextCard(state);
    if (!unit) return;
    spend?.();
    // Its own turn: the push limit starts again (3.6).
    delete unit.pushed;
    const ctx: Ctx = {state, map, slot: unit.slot!};
    beginSlot(ctx);
    record(state, {kind: 'turn', unitId: unit.id});
    // Quicksand and Crushed ticked in beginSlot.
    if (state.phase !== 'fight') return;
    if (!unit.alive) continue;
    hailStrikes(ctx, unit);
    if (state.phase !== 'fight') return;
    if (!unit.alive) continue;

    if (unit.charging) {
      triggerCharge(ctx, unit);
      continue;
    }
    // The camel isn't a decision: it walks its road.
    if (HEROES[unit.hero].routeSlots !== undefined) {
      walkRoad(ctx, unit);
      continue;
    }
    // Nothing to do but Hold: the track goes on without asking.
    if (onlyHold(state, map, unit)) {
      skipTurn(ctx, unit);
      continue;
    }
    delete unit.skipped;
    state.awaiting = unit.id;
    return unit;
  }
}

/**
 * The track reaches `ctx.slot`: effects act at the beginning of each slot
 * passed (3.9), here expiry (statuses, hail), quicksand and Crushed.
 */
function beginSlot(ctx: Ctx): void {
  const {state, slot} = ctx;
  const from = state.currentSlot;
  state.currentSlot = slot;
  damageEachSlot(ctx, from, (s) => {
    for (const u of state.units) expireStatuses(u, s);
  });
  for (const u of state.units) expireStatuses(u, slot);
  state.effects = state.effects.filter((e) => e.untilSlot >= slot);
}

/** A turn with only Hold to choose: Held for the unit, its card marked as skipped. */
function skipTurn(ctx: Ctx, unit: Unit): void {
  const hail = hailPushOwed(ctx.state, unit);
  unit.skipped = true;
  log(ctx, `${unitName(unit)} can only hold: turn skipped.`);
  record(ctx.state, {kind: 'skip', unitId: unit.id});
  placeCard(ctx.state, unit, ctx.slot + slotsForward(ABILITIES.hold.cost, unit.speed));
  hailPush(ctx, unit, hail);
}

/**
 * The camel's turn (owner, 2026-10-22): one step toward the exit, around
 * ruins and units (`stepToExit`), then its card goes `routeSlots` on.
 * Immobilized, or with units shutting every way, it waits, its turn skipped.
 */
function walkRoad(ctx: Ctx, unit: Unit): void {
  const hail = hailPushOwed(ctx.state, unit);
  const next = isImmobilized(unit) ? undefined : stepToExit(ctx.state, ctx.map, unit);
  if (next) {
    delete unit.skipped;
    enterHex(ctx, unit, next);
    log(ctx, `${unitName(unit)} walks on.`);
  } else {
    unit.skipped = true;
    log(ctx, `${unitName(unit)} can’t go on: turn skipped.`);
    record(ctx.state, {kind: 'skip', unitId: unit.id});
  }
  checkEnd(ctx.state);
  if (unit.alive) placeCard(ctx.state, unit, ctx.slot + HEROES[unit.hero].routeSlots!);
  if (ctx.state.phase === 'fight') hailPush(ctx, unit, hail);
}

function triggerCharge(ctx: Ctx, unit: Unit): void {
  const {ability, target} = unit.charging!;
  const def = ABILITIES[ability];
  const hail = hailPushOwed(ctx.state, unit);
  const hex = redirectedCharge(ctx.state, ctx.map, unit, target);
  unit.charging = null;
  delete unit.skipped;
  if (!hexEquals(hex, target))
    log(ctx, `${unitName(unit)}'s ${def.name} is drawn onto its taunter.`);
  record(ctx.state, {kind: 'action', unitId: unit.id, ability, target: hex, charged: true});
  def.resolve(ctx, unit, {hex});
  checkEnd(ctx.state);
  if (unit.alive)
    placeCard(ctx.state, unit, ctx.slot + slotsForward(def.recoveryCost!, unit.speed));
  if (ctx.state.phase === 'fight') hailPush(ctx, unit, hail);
  unit.ultimateCharge += def.recoveryCost!;
}

/**
 * Applies one turn for `unit` (the acting unit): validates and resolves
 * the move or the ability, then places its card (3.2). Throws RuleError
 * with a player-facing message for an illegal turn. Validation happens as
 * the turn resolves, so apply it to a copy and keep the copy only if it
 * doesn't throw. `trustTarget` skips re-listing the targets and the taunt
 * check, for the AI's own options, which it took from that list and
 * filtered by the taunt.
 */
export function applyTurn(
  state: FightState,
  unit: Unit,
  input: TurnInput,
  trustTarget = false
): void {
  const map = mapOf(state);
  const ctx: Ctx = {state, map, slot: state.currentSlot};
  const def = ABILITIES[input.action.ability];
  if (!def) throw new RuleError('Unknown ability.');
  const reason = unusableReason(unit, def);
  if (reason) throw new RuleError(reason);
  const path = input.move ?? [];
  if (movementRules(state).separateMovement && path.length > 0 && def.id !== 'hold')
    throw new RuleError('Movement and an ability require separate turns.');
  // Move + Hold encodes a move-only action without changing the turn protocol.
  const cost = turnInputCost(state, input, unit);
  // Taunt (17.5): decided from where the turn starts, before any move. The
  // AI's own options already obey it (trustTarget).
  const taunter = trustTarget ? undefined : taunterOf(state, unit);
  const bound = taunter !== undefined && tauntBinds(state, map, unit, taunter);
  // Hold the Line: the hostile Vanguards next to it as the turn starts, and
  // the Push their blows owe its card once the turn has placed it.
  const held = linesHeld(state, unit);
  let pushOwed = 0;
  // Hail: starting the turn on it Pushes the card once the turn has placed it.
  const hailOwed = hailPushOwed(state, unit);

  const move = () => {
    if (path.length === 0 || !unit.alive) return;
    const bad = invalidPath(state, map, unit, path);
    if (bad) throw new RuleError(bad);
    // Quicksand triggers on entering each hex, allies' hexes passed included.
    for (const h of path) {
      pushOwed += holdTheLine(ctx, unit, h, held);
      if (!unit.alive) return;
      enterHex(ctx, unit, h);
      if (!unit.alive) return;
    }
  };
  const act = () => {
    if (!unit.alive) return;
    if (movementRules(state).separateMovement && path.length > 0) {
      log(ctx, `${unitName(unit)} moves.`);
      return;
    }
    const target = input.action.target ?? {};
    if (
      !trustTarget &&
      !legalTargets(state, map, unit, def, unit.hex!).some((t) => sameTarget(t, target))
    ) {
      throw new RuleError(`${def.name} can’t target that.`);
    }
    if (bound && !obeysTaunt(map, def, unit.hex!, target, taunter)) {
      throw new RuleError(`Taunted: attack ${unitName(taunter)} or end the turn.`);
    }
    if (def.ultimate) unit.ultimateUsed = true;
    if (def.charged) {
      unit.charging = {ability: def.id, target: target.hex!};
      log(ctx, `${unitName(unit)} begins charging ${def.name}.`);
      record(state, {kind: 'charge', unitId: unit.id, ability: def.id, target: target.hex!});
    } else {
      record(state, {
        kind: 'action',
        unitId: unit.id,
        ability: def.id,
        ...(target.hex ? {target: target.hex} : {}),
      });
      def.resolve(ctx, unit, target);
    }
  };

  move();
  act();
  // An ability that moved it (Leap, Lunge's bound, Advance's charge): struck where it lands.
  if (unit.alive && unit.hex) pushOwed += holdTheLine(ctx, unit, unit.hex, held);
  state.awaiting = null;
  checkEnd(state);
  if (unit.alive) placeCard(state, unit, state.currentSlot + slotsForward(cost, unit.speed));
  if (pushOwed > 0 && state.phase === 'fight') push(ctx, unit, pushOwed);
  if (state.phase === 'fight') hailPush(ctx, unit, hailOwed);
  if (countsTowardUltimate(input)) unit.ultimateCharge += cost;
}

/**
 * The authoritative cost, shared by the server, AI simulations and previews.
 * A unit with its own move cost (the camel) pays that for a move instead.
 */
export function turnInputCost(state: FightState, input: TurnInput, unit?: Unit): number {
  const hexes = input.move?.length ?? 0;
  const moveCost = unit && HEROES[unit.hero].moveCost;
  if (moveCost !== undefined && movementRules(state).separateMovement && hexes > 0) return moveCost;
  const base =
    movementRules(state).separateMovement && hexes > 0
      ? movementRules(state).moveActionCost
      : ABILITIES[input.action.ability].cost;
  return turnCost(base, hexes);
}

/**
 * A turn's cost charges the ultimate (10.10) unless it only Holds:
 * otherwise waiting would charge it as fast as acting (owner, 2026-10-19).
 */
export function countsTowardUltimate(input: TurnInput): boolean {
  return input.action.ability !== 'hold' || (input.move?.length ?? 0) > 0;
}

/** A deep copy for previews and the AI; drops the log unless asked, and the events always. */
export function cloneFight(state: FightState, keepLog = false): FightState {
  // A copy never records: only the run's own fight does, from a fresh list.
  const {events: _events, ...rest} = state;
  return {
    ...rest,
    units: state.units.map((u) => ({
      ...u,
      hex: u.hex ? {...u.hex} : null,
      statuses: u.statuses.map((s) => ({...s})),
      charging: u.charging ? {...u.charging, target: {...u.charging.target}} : null,
    })),
    effects: state.effects.map((e) => ({...e, hex: {...e.hex}})),
    log: keepLog ? state.log.map((l) => ({...l})) : [],
  };
}
