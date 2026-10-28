/**
 * The Steppe Crossing: a hexagon of flat-top hexes, 4 from the centre hex
 * each way, 61 hexes (owner, 2026-10-24; a 64-hex block of pointy-top
 * hexes, 9 rows with the corners cut, and before it the Salt Flats'
 * smaller boards, from 2026-10-19). Its nine columns run 5, 6, 7, 8, 9, 8,
 * 7, 6, 5 hexes from left to right, so the outermost columns are straight,
 * five hexes each. Each side starts in the two columns on its edge (owner,
 * 2026-10-25; the outermost column alone before): the party on the right,
 * facing left, the enemy on the left, facing right (owner, 2026-10-28; the
 * other way round before). The camel starts at the top-right or the
 * bottom-right corner, at random each fight, and the only exit is the
 * opposite corner, the board's length apart (owner, 2026-10-28; the top
 * point and the bottom one before; `ROUTES`).
 *
 * Hexes are axial, the centre hex {q: 0, r: 0}; on screen q runs left to
 * right and r down each column. A space can also be named as a column (0
 * to 8, left to right) and a row counted down from the top of that column
 * (`spaceAt`), as the test stage's file does.
 *
 * The open steppe: each fight pitches two or three yurts near the board's
 * middle and raises mountains anywhere along the top edge, at random
 * (owner, 2026-10-28; to the left or right of Humphrey's start at the top
 * point, or both, from 2026-10-27; see `randomTiles`); the ruins scattered before are gone (owner,
 * 2026-10-24). The fixed layout of four yurts below is the map's own,
 * which tests place units around, and the test stage's `"map"`. Quicksand and the sandstorm were removed
 * with their keywords (owner, 2026-10-23).
 *
 * Each region has a map of its own (2026-10-25; setting.md, 15.3a), the
 * same board under another look: the Steppe's (`STEPPE`), the Gobi
 * Desert (`GOBI`), the China region's (owner, 2026-10-28), where the
 * `obstacle` tile is an oasis rather than a yurt, the Flaming Mountains
 * (`FLAMING`), China's from 2026-10-26 and no region's now, its obstacle a
 * beacon tower and patches of scorched ground spread over it (`scorched`)
 * in place of mountains,
 * and the Salt Flats (`SALT`), the Persia region's (owner, 2026-10-26),
 * one large salt dome over the middle seven spaces. A
 * stage names its map (`STAGES` in config.ts); the page draws each map's
 * look (`ground.ts`).
 */
import {hexDistance, hexKey, hexNeighbors} from '@canvas/engine/server';
import type {Hex} from '@canvas/engine/server';

/**
 * `obstacle` is a yurt on the Steppe, an oasis in the Gobi and a beacon tower in the Flaming Mountains (ruins everywhere until 2026-10-24; saved runs keep the name).
 * `scorched` is open ground that burns (`scorched`; owner, 2026-10-28): walkable, it blocks nothing.
 */
export type Tile = 'sand' | 'obstacle' | 'mountain' | 'scorched';

/** Yurts (ruins) and mountains: no unit may stand there, and they stop arrows. */
export function blocks(tile: string | undefined): boolean {
  return tile === 'obstacle' || tile === 'mountain';
}

