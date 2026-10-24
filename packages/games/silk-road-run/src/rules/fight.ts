/**
 * The fight's flow: creating it, the track advancing card by
 * card, start-of-turn effects (hail lifting, grapples squeezing, Stunned turns skipped) and applying
 * one turn's move and action (timeline.md; brief sections 2 and 8).
 */
import {hexEquals} from '@canvas/engine/server';
import {CAMEL, HEROES, PARTY, healthOf} from './config';
import {canMove, invalidPath, isImmobilized, isStunned, stepToExit} from './board';
import {ABILITIES, sameTarget, unusableReason} from './abilities';
import {allowedTargets, onlyHold} from './choices';
import {
  checkEnd,
  clearHail,
  endTurnEffects,
  enterHex,
  landShots,
  log,
  record,
  squeezeGrapples,
  unitName,
} from './resolve';
import type {Ctx} from './resolve';
import {MAPS, SALT_FLATS, randomTiles} from './map';
import type {MapData, Tile} from './map';
import {aimSlot, chargeOf, nextCard, placeCard, placeStartingCards, shuffled} from './track';
import type {FightState, HeroId, Side, TurnInput, Unit} from './types';

/** A player-facing rule violation; the server sends its message back. */
export class RuleError extends Error {}

const fightMaps = new WeakMap<Record<string, Tile>, MapData>();

/** The fight's map, with the fight's own ruins. */
export function mapOf(state: FightState): MapData {
  const map = MAPS[state.mapId]!;
  let own = fightMaps.get(state.tiles);
  if (!own) fightMaps.set(state.tiles, (own = {...map, tiles: state.tiles}));
  return own;
}

/**
 * A hero's speed, defence and power, from config.ts, and the health its
 * defence gives. Phase 1 has no gear and no stat changes, so these are
 * always a unit's stats.
 */
function heroStats(hero: HeroId): Pick<Unit, 'speed' | 'defence' | 'power' | 'maxHp'> {
  const {speed, defence, power} = HEROES[hero];
  return {speed, defence, power, maxHp: healthOf(defence)};
}

/**
 * Brings a saved fight's unit stats up to date with config.ts. A fight
 * keeps the stats its units started with, so without this a run in
 * progress would play on with the numbers it started with after they're
 * re-tuned. A change to what a run saves ends older runs instead
 * (`RUN_FORMAT` in run.ts).
 */
export function refreshStats(state: FightState): void {
  for (const u of state.units) {
    Object.assign(u, heroStats(u.hero));
    u.hp = Math.min(u.hp, u.maxHp);
  }
}

/** `copy` numbers a second or later unit of the same hero on a side (e-wolf, e-wolf-2). */
function makeUnit(side: Side, partyIndex: number, hero: HeroId, copy = 0): Unit {
  const stats = heroStats(hero);
  return {
    id: `${side === 'player' ? 'p' : 'e'}-${hero}${copy ? `-${copy + 1}` : ''}`,
    hero,
    side,
    // The camel walks itself (owner, 2026-10-22).
    controller: side === 'player' && !HEROES[hero].walksRoad ? 'human' : 'ai',
    partyIndex,
    hex: null,
    hp: stats.maxHp,
    ...stats,
    slot: null,
    statuses: [],
    alive: true,
  };
}

/**
 * A new fight on the Salt Flats, already under way: the seed scatters the
 * ruins, the player's party along the leftmost column and
 * the enemy's along the rightmost (owner, 2026-10-20; there is no
 * deployment step). The player's camel
 * starts in the top-left corner (camel.md, 18.1; owner, 2026-10-22). The player brings
 * the heroes chosen on the start menu; the enemy brings `enemies`, all three
 * heroes unless the run's stage says otherwise (STAGES). No unit starts
 * boxed in by ruins and the units beside it: the seed scatters again until
 * every one has a free hex to step to.
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
    tiles: {},
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
  do {
    state.tiles = randomTiles(random);
    for (const side of ['player', 'enemy'] as const) {
      const free = map.startColumns[side].filter((h) => !hexEquals(h, map.camelStart));
      const hexes = shuffled(free, random);
      state.units
        .filter((u) => u.side === side && u !== camel)
        .forEach((u, i) => (u.hex = hexes[i]!));
    }
  } while (state.units.some((u) => !canMove(state, mapOf(state), u)));
  placeStartingCards(state);
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
 * Advances automatic effects and turns to the next decision, on either
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
    const ctx: Ctx = {state, map, slot: unit.slot!};
    state.currentSlot = unit.slot!;
    if (charging(state, unit)) {
      landCharge(ctx, unit);
      continue;
    }
    record(state, {kind: 'turn', unitId: unit.id});
    // Its hail lasts until its next turn: this one (owner, 2026-10-23).
    clearHail(state, unit);
    // An Enhance lasts until the end of this turn.
    if (unit.enhance) unit.enhanceStarted = true;
    squeezeGrapples(ctx, unit);
    // The squeeze can end the fight.
    if (state.phase !== 'fight') return;
    // The camel isn't a decision: it walks its road.
    if (HEROES[unit.hero].walksRoad) {
      walkRoad(ctx, unit);
      continue;
    }
    if (isStunned(unit)) {
      skipTurn(ctx, unit, `${unitName(unit)} is Stunned: turn skipped.`);
      continue;
    }
    // Nothing to do but Hold: the track goes on without asking.
    if (onlyHold(state, map, unit)) {
      skipTurn(ctx, unit, `${unitName(unit)} can only hold: turn skipped.`);
      continue;
    }
    delete unit.skipped;
    state.awaiting = unit.id;
    return unit;
  }
}

/** Whether `unit`'s card is out charging: a shot of its is in the air. */
export function charging(state: FightState, unit: Unit): boolean {
  return Boolean(state.shots?.some((v) => v.source === unit.id));
}

