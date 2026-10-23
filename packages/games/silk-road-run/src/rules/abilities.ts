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
  hexesInRange,
} from '@canvas/engine/server';
import type {Hex} from '@canvas/engine/server';
import {ABILITY, HEROES} from './config';
import {isImmobilized, onMap, sortByHex, unitAt, walkable} from './board';
import {endGrapples, enterHex, hailHolds, hit, log, stun, unitName} from './resolve';
import type {Ctx} from './resolve';
import {tileAt} from './map';
import type {MapData} from './map';
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
   * Its user may step in next to a unit first (Grapple's step): a target
   * with `to` is the hex it steps to, picked second.
   */
  stepsIn?: boolean;
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

// ─── Bökh Champion ───────────────────────────────────────────────────────────

/** Whether `user` is grappling `u`. */
function grappling(user: Unit, u: Unit): boolean {
  return u.statuses.some((s) => s.grapple?.champion === user.id && s.grapple.target === u.id);
}

/**
 * Throw (owner, 2026-10-23): only the unit the Champion grapples, Moved to
 * a free space next to it, then struck. The grapple holds only if it lands
 * next to the Champion.
 */
const throwAbility: AbilityDef = {
  id: 'throw',
  name: 'Throw',
  kind: 'attack',
  summary: (user) =>
    `Melee, on the unit you grapple: Move it to a free space next to it, then it takes ${damageText(user)}. Landing away from you breaks the grapple.`,
  targetsUnit: true,
  targets(state, map, user, from) {
    const out: ActionTarget[] = [];
    for (const t of adjacentUnits(state, from, (u) => u !== user && grappling(user, u)))
      for (const to of sortByHex(
        hexNeighbors(t.hex!).filter((h) => walkable(map, h) && !unitAt(state, h)),
        (h) => h
      ))
        out.push({hex: t.hex!, to});
    return out;
  },
  resolve(ctx, user, target) {
    const u = unitAt(ctx.state, target.hex!)!;
    log(ctx, `${unitName(user)} throws ${unitName(u)}.`);
    enterHex(ctx, u, target.to!, 'throw');
    hit(ctx, user, u, 'The throw');
  },
};

const grapple: AbilityDef = {
  id: 'grapple',
  name: 'Grapple',
  kind: 'attack',
  range: ABILITY.grapple.range,
  summary: (user) =>
    `Step in next to a unit within ${ABILITY.grapple.range} spaces: it takes ${damageText(user)} and is Stunned until you take damage, are Stunned or are no longer next to it. One at a time.`,
  stepsIn: true,
  targetsUnit: true,
  targets: (state, map, user, from) => stepInTargets(state, map, user, from, ABILITY.grapple.range),
  resolve(ctx, user, target) {
    if (target.to) {
      enterHex(ctx, user, target.to);
      if (!user.alive) return;
    }
    const u = unitAt(ctx.state, target.hex!)!;
    log(ctx, `${unitName(user)} grapples ${unitName(u)}.`);
    hit(ctx, user, u, 'The grapple');
    if (!u.alive) return;
    // One target at a time: an earlier grapple lets go.
    endGrapples(ctx, (g) => g.champion === user.id && g.target !== u.id);
    if (!grappling(user, u))
      stun(ctx, u, {kind: 'stunned', grapple: {champion: user.id, target: u.id}});
  },
};

/**
 * Targets for Grapple: every unit next to `from`, then every unit within
 * `reach`, once for each free space beside it the user can get to in
 * `reach - 1` steps (`to`). Immobilized, only the first.
 */
function stepInTargets(
  state: FightState,
  map: MapData,
  user: Unit,
  from: Hex,
  reach: number
): ActionTarget[] {
  const out = adjacentUnits(state, from, (u) => u !== user);
  if (isImmobilized(user)) return out;
  const far = state.units.filter(
    (u) =>
      u.alive &&
      u.hex &&
      u !== user &&
      hexDistance(u.hex, from) > 1 &&
      hexDistance(u.hex, from) <= reach
  );
  for (const u of sortByHex(far, (x) => x.hex!))
    for (const to of stepLandings(state, map, from, u.hex!, reach)) out.push({hex: u.hex!, to});
  return out;
}

/**
 * The free walkable spaces a step in may end on, beside `target`: at most
 * `reach - 1` steps from `from`, each onto a free walkable space, as
 * walking is blocked.
 */
function stepLandings(
  state: FightState,
  map: MapData,
  from: Hex,
  target: Hex,
  reach: number
): Hex[] {
  const seen = new Set<string>([`${from.q},${from.r}`]);
  const out: Hex[] = [];
  let frontier = [from];
  for (let step = 1; step < reach; step++) {
    const next: Hex[] = [];
    for (const f of frontier)
      for (const h of hexNeighbors(f)) {
        const k = `${h.q},${h.r}`;
        if (seen.has(k) || !walkable(map, h) || unitAt(state, h)) continue;
        seen.add(k);
        next.push(h);
        if (hexDistance(h, target) === 1) out.push(h);
      }
    frontier = next;
  }
  return sortByHex(out, (h) => h);
}

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
  hail,
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