export interface MapData {
  id: string;
  name: string;
  /** Every hex on the board, top to bottom, left to right. */
  hexes: Hex[];
  tiles: Record<string, Tile>;
  /** Where each side may start: the board's two outermost columns on its edge. */
  startColumns: {player: Hex[]; enemy: Hex[]};
  /**
   * The player's camel's starting hex (camel.md, 18.1): on a map of
   * `MAPS`, its first route's (`ROUTES`); on a fight's own (`mapOf`), the
   * fight's.
   */
  camelStart: Hex;
  /** The camel reaching one of these wins the fight (camel.md, 18.2); as `camelStart`. */
  exits: Hex[];
  /**
   * Whether its fights raise a range of mountains (`randomTiles`): in about
   * half of them, or when the stage says (no map now; the Steppe's until
   * 2026-10-27); never (the Gobi's, 2026-10-25); or in every one (the
   * Steppe's, owner, 2026-10-27, and the Flaming Mountains', 2026-10-26).
   */
  mountains: 'sometimes' | 'never' | 'always';
  /**
   * Where they stand: one or two ranges anywhere along the board's top
   * edge, its two top slanted edges (the Steppe's, owner, 2026-10-28;
   * either side of Humphrey's start at the top point from 2026-10-27, any
   * of the four slanted edges before), or one salt dome on
   * the centre and the six spaces around it, the same in every fight (the
   * Salt Flats', owner, 2026-10-26; `DOME`).
   */
  mountainPlaces: 'edge' | 'centre';
  /**
   * Its fights' yurts (ruins): how many, one of `counts` at random, and
   * how far from the centre they may stand (`randomTiles`).
   */
  obstacles: {counts: number[]; reach: number};
  /**
   * Its fights' scorched ground (`scorched`; the Flaming Mountains', owner,
   * 2026-10-28): how many patches, one of `patches` at random, each of one
   * of `sizes` spaces (`scorchedPatches`); `null` on a map without it.
   */
  scorch: {patches: number[]; sizes: number[]} | null;
}

/** How far the board reaches from its centre hex. */
const RADIUS = 4;

/**
 * How far down the board a hex sits, in half hexes from the centre's
 * level: −8 at the top point to 8 at the bottom one. Negative is the top
 * half, positive the bottom, 0 the middle (either half).
 */
export const depth = (h: Hex): number => 2 * h.r + h.q;

/** The rows of column `q` (−4 to 4), top to bottom. */
function columnRs(q: number): number[] {
  const top = Math.max(-RADIUS, -RADIUS - q);
  const bottom = Math.min(RADIUS, RADIUS - q);
  return Array.from({length: bottom - top + 1}, (_, i) => top + i);
}

/** The space at column `col` (0 to 8, left to right), `row` hexes down from that column's top. */
export function spaceAt(col: number, row: number): Hex {
  const q = col - RADIUS;
  return {q, r: (columnRs(q)[0] ?? 0) + row};
}

/** A hex as a column and a row down that column (`spaceAt`'s inverse). */
export function spaceOf(h: Hex): {col: number; row: number} {
  return {col: h.q + RADIUS, row: h.r - Math.max(-RADIUS, -RADIUS - h.q)};
}

function boardHexes(): Hex[] {
  const out: Hex[] = [];
  for (let q = -RADIUS; q <= RADIUS; q++) for (const r of columnRs(q)) out.push({q, r});
  return out.sort((a, b) => depth(a) - depth(b) || a.q - b.q);
}

const column = (q: number): Hex[] => columnRs(q).map((r) => ({q, r}));

/** A road for the camel: where it starts and the exit it walks to. */
export interface Route {
  camelStart: Hex;
  exits: Hex[];
}

/**
 * The camel's two roads (owner, 2026-10-28), one at random each fight
 * (`createFight`): from the top-right corner to the bottom-left one, or
 * from the bottom-right to the top-left, each a straight line through the
 * centre, 8 hexes long.
 */
export const ROUTES: Route[] = [
  {camelStart: {q: RADIUS, r: -RADIUS}, exits: [{q: -RADIUS, r: RADIUS}]},
  {camelStart: {q: RADIUS, r: 0}, exits: [{q: -RADIUS, r: 0}]},
];

/**
 * The hex just past `map`'s exit `exit`, off the board, carrying on the
 * camel's road the way it was going (the walk out's last step, and the
 * way the exit's chevrons point).
 */
export function pastExit(map: MapData, exit: Hex): Hex {
  const from = map.camelStart;
  const d = Math.max(1, hexDistance(from, exit));
  return {
    q: exit.q + Math.round((exit.q - from.q) / d),
    r: exit.r + Math.round((exit.r - from.r) / d),
  };
}

