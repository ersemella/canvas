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
  cleanse,
  setBarrier,
  isImmobilized,
  obscured,
  onMap,
  sortByHex,
  unitAt,
  walkable,
} from './board';
import {
  applyHail,
  breakPins,
  enterHex,
  displace,
  heal,
  hit,
  log,
  push,
  scaled,
  unitName,
} from './resolve';
import type {Ctx} from './resolve';
import {tileAt} from './map';
import type {MapData} from './map';
import type {AbilityId, ActionTarget, FightState, Unit} from './types';

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

function direction(from: Hex, to: Hex): number {
  return hexDirectionTo(from, to)!;
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
    `Light a space: a unit in it is healed for ${scaled(ABILITY.sunlight.heal, user.power)} and cleansed, and hail there is cleared.`,
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
      cleanse(u);
      breakPins(ctx, u, true);
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
  radius: 0,
  summary: (user) =>
    `Hail on a space: units in it take ${scaled(ABILITY.hail.damage, user.power)} damage and are Slowed ${ABILITY.hail.slowed}.`,
  duration: ABILITY.hail.hexSlots,
  ultimate: false,
  charged: false,
  cost: ABILITY.hail.cost,
  movesSelf: false,
  targets: (_state, map, _user, from) =>
    hexesWithin(map, from, ABILITY.hail.range, (h) => tileAt(map, h) !== 'obstacle'),
  resolve(ctx, user, target) {
    const h = target.hex!;
    ctx.state.effects = ctx.state.effects.filter((e) => !hexEquals(e.hex, h));
    ctx.state.effects.push({
      kind: 'hail',
      hex: h,
      untilSlot: ctx.slot + ABILITY.hail.hexSlots,
      damage: scaled(ABILITY.hail.damage, user.power),
      slowed: ABILITY.hail.slowed,
      statusSlots: ABILITY.hail.statusSlots,
    });
    log(ctx, `${unitName(user)} calls down hail.`);
    const u = unitAt(ctx.state, h);
    if (u) applyHail(ctx, u);
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

const throwAbility: AbilityDef = {
  id: 'throw',
  name: 'Throw',
  kind: 'attack',
  summary: (user) =>
    `Melee: ${scaled(ABILITY.throw.damage, user.power)} damage, then throw the target to another free space next to you.`,
  ultimate: false,
  charged: false,
  cost: ABILITY.throw.cost,
  movesSelf: false,
  targetsUnit: true,
  targets(state, map, user, from) {
    const landing = hexNeighbors(from).filter((h) => walkable(map, h) && !unitAt(state, h));
    const out: ActionTarget[] = [];
    for (const t of adjacentUnits(state, from, (u) => u !== user)) {
      for (const to of sortByHex(landing, (h) => h)) out.push({hex: t.hex!, to});
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

const pin: AbilityDef = {
  id: 'pin',
  name: 'Pin',
  kind: 'control',
  summary: (user) =>
    `Melee, after an optional step: the target is Immobilized and Taunted and takes ${scaled(ABILITY.pin.damagePerSlot, user.power)} damage a slot, until you move away.`,
  duration: ABILITY.pin.slots,
  ultimate: false,
  charged: false,
  cost: ABILITY.pin.cost,
  movesSelf: false,
  targetsUnit: true,
  /**
   * A unit next to the Champion, or (owner, 2026-10-21) one a single step
   * would bring it next to: `to` is that step, to a free walkable hex. Not
   * stepping while Immobilized.
   */
  targets(state, map, user, from) {
    const out = adjacentUnits(state, from, (u) => u !== user);
    if (isImmobilized(user)) return out;
    for (const to of hexNeighbors(from)) {
      if (!walkable(map, to) || unitAt(state, to)) continue;
      for (const t of adjacentUnits(state, to, (u) => u !== user)) {
        if (hexDistance(t.hex!, from) > 1) out.push({hex: t.hex!, to});
      }
    }
    return out;
  },
  resolve(ctx, user, target) {
    if (target.to) {
      enterHex(ctx, user, target.to, true, 'walk');
      if (!user.alive) return;
    }
    const u = unitAt(ctx.state, target.hex!)!;
    const untilSlot = ctx.slot + ABILITY.pin.slots;
    // Tagged with the pin, so breaking it clears them all. The Champion
    // stays free: moving away from the target breaks the pin (resolve.ts).
    const pin = {champion: user.id, target: u.id};
    addStatus(u, {kind: 'immobilized', value: 0, untilSlot, pin});
    addStatus(u, {
      kind: 'crushed',
      value: scaled(ABILITY.pin.damagePerSlot, user.power),
      untilSlot,
      pin,
    });
    addStatus(u, {kind: 'taunted', value: 0, untilSlot, source: user.id, pin});
    log(ctx, `${unitName(user)} pins ${unitName(u)}.`);
  },
};

const rampage: AbilityDef = {
  id: 'rampage',
  name: 'Rampage',
  kind: 'attack',
  summary: () => `Rush in a straight line, knocking nearby units aside.`,
  ultimate: true,
  charged: false,
  cost: ABILITY.rampage.cost,
  movesSelf: true,
  targets(_state, map, _user, from) {
    // The target is the first hex in the chosen direction.
    return DIRECTIONS.map((d) => hexNeighbor(from, d))
      .filter((h) => walkable(map, h))
      .map((hex) => ({hex}));
  },
  resolve(ctx, user, target) {
    const dir = direction(user.hex!, target.hex!);
    log(ctx, `${unitName(user)} rampages.`);
    const hitAlready = new Set<string>([user.id]);
    let pos = user.hex!;
    let lastFree = pos;
    for (let i = 0; i < ABILITY.rampage.distance; i++) {
      const next = hexNeighbor(pos, dir);
      // Only an obstacle (or an Unstoppable unit, none in Phase 1) stops it; the edge ends it.
      if (!walkable(ctx.map, next)) break;
      pos = next;
      // Everyone in the hex entered or beside it, hit once: farthest first,
      // so those beside it (distance 1) before the one in the path (0).
      const victims = ctx.state.units.filter(
        (u) => u.alive && u.hex && !hitAlready.has(u.id) && hexDistance(u.hex, pos) <= 1
      );
      victims.sort(
        (a, b) => hexDistance(b.hex!, pos) - hexDistance(a.hex!, pos) || unitOrder(a) - unitOrder(b)
      );
      for (const u of victims) {
        hitAlready.add(u.id);
        hit(ctx, user, u, ABILITY.rampage.damage, 'The Rampage');
        if (!u.alive) continue;
        // In the path: knocked ahead; beside it: away from the Champion's hex.
        const away = hexEquals(u.hex!, pos) ? dir : direction(pos, u.hex!);
        displace(ctx, u, away, ABILITY.rampage.displace);
      }
      if (!unitAt(ctx.state, pos)) lastFree = pos;
    }
    // Ends on the last free hex it passed if the last one is taken.
    if (user.alive) enterHex(ctx, user, lastFree, true, 'rush');
  },
};

// ─── Modao Vanguard ──────────────────────────────────────────────────────────

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

/** Reap's line from `from` along `dir`: up to its reach, stopping before ruins or the map's edge. */
export function reapLine(map: MapData, from: Hex, dir: number): Hex[] {
  const out: Hex[] = [];
  let h = from;
  for (let i = 0; i < ABILITY.reap.reach; i++) {
    h = hexNeighbor(h, dir);
    if (!walkable(map, h)) break;
    out.push(h);
  }
  return out;
}

const reap: AbilityDef = {
  id: 'reap',
  name: 'Reap',
  kind: 'attack',
  summary: (user) =>
    `Thrust ${ABILITY.reap.reach} spaces in a line, through every unit on it: ${scaled(ABILITY.reap.damage, user.power)} damage and Push ${ABILITY.reap.push} to each.`,
  ultimate: false,
  charged: false,
  cost: ABILITY.reap.cost,
  movesSelf: false,
  targetsUnit: true,
  // Any unit on one of its six lines; aimed at either of two in a line, it hits both.
  targets(state, map, user, from) {
    const out: ActionTarget[] = [];
    for (const d of DIRECTIONS) {
      for (const h of reapLine(map, from, d)) {
        const u = unitAt(state, h);
        if (u && u !== user) out.push({hex: h});
      }
    }
    return out;
  },
  resolve(ctx, user, target) {
    log(ctx, `${unitName(user)} reaps.`);
    const victims = reapLine(ctx.map, user.hex!, direction(user.hex!, target.hex!))
      .map((h) => unitAt(ctx.state, h))
      .filter((u): u is Unit => u !== undefined);
    for (const u of victims) {
      hit(ctx, user, u, ABILITY.reap.damage, 'The reap');
      push(ctx, u, ABILITY.reap.push);
    }
  },
};

const advance: AbilityDef = {
  id: 'advance',
  name: 'Advance',
  kind: 'attack',
  // Centred on the Vanguard: the area is the six spaces around it.
  radius: ABILITY.advance.radius,
  summary: (user) =>
    `Every unit next to you takes ${scaled(ABILITY.advance.damage, user.power)} damage, is knocked back ${ABILITY.advance.displace} and Pushed ${ABILITY.advance.push}.`,
  ultimate: true,
  charged: false,
  cost: ABILITY.advance.cost,
  movesSelf: false,
  targets: (_state, _map, _user, from) => [{hex: from}],
  resolve(ctx, user) {
    const centre = user.hex;
    if (!centre) return;
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

function unitOrder(u: Unit): number {
  return (u.side === 'player' ? 0 : 10) + u.partyIndex;
}

export const ABILITIES: Record<AbilityId, AbilityDef> = {
  hold,
  bow,
  leap,
  volley,
  sunlight,
  hail,
  freeze,
  throw: throwAbility,
  pin,
  rampage,
  challenge,
  reap,
  advance,
  bite,
};

export function abilitiesOf(unit: Unit): AbilityDef[] {
  return HEROES[unit.hero].abilities.map((id) => ABILITIES[id]);
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
