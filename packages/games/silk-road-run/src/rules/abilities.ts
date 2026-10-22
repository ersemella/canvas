/**
 * The three prototype heroes' abilities (brief section 4), and the Modao
 * Vanguard's. Each lists its
 * legal targets from a hex (for validation, previews and the AI) and
 * resolves on the fight state. Values come from config.ts.
 */
import {
  hexDirectionTo,
  hexDistance,
  hexEquals,
  hexNeighbor,
  hexNeighbors,
  hexesInRange,
} from '@canvas/engine/server';
import type {Hex} from '@canvas/engine/server';
import {ABILITY, HEROES, RULES} from './config';
import {
  addStatus,
  setBarrier,
  isImmobilized,
  isPinned,
  obscured,
  onMap,
  sortByHex,
  unitAt,
  walkable,
} from './board';
import {displace, enterHex, heal, hit, log, push, scaled, unitName} from './resolve';
import type {Ctx} from './resolve';
import {tileAt} from './map';
import type {MapData} from './map';
import type {AbilityId, ActionTarget, FightState, PassiveId, Unit} from './types';

/**
 * What an ability is broadly for, shown as an icon by its name: hurting
 * enemies, healing, moving its user, or controlling the board (statuses,
 * hail).
 */
export type AbilityKind = 'attack' | 'heal' | 'move' | 'control';

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
   * A ground-targeted area (hail, Volley, Freeze): the hexes within this
   * of the target hex (0: the hex alone). Its effect doesn't depend on
   * where the user stands. None for the rest.
   */
  radius?: number;
  /**
   * One line for the side panel, with damage and healing scaled by the
   * user's power (defence and Vulnerable still apply on the hit).
   * Range is left out, and so is duration: the panel lists it with the cost.
   */
  summary(user: Unit): string;
  ultimate: boolean;
  /** Charged (3.7): the card moves by `cost`, then the ability triggers when reached. */
  charged: boolean;
  /** Action cost, or the charge cost for a charged ability. */
  cost: number;
  recoveryCost?: number;
  /** How many slots its effect lasts, if it lingers; the stat sheet lists it beside the cost. */
  duration?: number;
  /** Moves the user, so Immobilized forbids it (17.5). */
  movesSelf: boolean;
  /**
   * Its user may step in next to a unit first (Lunge's bound, Grapple's
   * step): a target with `to` is the hex it steps to, picked second.
   */
  stepsIn?: boolean;
  /** A damaging charged ability, which Taunt redirects onto the taunter (17.5). */
  damaging?: boolean;
  /**
   * Aimed at a unit (melee, and the bow), not at a hex: with no unit to aim
   * at, the page disables it. Ground-targeted abilities can be aimed at an
   * empty hex on purpose (hail to deny it, a charge where enemies will be).
   */
  targetsUnit?: boolean;
  /** Legal targets with the user standing on `from`. */
  targets(state: FightState, map: MapData, user: Unit, from: Hex): ActionTarget[];
  /** Resolves the ability now (a charged one triggers here). */
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

function unitsInArea(state: FightState, center: Hex, radius: number): Unit[] {
  return state.units.filter((u) => u.alive && u.hex && hexDistance(u.hex, center) <= radius);
}

const hold: AbilityDef = {
  id: 'hold',
  name: 'Hold',
  summary: () => 'End the turn with no effect.',
  ultimate: false,
  charged: false,
  cost: ABILITY.hold.cost,
  movesSelf: false,
  targets: () => [{}],
  resolve: (ctx, user) => log(ctx, `${unitName(user)} holds.`),
};

// ─── Mangudai Outrider ───────────────────────────────────────────────────────

/** An arrow's flight along one hex direction: the hexes it crosses, and the unit it stops at. */
export interface ArrowLane {
  hexes: Hex[];
  hit?: Unit;
  /** The Obscured hex the lane stopped short of, if a sandstorm stopped it. */
  storm?: Hex;
  /** The unit the arrow would have hit in or past that sandstorm, which it can't. */
  hidden?: Unit;
}

