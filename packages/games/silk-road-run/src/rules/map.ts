/**
 * The Steppe Crossing: a hexagon of flat-top hexes, 4 from the centre hex
 * each way, 61 hexes (owner, 2026-10-24; a 64-hex block of pointy-top
 * hexes, 9 rows with the corners cut, and before it the Salt Flats'
 * smaller boards, from 2026-10-19). Its nine columns run 5, 6, 7, 8, 9, 8,
 * 7, 6, 5 hexes from left to right, so the outermost columns are straight,
 * five hexes each. Each side starts in the two columns on its edge (owner,
 * 2026-10-25; the outermost column alone before). The camel starts at the top
 * point and the only exit is the bottom one, the board's length apart.
 *
 * Hexes are axial, the centre hex {q: 0, r: 0}; on screen q runs left to
 * right and r down each column. A space can also be named as a column (0
 * to 8, left to right) and a row counted down from the top of that column
 * (`spaceAt`), as the test stage's file does.
 *
 * The open steppe: each fight pitches two or three yurts near the board's
 * middle and, in about half of fights, raises a range of mountains along
 * an edge (see `randomTiles`); the ruins scattered before are gone (owner,
 * 2026-10-24). The fixed layout of four yurts below is the map's own,
 * which tests place units around, and the test stage's `"map"`. Quicksand and the sandstorm were removed
 * with their keywords (owner, 2026-10-23).
 *
 * Each region has a map of its own (2026-10-25; setting.md, 15.3a), the
 * same board under another look: the Steppe's (`STEPPE`), the Gobi
 * Crossing (`GOBI`), where the `obstacle` tile is a sandstone ruin rather
 * than a yurt, and the Flaming Mountains (`FLAMING`), the China region's
 * (owner, 2026-10-26), its obstacles beacon towers and its mountains on fire. A
 * stage names its map (`STAGES` in config.ts); the page draws each map's
 * look (`ground.ts`).
 */
import {hexDistance, hexKey, hexNeighbors} from '@canvas/engine/server';
import type {Hex} from '@canvas/engine/server';

/** `obstacle` is a yurt on the Steppe, a ruin in the Gobi and a beacon tower in the Flaming Mountains (ruins everywhere until 2026-10-24; saved runs keep the name). */
export type Tile = 'sand' | 'obstacle' | 'mountain';

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
  /** The player's camel's starting hex (camel.md, 18.1). */
  camelStart: Hex;
  /** The camel reaching one of these wins the fight (camel.md, 18.2). */
  exits: Hex[];
  /**
   * Whether its fights raise a range of mountains (`randomTiles`): in about
   * half of them, or when the stage says (the Steppe's); never (the Gobi's,
   * 2026-10-25); or in every one (the Flaming Mountains', 2026-10-26).
   */
  mountains: 'sometimes' | 'never' | 'always';
  /**
   * Where they stand: one range along one of the board's slanted edges
   * (the Steppe's), or two clumps in its middle (the Flaming
   * Mountains', owner, 2026-10-26; `middleClumps`).
   */
  mountainPlaces: 'edge' | 'middle';
  /**
   * Its fights' yurts (ruins): how many, one of `counts` at random, and
   * how far from the centre they may stand (`randomTiles`).
   */
  obstacles: {counts: number[]; reach: number};
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
  // Yurts: two per half, around the centre (the ruins' places before).
  [{q: -1, r: -1}, 'obstacle'],
  [{q: 1, r: -1}, 'obstacle'],
  [{q: -3, r: 2}, 'obstacle'],
  [{q: 0, r: 2}, 'obstacle'],
];

export const STEPPE: MapData = {
  id: 'steppe',
  name: 'The Steppe Crossing',
  hexes: boardHexes(),
  tiles: Object.fromEntries(special.map(([h, t]) => [hexKey(h), t])),
  startColumns: {
    player: [...column(-RADIUS), ...column(1 - RADIUS)],
    enemy: [...column(RADIUS), ...column(RADIUS - 1)],
  },
  // The top point (owner, 2026-10-24; the top-left corner on the board of
  // rows before).
  camelStart: {q: 0, r: -RADIUS},
  // The bottom point, the only exit (owner, 2026-10-24; the bottom-right
  // corner before).
  exits: [{q: 0, r: RADIUS}],
  mountains: 'sometimes',
  mountainPlaces: 'edge',
  // Two or three yurts, within 2 hexes of the centre (owner, 2026-10-24).
  obstacles: {counts: [2, 3], reach: 2},
};

/**
 * The Gobi Crossing (2026-10-25), made as the China region's way in; the
 * Flaming Mountains took its place there and its desert was kept for the
 * Arabia region (owner, 2026-10-26), cut the same day; no region has it now. The Steppe's board, its yurts' places now sandstone ruins of the old frontier
 * posts, on gravel desert, and no mountains, whatever the stage. With no
 * mountains to break up the board, more ruins (owner, 2026-10-25): four or
 * five, within 3 hexes of the centre, still off the starting columns.
 */
