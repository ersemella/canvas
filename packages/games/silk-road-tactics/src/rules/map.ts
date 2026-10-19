/**
 * The Salt Flats Crossing (brief section 7): 7 rows of pointy-top hexes,
 * odd rows shoved right. Even rows have columns 0 to 8; odd rows also have
 * column −1, so neither side edge has notches (owner, 2026-10-19). That
 * makes the board an exact left-right mirror: column c and 8 − c on even
 * rows, c and 7 − c on odd rows. The quicksand predates that and is the
 * one feature off it by a hex.
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
  deployment: {player: Hex[]; enemy: Hex[]};
  /** Enemy placements by party index; the run's seed picks one. */
  enemyLayouts: Hex[][];
  /** The player's starting placement, which they can change. */
  playerLayout: Hex[];
}

const ROWS = 7;
/** The columns of a row: odd rows start half a hex further left. */
const columnsOf = (row: number): number[] => Array.from({length: row & 1 ? 10 : 9}, (_, i) => i - (row & 1));
const at = (col: number, row: number): Hex => offsetToHex({col, row});

const special: [OffsetCoord, Tile][] = [
  // Ruins: two per half, breaking the long sight lines down the middle row.
  [{col: 3, row: 2}, 'obstacle'],
  [{col: 2, row: 4}, 'obstacle'],
  [{col: 5, row: 2}, 'obstacle'],
  [{col: 6, row: 4}, 'obstacle'],
  // Quicksand, near the centre.
  [{col: 3, row: 3}, 'hazard'],
  [{col: 5, row: 3}, 'hazard'],
  // Sandstorm, between the ruins.
  [{col: 4, row: 2}, 'conceal'],
  [{col: 4, row: 4}, 'conceal'],
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
  deployment: {player: edgeHexes('left', 2), enemy: edgeHexes('right', 2)},
  enemyLayouts: [
    [at(7, 2), at(7, 3), at(8, 4)],
    [at(7, 4), at(8, 2), at(7, 3)],
    [at(7, 3), at(8, 1), at(8, 5)],
  ],
  playerLayout: [at(1, 2), at(0, 3), at(0, 4)],
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