/**
 * The bow's six lanes from `from`: each runs until the first unit (which
 * it hits), an obstacle, an Obscured hex (which it can't target in or
 * through, so it stops short of it) or the map's edge (the bow has no range
 * limit). From an Obscured hex every lane is empty: the bow can't shoot out
 * of a sandstorm (owner, 2026-10-21). For the page to show where an arrow
 * can fly, hit or not.
 */
export function arrowLanes(state: FightState, map: MapData, from: Hex): ArrowLane[] {
  const blind = obscured(state, map, from);
  return DIRECTIONS.map((dir) => {
    const lane: ArrowLane = {hexes: []};
    if (blind) return lane;
    let h = from;
    for (let i = 0; i < ABILITY.bow.range; i++) {
      h = hexNeighbor(h, dir);
      if (!onMap(map, h) || tileAt(map, h) === 'obstacle') break;
      if (obscured(state, map, h)) {
        lane.storm = h;
        const hidden = unitInLane(state, map, h, dir);
        if (hidden) lane.hidden = hidden;
        break;
      }
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

/** The first unit from `h` on along `dir`, before an obstacle or the map's edge. */
function unitInLane(state: FightState, map: MapData, h: Hex, dir: number): Unit | undefined {
  for (; onMap(map, h) && tileAt(map, h) !== 'obstacle'; h = hexNeighbor(h, dir)) {
    const u = unitAt(state, h);
    if (u) return u;
  }
  return undefined;
}

const bow: AbilityDef = {
  id: 'bow',
  name: 'Bow',
  kind: 'attack',
  summary: (user) => `Shoot straight for ${scaled(ABILITY.bow.damage, user.power)} damage.`,
  ultimate: false,
  charged: false,
  cost: ABILITY.bow.cost,
  movesSelf: false,
  targetsUnit: true,
  targets(state, map, _user, from) {
    return arrowLanes(state, map, from)
      .filter((lane) => lane.hit)
      .map((lane) => ({hex: lane.hit!.hex!}));
  },
  resolve(ctx, user, target) {
    const u = unitAt(ctx.state, target.hex!)!;
    hit(ctx, user, u, ABILITY.bow.damage, `${unitName(user)}'s arrow`);
  },
};

/** Where a Leap along `dir` lands: two hexes on, over anything, if that hex is on the map, walkable and free. */
function leapLanding(state: FightState, map: MapData, from: Hex, dir: number): Hex | undefined {
  const over = hexNeighbor(from, dir);
  const land = hexNeighbor(over, dir);
  if (!onMap(map, over) || !walkable(map, land) || unitAt(state, land)) return undefined;
  return land;
}

const leap: AbilityDef = {
  id: 'leap',
  name: 'Leap',
  kind: 'move',
  summary: () => `Jump over one space in a straight line: ruins, a unit or a hazard.`,
  ultimate: false,
  charged: false,
  cost: ABILITY.leap.cost,
  movesSelf: true,
  targets(state, map, _user, from) {
    const out: ActionTarget[] = [];
    for (const d of DIRECTIONS) {
      const hex = leapLanding(state, map, from, d);
      if (hex) out.push({hex});
    }
    return out;
  },
  resolve(ctx, user, target) {
    // The hex leapt over has no effect; the one it lands on does.
    enterHex(ctx, user, target.hex!, true, 'leap');
    log(ctx, `${unitName(user)} leaps.`);
  },
};

const volley: AbilityDef = {
  id: 'volley',
  name: 'Volley',
  kind: 'attack',
  range: ABILITY.volley.range,
  radius: ABILITY.volley.radius,
  summary: (user) =>
    `Units in a targeted area take ${scaled(ABILITY.volley.damage, user.power)} damage.`,
  ultimate: true,
  charged: true,
  cost: ABILITY.volley.chargeCost,
  recoveryCost: ABILITY.volley.recoveryCost,
  movesSelf: false,
  damaging: true,
  targets: (_state, map, _user, from) => hexesWithin(map, from, ABILITY.volley.range),
  resolve(ctx, user, target) {
    log(ctx, `${unitName(user)}'s Volley lands.`);
    for (const u of unitsInArea(ctx.state, target.hex!, ABILITY.volley.radius)) {
      hit(ctx, user, u, ABILITY.volley.damage, 'The Volley');
    }
  },
};

// ─── Yadachy Storm Caller ────────────────────────────────────────────────────

const sunlight: AbilityDef = {
  id: 'sunlight',
  name: 'Sunlight',
  kind: 'heal',
  range: ABILITY.sunlight.range,
  summary: (user) =>
    `Light a space: a unit in it is healed for ${scaled(ABILITY.sunlight.heal, user.power)}, and hail there is cleared.`,
  ultimate: false,
  charged: false,
  cost: ABILITY.sunlight.cost,
  movesSelf: false,
  // A space, not a unit (owner, 2026-10-21): an empty one can be cleared of
  // hail, and a sandstorm doesn't stop it.
  targets: (_state, map, _user, from) =>
    hexesWithin(map, from, ABILITY.sunlight.range, (h) => tileAt(map, h) !== 'obstacle'),
  resolve(ctx, user, target) {
    const h = target.hex!;
    const u = unitAt(ctx.state, h);
    if (u) {
      log(ctx, `${unitName(user)} calls down sunlight on ${unitName(u)}.`);
      heal(ctx, u, scaled(ABILITY.sunlight.heal, user.power));
    } else {
      log(ctx, `${unitName(user)} calls down sunlight.`);
    }
    // Clears the storm from that hex only (owner, 2026-10-21).
    ctx.state.effects = ctx.state.effects.filter((e) => !hexEquals(e.hex, h));
  },
};

const hail: AbilityDef = {
  id: 'hail',
  name: 'Hail',
  kind: 'control',
  range: ABILITY.hail.range,
  radius: ABILITY.hail.radius,
  summary: (user) =>
    `Hail on an area: every unit in it takes ${scaled(ABILITY.hail.damage, user.power)} damage and is Pushed ${ABILITY.hail.castPush}, allies too. It stays: a unit that starts its turn in it takes ${scaled(ABILITY.hail.turnDamage, user.power)} damage.`,
  duration: ABILITY.hail.hexSlots,
  ultimate: false,
  charged: false,
  cost: ABILITY.hail.cost,
  movesSelf: false,
  targets: (_state, map, _user, from) =>
    hexesWithin(map, from, ABILITY.hail.range, (h) => tileAt(map, h) !== 'obstacle'),
  resolve(ctx, user, target) {
    const area = hexesWithin(ctx.map, target.hex!, ABILITY.hail.radius, (h) =>
      walkable(ctx.map, h)
    ).map((t) => t.hex!);
    ctx.state.effects = ctx.state.effects.filter((e) => !area.some((h) => hexEquals(e.hex, h)));
    for (const hex of area)
      ctx.state.effects.push({
        kind: 'hail',
        hex,
        untilSlot: ctx.slot + ABILITY.hail.hexSlots,
        push: 0,
        damage: scaled(ABILITY.hail.turnDamage, user.power),
      });
    log(ctx, `${unitName(user)} calls down hail.`);
    // The caster's own card is placed after this turn's, so it isn't Pushed.
    const struck = unitsInArea(ctx.state, target.hex!, ABILITY.hail.radius)
      .filter((u) => u !== user)
      .sort((a, b) => unitOrder(a) - unitOrder(b));
    for (const u of struck) {
      hit(ctx, user, u, ABILITY.hail.damage, 'The hail');
      push(ctx, u, ABILITY.hail.castPush);
    }
  },
};

const freeze: AbilityDef = {
  id: 'freeze',
  name: 'Freeze',
  kind: 'control',
  range: ABILITY.freeze.range,
  radius: ABILITY.freeze.radius,
  summary: (user) =>
    `Units in a targeted area take ${scaled(ABILITY.freeze.damage, user.power)} damage and are Immobilized and Vulnerable ${ABILITY.freeze.vulnerable}%.`,
  duration: ABILITY.freeze.immobilizedSlots,
  ultimate: true,
  charged: false,
  cost: ABILITY.freeze.cost,
  movesSelf: false,
  targets: (_state, map, _user, from) => hexesWithin(map, from, ABILITY.freeze.range),
  resolve(ctx, user, target) {
    log(ctx, `${unitName(user)}'s Freeze takes hold.`);
    const untilSlot = ctx.slot + ABILITY.freeze.immobilizedSlots;
    for (const u of unitsInArea(ctx.state, target.hex!, ABILITY.freeze.radius)) {
      hit(ctx, user, u, ABILITY.freeze.damage, 'The Freeze');
      if (!u.alive) continue;
      addStatus(u, {kind: 'immobilized', value: 0, untilSlot});
      addStatus(u, {kind: 'vulnerable', value: ABILITY.freeze.vulnerable, untilSlot});
    }
  },
};

// ─── Bökh Champion ───────────────────────────────────────────────────────────

/** Whether `user` is grappling `u`. */
function grappling(user: Unit, u: Unit): boolean {
  return u.statuses.some((s) => s.grapple?.champion === user.id && s.grapple.target === u.id);
}

/**
 * Throw (owner, 2026-10-22, playtest; parked the same day): only the unit
 * the Champion is grappling, to another free space next to the Champion,
 * or one space straight back. Either stays within Grapple's range, so the
 * grapple holds (it ended two away while Grapple held only adjacent units).
 */
const throwAbility: AbilityDef = {
  id: 'throw',
  name: 'Throw',
  kind: 'attack',
  summary: (user) =>
    `Melee, on the unit you grapple: ${scaled(ABILITY.throw.damage, user.power)} damage, then throw it to another free space next to you, or one space straight back.`,
  ultimate: false,
  charged: false,
  cost: ABILITY.throw.cost,
  movesSelf: false,
  targetsUnit: true,
  targets(state, map, user, from) {
    const free = (h: Hex) => walkable(map, h) && !unitAt(state, h);
    const beside = hexNeighbors(from).filter(free);
    const out: ActionTarget[] = [];
    for (const t of adjacentUnits(state, from, (u) => u !== user && grappling(user, u))) {
      const back = hexNeighbor(t.hex!, direction(from, t.hex!));
      const landings = free(back) ? [...beside, back] : beside;
      for (const to of sortByHex(landings, (h) => h)) out.push({hex: t.hex!, to});
    }
    return out;
  },
  resolve(ctx, user, target) {
    const u = unitAt(ctx.state, target.hex!)!;
    log(ctx, `${unitName(user)} throws ${unitName(u)}.`);
    hit(ctx, user, u, ABILITY.throw.damage, 'The throw');
    if (u.alive) enterHex(ctx, u, target.to!, true, 'throw');
  },
};

const grapple: AbilityDef = {
  id: 'grapple',
  name: 'Grapple',
  kind: 'attack',
  range: ABILITY.grapple.range,
  summary: (user) =>
    `Step in next to a unit within ${ABILITY.grapple.range} spaces: ${scaled(ABILITY.grapple.damage, user.power)} damage, and it is pinned, Immobilized while you stay next to it. One at a time: a new grapple lets the last go.`,
  duration: ABILITY.grapple.slots,
  ultimate: false,
  charged: false,
  cost: ABILITY.grapple.cost,
  movesSelf: false,
  stepsIn: true,
  targetsUnit: true,
  // A unit next to it, or within `range` after a step in (owner,
  // 2026-10-22), as Lunge bounds; Immobilized, only one next to it.
  targets: (state, map, user, from) => stepInTargets(state, map, user, from, ABILITY.grapple.range),
  resolve(ctx, user, target) {
    if (target.to) {
      enterHex(ctx, user, target.to);
      if (!user.alive) return;
    }
    const u = unitAt(ctx.state, target.hex!)!;
    log(ctx, `${unitName(user)} grapples ${unitName(u)}.`);
    hit(ctx, user, u, ABILITY.grapple.damage, 'The grapple');
    if (u.alive) pinUnit(ctx, user, u);
  },
};

/**
 * Targets for an ability that may step in first (Grapple, Lunge): every
 * unit next to `from`, then every unit within `reach`, once for each free
 * hex beside it the user can step to (`to`). Immobilized, only the first.
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
    for (const to of lungeLandings(state, map, from, u.hex!, reach)) out.push({hex: u.hex!, to});
  return out;
}

/**
 * Grapple's pin on `u`: Immobilized, and nothing else (owner, 2026-10-22;
 * Vulnerable and Pinned before), tagged with the grapple so breaking it
 * clears it. One target at a time: any earlier grapple by `user` ends.
 * The Champion stays free: moving out of range of the target breaks the
 * grapple (resolve.ts).
 */
function pinUnit(ctx: Ctx, user: Unit, u: Unit): void {
  for (const other of ctx.state.units) {
    if (!grappling(user, other)) continue;
    other.statuses = other.statuses.filter((s) => s.grapple?.champion !== user.id);
    if (other !== u) log(ctx, `${unitName(user)} lets go of ${unitName(other)}.`);
  }
  const untilSlot = ctx.slot + ABILITY.grapple.slots;
  const grapple = {champion: user.id, target: u.id};
  addStatus(u, {kind: 'immobilized', value: 0, untilSlot, grapple});
}

/**
 * Shove (owner, 2026-10-22): melee, only on the unit the Champion is
 * pinning: it is Displaced away, which ends the grapple.
 */
const shove: AbilityDef = {
  id: 'shove',
  name: 'Shove',
  kind: 'control',
  summary: () =>
    `Melee, on the unit you pin: Displace it ${ABILITY.shove.displace} away, letting it go.`,
  ultimate: false,
  charged: false,
  cost: ABILITY.shove.cost,
  movesSelf: false,
  targetsUnit: true,
  targets: (state, _map, user, from) =>
    adjacentUnits(state, from, (u) => u !== user && grappling(user, u)),
  resolve(ctx, user, target) {
    const u = unitAt(ctx.state, target.hex!)!;
    log(ctx, `${unitName(user)} shoves ${unitName(u)}.`);
    displace(ctx, u, direction(user.hex!, u.hex!), ABILITY.shove.displace);
  },
};

/**
 * The free walkable hexes a Lunge (or Grapple's step) may land on, beside
 * `target`: at most `reach - 1` steps from `from`, each step onto a free
 * walkable hex, as walking is blocked.
 */
function lungeLandings(
  state: FightState,
  map: MapData,
  from: Hex,
  target: Hex,
  reach: number = ABILITY.lunge.reach
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

/**
 * The Bökh Champion's ultimate (owner, 2026-10-22; replaced Rampage): a
 * unit within `reach`, struck, then grappled as by Grapple. Next to the Champion
 * it strikes where it stands; otherwise it bounds to a free hex beside the
 * target (`to`), up to two steps away along free hexes, entering only that
 * hex.
 */
const lunge: AbilityDef = {
  id: 'lunge',
  name: 'Lunge',
  kind: 'attack',
  summary: (user) =>
    `Bound up to ${ABILITY.lunge.reach - 1} spaces to a unit: ${scaled(ABILITY.lunge.damage, user.power)} damage, then it is grappled, as by Grapple.`,
  range: ABILITY.lunge.reach,
  duration: ABILITY.grapple.slots,
  ultimate: true,
  charged: false,
  cost: ABILITY.lunge.cost,
  movesSelf: false,
  stepsIn: true,
  targetsUnit: true,
  /** Immobilized, only a unit next to it. */
  targets: (state, map, user, from) => stepInTargets(state, map, user, from, ABILITY.lunge.reach),
  resolve(ctx, user, target) {
    if (target.to) {
      enterHex(ctx, user, target.to, true, 'leap');
      if (!user.alive) return;
    }
    const u = unitAt(ctx.state, target.hex!)!;
    log(ctx, `${unitName(user)} lunges at ${unitName(u)}.`);
    hit(ctx, user, u, ABILITY.lunge.damage, 'The Lunge');
    if (!u.alive) return;
    pinUnit(ctx, user, u);
    log(ctx, `${unitName(user)} grapples ${unitName(u)}.`);
  },
};

// ─── Modao Vanguard ──────────────────────────────────────────────────────────

function direction(from: Hex, to: Hex): number {
  return hexDirectionTo(from, to)!;
}

/** The fixed order for units affected at once (3.3): the player's side first, then party slot. */
function unitOrder(u: Unit): number {
  return (u.side === 'player' ? 0 : 10) + u.partyIndex;
}

const challenge: AbilityDef = {
  id: 'challenge',
  name: 'Challenge',
  kind: 'control',
  range: ABILITY.challenge.range,
  summary: () =>
    `Taunt one unit in range; gain Barrier ${ABILITY.challenge.barrier} for ${ABILITY.challenge.barrierSlots} slots, replacing any.`,
  duration: ABILITY.challenge.tauntSlots,
  ultimate: false,
  charged: false,
  cost: ABILITY.challenge.cost,
  movesSelf: false,
  targetsUnit: true,
  // A call to fight, not a shot: no line of fire, and a sandstorm doesn't stop it.
  targets: (state, map, user, from) =>
    hexesWithin(map, from, ABILITY.challenge.range, (h) => {
      const u = unitAt(state, h);
      return u !== undefined && u !== user;
    }),
  resolve(ctx, user, target) {
    const u = unitAt(ctx.state, target.hex!)!;
    // A fresh taunt replaces this Vanguard's earlier one on the target.
    u.statuses = u.statuses.filter((s) => s.kind !== 'taunted' || s.source !== user.id);
    addStatus(u, {
      kind: 'taunted',
      value: 0,
      untilSlot: ctx.slot + ABILITY.challenge.tauntSlots,
      source: user.id,
    });
    setBarrier(user, ABILITY.challenge.barrier, ctx.slot + ABILITY.challenge.barrierSlots);
    log(ctx, `${unitName(user)} challenges ${unitName(u)}.`);
  },
};

/**
 * Reap's cone from `from` toward `dir`: the hex next to it, then the three
 * hexes behind that one, each on the map and not ruins. Ruins (or the map's
 * edge) on the hex next to it stop the whole cone.
 */
export function reapCone(map: MapData, from: Hex, dir: number): Hex[] {
  const front = hexNeighbor(from, dir);
  if (!walkable(map, front)) return [];
  const back = [(dir + 5) % 6, dir, (dir + 1) % 6].map((d) => hexNeighbor(front, d));
  return [front, ...back.filter((h) => walkable(map, h))];
}

const reap: AbilityDef = {
  id: 'reap',
  name: 'Reap',
  kind: 'attack',
  summary: (user) =>
    `Sweep a cone: the space next to you and the three behind it. Every unit in it takes ${scaled(ABILITY.reap.damage, user.power)} damage and is Pushed ${ABILITY.reap.push}.`,
  ultimate: false,
  charged: false,
  cost: ABILITY.reap.cost,
  movesSelf: false,
  // Aimed at the space next to it, which picks one of six cones; offered
  // only where the cone holds a unit (cones overlap, so a unit two spaces
  // away can be in two).
  targets(state, map, user, from) {
    return DIRECTIONS.filter((d) =>
      reapCone(map, from, d).some((h) => {
        const u = unitAt(state, h);
        return u !== undefined && u !== user;
      })
    ).map((d) => ({hex: hexNeighbor(from, d)}));
  },
  resolve(ctx, user, target) {
    log(ctx, `${unitName(user)} reaps.`);
    const victims = reapCone(ctx.map, user.hex!, direction(user.hex!, target.hex!))
      .map((h) => unitAt(ctx.state, h))
      .filter((u): u is Unit => u !== undefined)
      .sort((a, b) => unitOrder(a) - unitOrder(b));
    for (const u of victims) {
      hit(ctx, user, u, ABILITY.reap.damage, 'The reap');
      push(ctx, u, ABILITY.reap.push);
    }
  },
};

/**
 * Where an Advance may end its charge: where the Vanguard stands, or up to
 * `steps` hexes on along one of six straight lines, each a free walkable
 * hex (units and ruins stop it). Immobilized, only where it stands.
 */
export function advanceLandings(state: FightState, map: MapData, user: Unit, from: Hex): Hex[] {
  const out = [from];
  if (isImmobilized(user)) return out;
  for (const d of DIRECTIONS) {
    let h = from;
    for (let i = 0; i < ABILITY.advance.steps; i++) {
      h = hexNeighbor(h, d);
      if (!walkable(map, h) || unitAt(state, h)) break;
      out.push(h);
    }
  }
  return out;
}

const advance: AbilityDef = {
  id: 'advance',
  name: 'Advance',
  kind: 'attack',
  range: ABILITY.advance.steps,
  // Centred on where the charge ends: the six spaces around it.
  radius: ABILITY.advance.radius,
  summary: (user) =>
    `Charge up to ${ABILITY.advance.steps} spaces in a straight line, then every unit next to you takes ${scaled(ABILITY.advance.damage, user.power)} damage, is knocked back ${ABILITY.advance.displace} and Pushed ${ABILITY.advance.push}.`,
  ultimate: true,
  charged: false,
  cost: ABILITY.advance.cost,
  // The charge is optional, so Immobilized only keeps it in place.
  movesSelf: false,
  targets: (state, map, user, from) =>
    advanceLandings(state, map, user, from).map((hex) => ({hex})),
  resolve(ctx, user, target) {
    const start = user.hex;
    if (!start) return;
    if (!hexEquals(start, target.hex!)) {
      const dir = direction(start, target.hex!);
      for (let h = start; !hexEquals(h, target.hex!) && user.alive; ) {
        h = hexNeighbor(h, dir);
        enterHex(ctx, user, h);
      }
      if (!user.alive) return;
    }
    const centre = user.hex!;
    log(ctx, `${unitName(user)} advances like a wall.`);
    const victims = ctx.state.units
      .filter((u) => u.alive && u.hex && hexDistance(u.hex, centre) === 1)
      .sort((a, b) => unitOrder(a) - unitOrder(b));
    for (const u of victims) {
      hit(ctx, user, u, ABILITY.advance.damage, 'The advance');
      if (!u.alive) continue;
      displace(ctx, u, direction(centre, u.hex!), ABILITY.advance.displace);
      push(ctx, u, ABILITY.advance.push);
    }
  },
};

/** An always-on trait, shown on the stat sheet beside the abilities. */
export interface PassiveDef {
  id: PassiveId;
  name: string;
  summary(user: Unit): string;
}

export const PASSIVES: Record<PassiveId, PassiveDef> = {
  holdTheLine: {
    id: 'holdTheLine',
    name: 'Hold the Line',
    summary: (user) =>
      `An enemy that starts its turn next to you and moves away is struck as it goes: ${scaled(ABILITY.reap.damage, user.power)} damage and Pushed ${ABILITY.reap.push}.`,
  },
  inevitable: {
    id: 'inevitable',
    name: 'Inevitable',
    summary: () => 'Your card can’t be Pushed, by enemies or allies, hail included.',
  },
};

/** The hostile Vanguards with Hold the Line next to `unit`, as its turn starts. */
export function linesHeld(state: FightState, unit: Unit): Unit[] {
  if (!unit.hex) return [];
  return state.units
    .filter(
      (v) =>
        v.alive &&
        v.hex &&
        v.side !== unit.side &&
        HEROES[v.hero].passive === 'holdTheLine' &&
        hexDistance(v.hex, unit.hex!) === 1
    )
    .sort((a, b) => unitOrder(a) - unitOrder(b));
}

/**
 * Hold the Line (owner, 2026-10-22, playtest): `unit`, about to stand on
 * `next` by its own move this turn, is struck by each Vanguard in `held`
 * that it was next to when its turn started and leaves the reach of. The
 * damage lands now, before it gets away; the Push is returned, to apply
 * once its turn has placed its card. Each Vanguard strikes once a turn
 * (`held` loses it).
 */
export function holdTheLine(ctx: Ctx, unit: Unit, next: Hex, held: Unit[]): number {
  let pushes = 0;
  for (const v of [...held]) {
    if (!unit.alive) break;
    if (!v.alive || !v.hex || hexDistance(v.hex, next) <= 1) continue;
    held.splice(held.indexOf(v), 1);
    log(ctx, `${unitName(v)} holds the line.`);
    hit(ctx, v, unit, ABILITY.reap.damage, 'The parting blow');
    pushes += ABILITY.reap.push;
  }
  return pushes;
}

// ─── Wolf ────────────────────────────────────────────────────────────────────

const bite: AbilityDef = {
  id: 'bite',
  name: 'Bite',
  kind: 'attack',
  summary: (user) => `Melee: ${scaled(ABILITY.bite.damage, user.power)} damage.`,
  ultimate: false,
  charged: false,
  cost: ABILITY.bite.cost,
  movesSelf: false,
  targetsUnit: true,
  targets: (state, _map, user, from) => adjacentUnits(state, from, (u) => u !== user),
  resolve(ctx, user, target) {
    const u = unitAt(ctx.state, target.hex!)!;
    log(ctx, `${unitName(user)} bites ${unitName(u)}.`);
    hit(ctx, user, u, ABILITY.bite.damage, 'The bite');
  },
};

export const ABILITIES: Record<AbilityId, AbilityDef> = {
  hold,
  bow,
  leap,
  volley,
  sunlight,
  hail,
  freeze,
  throw: throwAbility,
  grapple,
  shove,
  lunge,
  challenge,
  reap,
  advance,
  bite,
};

export function abilitiesOf(unit: Unit): AbilityDef[] {
  return HEROES[unit.hero].abilities.map((id) => ABILITIES[id]);
}

/**
 * `def`'s targets for `unit` standing on `from`, as the rules allow them:
 * Pinned keeps only those on or next to `from` (owner, 2026-10-22,
 * playtest). Every caller that lists a turn's legal targets uses this.
 */
export function legalTargets(
  state: FightState,
  map: MapData,
  unit: Unit,
  def: AbilityDef,
  from: Hex
): ActionTarget[] {
  const all = def.targets(state, map, unit, from);
  if (!isPinned(unit)) return all;
  return all.filter((t) => !t.hex || hexDistance(t.hex, from) <= 1);
}

/** Why the unit can't use the ability at all right now, or null if it can. */
export function unusableReason(unit: Unit, ability: AbilityDef): string | null {
  if (!HEROES[unit.hero].abilities.includes(ability.id))
    return 'That unit doesn’t have that ability.';
  if (ability.ultimate) {
    if (unit.ultimateUsed) return 'The ultimate has already been used this fight.';
    if (unit.ultimateCharge < RULES.ultimateCharge) {
      return `The ultimate unlocks after ${RULES.ultimateCharge} action cost spent, not counting Holds without a move (${unit.ultimateCharge} so far).`;
    }
  }
  if (ability.movesSelf && isImmobilized(unit))
    return 'An Immobilized unit can’t use an ability that moves it.';
  return null;
}

export function sameTarget(a: ActionTarget, b: ActionTarget): boolean {
  const eq = (x?: Hex, y?: Hex) =>
    x === undefined ? y === undefined : y !== undefined && hexEquals(x, y);
  return eq(a.hex, b.hex) && eq(a.to, b.to);
}
