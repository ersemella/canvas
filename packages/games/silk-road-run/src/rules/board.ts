/**
 * Board rules on the hex map: who stands where, movement, line of fire and
 * statuses (map.md, section 6; keywords.md, 17.5).
 */
import {
  hexEquals,
  hexLineSides,
  hexNeighbor,
  hexNeighbors,
  hexesInRange,
} from '@canvas/engine/server';
import type {Hex} from '@canvas/engine/server';
import {ABILITY, HEROES, RULES} from './config';
import {blocks, depth, hexNumber, onMap, tileAt} from './map';
import {hasPassive} from './passives';
import type {MapData, Tile} from './map';
import type {AbilityId, FightState, ShotInAir, Status, Unit} from './types';

export {onMap};

// ─── A fight's geometry ──────────────────────────────────────────────────────

/**
 * What never changes in a fight, worked out once per tile layout (a fight's
 * yurts are random, so not once per map): the search asks the same
 * questions of the same spaces thousands of times a turn. Its hexes are
 * shared: nothing changes a hex in place.
 */
interface Geometry {
  /** Each space's neighbours a unit may stand on, in `hexNeighbors` order. */
  steps: Map<number, Hex[]>;
  /** Each space's six lanes, by direction: the spaces up to yurts or the map's edge. */
  lanes: Map<number, Hex[][]>;
  /** The spaces on the map within a range of a space, in `sortByHex` order, by range then space. */
  within: Map<number, Map<number, Hex[]>>;
}

const geometries = new WeakMap<Record<string, Tile>, Geometry>();

function geometry(map: MapData): Geometry {
  let g = geometries.get(map.tiles);
  if (g) return g;
  g = {steps: new Map(), lanes: new Map(), within: new Map()};
  for (const h of map.hexes) {
    const k = hexNumber(h);
    g.steps.set(
      k,
      hexNeighbors(h).filter((n) => walkable(map, n))
    );
    g.lanes.set(
      k,
      [0, 1, 2, 3, 4, 5].map((dir) => {
        const lane: Hex[] = [];
        for (let at = hexNeighbor(h, dir); walkable(map, at); at = hexNeighbor(at, dir))
          lane.push(at);
        return lane;
      })
    );
  }
  geometries.set(map.tiles, g);
  return g;
}

/** The spaces next to `h` a unit may stand on, in `hexNeighbors` order. */
export function steps(map: MapData, h: Hex): Hex[] {
  return geometry(map).steps.get(hexNumber(h)) ?? hexNeighbors(h).filter((n) => walkable(map, n));
}

/** The spaces from `h` along direction `dir` (left out) up to yurts or the map's edge. */
export function lane(map: MapData, h: Hex, dir: number): Hex[] {
  const lanes = geometry(map).lanes.get(hexNumber(h));
  if (lanes) return lanes[dir]!;
  const out: Hex[] = [];
  for (let at = hexNeighbor(h, dir); walkable(map, at); at = hexNeighbor(at, dir)) out.push(at);
  return out;
}

/**
 * Cleave's four areas from `h` (owner, 2026-10-26), each one way it can
 * swing, empty ones left out: a line of `ABILITY.cleave.reach` spaces
 * straight up and one straight down (hex directions 2 and 5), stopped by
 * yurts and the map's edge but not by units; and a cone to each side, the
 * two diagonal spaces next to `h` (directions 0 and 1, or 3 and 4) and the
 * space straight across beyond them, reached through either diagonal that
 * isn't a yurt.
 */
export function cleaveAreas(map: MapData, h: Hex): Hex[][] {
  const lines = [2, 5].map((dir) => lane(map, h, dir).slice(0, ABILITY.cleave.reach));
  const cones = [
    [0, 1],
    [3, 4],
  ].map(([a, b]) => {
    const near = [hexNeighbor(h, a!), hexNeighbor(h, b!)].filter((n) => walkable(map, n));
    const far = hexNeighbor(hexNeighbor(h, a!), b!);
    return near.length > 0 && walkable(map, far) ? [...near, far] : near;
  });
  return [...lines, ...cones].filter((area) => area.length > 0);
}