const special: [Hex, Tile][] = [
  // Yurts: two per half, around the centre (the ruins' places before).
  [{q: -1, r: -1}, 'obstacle'],
  [{q: 1, r: -1}, 'obstacle'],
  [{q: -3, r: 2}, 'obstacle'],
  [{q: 0, r: 2}, 'obstacle'],
];

export const STEPPE: MapData = {
  id: 'steppe',
  name: 'The Grassland Crossing',
  hexes: boardHexes(),
  tiles: Object.fromEntries(special.map(([h, t]) => [hexKey(h), t])),
  // The party on the right, the enemy on the left (owner, 2026-10-28).
  startColumns: {
    player: [...column(RADIUS), ...column(RADIUS - 1)],
    enemy: [...column(-RADIUS), ...column(1 - RADIUS)],
  },
  // A right-hand corner to the opposite one, at random each fight (owner,
  // 2026-10-28; `ROUTES`); the top point to the bottom one from 2026-10-24.
  ...ROUTES[0]!,
  // Always, along the top (owner, 2026-10-27; about half of fights, on any
  // slanted edge, before).
  mountains: 'always',
  mountainPlaces: 'edge',
  // Two or three yurts, within 2 hexes of the centre (owner, 2026-10-24).
  obstacles: {counts: [2, 3], reach: 2},
  scorch: null,
};

/**
 * The Gobi Desert (owner, 2026-10-28), the China region's map again: made
 * as its way in (2026-10-25), then kept for the Arabia region while the
 * Flaming Mountains were China's (owner, 2026-10-26). The Steppe's board
 * on sand, no mountains, whatever the stage, and its yurts' places
 * **oases**, a pool under date palms (owner, 2026-10-28; sandstone ruins
 * of the old frontier posts before). Two or three of them (owner,
 * 2026-10-28; four or five from 2026-10-25, as there are no mountains to
 * break up the board), within 3 hexes of the centre, still off the
 * starting columns.
 */
export const GOBI: MapData = {
  ...STEPPE,
  id: 'gobi',
  name: 'The Gobi Desert',
  mountains: 'never',
  obstacles: {counts: [2, 3], reach: 3},
};

/**
 * The Flaming Mountains (owner, 2026-10-26), the China region's map until
 * the Gobi took its place (owner, 2026-10-28), kept so a run saved there
 * still loads, and on the test stage: the
 * red earth of *Journey to the West*'s burning mountains, with no
 * mountains on it (owner, 2026-10-28) but **scorched ground** spread over
 * it in every fight, four or five small patches of one or two spaces
 * (`scorchedPatches`), which burn a unit Moved onto them or ending its
 * turn there (`scorched`), and one Han **beacon tower** (owner,
 * 2026-10-28; one or two before), the rammed-earth watchtowers along the
 * Hexi Corridor, as its `obstacle`, within 3 of the centre. Before
 * 2026-10-28 its burning mountains stood in side-by-side pairs in the
 * middle (three, then two at most), briefly along the board's rim, the
 * ground beside them scorched; the mudbrick ruins first scattered there,
 * and fissures burning whoever entered them, were taken out (owner,
 * 2026-10-26).
 */
export const FLAMING: MapData = {
  ...STEPPE,
  id: 'flaming',
  name: 'The Burning Mountains',
  mountains: 'never',
  obstacles: {counts: [1], reach: 3},
  scorch: {patches: [4, 5], sizes: [1, 2, 2]},
};

/**
 * The salt dome's spaces: the centre and the six around it (owner,
 * 2026-10-26), a hexagon in the middle of the hexagon board.
 */
export const DOME: Hex[] = [{q: 0, r: 0}, ...hexNeighbors({q: 0, r: 0})];