export const GOBI: MapData = {
  ...STEPPE,
  id: 'gobi',
  name: 'The Gobi Crossing',
  mountains: 'never',
  obstacles: {counts: [4, 5], reach: 3},
};

/**
 * The Flaming Mountains (owner, 2026-10-26), the China region's map: red
 * earth below the burning ridges of *Journey to the West*, which stand in
 * every fight, in two clumps in the middle of the board, not
 * along its edges (owner, 2026-10-26), and one or two Han **beacon
 * towers** (owner, 2026-10-26), the rammed-earth watchtowers along the
 * Hexi Corridor, as its `obstacle`, within 3 of the centre and not next to
 * a mountain. Mountains and towers together cover at most
 * `MAX_COVERED` spaces. The mudbrick ruins first scattered there, and
 * fissures burning whoever entered them, were taken out (owner,
 * 2026-10-26). The flames are only drawn: the mountains block as any do.
 */
export const FLAMING: MapData = {
  ...STEPPE,
  id: 'flaming',
  name: 'The Flaming Mountains',
  mountains: 'always',
  mountainPlaces: 'middle',
  obstacles: {counts: [1, 2], reach: 3},
};

export const MAPS: Record<string, MapData> = {
  [STEPPE.id]: STEPPE,
  [GOBI.id]: GOBI,
  [FLAMING.id]: FLAMING,
};

/** A map by its id; a mistake, never a fallback, if there's none. */
export function mapById(id: string): MapData {
  const map = MAPS[id];
  if (!map) throw new Error(`No map "${id}".`);
  return map;
}

/**
 * Mountains (owner, 2026-10-24): about half of fights, and every fight of a
 * run's first `MOUNTAIN_STAGES` stages (config.ts), have one range, 3 to
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
 * about half of fights, or always with `mountains` or on a map that always
 * has them, never on a map without them (`MapData.mountains`), along an
 * edge or in clumps in the middle as the map says (`mountainPlaces`), off
 * the starting columns, the camel's start and the exit, then two or three yurts near the
 * middle (not mirrored), on `map`'s board.
 */
