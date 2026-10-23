/**
 * The three prototype heroes' abilities (roster.md; owner, 2026-10-23) and
 * the wolf's. Each lists its legal targets from a hex (for validation,
 * previews and the AI) and resolves on the fight state. Every ability
 * deals exactly its user's power in damage; shapes come from config.ts.
 */
import {
  hexDistance,
  hexEquals,
  hexNeighbor,
  hexNeighbors,
  hexRound,
  hexesInRange,
} from '@canvas/engine/server';
import type {Hex} from '@canvas/engine/server';
import {ABILITY, CAMEL, HEROES} from './config';
import {isImmobilized, onMap, sortByHex, unitAt, walkable} from './board';
import {endGrapples, enterHex, hailHolds, hit, log, stun, unitName} from './resolve';
import type {Ctx} from './resolve';
import {tileAt} from './map';
import type {MapData} from './map';
import {placeCard} from './track';
import type {AbilityId, ActionTarget, FightState, Unit} from './types';

/**
 * What an ability is broadly for, shown as an icon by its name: hurting
 * enemies, or controlling the board (statuses, hail).
 */
export type AbilityKind = 'attack' | 'control';

export interface AbilityDef {
  id: AbilityId;
  name: string;
  /** None for Hold. */
  kind?: AbilityKind;
  /**
   * How far from its user it reaches, for an ability aimed within a range
   * (not the bow, whose lanes run to the first unit, nor melee); the page
   * outlines it.
   */
  range?: number;
  /**
   * A ground-targeted area (hail): the spaces within this of the target
   * (0: the space alone). Its effect doesn't depend on where the user
   * stands. None for the rest.
   */
  radius?: number;
  /** One line for the side panel, with its damage (the user's power). Range is left out. */
  summary(user: Unit): string;
  /**
   * Aimed at a unit (melee, and the bow), not at a hex: with no unit to aim
   * at, the page disables it. Ground-targeted abilities can be aimed at an
   * empty hex on purpose (hail to deny it).
   */
  targetsUnit?: boolean;
  /** Legal targets with the user standing on `from`. */
  targets(state: FightState, map: MapData, user: Unit, from: Hex): ActionTarget[];
  /** Resolves the ability now. */
  resolve(ctx: Ctx, user: Unit, target: ActionTarget): void;
}

const DIRECTIONS = [0, 1, 2, 3, 4, 5];

function adjacentUnits(state: FightState, from: Hex, keep: (u: Unit) => boolean): ActionTarget[] {
  return hexNeighbors(from)
    .map((h) => unitAt(state, h))
    .filter((u): u is Unit => u !== undefined && keep(u))
    .map((u) => ({hex: u.hex!}));
}

function hexesWithin(
  map: MapData,
  from: Hex,
  range: number,
  keep: (h: Hex) => boolean = () => true
): ActionTarget[] {
  return sortByHex(
    hexesInRange(from, range).filter((h) => onMap(map, h) && keep(h)),
    (h) => h
  ).map((hex) => ({hex}));
}

/** "1 damage", or "no damage" at power 0. */
function damageText(user: Unit): string {
  return user.power > 0 ? `${user.power} damage` : 'no damage';
}

const hold: AbilityDef = {
  id: 'hold',
  name: 'Hold',
  summary: () => 'End the turn with no effect.',
  targets: () => [{}],
  resolve: (ctx, user) => log(ctx, `${unitName(user)} holds.`),
};

// ─── Mangudai Outrider ───────────────────────────────────────────────────────

/** An arrow's flight along one hex direction: the hexes it crosses, and the unit it stops at. */
export interface ArrowLane {
  hexes: Hex[];
  hit?: Unit;
}

/**
 * The bow's six lanes from `from`: each runs until the first unit (which
 * it hits), ruins or the map's edge (the bow has no range limit). For the
 * page to show where an arrow can fly, hit or not.
 */
export function arrowLanes(state: FightState, map: MapData, from: Hex): ArrowLane[] {
  return DIRECTIONS.map((dir) => {
    const lane: ArrowLane = {hexes: []};
    let h = from;
    for (let i = 0; i < ABILITY.bow.range; i++) {
      h = hexNeighbor(h, dir);
      if (!onMap(map, h) || tileAt(map, h) === 'obstacle') break;
      lane.hexes.push(h);
      const u = unitAt(state, h);
      if (u) {
        lane.hit = u;
        break;
      }
    }
    return lane;
  });
}