/** The spaces on the map within `range` of `h`, `h` included, in `sortByHex` order. */
export function spacesWithin(map: MapData, h: Hex, range: number): Hex[] {
  const g = geometry(map);
  let byHex = g.within.get(range);
  if (!byHex) g.within.set(range, (byHex = new Map()));
  let out = byHex.get(hexNumber(h));
  if (!out) {
    out = sortByHex(
      hexesInRange(h, range).filter((n) => onMap(map, n)),
      (n) => n
    );
    byHex.set(hexNumber(h), out);
  }
  return out;
}

/** On the map and not an obstacle: a unit may stand here. */
export function walkable(map: MapData, h: Hex): boolean {
  return onMap(map, h) && !blocks(tileAt(map, h));
}

export function unitAt(state: FightState, h: Hex): Unit | undefined {
  return state.units.find((u) => u.alive && u.hex !== null && hexEquals(u.hex, h));
}

/**
 * Plain sand: open ground with nothing on it (no unit, hail, shot in the air or exit). It has
 * nothing to explain, so looking at it shows no tooltip or details.
 */
export function plainSand(state: FightState, map: MapData, h: Hex): boolean {
  return (
    tileAt(map, h) === 'sand' &&
    !map.exits.some((e) => hexEquals(e, h)) &&
    !unitAt(state, h) &&
    !state.effects.some((e) => hexEquals(e.hex, h)) &&
    !state.shots?.some((s) => shotLane(state, map, s).some((l) => hexEquals(l, h)))
  );
}

/** The abilities `unit` has: its hero's starting kit, or the test stage's (`Unit.loadout`). */
export function kitOf(unit: Unit): AbilityId[] {
  return unit.loadout?.abilities ?? HEROES[unit.hero].abilities;
}

/** How many abilities a kit has besides Hold (and moving, which isn't one). */
export function abilityCount(kit: AbilityId[]): number {
  return kit.filter((a) => a !== 'hold').length;
}

/**
 * Whether a kit has room for another ability (`RULES.maxAbilities`): an
 * upgrade adding one is offered only then. Each hero starts with 1 and
 * takes one of its upgrades: the Champion Haul or Shove, the Outrider one
 * of Skirmish, Volley and Feigned Retreat, the Storm Caller Sunlight or Gale.
 */
export function hasRoomForAbility(kit: AbilityId[]): boolean {
  return abilityCount(kit) < RULES.maxAbilities;
}

/** A unit with a ranged attack (Longshot). */
export function isRanged(unit: Unit): boolean {
  return kitOf(unit).includes('longshot');
}

export function hostile(a: Unit, b: Unit): boolean {
  return a.side !== b.side;
}

// ─── Statuses ────────────────────────────────────────────────────────────────

/** Immobilized (17.5): can't move to a different space by itself. Stunned covers it. */
export function isImmobilized(unit: Unit): boolean {
  return unit.statuses.some((s) => s.kind === 'immobilized' || s.kind === 'stunned');
}

/** Stunned (17.5): can't take any action, moving included; its turn is skipped. */
export function isStunned(unit: Unit): boolean {
  return unit.statuses.some((s) => s.kind === 'stunned');
}

export function addStatus(unit: Unit, status: Status): void {
  unit.statuses.push(status);
}

export function movementCap(unit: Unit): number {
  if (isImmobilized(unit)) return 0;
  if (HEROES[unit.hero].movesStraight) return Infinity;
  return HEROES[unit.hero].moveCap ?? RULES.movementCap;
}

/** Hail on `h`: entering it Immobilizes, so a move that enters it ends there. */
export function hailOn(state: FightState, h: Hex): boolean {
  return state.effects.some((e) => hexEquals(e.hex, h));
}

// ─── Movement ────────────────────────────────────────────────────────────────

export interface Reach {
  hex: Hex;
  /** Hexes entered, start excluded. */
  path: Hex[];
}

