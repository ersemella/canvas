/**
 * Board rules on the hex map: who stands where, movement, flanking, line
 * of fire and statuses (map.md, section 6; keywords.md, 17.5–17.6).
 */
import {
  hexEquals,
  hexLineSides,
  hexNeighbors,
  hexOppositePairs,
  hexToOffset,
} from '@canvas/engine/server';
import type {Hex} from '@canvas/engine/server';
import {HEROES, RULES, movementRules} from './config';
import {hexNumber, onMap, tileAt} from './map';
import type {MapData} from './map';
import type {FightState, Status, StatusKind, Unit} from './types';

export {onMap};

/** On the map and not an obstacle: a unit may stand here. */
export function walkable(map: MapData, h: Hex): boolean {
  return onMap(map, h) && tileAt(map, h) !== 'obstacle';
}

export function unitAt(state: FightState, h: Hex): Unit | undefined {
  return state.units.find((u) => u.alive && u.hex !== null && hexEquals(u.hex, h));
}

/**
 * Plain sand: open ground with nothing on it (no unit, hail or exit). It has
 * nothing to explain, so looking at it shows no tooltip or details.
 */
export function plainSand(state: FightState, map: MapData, h: Hex): boolean {
  return (
    tileAt(map, h) === 'sand' &&
    !map.exits.some((e) => hexEquals(e, h)) &&
    !unitAt(state, h) &&
    !state.effects.some((e) => hexEquals(e.hex, h))
  );
}

/**
 * Obscured (keywords.md, 17.6): a sandstorm tile (the Storm Caller's fog
 * was too, until 2026-10-21). The bow can't target a unit standing here,
 * or through here, or shoot out of here (owner, 2026-10-21; it halved
 * ranged hits before). Sunlight, aimed at a space, ignores it.
 */
export function obscured(_state: FightState, map: MapData, h: Hex): boolean {
  return tileAt(map, h) === 'conceal';
}

/** A unit with a ranged attack (the bow), which Obscured stops. */
export function isRanged(unit: Unit): boolean {
  return HEROES[unit.hero].abilities.includes('bow');
}

export function hostile(a: Unit, b: Unit): boolean {
  return a.side !== b.side;
}

// ─── Statuses ────────────────────────────────────────────────────────────────

/** Strongest active value of a status (combine by max); 0 if none. */
export function statusValue(unit: Unit, kind: StatusKind): number {
  let best = 0;
  for (const s of unit.statuses)
    if (s.kind === kind)
      best = Math.max(best, kind === 'immobilized' || kind === 'pinned' ? 1 : s.value);
  return best;
}

/** Slots left on the longest status of a kind at `slot` (inclusive), for previews and AI. */
export function statusSlotsLeft(unit: Unit, kind: StatusKind, slot: number): number {
  let best = 0;
  for (const s of unit.statuses) if (s.kind === kind) best = Math.max(best, s.untilSlot - slot + 1);
  return best;
}

export function isImmobilized(unit: Unit): boolean {
  return unit.statuses.some((s) => s.kind === 'immobilized');
}

/** Pinned (a Grapple's hold): its abilities reach only hexes next to it. */
export function isPinned(unit: Unit): boolean {
  return unit.statuses.some((s) => s.kind === 'pinned');
}

export function addStatus(unit: Unit, status: Status): void {
  unit.statuses.push(status);
}

/** Removes statuses that ended before `slot` (they cover their last slot, 3.9). */
export function expireStatuses(unit: Unit, slot: number): void {
  unit.statuses = unit.statuses.filter((s) => s.untilSlot >= slot);
}

/**
 * Cleanse: every harmful status from an ability (not a flank's Vulnerable),
 * except a grappling Champion's own hold: cleansing it doesn't break the grapple
 * (owner, 2026-10-20). Barrier is beneficial, so it stays (17.8).
 */
export function cleanse(unit: Unit): void {
  unit.statuses = unit.statuses.filter(
    (s) => s.grapple?.champion === unit.id || s.kind === 'barrier'
  );
}

/** The unit's Barrier, if it has one: there is at most one, a new one replacing it. */
export function barrierOf(unit: Unit): Status | undefined {
  return unit.statuses.find((s) => s.kind === 'barrier');
}

/** Gives the unit a fresh Barrier, replacing any it has (owner, 2026-10-22: barriers don't stack). */
export function setBarrier(unit: Unit, value: number, untilSlot: number): void {
  unit.statuses = unit.statuses.filter((s) => s.kind !== 'barrier');
  addStatus(unit, {kind: 'barrier', value, untilSlot});
}