const bow: AbilityDef = {
  id: 'bow',
  name: 'Bow',
  kind: 'attack',
  summary: (user) => `Shoot straight: the first unit in line takes ${damageText(user)}.`,
  targetsUnit: true,
  targets(state, map, _user, from) {
    return arrowLanes(state, map, from)
      .filter((lane) => lane.hit)
      .map((lane) => ({hex: lane.hit!.hex!}));
  },
  resolve(ctx, user, target) {
    const u = unitAt(ctx.state, target.hex!)!;
    hit(ctx, user, u, `${unitName(user)}'s arrow`);
  },
};

/**
 * Volley (owner, 2026-10-23): arrows loosed high, falling on one space
 * within `ABILITY.volley.range` (2), adjacent included, as hail does, so no
 * line of fire is needed: the unit there, ally or enemy, takes the
 * Outrider's power.
 */
const volley: AbilityDef = {
  id: 'volley',
  name: 'Volley',
  kind: 'attack',
  range: ABILITY.volley.range,
  radius: 0,
  summary: (user) =>
    `Arrows from above on a unit within ${ABILITY.volley.range}, over anything in the way: it takes ${damageText(user)}.`,
  targetsUnit: true,
  targets: (state, map, user, from) =>
    hexesWithin(map, from, ABILITY.volley.range, (h) => {
      const u = unitAt(state, h);
      return u !== undefined && u !== user;
    }),
  resolve(ctx, user, target) {
    const u = unitAt(ctx.state, target.hex!)!;
    log(ctx, `${unitName(user)} looses a volley.`);
    hit(ctx, user, u, `${unitName(user)}'s volley`);
  },
};

// ─── Yadachy Storm Caller ────────────────────────────────────────────────────

const hail: AbilityDef = {
  id: 'hail',
  name: 'Hail',
  kind: 'control',
  range: ABILITY.hail.range,
  radius: 0,
  summary: (user) =>
    `Hail on a space until your next turn: a unit there takes ${damageText(user)}, and a unit there or that enters it is Immobilized until the hail is gone.`,
  targets: (_state, map, _user, from) =>
    hexesWithin(map, from, ABILITY.hail.range, (h) => tileAt(map, h) !== 'obstacle'),
  resolve(ctx, user, target) {
    const hex = target.hex!;
    ctx.state.effects = ctx.state.effects.filter((e) => !hexEquals(e.hex, hex));
    ctx.state.effects.push({kind: 'hail', hex, source: user.id});
    log(ctx, `${unitName(user)} calls down hail.`);
    const u = unitAt(ctx.state, hex);
    if (!u) return;
    hit(ctx, user, u, 'The hail');
    hailHolds(ctx, u);
  },
};

/** Units other than `user` within `range` of `from`, as targets. */
function unitsWithin(state: FightState, map: MapData, user: Unit, from: Hex, range: number) {
  return hexesWithin(map, from, range, (h) => {
    const u = unitAt(state, h);
    return u !== undefined && u !== user;
  });
}

/**
 * The space a Push moves `unit` to, one step directly away from `source`
 * (keywords.md, 17.4: along the line from the source through the unit;
 * off a hex line, the hex that line runs into, ties broken one way), or
 * undefined if ruins, a unit or the map's edge stop it.
 */
export function pushedTo(
  state: FightState,
  map: MapData,
  source: Hex,
  unit: Unit
): Hex | undefined {
  const at = unit.hex!;
  const d = hexDistance(source, at);
  const to = hexRound(at.q + (at.q - source.q) / d + 1e-6, at.r + (at.r - source.r) / d + 1e-6);
  if (hexDistance(to, at) !== 1 || hexDistance(to, source) !== d + 1) return undefined;
  return walkable(map, to) && !unitAt(state, to) ? to : undefined;
}

