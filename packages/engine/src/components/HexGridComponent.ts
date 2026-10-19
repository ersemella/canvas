import type {HexOffsetParity, HexOrientation} from '../math/Hex';

/**
 * A rectangular (offset) hex map. The entity's Transform position is the
 * centre of the hex at column 0, row 0.
 */
export interface HexGridData {
  /** `'pointy'` (a vertex at the top, rows of hexes) or `'flat'`. */
  orientation: HexOrientation;
  /** Centre-to-vertex distance in pixels. */
  size: number;
  columns: number;
  rows: number;
  /**
   * Which rows (pointy) or columns (flat) are shoved by half a hex: `'odd'`
   * (the default) or `'even'`.
   */
  parity?: HexOffsetParity;
}

/** Puts an entity on a hex of a grid, in axial coordinates. */
export interface HexPositionData {
  /** Id of the entity with the `HexGrid`. */
  grid: string;
  q: number;
  r: number;
}