/**
 * A charging card come back (owner, 2026-10-23): its shots fly, and
 * that is all, no turn and nothing that comes with one (hail lifting, a
 * squeeze, an Enhance running out, Stunned); then the card goes its action
 * cost on (3.2), to the unit's next turn.
 */
function landCharge(ctx: Ctx, unit: Unit): void {
  landShots(ctx, unit);
  checkEnd(ctx.state);
  if (unit.alive) placeCard(ctx.state, unit, aimSlot(ctx.state, unit, ctx.slot));
}

/** A turn it can't take, or with only Hold to choose: its card marked as skipped, placed as after any turn. */
function skipTurn(ctx: Ctx, unit: Unit, text: string): void {
  unit.skipped = true;
  log(ctx, text);
  record(ctx.state, {kind: 'skip', unitId: unit.id});
  endTurnEffects(unit);
  placeCard(ctx.state, unit, aimSlot(ctx.state, unit));
}

/**
 * The camel's turn (owner, 2026-10-22): one step toward the exit, around
 * ruins and units (`stepToExit`), then its card goes its action cost on
 * (3.2), whether or not it stepped. Immobilized or Stunned,
 * or with units shutting every way, it waits, its turn skipped.
 */
function walkRoad(ctx: Ctx, unit: Unit): void {
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
  endTurnEffects(unit);
  if (unit.alive) placeCard(ctx.state, unit, aimSlot(ctx.state, unit, ctx.slot));
}

/**
 * Applies one turn for `unit` (the acting unit): validates and resolves
 * the move or the ability, then places its card (3.2). Throws RuleError
 * with a player-facing message for an illegal turn. Validation happens as
 * the turn resolves, so apply it to a copy and keep the copy only if it
 * doesn't throw. `trustTarget` skips re-listing the targets, for the AI's
 * own options, which it took from that list.
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
  // Move + Hold encodes a move-only turn without changing the turn protocol.
  if (path.length > 0 && def.id !== 'hold')
    throw new RuleError('Movement and an ability require separate turns.');

  if (path.length > 0) {
    const bad = invalidPath(state, map, unit, path);
    if (bad) throw new RuleError(bad);
    // A grapple ends only if the walk ends apart (owner, 2026-10-23).
    path.forEach((h, i) => enterHex(ctx, unit, h, 'walk', i < path.length - 1));
    log(ctx, `${unitName(unit)} moves.`);
  } else {
    const target = input.action.target ?? {};
    if (!trustTarget && !allowedTargets(state, map, unit, def).some((t) => sameTarget(t, target)))
      throw new RuleError(`${def.name} can’t target that.`);
    // A step before the ability (Skirmish), a walk of one space.
    if (def.steps) {
      enterHex(ctx, unit, target.to!);
      log(ctx, `${unitName(unit)} steps.`);
    }
    record(state, {
      kind: 'action',
      unitId: unit.id,
      ability: def.id,
      ...(target.hex ? {target: target.hex} : {}),
    });
    def.resolve(ctx, unit, target);
  }
  state.awaiting = null;
  checkEnd(state);
  endTurnEffects(unit);
  // A charged ability's card is pushed out to its charge, the cards there moving on.
  if (unit.alive)
    placeCard(
      state,
      unit,
      aimSlot(state, unit, state.currentSlot, def.id),
      chargeOf(unit, def.id) > 0
    );
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
    })),
    effects: state.effects.map((e) => ({...e, hex: {...e.hex}})),
    ...(state.shots ? {shots: state.shots.map((v) => ({...v}))} : {}),
    log: keepLog ? state.log.map((l) => ({...l})) : [],
  };
}
