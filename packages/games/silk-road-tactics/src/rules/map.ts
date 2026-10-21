/**
 * The Salt Flats Crossing (brief section 7): 9 rows of pointy-top hexes,
 * odd rows shoved right. Even rows have columns 0 to 7; odd rows also have
 * column −1, so neither side edge is notched (owner, 2026-10-19). 8 columns
 * × 9 rows since 2026-10-20 (owner; it was 9 × 7, then briefly 7 × 7 and
 * 8 × 8, the last row added at the bottom). It is an
 * exact left-right mirror: column c and 7 − c on even rows, c and 6 − c
 * on odd rows (whose column 3 is the centre hex). Every feature is
 * mirrored, the quicksand included.
 *
 * Each fight scatters its own ruins and quicksand, not mirrored (owner,
 * 2026-10-20; see `randomTiles`); the sandstorm stays where it is. The
 * fixed layout below is what a fight saved without its own tiles uses.
 */
import {hexKey, offsetToHex} from '@canvas/engine/server';
import type {Hex, OffsetCoord} from '@canvas/engine/server';

export type Tile = 'sand' | 'obstacle' | 'hazard' | 'conceal';

export interface MapData {
  id: string;
  name: string;
  /** Every hex on the board, row by row. */
  hexes: Hex[];
  tiles: Record<string, Tile>;
  /** Where each side may start: the board's outermost column on its edge. */
  startColumns: {player: Hex[]; enemy: Hex[]};
  /** The player's camel's starting hex, one of the player's starting column (camel.md, 18.1). */
  camelStart: Hex;
  /** The camel reaching one of these wins the fight (camel.md, 18.2). */
  exits: Hex[];
}

const ROWS = 9;
/** The columns of a row: even rows 0 to 7, odd rows −1 to 7 (odd rows sit half a hex further left). */
const columnsOf = (row: number): number[] =>
  Array.from({length: row & 1 ? 9 : 8}, (_, i) => i - (row & 1));
const at = (col: number, row: number): Hex => offsetToHex({col, row});

const special: [OffsetCoord, Tile][] = [
  // Ruins: two per half, breaking the long sight lines across the board.
  [{col: 2, row: 2}, 'obstacle'],
  [{col: 5, row: 2}, 'obstacle'],
  [{col: 1, row: 5}, 'obstacle'],
  [{col: 5, row: 5}, 'obstacle'],
  // Quicksand, either side of the centre hex.
  [{col: 2, row: 3}, 'hazard'],
  [{col: 4, row: 3}, 'hazard'],
  // Sandstorm, between the ruins.
  [{col: 3, row: 2}, 'conceal'],
  [{col: 4, row: 2}, 'conceal'],
  [{col: 3, row: 5}, 'conceal'],
];

function boardHexes(): Hex[] {
  const out: Hex[] = [];
  for (let row = 0; row < ROWS; row++) for (const col of columnsOf(row)) out.push(at(col, row));
  return out;
}

/** The `n` hexes of each row nearest the left or right edge. */
function edgeHexes(side: 'left' | 'right', n: number): Hex[] {
  const out: Hex[] = [];
  for (let row = 0; row < ROWS; row++) {
    const cols = columnsOf(row);
    for (const col of side === 'left' ? cols.slice(0, n) : cols.slice(-n)) out.push(at(col, row));
  }
  return out;
}

export const SALT_FLATS: MapData = {
  id: 'salt-flats',
  name: 'The Salt Flats Crossing',
  hexes: boardHexes(),
  tiles: Object.fromEntries(special.map(([c, t]) => [hexKey(offsetToHex(c)), t])),
  startColumns: {player: edgeHexes('left', 1), enemy: edgeHexes('right', 1)},
  // The middle row's first hex.
  camelStart: at(0, 4),
  // The four hexes sticking out on the right edge: the last of each row
  // shoved half a hex right (owner, 2026-10-21).
  exits: [1, 3, 5, 7].map((row) => at(7, row)),
};

export const MAPS: Record<string, MapData> = {[SALT_FLATS.id]: SALT_FLATS};

/** Ruins per fight: two in the top rows and two in the bottom, to break sight lines on both. */
const RUIN_ROWS = [
  [0, 1, 2, 3],
  [5, 6, 7, 8],
];
const RUINS_PER_ROWS = 2;
/** Quicksand hexes per fight. */
const QUICKSAND = 2;

/**
 * A fight's own ruins and quicksand, from `random` in [0, 1): as many as
 * the fixed layout has, anywhere (not mirrored, owner 2026-10-20) but two
 * columns clear of each side's edge (the starting columns and the hexes in
 * front of them), off the sandstorm and off each other. The sandstorm
 * keeps its place.
 */
export function randomTiles(random: () => number): Record<string, Tile> {
  const tiles: Record<string, Tile> = {};
  for (const [c, t] of special) if (t === 'conceal') tiles[hexKey(offsetToHex(c))] = t;
  const candidates: OffsetCoord[] = [];
  for (let row = 0; row < ROWS; row++)
    for (const col of columnsOf(row).slice(2, -2)) candidates.push({col, row});
  const place = (pool: OffsetCoord[], tile: Tile) => {
    const free = pool.filter((c) => !tiles[hexKey(offsetToHex(c))]);
    tiles[hexKey(offsetToHex(free[Math.floor(random() * free.length)]!))] = tile;
  };
  for (const rows of RUIN_ROWS)
    for (let i = 0; i < RUINS_PER_ROWS; i++)
      place(
        candidates.filter((c) => rows.includes(c.row)),
        'obstacle'
      );
  for (let i = 0; i < QUICKSAND; i++) place(candidates, 'hazard');
  return tiles;
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
