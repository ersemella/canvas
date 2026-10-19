/**
 * Hex grid geometry: axial coordinates, distance, neighbours, lines, areas,
 * offset-rectangle maps, and conversion to and from pixels. Pure functions
 * with no DOM, so a game's server rules can use the same geometry as its
 * renderer (also exported from `@canvas/engine/server`).
 *
 * Coordinates are axial `{q, r}` (the cube coordinate `s` is `-q - r`), as in
 * Red Blob Games' hex guide (https://www.redblobgames.com/grids/hexagons/).
 */

export interface Hex {
  q: number;
  r: number;
}

/** Column and row in an offset (rectangular) map. */
export interface OffsetCoord {
  col: number;
  row: number;
}

/**
 * `pointy`: a vertex at the top, rows of hexes (offset maps shove alternate
 * rows sideways). `flat`: an edge at the top, columns of hexes.
 */
export type HexOrientation = 'pointy' | 'flat';

/** Which rows (pointy) or columns (flat) of an offset map are shoved by half a hex. */
export type HexOffsetParity = 'odd' | 'even';

export interface HexLayout {
  orientation: HexOrientation;
  /** Centre-to-vertex distance in pixels. */
  size: number;
  /** Pixel position of hex (0, 0)'s centre. */
  origin: {x: number; y: number};
}

/**
 * The six directions, in order around the hex: index `i` and `i + 3` are
 * opposite. For pointy-top hexes they run east, north-east, north-west,
 * west, south-west, south-east (y grows downwards on the canvas).
 */
export const HEX_DIRECTIONS: readonly Hex[] = [
  {q: 1, r: 0},
  {q: 1, r: -1},
  {q: 0, r: -1},
  {q: -1, r: 0},
  {q: -1, r: 1},
  {q: 0, r: 1},
];

const SQRT3 = Math.sqrt(3);

export function hex(q: number, r: number): Hex {
  return {q, r};
}

export function hexS(h: Hex): number {
  return -h.q - h.r;
}

export function hexEquals(a: Hex, b: Hex): boolean {
  return a.q === b.q && a.r === b.r;
}

/** A string key for maps and sets, e.g. `"3,-1"`. */
export function hexKey(h: Hex): string {
  return `${h.q},${h.r}`;
}

export function hexFromKey(key: string): Hex {
  const [q, r] = key.split(',').map(Number);
  return {q: q!, r: r!};
}

export function hexAdd(a: Hex, b: Hex): Hex {
  return {q: a.q + b.q, r: a.r + b.r};
}

export function hexSubtract(a: Hex, b: Hex): Hex {
  return {q: a.q - b.q, r: a.r - b.r};
}

export function hexScale(h: Hex, k: number): Hex {
  return {q: h.q * k, r: h.r * k};
}

/** Steps between two hexes. */
export function hexDistance(a: Hex, b: Hex): number {
  const dq = a.q - b.q;
  const dr = a.r - b.r;
  return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;
}

/** Direction index 0–5 (see {@link HEX_DIRECTIONS}); wraps, so `-1` is 5. */
export function hexDirection(direction: number): Hex {
  return HEX_DIRECTIONS[((direction % 6) + 6) % 6]!;
}

export function hexNeighbor(h: Hex, direction: number): Hex {
  return hexAdd(h, hexDirection(direction));
}

/** The six adjacent hexes, in direction order. */
export function hexNeighbors(h: Hex): Hex[] {
  return HEX_DIRECTIONS.map((d) => hexAdd(h, d));
}

/**
 * The three pairs of hexes directly opposite each other across `h`
 * (directions `i` and `i + 3`).
 */
export function hexOppositePairs(h: Hex): [Hex, Hex][] {
  return [0, 1, 2].map((i) => [hexNeighbor(h, i), hexNeighbor(h, i + 3)]);
}

/**
 * The direction index from `from` to an adjacent hex or one in a straight
 * hex line from it, or `null` if `to` is not on one of the six lines.
 */
export function hexDirectionTo(from: Hex, to: Hex): number | null {
  const d = hexSubtract(to, from);
  const n = hexDistance(d, {q: 0, r: 0});
  if (n === 0) return null;
  const i = HEX_DIRECTIONS.findIndex((dir) => dir.q * n === d.q && dir.r * n === d.r);
  return i === -1 ? null : i;
}

/** Rounds fractional axial coordinates to the hex containing them. */
export function hexRound(q: number, r: number): Hex {
  return roundCube(q, r, -q - r);
}

function lerpHexes(a: Hex, b: Hex, nudge: number): Hex[] {
  const n = hexDistance(a, b);
  const out: Hex[] = [];
  // Nudging both ends the same way breaks exact ties (a line along a border)
  // consistently to one side.
  const aq = a.q + nudge;
  const ar = a.r + nudge;
  const as = hexS(a) - 2 * nudge;
  const bq = b.q + nudge;
  const br = b.r + nudge;
  const bs = hexS(b) - 2 * nudge;
  for (let i = 0; i <= n; i++) {
    const t = n === 0 ? 0 : i / n;
    const q = aq + (bq - aq) * t;
    const r = ar + (br - ar) * t;
    const s = as + (bs - as) * t;
    out.push(roundCube(q, r, s));
  }
  return out;
}

