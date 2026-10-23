/**
 * Board rules on the hex map: who stands where, movement, line of fire and
 * statuses (map.md, section 6; keywords.md, 17.5).
 */
import {
  hexEquals,
  hexLineSides,
  hexNeighbor,
  hexNeighbors,
  hexToOffset,
} from '@canvas/engine/server';
import type {Hex} from '@canvas/engine/server';
import {ABILITY, HEROES, RULES} from './config';
import {hexNumber, onMap, tileAt} from './map';
import type {MapData, Tile} from './map';
import type {FightState, Status, Unit} from './types';

export {onMap};

/** On the map and not an obstacle: a unit may stand here. */
export function walkable(map: MapData, h: Hex): boolean {
  return onMap(map, h) && tileAt(map, h) !== 'obstacle';
}

export function unitAt(state: FightState, h: Hex): Unit | undefined {
  return state.units.find((u) => u.alive && u.hex !== null && hexEquals(u.hex, h));
}

/**
 * Plain sand: open ground with nothing on it (no unit, hail, overwatch or exit). It has
 * nothing to explain, so looking at it shows no tooltip or details.
 */
export function plainSand(state: FightState, map: MapData, h: Hex): boolean {
  return (
    tileAt(map, h) === 'sand' &&
    !map.exits.some((e) => hexEquals(e, h)) &&
    !unitAt(state, h) &&
    !state.effects.some((e) => hexEquals(e.hex, h)) &&
    !overwatchedHexes(state, map).has(hexNumber(h))
  );
}

