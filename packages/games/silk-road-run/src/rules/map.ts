/**
 * The Salt Flats Crossing (brief section 7): 8 rows of pointy-top hexes,
 * odd rows shoved right. Even rows have columns 0 to 6; odd rows also have
 * column −1, so neither side edge is notched (owner, 2026-10-19). 8 × 8
 * (odd rows 8 hexes wide) since 2026-10-23 (owner; it was 9 × 7, then
 * briefly 7 × 7 and 8 × 8, then 9 × 9 from 2026-10-20). It is an exact
 * left-right mirror: column c and 6 − c on even rows (whose column 3 is
 * the centre hex), c and 5 − c on odd rows.
 *
 * Each fight scatters its own ruins, not mirrored (owner, 2026-10-20; see
 * `randomTiles`). The fixed layout below is the map's own, which tests
 * place units around. Quicksand and the sandstorm were removed with their
 * keywords (owner, 2026-10-23).
 */
import {hexDistance, hexKey, hexNeighbors, offsetToHex} from '@canvas/engine/server';
import type {Hex, OffsetCoord} from '@canvas/engine/server';

export type Tile = 'sand' | 'obstacle';

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

const ROWS = 8;
/** The columns of a row: even rows 0 to 6, odd rows −1 to 6 (odd rows sit half a hex further left). */
const columnsOf = (row: number): number[] =>
  Array.from({length: row & 1 ? 8 : 7}, (_, i) => i - (row & 1));
const at = (col: number, row: number): Hex => offsetToHex({col, row});

const special: [OffsetCoord, Tile][] = [
  // Ruins: two per half, breaking the long sight lines across the board.
  [{col: 2, row: 2}, 'obstacle'],
  [{col: 4, row: 2}, 'obstacle'],
  [{col: 1, row: 5}, 'obstacle'],
  [{col: 4, row: 5}, 'obstacle'],
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
  // The top-left corner (owner, 2026-10-22; was the middle row's first hex).
  camelStart: at(0, 0),
  // The bottom-right corner, the only exit (owner, 2026-10-22; was the four
  // hexes sticking out on the right edge).
  exits: [at(columnsOf(ROWS - 1).at(-1)!, ROWS - 1)],
};

export const MAPS: Record<string, MapData> = {[SALT_FLATS.id]: SALT_FLATS};

/**
 * Ruins per fight: three in the top rows and three in the bottom, to break
 * sight lines on both (owner, 2026-10-22; two each before).
 */
const RUIN_ROWS = [
  [0, 1, 2, 3],
  [4, 5, 6, 7],
];
const RUINS_PER_ROWS = 3;

/** How far apart a fight's ruins try to be: no two within two hexes, so they spread across the board. */
const RUIN_GAP = 3;

/**
 * A fight's own ruins, from `random` in [0, 1): anywhere (not mirrored,
 * owner 2026-10-20) but the starting columns, top and bottom rows and the
 * hexes in front of the starting columns included (owner, 2026-10-24; two
 * columns clear of each edge before, which bunched them in the middle).
 * Each keeps `RUIN_GAP` hexes from the others where it can, closing in
 * only when nothing that far is left, and never cuts the board in two.
 */
export function randomTiles(random: () => number): Record<string, Tile> {
  const tiles: Record<string, Tile> = {};
  const ruins: Hex[] = [];
  const candidates: OffsetCoord[] = [];
  for (let row = 0; row < ROWS; row++)
    for (const col of columnsOf(row).slice(1, -1)) candidates.push({col, row});
  for (const rows of RUIN_ROWS)
    for (let i = 0; i < RUINS_PER_ROWS; i++)
      for (let gap = RUIN_GAP; gap >= 1; gap--) {
        const free = candidates
          .filter((c) => rows.includes(c.row))
          .map((c) => offsetToHex(c))
          .filter((h) => ruins.every((r) => hexDistance(r, h) >= gap))
          .filter((h) => connectedWithout(tiles, h));
        if (!free.length) continue;
        const h = free[Math.floor(random() * free.length)]!;
        tiles[hexKey(h)] = 'obstacle';
        ruins.push(h);
        break;
      }
  return tiles;
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