/** Light Step (19.8): the unit walks through allies, and may end on one, swapping places. */
export function passesAllies(unit: Unit): boolean {
  return hasPassive(unit, 'lightStep');
}

/**
 * Every hex the unit can end its move on, with a shortest path to it, the
 * start included with an empty path. Units and obstacles block walking;
 * a move can't end on another unit (brief section 2), and one that enters
 * hail ends there (it Immobilizes). With Light Step (19.8) allies don't
 * block, and a walk may end on one whose space it entered from a free one
 * (or its start): the two swap, the ally Moved to that space (`walk` in
 * resolve.ts). A unit that `movesStraight` goes along the six lanes
 * instead (`straightReaches`).
 */
export function reachableHexes(state: FightState, map: MapData, unit: Unit): Reach[] {
  if (!unit.hex) return [];
  const cap = movementCap(unit);
  if (HEROES[unit.hero].movesStraight) return straightReaches(state, map, unit, cap);
  const through = passesAllies(unit);
  // unitAt for every hex at once: the first living unit standing there.
  const occupant = new Map<number, Unit>();
  for (const u of state.units)
    if (u.alive && u.hex && u !== unit && !occupant.has(hexNumber(u.hex)))
      occupant.set(hexNumber(u.hex), u);
  const best = new Map<number, Hex[]>();
  // Allies' spaces a walk can end on, swapping: the shortest walk entering each from a free space.
  const swaps = new Map<number, Hex[]>();
  best.set(hexNumber(unit.hex), []);
  let frontier: Hex[] = [unit.hex];
  for (let step = 0; step < cap; step++) {
    const next: Hex[] = [];
    for (const from of frontier) {
      const fromPath = best.get(hexNumber(from))!;
      const fromFree = !occupant.has(hexNumber(from));
      for (const h of steps(map, from)) {
        const key = hexNumber(h);
        const other = occupant.get(key);
        if (other && (!through || hostile(other, unit))) continue;
        if (other && fromFree && !swaps.has(key)) swaps.set(key, [...fromPath, h]);
        if (best.has(key)) continue;
        best.set(key, [...fromPath, h]);
        // Hail stops the walk where it enters.
        if (!hailOn(state, h)) next.push(h);
      }
    }
    frontier = next;
  }
  const out = [...best.entries()]
    .filter(([key]) => !occupant.has(key))
    .map(([, path]) => ({hex: path[path.length - 1] ?? unit.hex!, path}));
  for (const path of swaps.values()) out.push({hex: path[path.length - 1]!, path});
  return sortByHex(out, (r) => r.hex);
}

/**
 * `reachableHexes` for a unit that `movesStraight`: each of the six lanes
 * from its space, up to the first unit (ally or enemy; the first enemy with
 * Light Step), yurts or the map's edge, and ending on the first hail it
 * enters.
 */
function straightReaches(state: FightState, map: MapData, unit: Unit, cap: number): Reach[] {
  const out: Reach[] = [{hex: unit.hex!, path: []}];
  if (cap > 0) {
    for (let dir = 0; dir < 6; dir++) {
      const path: Hex[] = [];
      let prevFree = true;
      for (const h of lane(map, unit.hex!, dir).slice(0, cap)) {
        const other = unitAt(state, h);
        // Light Step passes allies, and may end on one entered from a free space.
        if (other && (!passesAllies(unit) || hostile(other, unit))) break;
        path.push(h);
        if (!other || prevFree) out.push({hex: h, path: [...path]});
        prevFree = !other;
        if (hailOn(state, h)) break;
      }
    }
  }
  return sortByHex(out, (r) => r.hex);
}

/**
 * Whether the unit can move at all this turn: `reachableHexes` has a hex
 * other than its own, without listing them: a walkable neighbour with no
 * one on it, a one-hex move, without which no path can start.
 */
export function canMove(state: FightState, map: MapData, unit: Unit): boolean {
  if (!unit.hex || movementCap(unit) === 0) return false;
  return steps(map, unit.hex).some((h) => {
    const other = unitAt(state, h);
    // With Light Step, an ally next to it is a swap.
    return !other || (passesAllies(unit) && !hostile(other, unit));
  });
}

