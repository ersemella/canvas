/**
 * The Steppe Crossing: a hexagon of flat-top hexes, 4 from the centre hex
 * each way, 61 hexes (owner, 2026-10-24; a 64-hex block of pointy-top
 * hexes, 9 rows with the corners cut, and before it the Salt Flats'
 * smaller boards, from 2026-10-19). Its nine columns run 5, 6, 7, 8, 9, 8,
 * 7, 6, 5 hexes from left to right, so the outermost columns, where the
 * sides start, are straight, five hexes each. The camel starts at the top
 * point and the only exit is the bottom one, the board's length apart.
 *
 * Hexes are axial, the centre hex {q: 0, r: 0}; on screen q runs left to
 * right and r down each column. A space can also be named as a column (0
 * to 8, left to right) and a row counted down from the top of that column
 * (`spaceAt`), as the test stage's file does.
 *
 * The open steppe: a fight has no ruins (owner, 2026-10-24; six scattered
 * per fight before), only, in about half of fights, a range of mountains
 * (see `randomTiles`). The fixed layout of four ruins below is kept for
 * the tests, which place units around it, and the test stage's `"map"`. Quicksand and the sandstorm were removed
 * with their keywords (owner, 2026-10-23).
 */
import {hexDistance, hexKey, hexNeighbors} from '@canvas/engine/server';
import type {Hex} from '@canvas/engine/server';

export type Tile = 'sand' | 'obstacle' | 'mountain';

/** Ruins and mountains: no unit may stand there, and they stop arrows. */
export function blocks(tile: string | undefined): boolean {
  return tile === 'obstacle' || tile === 'mountain';
}

export interface MapData {
  id: string;
  name: string;
  /** Every hex on the board, top to bottom, left to right. */
  hexes: Hex[];
  tiles: Record<string, Tile>;
  /** Where each side may start: the board's outermost column on its edge. */
  startColumns: {player: Hex[]; enemy: Hex[]};
  /** The player's camel's starting hex (camel.md, 18.1). */
  camelStart: Hex;
  /** The camel reaching one of these wins the fight (camel.md, 18.2). */
  exits: Hex[];
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

const special: [Hex, Tile][] = [
  // Ruins: two per half, breaking the long sight lines across the board
  // (the board of rows' four, around its centre as they were).
  [{q: -1, r: -1}, 'obstacle'],
  [{q: 1, r: -1}, 'obstacle'],
  [{q: -3, r: 2}, 'obstacle'],
  [{q: 0, r: 2}, 'obstacle'],
];

export const SALT_FLATS: MapData = {
  id: 'steppe',
  name: 'The Steppe Crossing',
  hexes: boardHexes(),
  tiles: Object.fromEntries(special.map(([h, t]) => [hexKey(h), t])),
  startColumns: {player: column(-RADIUS), enemy: column(RADIUS)},
  // The top point (owner, 2026-10-24; the top-left corner on the board of
  // rows before).
  camelStart: {q: 0, r: -RADIUS},
  // The bottom point, the only exit (owner, 2026-10-24; the bottom-right
  // corner before).
  exits: [{q: 0, r: RADIUS}],
};

export const MAPS: Record<string, MapData> = {[SALT_FLATS.id]: SALT_FLATS};

/**
 * Mountains (owner, 2026-10-24): about half of fights have one range, 3 to
 * 5 hexes in one clump along one of the hexagon's four slanted edges (top
 * left, top right, bottom left, bottom right), starting on that edge and
 * at most one hex in from it. Never on the sides (the starting columns and
 * the hexes in from them), never down the middle column, where Temee walks,
 * so never directly in front of Temee, and never within
 * `MOUNTAIN_CENTRE_GAP` − 1 hexes of the centre.
 */
const MOUNTAIN_CHANCE = 0.5;
const MOUNTAIN_SIZES = [3, 4, 5];
const MOUNTAIN_CENTRE_GAP = 3;
const CENTRE: Hex = {q: 0, r: 0};

/**
 * The four slanted edges, top left, top right, bottom left and bottom
 * right: which side of the middle column each is on, and how far in from
 * it a hex is (0 on the edge).
 */
const MOUNTAIN_EDGES: {left: boolean; inFrom: (h: Hex) => number}[] = [
  {left: true, inFrom: (h) => h.q + h.r + RADIUS},
  {left: false, inFrom: (h) => h.r + RADIUS},
  {left: true, inFrom: (h) => RADIUS - h.r},
  {left: false, inFrom: (h) => RADIUS - h.q - h.r},
];

/**
 * A fight's own tiles, from `random` in [0, 1): a range of mountains in
 * about half of fights, off the starting columns, the camel's start and
 * the exit, and nothing else; the steppe is open (owner, 2026-10-24, the
 * ruins gone).
 */
export function randomTiles(random: () => number): Record<string, Tile> {
  const tiles: Record<string, Tile> = {};
  const reserved = [SALT_FLATS.camelStart, ...SALT_FLATS.exits];
  const candidates = SALT_FLATS.hexes.filter(
    (h) => Math.abs(h.q) < RADIUS && !reserved.some((x) => hexDistance(x, h) === 0)
  );
  if (random() < MOUNTAIN_CHANCE) {
    const edge = MOUNTAIN_EDGES[Math.floor(random() * MOUNTAIN_EDGES.length)]!;
    const size = MOUNTAIN_SIZES[Math.floor(random() * MOUNTAIN_SIZES.length)]!;
    const inFrontOfTemee: Hex = {q: 0, r: SALT_FLATS.camelStart.r + 1};
    const allowed = candidates
      .filter((h) => (edge.left ? h.q < 0 : h.q > 0))
      .filter((h) => edge.inFrom(h) === 0 || (edge.inFrom(h) === 1 && Math.abs(h.q) < RADIUS - 1))
      .filter((h) => hexDistance(h, CENTRE) >= MOUNTAIN_CENTRE_GAP)
      .filter((h) => hexDistance(h, inFrontOfTemee) > 0);
    mountainRange(tiles, allowed, edge.inFrom, size, random);
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
  tiles: Record<string, Tile>,
  allowed: Hex[],
  inFrom: (h: Hex) => number,
  size: number,
  random: () => number
): Hex[] {
  const range: Hex[] = [];
  const inRange = (h: Hex) => range.some((m) => hexDistance(m, h) === 0);
  while (range.length < size) {
    let free = allowed.filter((h) => !inRange(h) && connectedWithout(tiles, h));
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

/** Whether every open hex can still walk to every other with `extra` ruined too. */
function connectedWithout(tiles: Record<string, Tile>, extra: Hex): boolean {
  const blocked = new Set([...Object.keys(tiles), hexKey(extra)]);
  const all = new Set(SALT_FLATS.hexes.map(hexKey));
  const open = SALT_FLATS.hexes.filter((h) => !blocked.has(hexKey(h)));
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
