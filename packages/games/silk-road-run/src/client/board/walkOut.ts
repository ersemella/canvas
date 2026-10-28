/**
 * A won fight's party walking out along the road (camel.md).
 */
import {hexEquals, hexKey, hexNeighbors} from '@canvas/engine';
import type {Hex} from '@canvas/engine';
import {CAMEL} from '../../rules/config';
import {unitAt, walkable} from '../../rules/board';
import {mapOf} from '../../rules/fight';
import type {FightState, Unit} from '../../rules/types';
import {pastExit} from '../../rules/map';
import {center, lerp} from './pixels';
import type {Point} from './pixels';

/** Seconds a unit takes for each hex of a won fight's walk out. */
const WALK_OUT_HEX_SECONDS = 0.9;
/** Seconds each of its frames shows as it walks: a quicker bob than its idle. */
export const WALK_OUT_STEP_SECONDS = 0.3;

/** One unit's walk out: hex centres to the exit and one past the edge, after `delay` seconds. */
export interface Walk {
  route: Point[];
  delay: number;
}

/**
 * A won fight's walk out (camel.md): the camel heads for its nearest exit,
 * and every living hero for the same one, each along its shortest walkable
 * path (around any enemies still standing where there is a way), then one
 * hex further, off the board's edge the way the road goes. Nearest first, they reach the exit one
 * hex's time apart, so no two stand on it at once. A unit that can't reach
 * it stays put. Null if the camel can't reach an exit.
 */
export function walkOutPlan(fight: FightState): Map<string, Walk> | null {
  const map = mapOf(fight);
  const party = fight.units.filter((u) => u.alive && u.hex && u.side === 'player');
  const camel = party.find((u) => u.hero === CAMEL);
  if (!camel) return null;
  const toExit = walkPath(fight, camel.hex!, (h) => map.exits.some((e) => hexEquals(e, h)));
  if (!toExit) return null;
  const exit = toExit[toExit.length - 1]!;
  const paths = party
    .map((u) => ({
      u,
      path: u === camel ? toExit : walkPath(fight, u.hex!, (h) => hexEquals(h, exit)),
    }))
    .filter((p): p is {u: Unit; path: Hex[]} => p.path !== null)
    .sort((a, b) => a.path.length - b.path.length);
  const walks = new Map<string, Walk>();
  // When each reaches the exit, in hexes' time from the start.
  let arrival = -Infinity;
  for (const {u, path} of paths) {
    const steps = path.length - 1;
    arrival = Math.max(steps, arrival + 1);
    // Then on one hex past the exit, off the board the way the road goes.
    const route = [...path.map(center), center(pastExit(map, exit))];
    walks.set(u.id, {route, delay: (arrival - steps) * WALK_OUT_HEX_SECONDS});
  }
  return walks;
}

/**
 * The shortest walkable path from `from` to a hex that is `goal`, start
 * included: around enemies still standing where there is a way, through
 * them where there isn't (the party is walking too, so it doesn't block).
 */
function walkPath(fight: FightState, from: Hex, goal: (h: Hex) => boolean): Hex[] | null {
  const map = mapOf(fight);
  const search = (aroundEnemies: boolean): Hex[] | null => {
    const came = new Map<string, Hex | null>([[hexKey(from), null]]);
    let frontier = [from];
    while (frontier.length > 0) {
      const next: Hex[] = [];
      for (const h of frontier) {
        if (goal(h)) {
          const path: Hex[] = [];
          for (let at: Hex | null = h; at; at = came.get(hexKey(at))!) path.unshift(at);
          return path;
        }
        for (const n of hexNeighbors(h)) {
          if (came.has(hexKey(n)) || !walkable(map, n)) continue;
          if (aroundEnemies && unitAt(fight, n)?.side === 'enemy') continue;
          came.set(hexKey(n), h);
          next.push(n);
        }
      }
      frontier = next;
    }
    return null;
  };
  return search(true) ?? search(false);
}

/** Where a walk has got to `t` seconds in: waiting at its start, on its way, fading past the edge, or gone. */
export function walkPosition(walk: Walk, t: number): {at: Point; alpha: number} | 'gone' {
  const {route} = walk;
  const last = route.length - 1;
  const k = (t - walk.delay) / WALK_OUT_HEX_SECONDS;
  if (k < 0) return {at: route[0]!, alpha: 1};
  if (k >= last) return 'gone';
  const i = Math.floor(k);
  const f = k - i;
  const a = route[i]!;
  const b = route[i + 1]!;
  return {
    at: {x: Math.round(lerp(a.x, b.x, f)), y: Math.round(lerp(a.y, b.y, f))},
    alpha: i === last - 1 ? 1 - f : 1,
  };
}
