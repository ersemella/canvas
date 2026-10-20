/**
 * The AI's one-step lookahead: what each enemy could do to a unit standing
 * on a hex before that unit's next card. Built once per AI turn from where
 * the enemies stand, so scoring an option is a lookup. An estimate, not a
 * search: each enemy's best single hit on that hex from its current hex (historical experiments may allow moving first), with the units now on the board blocking arrows (the acting unit
 * aside, since it is the one moving).
 */
import {hexesInRange, hexDistance} from '@canvas/engine/server';
import {ABILITY, HEROES, RULES, movementRules} from './config';
import {ABILITIES, unusableReason} from './abilities';
import {fogAt, hostile, movementCap, obscured} from './board';
import {scaled, throughDefence} from './resolve';
import {tileAt} from './map';
import {slotsForward} from './track';
import type {MapData} from './map';
import type {FightState, Unit} from './types';

/** Per hex: the most an enemy's ranged hit (Obscured halves it) or other hit could deal, before defence. */
interface HexThreat {
  ranged: number;
  other: number;
}

export interface Threat {
  enemyId: string;
  hexes: Map<number, HexThreat>;
}

/** A hex as one number, for cheap map keys (the board is far smaller than ±64). */
const id = (q: number, r: number): number => (q + 64) * 128 + (r + 64);
const AXIAL: [number, number][] = [
  [1, 0],
  [1, -1],
  [0, -1],
  [-1, 0],
  [-1, 1],
  [0, 1],
];

/** Each map's tiles by hex number, built once: absent means off the map. */
const boards = new WeakMap<MapData, Map<number, string>>();
function boardOf(map: MapData): Map<number, string> {
  let b = boards.get(map);
  if (!b) {
    b = new Map(map.hexes.map((h) => [id(h.q, h.r), tileAt(map, h)]));
    boards.set(map, b);
  }
  return b;
}

/**
 * The hexes `e` could end a move on, as [q, r] (reachableHexes without the
 * paths): within its movement cap, through walkable hexes and its allies,
 * not through its enemies (the moving actor aside), not ending on a unit.
 */
function reachOf(
  state: FightState,
  board: Map<number, string>,
  e: Unit,
  actor: Unit
): [number, number][] {
  const blocked = new Set<number>();
  const taken = new Set<number>();
  for (const u of state.units) {
    if (!u.alive || !u.hex || u === e || u === actor) continue;
    const k = id(u.hex.q, u.hex.r);
    taken.add(k);
    if (movementRules(state).blockAllUnits || hostile(u, e)) blocked.add(k);
  }
  const start: [number, number] = [e.hex!.q, e.hex!.r];
  const seen = new Set([id(...start)]);
  const out: [number, number][] = [start];
  let frontier = [start];
  for (let step = 0; step < movementCap(e); step++) {
    const next: [number, number][] = [];
    for (const [q, r] of frontier) {
      for (const [dq, dr] of AXIAL) {
        const k = id(q + dq, r + dr);
        const tile = board.get(k);
        if (seen.has(k) || tile === undefined || tile === 'obstacle' || blocked.has(k)) continue;
        seen.add(k);
        next.push([q + dq, r + dr]);
        if (!taken.has(k)) out.push([q + dq, r + dr]);
      }
    }
    frontier = next;
  }
  return out;
}

function mark(hexes: Map<number, HexThreat>, key: number, kind: keyof HexThreat, d: number): void {
  const t = hexes.get(key);
  if (!t) hexes.set(key, kind === 'ranged' ? {ranged: d, other: 0} : {ranged: 0, other: d});
  else if (d > t[kind]) t[kind] = d;
}

