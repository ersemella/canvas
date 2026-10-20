/**
 * The Salt Flats Crossing (brief section 7): 9 rows of pointy-top hexes,
 * odd rows shoved right. Even rows have columns 0 to 7; odd rows also have
 * column −1, so neither side edge is notched (owner, 2026-10-19). 8 columns
 * × 9 rows since 2026-10-20 (owner; it was 9 × 7, then briefly 7 × 7 and
 * 8 × 8, the last row added at the bottom). It is an
 * exact left-right mirror: column c and 7 − c on even rows, c and 6 − c
 * on odd rows (whose column 3 is the centre hex). Every feature is
 * mirrored, the quicksand included.
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
};

export const MAPS: Record<string, MapData> = {[SALT_FLATS.id]: SALT_FLATS};

const hexSets = new WeakMap<MapData, Set<string>>();

export function onMap(map: MapData, h: Hex): boolean {
  let set = hexSets.get(map);
  if (!set) hexSets.set(map, (set = new Set(map.hexes.map(hexKey))));
  return set.has(hexKey(h));
}

export function tileAt(map: MapData, h: Hex): Tile {
  return map.tiles[hexKey(h)] ?? 'sand';
}