/**
 * The Salt Flats (owner, 2026-10-26), the Persia region's map: the salt
 * crust of a desert's dry lake, and one large salt dome over the middle
 * seven spaces in every fight (`DOME`), the same each time, so the board
 * fights round its two sides; the camel walks round it, 10 steps to the
 * exit instead of 8. Only the dome: the one obstacle a fight, a ruin
 * standing in for the design's windcatcher (salt-flats.md), was taken out
 * (owner, 2026-10-26).
 */
export const SALT: MapData = {
  ...STEPPE,
  id: 'salt',
  name: 'The Salt Flats',
  tiles: Object.fromEntries(DOME.map((h) => [hexKey(h), 'mountain' as const])),
  mountains: 'always',
  mountainPlaces: 'centre',
  obstacles: {counts: [0], reach: 3},
  scorch: null,
};

export const MAPS: Record<string, MapData> = {
  [STEPPE.id]: STEPPE,
  [GOBI.id]: GOBI,
  [FLAMING.id]: FLAMING,
  [SALT.id]: SALT,
};

/** A map's mountains that stand in every fight, the same each time: the Salt Flats' dome; none elsewhere. */
export function fixedTiles(map: MapData): Record<string, Tile> {
  return map.mountainPlaces === 'centre'
    ? Object.fromEntries(DOME.map((h) => [hexKey(h), 'mountain' as const]))
    : {};
}

/** A map by its id; a mistake, never a fallback, if there's none. */
export function mapById(id: string): MapData {
  const map = MAPS[id];
  if (!map) throw new Error(`No map "${id}".`);
  return map;
}

/**
 * Mountains (owner, 2026-10-24): on a map that raises them along its
 * edges (the Steppe's, in every fight since 2026-10-27), one range or two
 * (`MOUNTAIN_RANGES`), each 3 to 5 hexes in one clump starting anywhere
 * along the hexagon's top edge, its two top slanted edges and the point
 * between them, and at most one hex in from it, so that together they may
 * run all along it (owner, 2026-10-28, once Humphrey no longer started at
 * the top point; left of it, right of it or both from 2026-10-27, one
 * range on any of the four slanted edges before). Never on the sides (the
 * starting columns and the hexes in from them), and never within
 * `MOUNTAIN_CENTRE_GAP` − 1 hexes of the centre.
 */
const MOUNTAIN_CHANCE = 0.5;
const MOUNTAIN_SIZES = [3, 4, 5];
const MOUNTAIN_RANGES = [1, 2];
const MOUNTAIN_CENTRE_GAP = 3;
const CENTRE: Hex = {q: 0, r: 0};

/** How far in from the board's top edge a hex is: 0 on it. */
const inFromTop = (h: Hex): number => h.r + Math.min(h.q, 0) + RADIUS;

/**
 * A fight's own tiles, from `random` in [0, 1): a range of mountains in
 * about half of fights, or always with `mountains` or on a map that always
 * has them, never on a map without them (`MapData.mountains`), along the
 * top edges (`mountainPlaces`), off the starting columns, the camel's
 * start and the exit, or the Salt Flats' dome (`fixedTiles`), then the
 * map's scorched ground (`scorchedPatches`), then two or three yurts near
 * the middle (not mirrored), on `map`'s board.
 */
