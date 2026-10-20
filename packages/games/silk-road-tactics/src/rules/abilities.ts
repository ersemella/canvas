/**
 * The three prototype heroes' abilities (brief section 4). Each lists its
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
  hostile,
  isImmobilized,
  onMap,
  sortByHex,
  unitAt,
  walkable,
} from './board';
import {applyHail, enterHex, displace, heal, hit, log, scaled, unitName} from './resolve';
import type {Ctx} from './resolve';
import {tileAt} from './map';
import type {MapData} from './map';
import type {AbilityId, ActionTarget, FightState, Unit} from './types';

export interface AbilityDef {
  id: AbilityId;
  name: string;
  /**
   * One line for the side panel, with damage and healing scaled by the
   * user's power (defence, Vulnerable and conceal still apply on the hit).
   */
  summary(user: Unit): string;
  ultimate: boolean;
  /** Charged (3.7): the card moves by `cost`, then the ability triggers when reached. */
  charged: boolean;
  /** Action cost, or the charge cost for a charged ability. */
  cost: number;
  recoveryCost?: number;
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
  summary: () => 'Quick action with no effect: end the turn.',
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
}

/**
 * The bow's six lanes from `from`: each runs up to its range and stops at
 * the first unit (which it hits), an obstacle or the map's edge. For the
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
  name: 'Composite Bow',
  summary: (user) =>
    `Arrow along a hex line, range ${ABILITY.bow.range}; hits the first unit, ally or enemy, for ${scaled(ABILITY.bow.damage, user.power)} damage.`,
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
    hit(ctx, user, u, ABILITY.bow.damage, true, `${unitName(user)}'s arrow`);
  },
};

function dashEnd(
  state: FightState,
  map: MapData,
  user: Unit,
  from: Hex,
  dir: number,
  distance: number
): Hex | undefined {
  let h = from;
  for (let i = 0; i < distance; i++) {
    h = hexNeighbor(h, dir);
    if (!walkable(map, h)) return undefined;
    const u = unitAt(state, h);
    if (u && u !== user && hostile(u, user)) return undefined;
  }
  const end = unitAt(state, h);
  return end && end !== user ? undefined : h;
}

const dash: AbilityDef = {
  id: 'dash',
  name: 'Dash',
  summary: () =>
    `Ride up to ${ABILITY.dash.distance} hexes in a straight line; passes allies, not enemies or ruins.`,
  ultimate: false,
  charged: false,
  cost: ABILITY.dash.cost,
  movesSelf: true,
  targets(state, map, user, from) {
    const out: ActionTarget[] = [];
    for (let n = 1; n <= ABILITY.dash.distance; n++) {
      for (const d of DIRECTIONS) {
        const hex = dashEnd(state, map, user, from, d, n);
        if (hex) out.push({hex});
      }
    }
    return out;
  },
  resolve(ctx, user, target) {
    // Hexes passed have no effect; the one it ends on does.
    enterHex(ctx, user, target.hex!);
    log(ctx, `${unitName(user)} dashes.`);
  },
};

const volley: AbilityDef = {
  id: 'volley',
  name: 'Volley',
  summary: (user) =>
    `Ultimate, charged: arrows arc onto a hex within ${ABILITY.volley.range}, hitting every unit within ${ABILITY.volley.radius}, allies too, for ${scaled(ABILITY.volley.damage, user.power)} damage.`,
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
      hit(ctx, user, u, ABILITY.volley.damage, true, 'The Volley');
    }
  },
};

// ─── Yadachy Storm Caller ────────────────────────────────────────────────────

const sunlight: AbilityDef = {
  id: 'sunlight',
  name: 'Sunlight',
  summary: (user) =>
    `Heals ${scaled(ABILITY.sunlight.heal, user.power)} and cleanses every unit within ${ABILITY.sunlight.radius}, itself and enemies included.`,
  ultimate: false,
  charged: false,
  cost: ABILITY.sunlight.cost,
  movesSelf: false,
  targets: () => [{}],
  resolve(ctx, user) {
    log(ctx, `${unitName(user)} calls down sunlight.`);
    for (const u of unitsInArea(ctx.state, user.hex!, ABILITY.sunlight.radius)) {
      cleanse(u);
      heal(ctx, u, scaled(ABILITY.sunlight.heal, user.power));
    }
  },
};

const hail: AbilityDef = {
  id: 'hail',
  name: 'Hail',
  summary: (user) =>
    `A hex within ${ABILITY.hail.range} becomes hail for ${ABILITY.hail.hexSlots} slots: whoever is struck there takes ${scaled(ABILITY.hail.damage, user.power)} damage, then is Slowed ${ABILITY.hail.slowed}, Vulnerable ${ABILITY.hail.vulnerable}%.`,
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
      vulnerable: ABILITY.hail.vulnerable,
      statusSlots: ABILITY.hail.statusSlots,
    });
    log(ctx, `${unitName(user)} calls down hail.`);
    const u = unitAt(ctx.state, h);
    if (u) applyHail(ctx, u);
  },
};

const gale: AbilityDef = {
  id: 'gale',
  name: 'Gale',
  summary: () => `Melee: Displace ${ABILITY.gale.displace} away and Slowed ${ABILITY.gale.slowed}.`,
  ultimate: false,
  charged: false,
  cost: ABILITY.gale.cost,
  movesSelf: false,
  targetsUnit: true,
  targets: (state, _map, user, from) => adjacentUnits(state, from, (u) => u !== user),
  resolve(ctx, user, target) {
    const u = unitAt(ctx.state, target.hex!)!;
    log(ctx, `${unitName(user)}'s gale strikes ${unitName(u)}.`);
    addStatus(u, {
      kind: 'slowed',
      value: ABILITY.gale.slowed,
      untilSlot: ctx.slot + ABILITY.gale.slowedSlots,
    });
    displace(ctx, u, direction(user.hex!, u.hex!), ABILITY.gale.displace);
  },
};

const freeze: AbilityDef = {
  id: 'freeze',
  name: 'Freeze',
  summary: () =>
    `Ultimate, charged: units within ${ABILITY.freeze.radius} of a hex within ${ABILITY.freeze.range} are Immobilized and Vulnerable ${ABILITY.freeze.vulnerable}%.`,
  ultimate: true,
  charged: true,
  cost: ABILITY.freeze.chargeCost,
  recoveryCost: ABILITY.freeze.recoveryCost,
  movesSelf: false,
  targets: (_state, map, _user, from) => hexesWithin(map, from, ABILITY.freeze.range),
  resolve(ctx, user, target) {
    log(ctx, `${unitName(user)}'s Freeze takes hold.`);
    const untilSlot = ctx.slot + ABILITY.freeze.immobilizedSlots;
    for (const u of unitsInArea(ctx.state, target.hex!, ABILITY.freeze.radius)) {
      addStatus(u, {kind: 'immobilized', value: 0, untilSlot});
      addStatus(u, {kind: 'vulnerable', value: ABILITY.freeze.vulnerable, untilSlot});
    }
  },
};

// ─── Bökh Champion ───────────────────────────────────────────────────────────

const throwAbility: AbilityDef = {
  id: 'throw',
  name: 'Throw',
  summary: (user) =>
    `Melee: ${scaled(ABILITY.throw.damage, user.power)} damage, and the target is thrown to another free hex next to you.`,
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
    hit(ctx, user, u, ABILITY.throw.damage, false, 'The throw');
    if (u.alive) enterHex(ctx, u, target.to!);
  },
};

const pin: AbilityDef = {
  id: 'pin',
  name: 'Pin',
  summary: (user) =>
    `Melee: you and the target are Immobilized for ${ABILITY.pin.slots} slots; it is Vulnerable ${ABILITY.pin.vulnerable}%, takes ${scaled(ABILITY.pin.damagePerSlot, user.power)} damage every slot, and is Taunted: it must attack you if it can.`,
  ultimate: false,
  charged: false,
  cost: ABILITY.pin.cost,
  movesSelf: false,
  targetsUnit: true,
  targets: (state, _map, user, from) => adjacentUnits(state, from, (u) => u !== user),
  resolve(ctx, user, target) {
    const u = unitAt(ctx.state, target.hex!)!;
    const untilSlot = ctx.slot + ABILITY.pin.slots;
    addStatus(user, {kind: 'immobilized', value: 0, untilSlot});
    addStatus(u, {kind: 'immobilized', value: 0, untilSlot});
    addStatus(u, {kind: 'vulnerable', value: ABILITY.pin.vulnerable, untilSlot});
    addStatus(u, {
      kind: 'crushed',
      value: scaled(ABILITY.pin.damagePerSlot, user.power),
      untilSlot,
    });
    addStatus(u, {kind: 'taunted', value: 0, untilSlot, source: user.id});
    log(ctx, `${unitName(user)} pins ${unitName(u)}.`);
  },
};

const rampage: AbilityDef = {
  id: 'rampage',
  name: 'Rampage',
  summary: (user) =>
    `Ultimate: charge ${ABILITY.rampage.distance} hexes in a line; everything in or beside the path takes ${scaled(ABILITY.rampage.damage, user.power)} damage and is knocked aside.`,
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
        hit(ctx, user, u, ABILITY.rampage.damage, false, 'The Rampage');
        if (!u.alive) continue;
        // In the path: knocked ahead; beside it: away from the Champion's hex.
        const away = hexEquals(u.hex!, pos) ? dir : direction(pos, u.hex!);
        displace(ctx, u, away, ABILITY.rampage.displace);
      }
      if (!unitAt(ctx.state, pos)) lastFree = pos;
    }
    // Ends on the last free hex it passed if the last one is taken.
    if (user.alive) enterHex(ctx, user, lastFree);
  },
};

function unitOrder(u: Unit): number {
  return (u.side === 'player' ? 0 : 10) + u.partyIndex;
}

export const ABILITIES: Record<AbilityId, AbilityDef> = {
  hold,
  bow,
  dash,
  volley,
  sunlight,
  hail,
  gale,
  freeze,
  throw: throwAbility,
  pin,
  rampage,
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
    if (unit.turnsTaken < RULES.ultimateUnlockTurns) {
      return `The ultimate unlocks after ${RULES.ultimateUnlockTurns} turns, not counting Holds without a move (${unit.turnsTaken} so far).`;
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
