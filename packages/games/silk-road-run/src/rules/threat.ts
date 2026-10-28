/**
 * The AI's one-step lookahead: what each enemy could do to a unit standing
 * on a hex before that unit's next card. Built once per AI turn from where
 * the enemies stand, so scoring an option is a lookup. An estimate, not a
 * search: each enemy's best single hit on that hex from where it stands
 * (walking and attacking are separate turns), with the units now on the
 * board blocking arrows (the acting unit aside, since it is the one moving).
 */
import {ABILITY, AI} from './config';
import {cleaveAreas, hostile, isImmobilized, isStunned, kitOf} from './board';
import {damageOf} from './resolve';
import {blocks, tileAt} from './map';
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
    const has = (a: AbilityId) => kitOf(e).includes(a);
    const {q: fq, r: fr} = e.hex;
    if (has('bite') || has('grapple') || has('swiftStrike') || has('smash') || has('reave'))
      for (const [dq, dr] of AXIAL) mark(hexes, id(fq + dq, fr + dr), power);
    // `over`: the spaces nearest it flown over, whatever is on them (Longshot's).
    const lanes = (oq: number, or: number, d: number, range = ABILITY.snapShot.range, over = 0) => {
      for (const [dq, dr] of AXIAL) {
        for (let i = 1; i <= range; i++) {
          const k = id(oq + dq * i, or + dr * i);
          const tile = board.get(k);
          if (tile === undefined) break;
          if (i <= over) continue;
          if (blocks(tile)) break;
          if (k !== id(fq, fr)) mark(hexes, k, d);
          if (occupied.has(k) && k !== id(fq, fr)) break;
        }
      }
    };
    if (has('snapShot') || has('boulder')) lanes(fq, fr, power);
    if (has('longshot') && ABILITY.longshot.first)
      lanes(fq, fr, power, ABILITY.longshot.range, ABILITY.longshot.minRange - 1);
    // Longshot built first (`first` off): its six lines to the map's edge,
    // through units and yurts.
    else if (has('longshot'))
      for (const [dq, dr] of AXIAL)
        for (let i = 1; i <= ABILITY.longshot.range; i++) {
          const k = id(fq + dq * i, fr + dr * i);
          if (!board.has(k)) break;
          mark(hexes, k, power);
        }
    // Stomp: the spaces next to it, and those it may step to first; as the
    // charge (first built), the spaces it walks into, `steps` each way.
    if (has('stomp') && ABILITY.stomp.mode === 'stomp') {
      const reach = 1 + (isImmobilized(e) ? 0 : ABILITY.stomp.step);
      for (let dq = -reach; dq <= reach; dq++)
        for (let dr = Math.max(-reach, -dq - reach); dr <= Math.min(reach, -dq + reach); dr++)
          if (dq || dr) mark(hexes, id(fq + dq, fr + dr), power);
    } else if (has('stomp') && !isImmobilized(e))
      for (const [dq, dr] of AXIAL)
        for (let i = 1; i <= ABILITY.stomp.steps; i++) {
          const k = id(fq + dq * i, fr + dr * i);
          const tile = board.get(k);
          if (tile === undefined || blocks(tile)) break;
          mark(hexes, k, power);
        }
    // Charge: each of its lanes to yurts or the map's edge, the first unit
    // in it carried and a second one met, so past one unit and up to a
    // second.
    if (has('charge') && !isImmobilized(e))
      for (const [dq, dr] of AXIAL) {
        let passed = 0;
        for (let i = 1; ; i++) {
          const k = id(fq + dq * i, fr + dr * i);
          const tile = board.get(k);
          if (tile === undefined || blocks(tile)) break;
          mark(hexes, k, power);
          if (occupied.has(k) && ++passed === 2) break;
        }
      }
    // Cleave: its line of `reach` each way.
    if (has('cleave'))
      for (const area of cleaveAreas(map, e.hex))
        for (const h of area) mark(hexes, id(h.q, h.r), power);
    // Elixir: a hit on any space within its range (`fixed`; none at 0).
    if (has('elixir') && ABILITY.elixir.fixed > 0) {
      const range = ABILITY.elixir.range;
      for (let dq = -range; dq <= range; dq++)
        for (let dr = Math.max(-range, -dq - range); dr <= Math.min(range, -dq + range); dr++)
          if (dq || dr) mark(hexes, id(fq + dq, fr + dr), power);
    }
    // Volley (an experiment): any space within its range, at the dodge share.
    if (has('volley')) {
      const range = ABILITY.volley.range;
      for (let dq = -range; dq <= range; dq++)
        for (let dr = Math.max(-range, -dq - range); dr <= Math.min(range, -dq + range); dr++) {
          const k = id(fq + dq, fr + dr);
          const tile = board.get(k);
          if ((dq || dr) && tile !== undefined && !blocks(tile))
            mark(hexes, k, power * AI.dodgeShare);
        }
    }
    // Skirmish: Snap Shot's lanes from each free space next to it, unless it
    // can't step, at the dodge share once charged.
    if (has('skirmish') && !isImmobilized(e)) {
      const d = ABILITY.skirmish.charge > 0 ? power * AI.dodgeShare : power;
      for (const [sq, sr] of AXIAL) {
        const k = id(fq + sq, fr + sr);
        const tile = board.get(k);
        if (tile === undefined || blocks(tile) || occupied.has(k)) continue;
        lanes(fq + sq, fr + sr, d);
      }
    }
  }
  return out;
}

/**
 * The damage `me` could take, where it stands in `after`, from the enemies
 * whose cards come before its own next card: each one's best hit, summed,
 * less its Shield. A Stunned enemy can't act.
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
  // A Shield (17.6) lasts until its next turn, so it takes these hits first.
  return Math.max(0, total - (me.shield ?? 0));
}