export function randomTiles(
  random: () => number,
  mountains = false,
  map: MapData = STEPPE
): Record<string, Tile> {
  const tiles: Record<string, Tile> = fixedTiles(map);
  const fixed = map.mountainPlaces === 'centre';
  const reserved = [map.camelStart, ...map.exits];
  const candidates = map.hexes.filter(
    (h) => Math.abs(h.q) < RADIUS && !reserved.some((x) => hexDistance(x, h) === 0)
  );
  // Rolled even when forced, so a seed's other draws stay the same.
  const rolled = random() < MOUNTAIN_CHANCE;
  const raise = map.mountains !== 'never' && (rolled || mountains || map.mountains === 'always');
  const {counts, reach} = map.obstacles;
  const roll = () => counts[Math.floor(random() * counts.length)]!;
  if (raise && !fixed) {
    const ranges = MOUNTAIN_RANGES[Math.floor(random() * MOUNTAIN_RANGES.length)]!;
    const allowed = candidates
      .filter((h) => inFromTop(h) === 0 || (inFromTop(h) === 1 && Math.abs(h.q) < RADIUS - 1))
      .filter((h) => hexDistance(h, CENTRE) >= MOUNTAIN_CENTRE_GAP);
    for (let i = 0; i < ranges; i++) {
      const size = MOUNTAIN_SIZES[Math.floor(random() * MOUNTAIN_SIZES.length)]!;
      mountainRange(map, tiles, allowed, inFromTop, size, random);
    }
  }
  // Yurts (owner, 2026-10-24), or ruins: as many as the map
  // says, within its reach of the centre and off the starting columns, not
  // next to the camel's start or the exit, no two side by side, never
  // cutting the board in two.
  // By the dome, not next to a mountain either, so a ruin stands on its
  // own rather than reading as part of it. Never on scorched ground.
  if (map.scorch) scorchedPatches(map, map.scorch, tiles, candidates, random);
  const yurts: Hex[] = [];
  const count = roll();
  const mountainHexes = fixed ? map.hexes.filter((h) => tiles[hexKey(h)] === 'mountain') : [];
  for (let i = 0; i < count; i++) {
    const free = candidates
      .filter((h) => !tiles[hexKey(h)])
      .filter((h) => hexDistance(h, CENTRE) <= reach && Math.abs(h.q) < RADIUS - 1)
      .filter((h) => reserved.every((x) => hexDistance(x, h) > 1))
      .filter((h) => [...yurts, ...mountainHexes].every((y) => hexDistance(y, h) > 1))
      .filter((h) => connectedWithout(map, tiles, h));
    if (!free.length) break;
    const h = free[Math.floor(random() * free.length)]!;
    tiles[hexKey(h)] = 'obstacle';
    yurts.push(h);
  }
  return tiles;
}

/**
 * One clump of up to `size` mountains among `allowed`, marked in `tiles`,
 * hugging the board's edge like the start of a longer range (owner,
 * 2026-10-24): from a random first hex on the edge (`inFrom` 0) it grows a
 * hex at a time onto a neighbour of the range, along the edge while it can
 * and only then a hex in, the ones touching more of it first, so it
 * thickens rather than sticks out. Never cuts the board in two.
 */
function mountainRange(
  map: MapData,
  tiles: Record<string, Tile>,
  allowed: Hex[],
  inFrom: (h: Hex) => number,
  size: number,
  random: () => number
): Hex[] {
  const range: Hex[] = [];
  while (range.length < size) {
    let free = allowed.filter((h) => !tiles[hexKey(h)] && connectedWithout(map, tiles, h));
    if (!range.length) free = free.filter((h) => inFrom(h) === 0);
    if (range.length) {
      const touching = (h: Hex) => range.filter((m) => hexDistance(m, h) === 1).length;
      free = free.filter((h) => touching(h) > 0);
      const nearest = Math.min(...free.map(inFrom));
      free = free.filter((h) => inFrom(h) === nearest);
      const most = Math.max(0, ...free.map(touching));
      free = free.filter((h) => touching(h) === most);
    }
    if (!free.length) break;
    const h = free[Math.floor(random() * free.length)]!;
    tiles[hexKey(h)] = 'mountain';
    range.push(h);
  }
  return range;
}

/**
 * The Flaming Mountains' scorched ground (owner, 2026-10-28), spread over
 * the board: `patches` patches, each a first space and, for a size of 2,
 * one beside it, off the starting columns and Humphrey's road (`onRoad`),
 * not next to its start or exit, and each patch at least 3 spaces
 * from the others where it can be (2 where it can't), so they spread
 * rather than clump.
 */