/** A unit with a ranged attack (the bow). */
export function isRanged(unit: Unit): boolean {
  return HEROES[unit.hero].abilities.includes('bow');
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

/**
 * Every hex the unit can end its move on, with a shortest path to it, the
 * start included with an empty path. Units and obstacles block walking;
 * a move can't end on another unit (brief section 2), and one that enters
 * hail ends there (it Immobilizes).
 */
export function reachableHexes(state: FightState, map: MapData, unit: Unit): Reach[] {
  if (!unit.hex) return [];
  const cap = movementCap(unit);
  // unitAt for every hex at once: the first living unit standing there.
  const occupant = new Map<number, Unit>();
  for (const u of state.units)
    if (u.alive && u.hex && !occupant.has(hexNumber(u.hex))) occupant.set(hexNumber(u.hex), u);
  const best = new Map<number, Hex[]>();
  best.set(hexNumber(unit.hex), []);
  // A walk keeps out of overwatched lanes where it can: first every hex
  // reachable around them, then the rest, through them.
  const watched = overwatchedHexes(state, map, unit);
  for (const avoid of watched.size > 0 ? [true, false] : [false]) {
    const seen = new Map<number, Hex[]>([[hexNumber(unit.hex), []]]);
    let frontier: Hex[] = [unit.hex];
    for (let step = 0; step < cap; step++) {
      const next: Hex[] = [];
      for (const from of frontier) {
        const fromPath = seen.get(hexNumber(from))!;
        for (const h of hexNeighbors(from)) {
          if (!walkable(map, h)) continue;
          const key = hexNumber(h);
          const other = occupant.get(key);
          if ((other && other !== unit) || seen.has(key) || (avoid && watched.has(key))) continue;
          seen.set(key, [...fromPath, h]);
          if (!best.has(key)) best.set(key, [...fromPath, h]);
          // Hail stops the walk where it enters, and so may an overwatch shot.
          if (!hailOn(state, h) && !(ABILITY.overwatch.stopsWalk && watched.has(key))) next.push(h);
        }
      }
      frontier = next;
    }
  }
  const out = [...best.values()].map((path) => ({hex: path[path.length - 1] ?? unit.hex!, path}));
  return sortByHex(out, (r) => r.hex);
}

/**
 * Whether the unit can move at all this turn: `reachableHexes` has a hex
 * other than its own, without listing them: a walkable neighbour with no
 * one on it, a one-hex move, without which no path can start.
 */
export function canMove(state: FightState, map: MapData, unit: Unit): boolean {
  if (!unit.hex || movementCap(unit) === 0) return false;
  return hexNeighbors(unit.hex).some((h) => walkable(map, h) && !unitAt(state, h));
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
  for (const [i, h] of path.entries()) {
    if (!hexNeighbors(from).some((n) => hexEquals(n, h)))
      return 'Each step must be to an adjacent hex.';
    if (!walkable(map, h)) return 'That path crosses an obstacle or leaves the map.';
    const other = unitAt(state, h);
    if (other && other !== unit) return 'Units block that path.';
    if (hailOn(state, h) && i < path.length - 1) return 'Hail stops a move where it enters.';
    from = h;
  }
  const end = unitAt(state, from);
  if (end && end !== unit) return 'A move can’t end on another unit.';
  return null;
}

// ─── The camel's road ───────────────────────────────────────────────────────

/** Each fight's hexes from the exit, by hex number: built once per tile layout. */
const roads = new WeakMap<Record<string, Tile>, Map<number, number>>();

/**
 * Hexes from every walkable hex to the nearest exit, walking around ruins.
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
      for (const h of hexNeighbors(from)) {
        if (!walkable(map, h) || dist.has(hexNumber(h))) continue;
        dist.set(hexNumber(h), d);
        next.push(h);
      }
    frontier = next;
  }
  roads.set(map.tiles, dist);
  return dist;
}

/** Hexes along the camel's road from `from` to the exit; Infinity if ruins cut it off. */
export function roadDistance(map: MapData, from: Hex): number {
  return exitDistances(map).get(hexNumber(from)) ?? Infinity;
}

/**
 * The camel's road from `from` (left out) to the exit: a shortest walk
 * around ruins, each step to the first neighbour one hex nearer, so the
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
 * along a shortest walk to the exit around ruins and the other units, so
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
      for (const h of hexNeighbors(from)) {
        const k = hexNumber(h);
        if (!walkable(map, h) || dist.has(k) || (blocked.has(k) && k !== start)) continue;
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

// ─── Lanes ───────────────────────────────────────────────────────────────────

/** An arrow's flight along one hex direction: the hexes it crosses, and the unit it stops at. */
export interface ArrowLane {
  hexes: Hex[];
  hit?: Unit;
}

/**
 * The bow's lane from `from` in direction `dir`: it runs until the first
 * unit (which it hits), ruins or the map's edge (the bow has no range
 * limit). `ignore`, a unit stepping into the lane, doesn't stop it.
 */
export function arrowLane(
  state: FightState,
  map: MapData,
  from: Hex,
  dir: number,
  ignore?: Unit
): ArrowLane {
  const lane: ArrowLane = {hexes: []};
  let h = from;
  for (let i = 0; i < ABILITY.bow.range; i++) {
    h = hexNeighbor(h, dir);
    if (!onMap(map, h) || tileAt(map, h) === 'obstacle') break;
    lane.hexes.push(h);
    const u = unitAt(state, h);
    if (u && u !== ignore) {
      lane.hit = u;
      break;
    }
  }
  return lane;
}

/**
 * The hexes overwatched by Outriders other than `unit` (Overwatch,
 * abilities.ts), as `unit` stepping in would find them: a walk avoids them
 * where it can (`reachableHexes`). By hex number.
 */
export function overwatchedHexes(state: FightState, map: MapData, unit?: Unit): Set<number> {
  const out = new Set<number>();
  for (const o of state.overwatch ?? []) {
    const src = state.units.find((u) => u.id === o.source);
    if (!src?.alive || !src.hex || src === unit) continue;
    for (const h of arrowLane(state, map, src.hex, o.dir, unit).hexes) out.add(hexNumber(h));
  }
  return out;
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
      if (tileAt(map, h) === 'obstacle') return {clear: false};
    }
  }
  return {clear: true};
}

// ─── Ordering ────────────────────────────────────────────────────────────────

/** Sorts by offset row then column: the "hex index" used to break ties. */
export function sortByHex<T>(items: T[], hexOf: (t: T) => Hex): T[] {
  return [...items].sort((a, b) => hexIndex(hexOf(a)) - hexIndex(hexOf(b)));
}

export function hexIndex(h: Hex): number {
  const {col, row} = hexToOffset(h);
  return row * 100 + col;
}
