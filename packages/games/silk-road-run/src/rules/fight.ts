/**
 * The fight's flow: creating it, the track advancing card by
 * card, start-of-turn effects (hail lifting, grapples squeezing, Stunned turns skipped) and applying
 * one turn's move and action (timeline.md; brief sections 2 and 8).
 */
import {hexDirectionTo, hexEquals, hexKey} from '@canvas/engine/server';
import type {Hex} from '@canvas/engine/server';
import {CAMEL, HEROES, PARTY, RULES, healthOf} from './config';
import {
  canMove,
  faceStart,
  invalidPath,
  isImmobilized,
  isStunned,
  stepToExit,
  steps,
} from './board';
import {ABILITIES, forks, sameTarget, unusableReason} from './abilities';
import {allowedTargets, onlyHold} from './choices';
import {
  checkEnd,
  enterHex,
  returnFreed,
  expireDurations,
  haste,
  landShots,
  log,
  record,
  scorch,
  settle,
  squeezeDue,
  startTurnPassives,
  takeHasteDue,
  unitName,
  walk,
} from './resolve';
import type {Ctx} from './resolve';
import {MAPS, ROUTES, STEPPE, blocks, randomTiles} from './map';
import type {MapData, Tile} from './map';
import {hasPassive} from './passives';
import {aimSlot, chargeOf, nextCard, placeCard, placeStartingCards, shuffled} from './track';
import type {
  AbilityId,
  FightState,
  HeroId,
  Loadout,
  PassiveId,
  PassivePick,
  Provision,
  Side,
  StatId,
  TurnInput,
  Unit,
} from './types';

/** A player-facing rule violation; the server sends its message back. */
export class RuleError extends Error {}

const fightMaps = new WeakMap<Record<string, Tile>, MapData>();

/** The fight's map, with the fight's own yurts and the camel's road. */
export function mapOf(state: FightState): MapData {
  const map = MAPS[state.mapId]!;
  let own = fightMaps.get(state.tiles);
  if (!own) fightMaps.set(state.tiles, (own = {...map, ...state.route, tiles: state.tiles}));
  return own;
}

/**
 * A hero's speed, defence and power, from config.ts, or the test stage's
 * (`loadout`), plus its provisions, each at most RULES.statMax, and the
 * health its defence gives.
 * Phase 1 has no gear, so these are always a unit's stats.
 */
function heroStats(
  hero: HeroId,
  loadout: Loadout = {},
  provisions: Unit['provisions'] = {}
): Pick<Unit, 'speed' | 'defence' | 'power' | 'maxHp'> {
  const base = {...HEROES[hero], ...loadout};
  const stat = (id: StatId) => Math.min(RULES.statMax, base[id] + (provisions[id] ?? 0));
  const speed = stat('speed');
  const defence = stat('defence');
  const power = stat('power');
  return {speed, defence, power, maxHp: healthOf(defence)};
}

/** A hero's provisions (progression.md, 19.2), stat by stat; undefined with none. */
function provisionsOf(hero: HeroId, provisions: Provision[]): Unit['provisions'] {
  const own = provisions.filter((p) => p.hero === hero);
  if (own.length === 0) return undefined;
  const out: NonNullable<Unit['provisions']> = {};
  for (const {stat} of own) out[stat] = (out[stat] ?? 0) + 1;
  return out;
}

/**
 * What one enemy unit carries of the rival's provisions (progression.md,
 * 19.3): its stat points and passives.
 */
export interface EnemyCards {
  provisions?: Unit['provisions'];
  passives: PassiveId[];
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
    Object.assign(u, heroStats(u.hero, u.loadout, u.provisions));
    u.hp = Math.min(u.hp, u.maxHp);
  }
}

/**
 * `copy` numbers a second or later unit of the same hero on a side
 * (e-wolf, e-wolf-2); `loadout` is the test stage's stats, kit and
 * passives for it; `provisions` the stat points the run has given it, and
 * `passives` those taken at its caravanserais (beside its hero's and its
 * loadout's).
 * Glass Cannon (19.8) starts it at half its health.
 */
export function makeUnit(
  side: Side,
  partyIndex: number,
  hero: HeroId,
  copy = 0,
  loadout?: Loadout,
  provisions?: Unit['provisions'],
  taken: PassiveId[] = []
): Unit {
  const stats = heroStats(hero, loadout, provisions);
  const passives = [
    ...new Set([...(HEROES[hero].passives ?? []), ...(loadout?.passives ?? []), ...taken]),
  ];
  return {
    id: `${side === 'player' ? 'p' : 'e'}-${hero}${copy ? `-${copy + 1}` : ''}`,
    hero,
    side,
    // The camel walks itself (owner, 2026-10-22).
    controller: side === 'player' && !HEROES[hero].walksRoad ? 'human' : 'ai',
    partyIndex,
    hex: null,
    hp: passives.includes('glassCannon') ? Math.ceil(stats.maxHp / 2) : stats.maxHp,
    ...stats,
    slot: null,
    statuses: [],
    ...(loadout ? {loadout} : {}),
    ...(passives.length ? {passives} : {}),
    ...(provisions ? {provisions} : {}),
    alive: true,
  };
}