function scorchedPatches(
  map: MapData,
  scorch: NonNullable<MapData['scorch']>,
  tiles: Record<string, Tile>,
  candidates: Hex[],
  random: () => number
): void {
  const reserved = [map.camelStart, ...map.exits];
  const pick = <T>(list: T[]): T => list[Math.floor(random() * list.length)]!;
  const allowed = candidates
    .filter((h) => Math.abs(h.q) < RADIUS - 1 && !onRoad(map, h) && !tiles[hexKey(h)])
    .filter((h) => reserved.every((x) => hexDistance(x, h) > 1));
  const placed: Hex[] = [];
  const count = pick(scorch.patches);
  for (let i = 0; i < count; i++) {
    const size = pick(scorch.sizes);
    const apart = (gap: number) =>
      allowed.filter((h) => placed.every((p) => hexDistance(p, h) >= gap));
    const open = apart(3).length ? apart(3) : apart(2);
    if (!open.length) break;
    const first = pick(open);
    const patch = [first];
    const beside = open.filter((h) => hexDistance(h, first) === 1);
    if (size > 1 && beside.length) patch.push(pick(beside));
    for (const h of patch) tiles[hexKey(h)] = 'scorched';
    placed.push(...patch);
  }
}

/**
 * Scorched ground (owner, 2026-10-28; `Tile`), the Flaming Mountains'
 * (`MapData.scorch`; the open spaces next to its burning mountains, the
 * same day, before they were taken out). It burns a unit Moved onto it (Pushed, Pulled,
 * thrown or swapped there, each space it enters) or ending its turn there
 * (`scorch` in resolve.ts); walking across it doesn't.
 */
export function scorched(map: MapData, h: Hex): boolean {
  return map.tiles[hexKey(h)] === 'scorched';
}

/** Whether `h` is on the straight road from `map`'s camel start to its exit (`ROUTES`). */
function onRoad(map: MapData, h: Hex): boolean {
  const start = map.camelStart;
  const exit = map.exits[0]!;
  return hexDistance(start, h) + hexDistance(h, exit) === hexDistance(start, exit);
}

/** Whether every open hex of `map` can still walk to every other with `extra` blocked too. */
function connectedWithout(map: MapData, tiles: Record<string, Tile>, extra: Hex): boolean {
  const blocked = new Set([...Object.keys(tiles).filter((k) => blocks(tiles[k])), hexKey(extra)]);
  const all = new Set(map.hexes.map(hexKey));
  const open = map.hexes.filter((h) => !blocked.has(hexKey(h)));
  const seen = new Set([hexKey(open[0]!)]);
  const queue = [open[0]!];
  for (let h; (h = queue.shift()); )
    for (const n of hexNeighbors(h)) {
      const k = hexKey(n);
      if (all.has(k) && !blocked.has(k) && !seen.has(k)) {
        seen.add(k);
        queue.push(n);
      }
    }
  return seen.size === open.length;
}

/** A hex as one number, for cheap lookups in the AI's hot loops (unique while |r| < 32768). */
export const hexNumber = (h: Hex): number => h.q * 65536 + h.r;

const hexSets = new WeakMap<Hex[], Set<number>>();

export function onMap(map: MapData, h: Hex): boolean {
  let set = hexSets.get(map.hexes);
  if (!set) hexSets.set(map.hexes, (set = new Set(map.hexes.map(hexNumber))));
  return set.has(hexNumber(h));
}

/** Each tile layout by hex number, built once; a layout never changes after it is made. */
const tileNumbers = new WeakMap<Record<string, Tile>, Map<number, Tile>>();

export function tileAt(map: MapData, h: Hex): Tile {
  let tiles = tileNumbers.get(map.tiles);
  if (!tiles) {
    tiles = new Map();
    for (const [key, tile] of Object.entries(map.tiles)) {
      const [q, r] = key.split(',').map(Number);
      tiles.set(hexNumber({q: q!, r: r!}), tile);
    }
    tileNumbers.set(map.tiles, tiles);
  }
  return tiles.get(hexNumber(h)) ?? 'sand';
}