/**
 * Gale (proposed, 2026-10-23): a unit within 2 takes the Storm Caller's
 * power, then is Pushed 1 directly away. Stopped by ruins, a unit or the
 * edge, it stays (no collision damage, open question 55). Temee is too
 * heavy to Push. A Push into hail is held there; one that parts a
 * grapple's two ends it.
 */
const gale: AbilityDef = {
  id: 'gale',
  name: 'Gale',
  kind: 'attack',
  range: ABILITY.gale.range,
  radius: 0,
  summary: (user) =>
    `A unit within ${ABILITY.gale.range} takes ${damageText(user)} and is Pushed ${ABILITY.gale.push} away from you.`,
  targetsUnit: true,
  targets: (state, map, user, from) => unitsWithin(state, map, user, from, ABILITY.gale.range),
  resolve(ctx, user, target) {
    const u = unitAt(ctx.state, target.hex!)!;
    log(ctx, `${unitName(user)} calls up a gale.`);
    hit(ctx, user, u, 'The gale');
    if (!u.alive || u.hero === CAMEL) return;
    for (let i = 0; i < ABILITY.gale.push; i++) {
      const to = pushedTo(ctx.state, ctx.map, user.hex!, u);
      if (!to) break;
      enterHex(ctx, u, to, 'push');
    }
  },
};

/**
 * Thunderclap (proposed, 2026-10-23): a unit within 3 takes the Storm
 * Caller's power, and its card is Delayed 3 slots (keywords.md, 17.3;
 * colliding as any placement does). A card can be Delayed once between
 * its own turns (the delay limit, 3.6, at its simplest).
 */
const thunderclap: AbilityDef = {
  id: 'thunderclap',
  name: 'Thunderclap',
  kind: 'attack',
  range: ABILITY.thunderclap.range,
  radius: 0,
  summary: (user) =>
    `A unit within ${ABILITY.thunderclap.range} takes ${damageText(user)} and its next turn comes ${ABILITY.thunderclap.delay} slots later (once between its turns).`,
  targetsUnit: true,
  targets: (state, map, user, from) =>
    unitsWithin(state, map, user, from, ABILITY.thunderclap.range),
  resolve(ctx, user, target) {
    const u = unitAt(ctx.state, target.hex!)!;
    log(ctx, `${unitName(user)} calls down thunder.`);
    hit(ctx, user, u, 'The thunderclap');
    if (!u.alive || u.slot === null || u.delayed) return;
    u.delayed = true;
    const from = u.slot;
    placeCard(ctx.state, u, from + ABILITY.thunderclap.delay);
    log(ctx, `${unitName(u)} is Delayed ${u.slot! - from} slots.`);
  },
};

/**
 * Rain-stone Ward (proposed, 2026-10-23): a unit within 3, the Storm
 * Caller included, has Shield 2 until the Storm Caller's next turn
 * (keywords.md, 17.6). One ward at a time: a new one lifts the last.
 */
const ward: AbilityDef = {
  id: 'ward',
  name: 'Rain-stone Ward',
  kind: 'control',
  range: ABILITY.ward.range,
  radius: 0,
  summary: () =>
    `A unit within ${ABILITY.ward.range}, you included, has Shield ${ABILITY.ward.shield} until your next turn: damage takes it first.`,
  targets: (state, map, _user, from) =>
    hexesWithin(map, from, ABILITY.ward.range, (h) => unitAt(state, h) !== undefined),
  resolve(ctx, user, target) {
    const u = unitAt(ctx.state, target.hex!)!;
    for (const other of ctx.state.units) if (other.shield?.source === user.id) delete other.shield;
    u.shield = {amount: ABILITY.ward.shield, source: user.id};
    log(ctx, `${unitName(user)} wards ${unitName(u)}.`);
  },
};

// ─── Bökh Champion ───────────────────────────────────────────────────────────

/** Whether `user` is grappling `u`. */
export function grappling(user: Unit, u: Unit): boolean {
  return u.statuses.some((s) => s.grapple?.champion === user.id && s.grapple.target === u.id);
}

/**
 * Throw (owner, 2026-10-23): only the unit the Champion grapples, Moved to
 * any free space next to the Champion, or swapping places with it (the
 * Champion's own hex as the landing; owner, 2026-10-23), then struck. Either
 * way the two stay next to each other, so the grapple holds. An Immobilized
 * Champion can't swap: it would move itself.
 */