/**
 * A new fight on the Steppe Crossing, already under way: the seed scatters the
 * yurts, the player's party over the two rightmost columns and
 * the enemy's over the two leftmost (owner, 2026-10-28; the other way round
 * from 2026-10-25, the outermost column alone from 2026-10-20; there is no
 * deployment step). The seed picks the camel's road (`ROUTES`): it starts at
 * the top-right or the bottom-right corner and walks to the opposite one
 * (camel.md, 18.1; owner, 2026-10-28; the top point to the bottom one from
 * 2026-10-24), no other unit starting on either end. The player brings
 * the heroes chosen on the start menu; the enemy brings `enemies`, all three
 * heroes unless the run's stage says otherwise (STAGES). No unit starts
 * boxed in by yurts and the units beside it: the seed scatters again until
 * every one has a free hex to step to. With `mountains` the board always
 * has a range of mountains (randomTiles). The party's heroes come with
 * the run's `provisions` (progression.md, 19.2) and the passives taken
 * at its caravanserais (`passives`, 19.3), each enemy unit its share of
 * the rival's (`rivalCards`, by its place in `enemies`). It is fought on `map`,
 * the Steppe's unless a stage says otherwise (STAGES).
 */
export function createFight(
  seed: number,
  party: HeroId[] = PARTY,
  enemies: HeroId[] = PARTY,
  mountains = false,
  provisions: Provision[] = [],
  map: MapData = STEPPE,
  passives: PassivePick[] = [],
  rivalCards: EnemyCards[] = []
): FightState {
  const random = seededRandom(seed);
  const route = ROUTES[Math.floor(random() * ROUTES.length)]!;
  const state: FightState = {
    mapId: map.id,
    tiles: {},
    route,
    mode: 'solo',
    phase: 'fight',
    currentSlot: 0,
    units: [
      ...party.map((hero, i) =>
        makeUnit(
          'player',
          i,
          hero,
          0,
          undefined,
          provisionsOf(hero, provisions),
          passives.filter((p) => p.hero === hero).map((p) => p.passive)
        )
      ),
      makeUnit('player', party.length, CAMEL),
      ...enemies.map((hero, i) =>
        makeUnit(
          'enemy',
          i,
          hero,
          enemies.slice(0, i).filter((h) => h === hero).length,
          undefined,
          rivalCards[i]?.provisions,
          rivalCards[i]?.passives
        )
      ),
    ],
    effects: [],
    log: [],
    awaiting: null,
  };
  const camel = state.units.find((u) => u.hero === CAMEL)!;
  camel.hex = route.camelStart;
  do {
    state.tiles = randomTiles(random, mountains, {...map, ...route});
    for (const side of ['player', 'enemy'] as const) {
      // A mountain may stand in the inner of the two columns. Off the
      // camel's start and its exit.
      const free = map.startColumns[side].filter(
        (h) =>
          ![route.camelStart, ...route.exits].some((x) => hexEquals(h, x)) &&
          !blocks(state.tiles[hexKey(h)])
      );
      const hexes = shuffled(free, random);
      state.units
        .filter((u) => u.side === side && u !== camel)
        .forEach((u, i) => (u.hex = hexes[i]!));
    }
    // No unit boxed in: each can walk, or, with no walk of its own (the
    // Cataphract), has a lane to charge down.
  } while (
    state.units.some((u) =>
      HEROES[u.hero].moveCap === 0
        ? steps(mapOf(state), u.hex!).length === 0
        : !canMove(state, mapOf(state), u)
    )
  );
  faceStart(state, mapOf(state));
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
    returnFreed(state);
    const unit = nextCard(state);
    if (!unit) return;
    spend?.();
    expireDurations(state, unit.slot!);
    const ctx: Ctx = {state, map, slot: unit.slot!};
    state.currentSlot = unit.slot!;
    // A grapple squeezes every so many slots, whoever's card is here.
    squeezeDue(ctx, unit.slot!);
    if (state.phase !== 'fight') return;
    if (charging(state, unit)) {
      landCharge(ctx, unit);
      continue;
    }
    record(state, {kind: 'turn', unitId: unit.id});
    startTurnPassives(ctx, unit);
    // The camel isn't a decision: it walks its road.
    if (HEROES[unit.hero].walksRoad) {
      walkRoad(ctx, unit);
      continue;
    }
    if (isStunned(unit)) {
      skipTurn(ctx, unit, `${unitName(unit)} is Stunned: turn skipped.`, true);
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
 * squeeze, an Empower running out, Stunned; a Stun before the card comes
 * back has already lost the shots, in `stun`); then the card goes its action
 * cost on (3.2), to the unit's next turn.
 */
function landCharge(ctx: Ctx, unit: Unit): void {
  ctx.user = unit;
  landShots(ctx, unit);
  settle(ctx);
  checkEnd(ctx.state);
  if (unit.alive) {
    placeCard(ctx.state, unit, aimSlot(ctx.state, unit, ctx.slot));
    takeHasteDue(ctx.state, unit);
  }
}

/**
 * Places `unit`'s card at the end of its turn (3.2): its action cost on,
 * or `ability`'s charge; `idle` (a turn without moving or an ability) a
 * Wait's cost on unless `stunned` (`RULES.waitShare`), and
 * `RULES.patientSlots` fewer with Patient (19.8); then the Haste it was
 * given during the turn, Momentum's included.
 */
function endTurn(
  ctx: Ctx,
  unit: Unit,
  idle: boolean,
  ability?: AbilityId,
  stunned = false
): void {
  const {state} = ctx;
  if (unit.tookOff && hasPassive(unit, 'momentum')) {
    log(ctx, `${unitName(unit)} rides its momentum.`);
    haste(ctx, unit, 1);
  }
  delete unit.tookOff;
  if (!unit.alive) return;
  const now = state.currentSlot;
  let slot = aimSlot(state, unit, now, ability, idle && !stunned);
  if (idle && hasPassive(unit, 'patient')) slot = Math.max(now + 1, slot - RULES.patientSlots);
  placeCard(state, unit, slot, ability !== undefined && chargeOf(unit, ability) > 0);
  takeHasteDue(state, unit);
}

/**
 * A turn ending with `unit` on scorched ground (map.ts) burns it (owner,
 * 2026-10-28), whatever the turn was, a skipped one or Temee's included.
 */
function endTurnOn(ctx: Ctx, unit: Unit): void {
  if (ctx.state.phase !== 'fight') return;
  scorch(ctx, unit);
  checkEnd(ctx.state);
}

/** A turn it can't take, or with only Hold to choose: its card marked as skipped, placed as after any turn. */
function skipTurn(ctx: Ctx, unit: Unit, text: string, stunned = false): void {
  unit.skipped = true;
  log(ctx, text);
  record(ctx.state, {kind: 'skip', unitId: unit.id});
  endTurnOn(ctx, unit);
  endTurn(ctx, unit, true, undefined, stunned);
}

/**
 * The camel's turn (owner, 2026-10-22): one step toward the exit, around
 * yurts and units (`stepToExit`), then its card goes its action cost on
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
  endTurnOn(ctx, unit);
  endTurn(ctx, unit, !next);
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
  const def = ABILITIES[input.action.ability];
  if (!def) throw new RuleError('Unknown ability.');
  const ctx: Ctx = {state, map, slot: state.currentSlot, user: unit, pushes: Boolean(def.pushes)};
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
    const before = path.length > 1 ? path[path.length - 2]! : unit.hex!;
    walk(ctx, unit, path);
    log(ctx, `${unitName(unit)} moves.`);
    face(unit, before, path[path.length - 1]);
  } else {
    const {also, ...target} = input.action.target ?? {};
    if (!trustTarget && !allowedTargets(state, map, unit, def).some((t) => sameTarget(t, target)))
      throw new RuleError(`${def.name} can’t target that.`);
    // Forked (19.9): a second target, another of the ability's own.
    const second = also ? {hex: also} : undefined;
    if (second) {
      if (!forks(unit, def) || target.to || (target.hex && hexEquals(target.hex, second.hex)))
        throw new RuleError(`${def.name} can’t take a second target.`);
      if (!trustTarget && !allowedTargets(state, map, unit, def).some((t) => sameTarget(t, second)))
        throw new RuleError(`${def.name} can’t target that.`);
    }
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
    const from = unit.hex!;
    def.resolve(ctx, unit, target);
    // The second, if still a target once the first has resolved (it may have fallen or moved).
    if (
      second &&
      state.phase === 'fight' &&
      unit.alive &&
      unit.hex &&
      allowedTargets(state, map, unit, def).some((t) => sameTarget(t, second))
    ) {
      record(state, {kind: 'action', unitId: unit.id, ability: def.id, target: second.hex});
      def.resolve(ctx, unit, second);
    }
    face(unit, from, target.hex);
  }
  settle(ctx);
  state.awaiting = null;
  checkEnd(state);
  endTurnOn(ctx, unit);
  // A charged ability's card is pushed out to its charge, the cards there moving on.
  endTurn(ctx, unit, path.length === 0 && def.id === 'hold', def.id);
  // A card a grapple held off the track comes back once the grapple is over.
  returnFreed(state);
}

/**
 * One Eye (owner, 2026-10-28): a unit that faces a way turns to the way it
 * last stepped on a walk, or toward what it aimed at from `from`, if that
 * is in a straight line; otherwise it keeps facing as it was.
 */
function face(unit: Unit, from: Hex, to: Hex | undefined): void {
  if (unit.facing === undefined || !unit.alive || !to) return;
  const dir = hexDirectionTo(from, to);
  if (dir !== null) unit.facing = dir;
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
    ...(state.fires ? {fires: state.fires.map((f) => ({...f, hex: {...f.hex}}))} : {}),
    ...(state.fan ? {fan: {...state.fan}} : {}),
    log: keepLog ? state.log.map((l) => ({...l})) : [],
  };
}
