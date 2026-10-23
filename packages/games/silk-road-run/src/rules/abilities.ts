/**
 * The three prototype heroes' abilities (roster.md; owner, 2026-10-23) and
 * the wolf's. Each lists its legal targets from a hex (for validation,
 * previews and the AI) and resolves on the fight state. Every ability
 * deals exactly its user's power in damage; shapes come from config.ts.
 */
import {hexEquals, hexNeighbor, hexNeighbors, hexesInRange} from '@canvas/engine/server';
import type {Hex} from '@canvas/engine/server';
import {ABILITY, HEROES} from './config';
import {arrowLane, isImmobilized, onMap, sortByHex, unitAt, walkable} from './board';
import type {ArrowLane} from './board';
import {
  clearOverwatch,
  endGrapples,
  enterHex,
  hailHolds,
  hit,
  log,
  record,
  stun,
  unitName,
} from './resolve';
import type {Ctx} from './resolve';
import {tileAt} from './map';
import type {MapData} from './map';
import type {AbilityId, ActionTarget, FightState, Unit} from './types';

/**
 * What an ability is broadly for, shown as an icon by its name: hurting
 * enemies, controlling the board (statuses, hail), or helping (healing).
 */
export type AbilityKind = 'attack' | 'control' | 'support';

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

export type {ArrowLane};

/**
 * The bow's six lanes from `from` (`arrowLane` in board.ts). For the page
 * to show where an arrow can fly, hit or not.
 */
export function arrowLanes(state: FightState, map: MapData, from: Hex): ArrowLane[] {
  return DIRECTIONS.map((dir) => arrowLane(state, map, from, dir));
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
 * Overwatch (owner, 2026-10-23): one of the bow's lanes, aimed by its first
 * hex, held until the Outrider's next turn. The first unit to enter the
 * lane, walking (even passing through) or Moved, ally or enemy, is shot
 * for the Outrider's power, and the overwatch ends; it ends too if the
 * Outrider is Stunned (`overwatchFires`, `stun` in resolve.ts).
 */
const overwatch: AbilityDef = {
  id: 'overwatch',
  name: 'Overwatch',
  kind: 'attack',
  summary: (user) =>
    `Watch one lane until your next turn: the first unit to enter it, even passing through, takes ${damageText(user)}. Ends if you are Stunned.`,
  targets: (state, map, _user, from) =>
    sortByHex(
      DIRECTIONS.map((dir) => arrowLane(state, map, from, dir).hexes[0]).filter(
        (h): h is Hex => h !== undefined
      ),
      (h) => h
    ).map((hex) => ({hex})),
  resolve(ctx, user, target) {
    const dir = DIRECTIONS.find((d) => hexEquals(hexNeighbor(user.hex!, d), target.hex!))!;
    clearOverwatch(ctx.state, user);
    (ctx.state.overwatch ??= []).push({source: user.id, dir});
    log(ctx, `${unitName(user)} watches a lane.`);
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

/**
 * Sunlight (owner, 2026-10-23): one space within 3, at once. Hail there
 * melts (and with it the Immobilized it gave); a unit there is healed
 * `ABILITY.sunlight.heal`, never past its health, and cleansed of every
 * status, a grapple's Stun included, which ends the grapple.
 */
const sunlight: AbilityDef = {
  id: 'sunlight',
  name: 'Sunlight',
  kind: 'support',
  range: ABILITY.sunlight.range,
  radius: 0,
  summary: () =>
    `Sunlight on a space: a unit there heals ${ABILITY.sunlight.heal} and is cleansed of every status (a grapple on it ends), and hail there melts.`,
  // Only where it would do something: a unit or hail.
  targets: (state, map, _user, from) =>
    hexesWithin(
      map,
      from,
      ABILITY.sunlight.range,
      (h) =>
        tileAt(map, h) !== 'obstacle' &&
        (unitAt(state, h) !== undefined || state.effects.some((e) => hexEquals(e.hex, h)))
    ),
  resolve(ctx, user, target) {
    const hex = target.hex!;
    log(ctx, `${unitName(user)} calls down sunlight.`);
    const hail = ctx.state.effects.find((e) => hexEquals(e.hex, hex));
    if (hail) {
      ctx.state.effects = ctx.state.effects.filter((e) => e !== hail);
      for (const u of ctx.state.units)
        u.statuses = u.statuses.filter((s) => s.hail !== hail.source);
      log(ctx, 'The sunlight melts the hail.');
    }
    const u = unitAt(ctx.state, hex);
    if (!u) return;
    const healed = Math.min(ABILITY.sunlight.heal, u.maxHp - u.hp);
    if (healed > 0) {
      u.hp += healed;
      log(ctx, `The sunlight heals ${unitName(u)} for ${healed}.`);
      record(ctx.state, {kind: 'heal', unitId: u.id, amount: healed});
    }
    if (u.statuses.length > 0) {
      const grappled = u.statuses.some((s) => s.grapple);
      u.statuses = [];
      log(ctx, `The sunlight cleanses ${unitName(u)}${grappled ? ', breaking the grapple' : ''}.`);
    }
  },
};

/**
 * Fog (owner, 2026-10-23): one space within 3, until the Storm Caller's
 * next turn. A unit standing in it, ally or enemy, is Degraded: its
 * abilities deal `ABILITY.fog.degrade` less (`hit` in resolve.ts). It
 * Degrades whoever stands there when they act, not whoever is struck there.
 */
const fog: AbilityDef = {
  id: 'fog',
  name: 'Fog',
  kind: 'control',
  range: ABILITY.fog.range,
  radius: ABILITY.fog.radius,
  summary: () =>
    `Fog on a space until your next turn: a unit standing in it is Degraded, its abilities dealing ${ABILITY.fog.degrade} less.`,
  targets: (_state, map, _user, from) =>
    hexesWithin(map, from, ABILITY.fog.range, (h) => tileAt(map, h) !== 'obstacle'),
  resolve(ctx, user, target) {
    const hex = target.hex!;
    ctx.state.fog = (ctx.state.fog ?? []).filter((f) => !hexEquals(f.hex, hex));
    ctx.state.fog.push({hex, source: user.id});
    log(ctx, `${unitName(user)} calls down fog.`);
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
  overwatch,
  hail,
  sunlight,
  fog,
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