/** Every enemy of `actor` that can act, with the hexes it threatens. */
export function threatsTo(state: FightState, map: MapData, actor: Unit): Threat[] {
  const board = boardOf(map);
  const occupied = new Set<number>();
  for (const u of state.units)
    if (u.alive && u.hex && u !== actor) occupied.add(id(u.hex.q, u.hex.r));
  const out: Threat[] = [];
  for (const e of state.units) {
    if (!e.alive || !e.hex || e.slot === null || !hostile(e, actor)) continue;
    const hexes = new Map<number, HexThreat>();
    out.push({enemyId: e.id, hexes});
    if (e.charging) {
      // A damaging charge lands where it was aimed, with its own damage and
      // area (every charge was read as a Volley until 2026-10-20).
      const {ability, target} = e.charging;
      if (ABILITIES[ability].damaging) {
        const charge = ABILITY[ability] as {damage: number; radius: number};
        const d = scaled(charge.damage, e.power);
        for (const h of hexesInRange(target, charge.radius)) mark(hexes, id(h.q, h.r), 'ranged', d);
      }
      continue;
    }
    const kit = HEROES[e.hero].abilities;
    const usable = (a: keyof typeof ABILITIES) =>
      kit.includes(a) && !unusableReason(e, ABILITIES[a]);
    const melee = Math.max(
      usable('throw') ? scaled(ABILITY.throw.damage, e.power) : 0,
      usable('pin') ? scaled(ABILITY.pin.damagePerSlot, e.power) * ABILITY.pin.slots : 0
    );
    const hail = usable('hail') ? scaled(ABILITY.hail.damage, e.power) : 0;
    const bow = usable('bow') ? scaled(ABILITY.bow.damage, e.power) : 0;
    const rampage = usable('rampage') ? scaled(ABILITY.rampage.damage, e.power) : 0;
    const reach: [number, number][] = movementRules(state).separateMovement
      ? [[e.hex.q, e.hex.r]]
      : reachOf(state, board, e, actor);
    if (hail > 0) {
      // Every hex within hail's range of a reachable hex: grow the reach set ring by ring.
      const seen = new Set(reach.map(([q, r]) => id(q, r)));
      let frontier = reach;
      for (let ring = 0; ring < ABILITY.hail.range; ring++) {
        const next: [number, number][] = [];
        for (const [q, r] of frontier) {
          for (const [dq, dr] of AXIAL) {
            const k = id(q + dq, r + dr);
            if (seen.has(k) || !board.has(k)) continue;
            seen.add(k);
            next.push([q + dq, r + dr]);
          }
        }
        frontier = next;
      }
      for (const k of seen) if (board.get(k) !== 'obstacle') mark(hexes, k, 'other', hail);
    }
    for (const [fq, fr] of reach) {
      if (melee > 0)
        for (const [dq, dr] of AXIAL) mark(hexes, id(fq + dq, fr + dr), 'other', melee);
      if (bow > 0) {
        const from = board.get(id(fq, fr)) === 'conceal' || fogAt(state, {q: fq, r: fr});
        const d = from ? Math.floor(bow * (1 - RULES.obscuredReduction)) : bow;
        for (const [dq, dr] of AXIAL) {
          // Halved once beyond the first Obscured hex it flies through.
          let through = d;
          for (let i = 1; i <= ABILITY.bow.range; i++) {
            const q = fq + dq * i;
            const r = fr + dr * i;
            const k = id(q, r);
            const tile = board.get(k);
            if (tile === undefined || tile === 'obstacle') break;
            mark(hexes, k, 'ranged', through);
            if (occupied.has(k) && k !== id(e.hex.q, e.hex.r)) break;
            if (through === d && (tile === 'conceal' || fogAt(state, {q, r})))
              through = Math.floor(d * (1 - RULES.obscuredReduction));
          }
        }
      }
      if (rampage > 0) {
        for (const [dq, dr] of AXIAL) {
          for (let i = 1; i <= ABILITY.rampage.distance; i++) {
            const q = fq + dq * i;
            const r = fr + dr * i;
            const tile = board.get(id(q, r));
            if (tile === undefined || tile === 'obstacle') break;
            mark(hexes, id(q, r), 'other', rampage);
            for (const [nq, nr] of AXIAL) mark(hexes, id(q + nq, r + nr), 'other', rampage);
          }
        }
      }
    }
  }
  return out;
}

/**
 * The damage `me` could take, where it stands in `after`, from the enemies
 * whose cards come before the end of the window: its own next card, but at
 * least a typical turn ahead, so a cheap Hold doesn't look safer than
 * acting where it stands. Each enemy's best hit, summed, through `me`'s
 * defence and Vulnerable.
 */
export function threatDamage(
  threats: Threat[],
  after: FightState,
  map: MapData,
  me: Unit,
  now: number
): number {
  if (!me.alive || !me.hex || me.slot === null) return 0;
  const windowEnd = Math.max(me.slot, now + slotsForward(RULES.cost.typical, me.speed));
  const key = id(me.hex.q, me.hex.r);
  const covered = obscured(after, map, me.hex);
  let total = 0;
  for (const t of threats) {
    const e = after.units.find((u) => u.id === t.enemyId);
    if (!e?.alive || e.slot === null || e.slot >= windowEnd) continue;
    // Displaced by this turn: its reach is no longer what was mapped; count it only if still close.
    if (e.hex && hexDistance(e.hex, me.hex) > RULES.movementCap + ABILITY.bow.range + 1) continue;
    const h = t.hexes.get(key);
    if (!h) continue;
    const ranged = covered ? Math.floor(h.ranged * (1 - RULES.obscuredReduction)) : h.ranged;
    total += Math.max(ranged, h.other);
  }
  // Defence and Vulnerable once, on the sum (checking a flank is the costly part).
  return total > 0 ? throughDefence(after, me, total) : 0;
}
