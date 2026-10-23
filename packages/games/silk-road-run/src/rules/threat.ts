/**
 * The AI's one-step lookahead: what each enemy could do to a unit standing
 * on a hex before that unit's next card. Built once per AI turn from where
 * the enemies stand, so scoring an option is a lookup. An estimate, not a
 * search: each enemy's best single hit on that hex from where it stands
 * (walking and attacking are separate turns), with the units now on the
 * board blocking arrows (the acting unit aside, since it is the one moving).
 */
import {ABILITY, AI, HEROES} from './config';
import {hostile, isStunned} from './board';
import {damageOf} from './resolve';
import {tileAt} from './map';
import type {MapData} from './map';
import type {AbilityId, FightState, Unit} from './types';

export interface Threat {
  enemyId: string;
  /** Per hex, the most the enemy's hit could deal there. */
  hexes: Map<number, number>;
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

function mark(hexes: Map<number, number>, key: number, d: number): void {
  if (d > (hexes.get(key) ?? 0)) hexes.set(key, d);
}

/** Every enemy of `actor` that can act, with the hexes it threatens. */
export function threatsTo(state: FightState, map: MapData, actor: Unit): Threat[] {
  const board = boardOf(map);
  const occupied = new Set<number>();
  for (const u of state.units)
    if (u.alive && u.hex && u !== actor) occupied.add(id(u.hex.q, u.hex.r));
  const out: Threat[] = [];
  for (const e of state.units) {
    const power = damageOf(e);
    if (!e.alive || !e.hex || e.slot === null || !hostile(e, actor) || power <= 0) continue;
    const hexes = new Map<number, number>();
    out.push({enemyId: e.id, hexes});
    const has = (a: AbilityId) => HEROES[e.hero].abilities.includes(a);
    const {q: fq, r: fr} = e.hex;
    if (has('bite') || has('grapple'))
      for (const [dq, dr] of AXIAL) mark(hexes, id(fq + dq, fr + dr), power);
    // Volley falls on any space within its range, over anything between,
    // but only marks it this turn: worth the share left after a dodge.
    if (has('volley')) {
      const reach = ABILITY.volley.range;
      const d = power * AI.volleyDodgeShare;
      for (let dq = -reach; dq <= reach; dq++)
        for (let dr = Math.max(-reach, -dq - reach); dr <= Math.min(reach, -dq + reach); dr++)
          if (board.has(id(fq + dq, fr + dr))) mark(hexes, id(fq + dq, fr + dr), d);
    }
    const lanes = (oq: number, or: number, d: number) => {
      for (const [dq, dr] of AXIAL) {
        for (let i = 1; i <= ABILITY.bow.range; i++) {
          const k = id(oq + dq * i, or + dr * i);
          const tile = board.get(k);
          if (tile === undefined || tile === 'obstacle') break;
          if (k !== id(fq, fr)) mark(hexes, k, d);
          if (occupied.has(k) && k !== id(fq, fr)) break;
        }
      }
    };
    if (has('bow')) lanes(fq, fr, power);
    // Skirmish: the bow's lanes from each free space next to it, at the
    // dodge share once charged.
    if (has('skirmish')) {
      const d = ABILITY.skirmish.charge > 0 ? power * AI.volleyDodgeShare : power;
      for (const [sq, sr] of AXIAL) {
        const k = id(fq + sq, fr + sr);
        const tile = board.get(k);
        if (tile === undefined || tile === 'obstacle' || occupied.has(k)) continue;
        lanes(fq + sq, fr + sr, d);
      }
    }
  }
  return out;
}

/**
 * The damage `me` could take, where it stands in `after`, from the enemies
 * whose cards come before its own next card: each one's best hit, summed.
 * A Stunned enemy can't act.
 */
export function threatDamage(threats: Threat[], after: FightState, me: Unit): number {
  if (!me.alive || !me.hex || me.slot === null) return 0;
  const key = id(me.hex.q, me.hex.r);
  let total = 0;
  for (const t of threats) {
    const e = after.units.find((u) => u.id === t.enemyId);
    if (!e?.alive || e.slot === null || e.slot >= me.slot || isStunned(e)) continue;
    total += t.hexes.get(key) ?? 0;
  }
  return total;
}