/** Checks a submitted path; returns a player-facing reason if it's illegal. */
export function invalidPath(
  state: FightState,
  map: MapData,
  unit: Unit,
  path: Hex[]
): string | null {
  if (path.length === 0) return null;
  if (!unit.hex) return 'That unit is not on the board.';
  if (path.length > movementCap(unit)) {
    return isImmobilized(unit)
      ? 'That unit is Immobilized.'
      : 'That move is longer than the unit can go.';
  }
  let from = unit.hex;
  const straightDir = HEROES[unit.hero].movesStraight
    ? hexNeighbors(unit.hex).findIndex((n) => hexEquals(n, path[0]!))
    : -1;
  const other = (h: Hex) =>
    state.units.find((u) => u !== unit && u.alive && u.hex && hexEquals(u.hex, h));
  for (const [i, h] of path.entries()) {
    if (!hexNeighbors(from).some((n) => hexEquals(n, h)))
      return 'Each step must be to an adjacent hex.';
    if (straightDir >= 0 && !hexEquals(hexNeighbor(from, straightDir), h))
      return 'That unit moves in a straight line.';
    if (!walkable(map, h)) return 'That path crosses an obstacle or leaves the map.';
    const there = other(h);
    // Light Step (19.8) walks through allies.
    if (there && (!passesAllies(unit) || hostile(there, unit))) return 'Units block that path.';
    if (hailOn(state, h) && i < path.length - 1) return 'Hail stops a move where it enters.';
    from = h;
  }
  if (other(from)) {
    if (!passesAllies(unit)) return 'A move can’t end on another unit.';
    // A swap: the ally goes to the space the walk came from, which must be free.
    const back = path.length > 1 ? path[path.length - 2]! : unit.hex;
    if (other(back)) return 'A swap needs a free space to put the ally on.';
  }
  return null;
}

// ─── The camel's road ───────────────────────────────────────────────────────

/** Each fight's hexes from the exit, by hex number: built once per tile layout. */
const roads = new WeakMap<Record<string, Tile>, Map<number, number>>();

/**
 * Hexes from every walkable hex to the nearest exit, walking around yurts.
 * Units are left out: the road is fixed for the fight (owner, 2026-10-22).
 */
function exitDistances(map: MapData): Map<number, number> {
  let dist = roads.get(map.tiles);
  if (dist) return dist;
  dist = new Map(map.exits.map((e) => [hexNumber(e), 0]));
  let frontier = [...map.exits];
  for (let d = 1; frontier.length > 0; d++) {
    const next: Hex[] = [];
    for (const from of frontier)
      for (const h of steps(map, from)) {
        if (dist.has(hexNumber(h))) continue;
        dist.set(hexNumber(h), d);
        next.push(h);
      }
    frontier = next;
  }
  roads.set(map.tiles, dist);
  return dist;
}

/** Hexes along the camel's road from `from` to the exit; Infinity if yurts cut it off. */
export function roadDistance(map: MapData, from: Hex): number {
  return exitDistances(map).get(hexNumber(from)) ?? Infinity;
}

/**
 * The camel's road from `from` (left out) to the exit: a shortest walk
 * around yurts, each step to the first neighbour one hex nearer, so the
 * road from any hex on it is the rest of it. Empty at the exit, or with no
 * way there.
 */
export function roadToExit(map: MapData, from: Hex): Hex[] {
  const dist = exitDistances(map);
  const out: Hex[] = [];
  let at = from;
  for (let d = dist.get(hexNumber(at)); d !== undefined && d > 0; d--) {
    at = hexNeighbors(at).find((h) => dist.get(hexNumber(h)) === d - 1)!;
    out.push(at);
  }
  return out;
}