/**
 * A unit is flanked when two units hostile to it stand directly opposite
 * each other across it (6.3).
 */
export function isFlanked(state: FightState, unit: Unit): boolean {
  if (!unit.hex) return false;
  return hexOppositePairs(unit.hex).some(([a, b]) => {
    const ua = unitAt(state, a);
    const ub = unitAt(state, b);
    return ua !== undefined && ub !== undefined && hostile(ua, unit) && hostile(ub, unit);
  });
}

/** Vulnerable % in effect: an ability's or a flank's, by max (brief section 2). */
export function vulnerablePercent(state: FightState, unit: Unit): number {
  return Math.max(
    statusValue(unit, 'vulnerable'),
    isFlanked(state, unit) ? RULES.flankVulnerable : 0
  );
}

export function movementCap(unit: Unit): number {
  if (isImmobilized(unit)) return 0;
  const cap = HEROES[unit.hero].moveCap ?? RULES.movementCap;
  return Math.max(1, cap - statusValue(unit, 'slowed'));
}

// ─── Movement ────────────────────────────────────────────────────────────────

export interface Reach {
  hex: Hex;
  /** Hexes entered, start excluded. */
  path: Hex[];
}

/** Entering this hex hurts: quicksand or hail. */
function harmful(state: FightState, map: MapData, h: Hex): boolean {
  return tileAt(map, h) === 'hazard' || state.effects.some((e) => hexEquals(e.hex, h));
}

/**
 * Every hex the unit can end its move on, with the shortest path to it
 * (fewest quicksand or hail hexes among equally short ones), the start
 * included with an empty path. Units and obstacles block ordinary walking;
 * a move can't end on another unit (brief section 2).
 */
export function reachableHexes(state: FightState, map: MapData, unit: Unit): Reach[] {
  if (!unit.hex) return [];
  const cap = movementCap(unit);
  const blockAll = movementRules(state).blockAllUnits;
  // unitAt for every hex at once: the first living unit standing there.
  const occupant = new Map<number, Unit>();
  for (const u of state.units)
    if (u.alive && u.hex && !occupant.has(hexNumber(u.hex))) occupant.set(hexNumber(u.hex), u);
  const best = new Map<number, {path: Hex[]; hazards: number}>();
  best.set(hexNumber(unit.hex), {path: [], hazards: 0});
  let frontier: Hex[] = [unit.hex];
  for (let step = 0; step < cap; step++) {
    const next = new Map<number, Hex>();
    for (const from of frontier) {
      const fromBest = best.get(hexNumber(from))!;
      for (const h of hexNeighbors(from)) {
        if (!walkable(map, h)) continue;
        const key = hexNumber(h);
        const other = occupant.get(key);
        if (other && other !== unit && (blockAll || hostile(other, unit))) continue;
        const hazards = fromBest.hazards + (harmful(state, map, h) ? 1 : 0);
        const seen = best.get(key);
        // Only improve within the same step count (BFS layers).
        if (seen && (seen.path.length < step + 1 || seen.hazards <= hazards)) continue;
        best.set(key, {path: [...fromBest.path, h], hazards});
        next.set(key, h);
      }
    }
    frontier = [...next.values()];
  }
  const out: Reach[] = [];
  for (const {path} of best.values()) {
    const hex = path.length > 0 ? path[path.length - 1]! : unit.hex;
    const other = occupant.get(hexNumber(hex));
    if (other && other !== unit) continue;
    out.push({hex, path});
  }
  return sortByHex(out, (r) => r.hex);
}

/**
 * Whether the unit can move at all this turn: `reachableHexes` has a hex
 * other than its own, without listing them. When units block walking (they
 * always do but in balance experiments), that's a walkable neighbour with
 * no one on it: a one-hex move, and without one no path can start.
 */
export function canMove(state: FightState, map: MapData, unit: Unit): boolean {
  if (!unit.hex || movementCap(unit) === 0) return false;
  if (!movementRules(state).blockAllUnits)
    return reachableHexes(state, map, unit).some((r) => r.path.length > 0);
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
  for (const h of path) {
    if (!hexNeighbors(from).some((n) => hexEquals(n, h)))
      return 'Each step must be to an adjacent hex.';
    if (!walkable(map, h)) return 'That path crosses an obstacle or leaves the map.';
    const other = unitAt(state, h);
    if (other && other !== unit && (movementRules(state).blockAllUnits || hostile(other, unit)))
      return movementRules(state).blockAllUnits
        ? 'Units block that path.'
        : 'Enemies block movement.';
    from = h;
  }
  const end = unitAt(state, from);
  if (end && end !== unit) return 'A move can’t end on another unit.';
  return null;
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