const throwAbility: AbilityDef = {
  id: 'throw',
  name: 'Throw',
  kind: 'attack',
  summary: (user) =>
    `Melee, on the unit you grapple: Move it to a free space next to you, or swap places with it, then it takes ${damageText(user)}. The grapple holds.`,
  targetsUnit: true,
  targets(state, map, user, from) {
    const out: ActionTarget[] = [];
    for (const t of adjacentUnits(state, from, (u) => u !== user && grappling(user, u))) {
      const landings = hexNeighbors(from).filter((h) => walkable(map, h) && !unitAt(state, h));
      if (!isImmobilized(user)) landings.push(from);
      for (const to of sortByHex(landings, (h) => h)) out.push({hex: t.hex!, to});
    }
    return out;
  },
  resolve(ctx, user, target) {
    const u = unitAt(ctx.state, target.hex!)!;
    if (hexEquals(target.to!, user.hex!)) {
      const at = u.hex!;
      log(ctx, `${unitName(user)} swaps places with ${unitName(u)}.`);
      // Each enters the other's space; side by side still, the grapple holds.
      enterHex(ctx, u, user.hex!, 'swap', true);
      enterHex(ctx, user, at, 'swap', true);
    } else {
      log(ctx, `${unitName(user)} throws ${unitName(u)}.`);
      enterHex(ctx, u, target.to!, 'throw');
    }
    hit(ctx, user, u, 'The throw');
  },
};

const grapple: AbilityDef = {
  id: 'grapple',
  name: 'Grapple',
  kind: 'attack',
  summary: (user) =>
    `Melee: it takes ${damageText(user)} and is Stunned until you take damage, are Stunned or end a turn no longer next to it, taking ${ABILITY.grapple.squeeze} more at each of your turns meanwhile. One at a time.`,
  targetsUnit: true,
  // Melee only (owner, 2026-10-23; reached 2 spaces, stepping in, before),
  // and not the unit it already grapples.
  targets: (state, _map, user, from) =>
    adjacentUnits(state, from, (u) => u !== user && !grappling(user, u)),
  resolve(ctx, user, target) {
    const u = unitAt(ctx.state, target.hex!)!;
    log(ctx, `${unitName(user)} grapples ${unitName(u)}.`);
    hit(ctx, user, u, 'The grapple');
    if (!u.alive) return;
    // One target at a time: an earlier grapple lets go.
    endGrapples(ctx, (g) => g.champion === user.id);
    stun(ctx, u, {kind: 'stunned', grapple: {champion: user.id, target: u.id}});
  },
};

// ─── Wolf ────────────────────────────────────────────────────────────────────

const bite: AbilityDef = {
  id: 'bite',
  name: 'Bite',
  kind: 'attack',
  summary: (user) => `Melee: ${damageText(user)}.`,
  targetsUnit: true,
  targets: (state, _map, user, from) => adjacentUnits(state, from, (u) => u !== user),
  resolve(ctx, user, target) {
    const u = unitAt(ctx.state, target.hex!)!;
    log(ctx, `${unitName(user)} bites ${unitName(u)}.`);
    hit(ctx, user, u, 'The bite');
  },
};

export const ABILITIES: Record<AbilityId, AbilityDef> = {
  hold,
  bow,
  volley,
  hail,
  gale,
  thunderclap,
  ward,
  grapple,
  throw: throwAbility,
  bite,
};

export function abilitiesOf(unit: Unit): AbilityDef[] {
  return HEROES[unit.hero].abilities.map((id) => ABILITIES[id]);
}

/** Why the unit can't use the ability at all right now, or null if it can. */
export function unusableReason(unit: Unit, ability: AbilityDef): string | null {
  if (!HEROES[unit.hero].abilities.includes(ability.id))
    return 'That unit doesn’t have that ability.';
  return null;
}

export function sameTarget(a: ActionTarget, b: ActionTarget): boolean {
  const eq = (x?: Hex, y?: Hex) =>
    x === undefined ? y === undefined : y !== undefined && hexEquals(x, y);
  return eq(a.hex, b.hex) && eq(a.to, b.to);
}