/**
 * The camel's next step from where it stands (owner, 2026-10-22): one hex
 * along a shortest walk to the exit around yurts and the other units, so
 * it keeps to its road when nothing is in the way and walks around what
 * is. A unit standing on the exit itself only blocks the last step. When
 * units shut every way around, a step along its road if that hex is free.
 * Undefined at the exit, or with nowhere to step.
 */
export function stepToExit(state: FightState, map: MapData, unit: Unit): Hex | undefined {
  if (!unit.hex) return undefined;
  const blocked = new Set<number>();
  for (const u of state.units) if (u !== unit && u.alive && u.hex) blocked.add(hexNumber(u.hex));
  const free = (h: Hex) => !blocked.has(hexNumber(h));
  const dist = new Map<number, number>();
  let frontier = [...map.exits];
  for (const e of frontier) dist.set(hexNumber(e), 0);
  const start = hexNumber(unit.hex);
  for (let d = 1; frontier.length > 0 && !dist.has(start); d++) {
    const next: Hex[] = [];
    for (const from of frontier)
      for (const h of steps(map, from)) {
        const k = hexNumber(h);
        if (dist.has(k) || (blocked.has(k) && k !== start)) continue;
        dist.set(k, d);
        next.push(h);
      }
    frontier = next;
  }
  const d = dist.get(start);
  if (d === 0) return undefined;
  const around =
    d === undefined
      ? undefined
      : hexNeighbors(unit.hex).find((h) => dist.get(hexNumber(h)) === d - 1 && free(h));
  if (around) return around;
  const road = roadToExit(map, unit.hex)[0];
  return road && free(road) ? road : undefined;
}

// ─── Line of fire ────────────────────────────────────────────────────────────

/**
 * A direct ranged attack's line of fire (6.7): the line between hex centres
 * may not pass a hex holding another unit or an obstacle; where it runs
 * along a border it is blocked if either hex is (rule 29). Conceal doesn't
 * block. Returns the first blocking unit, if one does.
 */
export function lineOfFire(
  state: FightState,
  map: MapData,
  from: Hex,
  to: Hex
): {clear: boolean; blocker?: Unit} {
  const steps = hexLineSides(from, to).slice(1, -1);
  for (const step of steps) {
    for (const h of step) {
      const u = unitAt(state, h);
      if (u) return {clear: false, blocker: u};
      if (blocks(tileAt(map, h))) return {clear: false};
    }
  }
  return {clear: true};
}

/**
 * The first unit an arrow flying from `from` along hex direction `dir`
 * hits, stopped by yurts and the map's edge (Longshot's lane); `ignore`
 * isn't in the way (the archer itself).
 */
export function firstInLane(
  state: FightState,
  map: MapData,
  from: Hex,
  dir: number,
  ignore?: Unit
): Unit | undefined {
  for (const h of lane(map, from, dir)) {
    const u = unitAt(state, h);
    if (u && u !== ignore) return u;
  }
  return undefined;
}

/**
 * A shot in the air's lane, as it would fly now: from its Outrider's space
 * along its direction, up to and including the first unit in it, or to
 * yurts or the map's edge. Empty once its Outrider is gone.
 */
export function shotLane(state: FightState, map: MapData, shot: ShotInAir): Hex[] {
  const archer = state.units.find((u) => u.id === shot.source);
  if (!archer?.alive || !archer.hex) return [];
  // A Volley lands on its space.
  if (shot.hex) return [shot.hex];
  const out: Hex[] = [];
  for (const h of lane(map, archer.hex, shot.dir!)) {
    out.push(h);
    const u = unitAt(state, h);
    if (u && u !== archer) break;
  }
  return out;
}

// ─── Ordering ────────────────────────────────────────────────────────────────

/** Sorts top to bottom, then left to right: the "hex index" used to break ties. */
export function sortByHex<T>(items: T[], hexOf: (t: T) => Hex): T[] {
  const keyed = items.map((item) => ({item, key: hexIndex(hexOf(item))}));
  return keyed.sort((a, b) => a.key - b.key).map((k) => k.item);
}

export function hexIndex(h: Hex): number {
  return depth(h) * 100 + h.q;
}