export function randomTiles(
  random: () => number,
  mountains = false,
  map: MapData = STEPPE
): Record<string, Tile> {
  const tiles: Record<string, Tile> = {};
  const reserved = [map.camelStart, ...map.exits];
  const candidates = map.hexes.filter(
    (h) => Math.abs(h.q) < RADIUS && !reserved.some((x) => hexDistance(x, h) === 0)
  );
  // Rolled even when forced, so a seed's other draws stay the same.
  const rolled = random() < MOUNTAIN_CHANCE;
  const raise = map.mountains !== 'never' && (rolled || mountains || map.mountains === 'always');
  const middle = raise && map.mountainPlaces === 'middle';
  // How many yurts (ruins, towers): on a map of middle clumps, rolled
  // before them, so the clumps leave the obstacles room under
  // `MAX_COVERED`; after the mountains elsewhere, as it always was.
  const {counts, reach} = map.obstacles;
  const roll = () => counts[Math.floor(random() * counts.length)]!;
  let count = middle ? roll() : 0;
  if (middle) middleClumps(map, tiles, candidates, random, MAX_COVERED - count);
  else if (raise) {
    const edge = MOUNTAIN_EDGES[Math.floor(random() * MOUNTAIN_EDGES.length)]!;
    const size = MOUNTAIN_SIZES[Math.floor(random() * MOUNTAIN_SIZES.length)]!;
    const inFrontOfTemee: Hex = {q: 0, r: map.camelStart.r + 1};
    const allowed = candidates
      .filter((h) => (edge.left ? h.q < 0 : h.q > 0))
      .filter((h) => edge.inFrom(h) === 0 || (edge.inFrom(h) === 1 && Math.abs(h.q) < RADIUS - 1))
      .filter((h) => hexDistance(h, CENTRE) >= MOUNTAIN_CENTRE_GAP)
      .filter((h) => hexDistance(h, inFrontOfTemee) > 0);
    mountainRange(map, tiles, allowed, edge.inFrom, size, random);
  }
  // Yurts (owner, 2026-10-24), or ruins: as many as the map
  // says, within its reach of the centre and off the starting columns, not
  // next to the camel's start or the exit, no two side by side, never
  // cutting the board in two.
  // Among middle clumps, not next to a mountain either, so a tower stands
  // on its own rather than reading as part of a clump.
  const yurts: Hex[] = [];
  if (!middle) count = roll();
  const mountainHexes = middle ? map.hexes.filter((h) => tiles[hexKey(h)] === 'mountain') : [];
  for (let i = 0; i < count; i++) {
    const free = candidates
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
  const inRange = (h: Hex) => range.some((m) => hexDistance(m, h) === 0);
  while (range.length < size) {
    let free = allowed.filter((h) => !inRange(h) && connectedWithout(map, tiles, h));
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
 * The Flaming Mountains' (owner, 2026-10-26): two clumps of 2 to 4
 * mountains in the middle of the board, at most `budget` in all (8 less
 * the beacon towers, `MAX_COVERED`), each from a first hex within
 * `MIDDLE_CLUMP.start` of the centre growing a hex at a time onto a
 * neighbour of the clump within `MIDDLE_CLUMP.reach`, the ones touching
 * more of it first, so it bunches up rather than strings out. Off the
 * starting columns, off Temee's road down the
 * middle column, not next to the camel's start or the exit, the clumps
 * apart, and never cutting the board in two. (Two or three clumps at
 * first, then at most 8 mountains; two, owner, 2026-10-26.)
 */
const MIDDLE_CLUMP = {count: 2, sizes: [2, 3, 4], start: 2, reach: 3};

/**
 * On a map of middle clumps, the most spaces its mountains and obstacles
 * (the beacon towers) cover together (owner, 2026-10-26), so the board
 * stays open enough to manoeuvre.
 */
export const MAX_COVERED = 8;

function middleClumps(
  map: MapData,
  tiles: Record<string, Tile>,
  candidates: Hex[],
  random: () => number,
  budget: number
): void {
  const reserved = [map.camelStart, ...map.exits];
  const placed: Hex[] = [];
  const allowed = candidates
    .filter((h) => Math.abs(h.q) < RADIUS - 1 && h.q !== 0)
    .filter((h) => hexDistance(h, CENTRE) <= MIDDLE_CLUMP.reach)
    .filter((h) => reserved.every((x) => hexDistance(x, h) > 1));
  for (let c = 0; c < MIDDLE_CLUMP.count; c++) {
    // Rolled even when the budget cuts it, so a seed's other draws stay the same.
    const rolledSize = MIDDLE_CLUMP.sizes[Math.floor(random() * MIDDLE_CLUMP.sizes.length)]!;
    const size = Math.min(rolledSize, budget - placed.length);
    if (size < 2) break;
    // Apart from the clumps before it.
    let open = allowed.filter((h) => placed.every((p) => hexDistance(p, h) > 1));
    let clump: Hex[] = [];
    // A clump stuck at one mountain, with nowhere free beside it, is taken
    // back and started again elsewhere, a few times at most.
    for (let tries = 0; tries < 6 && clump.length < 2; tries++) {
      for (const h of clump) delete tiles[hexKey(h)];
      if (clump.length) open = open.filter((h) => hexDistance(h, clump[0]!) > 0);
      clump = growClump(map, tiles, open, size, random);
    }
    if (clump.length < 2) for (const h of clump) delete tiles[hexKey(h)];
    else placed.push(...clump);
  }
}

/**
 * One clump of up to `size` mountains among `open`, marked in `tiles`
 * (`middleClumps`), each mountain after the first beside one already in
 * it where it can be, else above or below one.
 */
function growClump(
  map: MapData,
  tiles: Record<string, Tile>,
  open: Hex[],
  size: number,
  random: () => number
): Hex[] {
  const clump: Hex[] = [];
  while (clump.length < size) {
    let free = open.filter(
      (h) => !clump.some((m) => hexDistance(m, h) === 0) && connectedWithout(map, tiles, h)
    );
    if (!clump.length) free = free.filter((h) => hexDistance(h, CENTRE) <= MIDDLE_CLUMP.start);
    else {
      const touching = (h: Hex) => clump.filter((m) => hexDistance(m, h) === 1).length;
      free = free.filter((h) => touching(h) > 0);
      // Beside one already (in a neighbouring column) before above or below
      // it, so the clump's ridge runs on unbroken (ridges.ts; owner,
      // 2026-10-26).
      const beside = free.filter((h) => clump.some((m) => hexDistance(m, h) === 1 && m.q !== h.q));
      if (beside.length) free = beside;
      const most = Math.max(0, ...free.map(touching));
      free = free.filter((h) => touching(h) === most);
    }
    if (!free.length) break;
    const h = free[Math.floor(random() * free.length)]!;
    tiles[hexKey(h)] = 'mountain';
    clump.push(h);
  }
  return clump;
}

/** Whether every open hex of `map` can still walk to every other with `extra` blocked too. */
function connectedWithout(map: MapData, tiles: Record<string, Tile>, extra: Hex): boolean {
  const blocked = new Set([...Object.keys(tiles), hexKey(extra)]);
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
