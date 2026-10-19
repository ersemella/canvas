/**
 * The Salt Flats Crossing (brief section 7): 9 × 7 offset rectangle,
 * pointy-top hexes, odd rows shoved right. Mirrored left to right by column
 * (column c and 8 − c); on an odd-r map that's a mirror to within half a
 * hex on odd rows.
 */
import {hexKey, offsetToHex} from '@canvas/engine/server';
import type {Hex, OffsetCoord} from '@canvas/engine/server';

export type Tile = 'sand' | 'obstacle' | 'hazard' | 'conceal';

export interface MapData {
  id: string;
  name: string;
  columns: number;
  rows: number;
  tiles: Record<string, Tile>;
  deployment: {player: Hex[]; enemy: Hex[]};
  /** Enemy placements by party index; the run's seed picks one. */
  enemyLayouts: Hex[][];
  /** The player's starting placement, which they can change. */
  playerLayout: Hex[];
}

const COLUMNS = 9;
const ROWS = 7;
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

function columnsHexes(cols: number[]): Hex[] {
  const out: Hex[] = [];
  for (let row = 0; row < ROWS; row++) for (const col of cols) out.push(at(col, row));
  return out;
}

export const SALT_FLATS: MapData = {
  id: 'salt-flats',
  name: 'The Salt Flats Crossing',
  columns: COLUMNS,
  rows: ROWS,
  tiles: Object.fromEntries(special.map(([c, t]) => [hexKey(offsetToHex(c)), t])),
  deployment: {player: columnsHexes([0, 1]), enemy: columnsHexes([7, 8])},
  enemyLayouts: [
    [at(7, 2), at(7, 3), at(8, 4)],
    [at(7, 4), at(8, 2), at(7, 3)],
    [at(7, 3), at(8, 1), at(8, 5)],
  ],
  playerLayout: [at(1, 2), at(1, 3), at(0, 4)],
};

export const MAPS: Record<string, MapData> = {[SALT_FLATS.id]: SALT_FLATS};

export function tileAt(map: MapData, h: Hex): Tile {
  return map.tiles[hexKey(h)] ?? 'sand';
}