function roundCube(q: number, r: number, s: number): Hex {
  // Round each cube coordinate, then recompute the one that moved most so
  // q + r + s stays 0.
  let rq = Math.round(q);
  let rr = Math.round(r);
  const rs = Math.round(s);
  const dq = Math.abs(rq - q);
  const dr = Math.abs(rr - r);
  const ds = Math.abs(rs - s);
  if (dq > dr && dq > ds) rq = -rr - rs;
  else if (dr > ds) rr = -rq - rs;
  // `+ 0` turns -0 into 0, so keys and equality behave.
  return {q: rq + 0, r: rr + 0};
}

const NUDGE = 1e-6;

/**
 * The hexes the straight line between two hex centres passes through, from
 * `a` to `b` inclusive. Where the line runs exactly along a border it picks
 * one side; use {@link hexLineSides} to get both.
 */
export function hexLine(a: Hex, b: Hex): Hex[] {
  return lerpHexes(a, b, NUDGE);
}

/**
 * The line from `a` to `b` as one entry per step: each entry holds the one
 * hex the line passes through there, or the two hexes when it runs exactly
 * along their shared border. Lets a game decide border cases itself (for
 * example, line of fire blocked if either hex is occupied).
 */
export function hexLineSides(a: Hex, b: Hex): Hex[][] {
  const plus = lerpHexes(a, b, NUDGE);
  const minus = lerpHexes(a, b, -NUDGE);
  return plus.map((h, i) => {
    const other = minus[i]!;
    return hexEquals(h, other) ? [h] : [h, other];
  });
}

/** Every hex within `radius` steps of `center`, the centre included. */
export function hexesInRange(center: Hex, radius: number): Hex[] {
  const out: Hex[] = [];
  for (let q = -radius; q <= radius; q++) {
    const rMin = Math.max(-radius, -q - radius);
    const rMax = Math.min(radius, -q + radius);
    for (let r = rMin; r <= rMax; r++) out.push({q: center.q + q, r: center.r + r});
  }
  return out;
}

/** The hexes exactly `radius` steps from `center` (just `center` for 0). */
export function hexRing(center: Hex, radius: number): Hex[] {
  if (radius === 0) return [center];
  const out: Hex[] = [];
  let h = hexAdd(center, hexScale(hexDirection(4), radius));
  for (let side = 0; side < 6; side++) {
    for (let step = 0; step < radius; step++) {
      out.push(h);
      h = hexNeighbor(h, side);
    }
  }
  return out;
}

// ─── Offset (rectangular) maps ───────────────────────────────────────────────

/** Column/row of an offset map to axial coordinates. */
export function offsetToHex(
  {col, row}: OffsetCoord,
  orientation: HexOrientation = 'pointy',
  parity: HexOffsetParity = 'odd'
): Hex {
  const shove = parity === 'odd' ? -1 : 1;
  if (orientation === 'pointy') {
    return {q: col - (row + shove * (row & 1)) / 2 + 0, r: row};
  }
  return {q: col, r: row - (col + shove * (col & 1)) / 2 + 0};
}

/** Axial coordinates to column/row of an offset map. */
export function hexToOffset(
  h: Hex,
  orientation: HexOrientation = 'pointy',
  parity: HexOffsetParity = 'odd'
): OffsetCoord {
  const shove = parity === 'odd' ? -1 : 1;
  if (orientation === 'pointy') {
    return {col: h.q + (h.r + shove * (h.r & 1)) / 2 + 0, row: h.r};
  }
  return {col: h.q, row: h.r + (h.q + shove * (h.q & 1)) / 2 + 0};
}

/** Every hex of a `columns` × `rows` offset map, row by row. */
export function offsetRectangle(
  columns: number,
  rows: number,
  orientation: HexOrientation = 'pointy',
  parity: HexOffsetParity = 'odd'
): Hex[] {
  const out: Hex[] = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < columns; col++) out.push(offsetToHex({col, row}, orientation, parity));
  }
  return out;
}

// ─── Pixels ──────────────────────────────────────────────────────────────────

/** Width and height of one hex in pixels for a centre-to-vertex `size`. */
export function hexDimensions(orientation: HexOrientation, size: number): {width: number; height: number} {
  return orientation === 'pointy'
    ? {width: SQRT3 * size, height: 2 * size}
    : {width: 2 * size, height: SQRT3 * size};
}

/** Pixel position of a hex's centre. */
export function hexToPixel(h: Hex, layout: HexLayout): {x: number; y: number} {
  const {size, origin} = layout;
  if (layout.orientation === 'pointy') {
    return {x: origin.x + size * SQRT3 * (h.q + h.r / 2), y: origin.y + size * 1.5 * h.r};
  }
  return {x: origin.x + size * 1.5 * h.q, y: origin.y + size * SQRT3 * (h.r + h.q / 2)};
}

/** The hex containing a pixel position (picking). */
export function pixelToHex(point: {x: number; y: number}, layout: HexLayout): Hex {
  const {size, origin} = layout;
  const x = (point.x - origin.x) / size;
  const y = (point.y - origin.y) / size;
  if (layout.orientation === 'pointy') {
    return hexRound((SQRT3 / 3) * x - y / 3, (2 / 3) * y);
  }
  return hexRound((2 / 3) * x, -x / 3 + (SQRT3 / 3) * y);
}

/**
 * The six corners of a hex of `size` centred on (0, 0), clockwise on screen
 * from the top (pointy) or the right (flat).
 */
export function hexCorners(orientation: HexOrientation, size: number): {x: number; y: number}[] {
  const start = orientation === 'pointy' ? -90 : 0;
  return Array.from({length: 6}, (_, i) => {
    const angle = ((start + 60 * i) * Math.PI) / 180;
    return {x: size * Math.cos(angle), y: size * Math.sin(angle)};
  });
}
