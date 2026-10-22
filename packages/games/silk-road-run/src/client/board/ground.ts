/**
 * The ground under everything: sand, ruins, quicksand and exits
 * (cached per map), the sandstorm's bank, and falling hail.
 */
import {assetLoader, hexKey} from '@canvas/engine';
import type {Hex} from '@canvas/engine';
import {tileAt} from '../../rules/map';
import type {MapData, Tile} from '../../rules/map';
import {BOARD_LAYOUT, SCENE_SIZE} from '../layout';
import {PALETTE} from '../palette';
import {
  HEX_SCALE,
  SPRITE_FEET,
  SPRITE_SCALE,
  artCanvas,
  center,
  dithered,
  hexPath,
  hexRandom,
  insideHex,
} from './pixels';
import quicksandImage from '../tiles/quicksand.png';
import ruinsImage from '../tiles/ruins.png';
import sandImage from '../tiles/sand.png';

/** The ground's colour until its textures load. */
const SAND = '#d4b483';

/** The ground texture of each tile type; ruins stand on sand. */
const TILE_TEXTURE: Record<Tile, string> = {
  sand: sandImage,
  obstacle: sandImage,
  hazard: quicksandImage,
  // The sandstorm blows over sand, drawn by `drawBank` across all its hexes.
  conceal: sandImage,
};

/**
 * A pixel-art image (42×42 for a ground texture or effect) clipped to a hex,
 * at the sprites' scale, centred on it. A sheet of square frames side by
 * side (quicksand's) shows its `frame`th.
 */
function drawHexImage(
  ctx: CanvasRenderingContext2D,
  h: Hex,
  img: HTMLImageElement,
  opts: {flipX?: boolean; frame?: number} = {}
): void {
  const c = center(h);
  const side = img.height;
  const size = side * SPRITE_SCALE;
  ctx.save();
  hexPath(ctx, h, 0);
  ctx.clip();
  ctx.imageSmoothingEnabled = false;
  ctx.translate(Math.round(c.x), Math.round(c.y));
  if (opts.flipX) ctx.scale(-1, 1);
  ctx.drawImage(img, (opts.frame ?? 0) * side, 0, side, side, -size / 2, -size / 2, size, size);
  ctx.restore();
}

/** Each map's tiles as a string, for the ground's cache key: worked out once per map. */
const mapKeys = new WeakMap<MapData, string>();

/** The board's ground as last drawn, and what it was drawn from (the map, which textures had loaded, the canvas's scale). */
let ground: {canvas: HTMLCanvasElement; key: string} | null = null;

/**
 * Every tile's ground. It never changes during a fight, so it's drawn once
 * into a canvas of its own, at the canvas's own resolution, and copied in
 * each frame with one image draw; it's drawn again when the map changes, a
 * texture finishes loading, or the canvas's scale changes. Only quicksand,
 * which flows, is drawn each frame, over its still copy.
 */
export function drawGround(ctx: CanvasRenderingContext2D, map: MapData, time: number | null): void {
  if (typeof document === 'undefined') {
    for (const h of map.hexes) drawTile(ctx, h, tileAt(map, h), time);
    return;
  }
  let mapKey = mapKeys.get(map);
  if (mapKey === undefined) {
    mapKey = map.hexes.map((h) => `${hexKey(h)}:${tileAt(map, h)}`).join(' ');
    mapKeys.set(map, mapKey);
  }
  const loaded = [...new Set(Object.values(TILE_TEXTURE))]
    .map((src) => (assetLoader.requestImage(src) ? 1 : 0))
    .join('');
  const scale = ctx.getTransform().a;
  const key = `${scale}|${loaded}|${mapKey}`;
  if (ground?.key !== key) {
    const canvas = ground?.canvas ?? document.createElement('canvas');
    canvas.width = Math.ceil(SCENE_SIZE.width * scale);
    canvas.height = Math.ceil(SCENE_SIZE.height * scale);
    const g = canvas.getContext('2d')!;
    g.setTransform(scale, 0, 0, scale, 0, 0);
    g.clearRect(0, 0, SCENE_SIZE.width, SCENE_SIZE.height);
    for (const h of map.hexes) drawTile(g, h, tileAt(map, h), null);
    ground = {canvas, key};
  }
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(ground.canvas, 0, 0, ground.canvas.width / scale, ground.canvas.height / scale);
  ctx.restore();
  if (time !== null)
    for (const h of map.hexes) if (tileAt(map, h) === 'hazard') drawTile(ctx, h, 'hazard', time);
}

/** Seconds each of quicksand's frames shows: a slow step, like the units' idles. */
export const QUICKSAND_FRAME_SECONDS = 0.3;

/**
 * Which of quicksand's frames (scripts/quicksand-sheet.py: its bands a step
 * further in each frame, so the sand seems to flow in) shows at a time.
 * Hexes start at different frames, so they don't flow in step.
 */
function quicksandFrame(sheet: HTMLImageElement, h: Hex, time: number): number {
  const frames = Math.max(1, Math.round(sheet.width / sheet.height));
  const start = Math.floor(hexRandom(h, 9)() * frames);
  return (Math.floor(time / QUICKSAND_FRAME_SECONDS) + start) % frames;
}

/**
 * A tile's ground: its texture (sand mirrored on alternate hexes, so the
 * board doesn't repeat) and its border. Until the image loads, flat sand
 * and a code-drawn mark show. Ruins stand on sand and are
 * drawn later, by `drawRuins`.
 */
function drawTile(ctx: CanvasRenderingContext2D, h: Hex, tile: Tile, time: number | null): void {
  const ground = assetLoader.requestImage(TILE_TEXTURE[tile]);
  if (ground) {
    drawHexImage(ctx, h, ground, {
      flipX: tile === 'sand' && (h.q * 7 + h.r * 13) % 2 !== 0,
      // Quicksand flows in, frame by frame.
      frame: tile === 'hazard' && time !== null ? quicksandFrame(ground, h, time) : 0,
    });
    ctx.save();
    hexPath(ctx, h, 0.5);
    ctx.strokeStyle = '#8c7350';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  } else {
    // Until the textures load: plain sand, with a mark for the tiles that do something.
    ctx.save();
    hexPath(ctx, h, 0.5);
    ctx.fillStyle = SAND;
    ctx.fill();
    ctx.strokeStyle = '#8c7350';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
    if (tile === 'hazard' || tile === 'conceal') drawTileMark(ctx, center(h), tile);
  }
}

/**
 * An exit, the road out (camel.md, 18.2): a worn ivory border and two
 * chevrons pointing off the board, outlined in ink like the sprites.
 */
export function drawExit(ctx: CanvasRenderingContext2D, h: Hex): void {
  ctx.save();
  hexPath(ctx, h, 3);
  ctx.setLineDash([4, 3]);
  ctx.strokeStyle = PALETTE.ivory;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.setLineDash([]);
  const c = center(h);
  ctx.translate(Math.round(c.x), Math.round(c.y));
  ctx.scale(HEX_SCALE, HEX_SCALE);
  ctx.lineJoin = 'miter';
  for (const dx of [-6, 3]) {
    ctx.beginPath();
    ctx.moveTo(dx - 3, -7);
    ctx.lineTo(dx + 4, 0);
    ctx.lineTo(dx - 3, 7);
    ctx.strokeStyle = PALETTE.ink;
    ctx.lineWidth = 5;
    ctx.stroke();
    ctx.strokeStyle = PALETTE.ivory;
    ctx.lineWidth = 2.5;
    ctx.stroke();
  }
  ctx.restore();
}

/** A ruin standing on its hex like a unit: over sandstorm and hail, so it always reads as blocked. */
export function drawRuins(ctx: CanvasRenderingContext2D, h: Hex): void {
  const ruins = assetLoader.requestImage(ruinsImage);
  if (ruins) {
    const c = center(h);
    const size = ruins.width * SPRITE_SCALE;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(
      ruins,
      Math.round(c.x - size / 2),
      Math.round(c.y + SPRITE_FEET - size),
      size,
      size
    );
    ctx.restore();
  } else {
    drawTileMark(ctx, center(h), 'obstacle');
  }
}

/** Each tile type has its own shape, not only its own colour (art direction). */
function drawTileMark(
  ctx: CanvasRenderingContext2D,
  at: {x: number; y: number},
  tile: string
): void {
  ctx.save();
  // Drawn around the origin at the size-32 scale, then scaled to the hex.
  ctx.translate(at.x, at.y);
  ctx.scale(HEX_SCALE, HEX_SCALE);
  const c = {x: 0, y: 0};
  if (tile === 'obstacle') {
    // Ruins: stacked blocks.
    ctx.fillStyle = '#4a3f35';
    ctx.strokeStyle = '#2b241e';
    ctx.lineWidth = 1.5;
    for (const [dx, dy, w, h] of [
      [-14, 2, 13, 10],
      [1, 2, 13, 10],
      [-7, -9, 14, 10],
    ] as const) {
      ctx.fillRect(c.x + dx, c.y + dy, w, h);
      ctx.strokeRect(c.x + dx, c.y + dy, w, h);
    }
  } else if (tile === 'hazard') {
    // Quicksand: a spiral.
    ctx.strokeStyle = '#5c4320';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let a = 0; a < Math.PI * 5; a += 0.2) {
      const r = 2 + a * 1.1;
      const x = c.x + Math.cos(a) * r;
      const y = c.y + Math.sin(a) * r * 0.75;
      if (a === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  } else if (tile === 'conceal') {
    // Sandstorm: drifting wavy lines.
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.lineWidth = 2;
    for (const dy of [-10, 0, 10]) {
      ctx.beginPath();
      for (let dx = -16; dx <= 16; dx += 2) {
        const y = c.y + dy + Math.sin((dx + dy) / 4) * 2.5;
        if (dx === -16) ctx.moveTo(c.x + dx, y);
        else ctx.lineTo(c.x + dx, y);
      }
      ctx.stroke();
    }
  }
  ctx.restore();
}

/** Hailstones falling on a hail hex: each drops in turn from above the board, bursting as it lands. */
const HAIL_DROPS = 10;
const HAIL_CYCLE_SECONDS = 1.1;
const HAIL_FALL_SECONDS = 0.3;
const HAIL_BURST_SECONDS = 0.24;
/** Frames a second it falls in. */
export const HAIL_FPS = 12;
/** How far above its landing spot a stone starts, and how far the wind carries it meanwhile, in art pixels. */
const HAIL_DROP_HEIGHT = 22;
const HAIL_DRIFT = 7;
/** The moment shown with reduced motion: a few stones in the air, none bursting. */
export const HAIL_STILL_SECONDS = 0.3;

/**
 * Hailstones falling onto a hail hex, from well above it and slanting with
 * the wind, a shadow growing under each as it nears the ground; on landing
 * it bursts into shards. This is all a hail hex shows: no ground image.
 * Drawn over the units, unclipped, so stones fall in front of whoever
 * stands there. Their spots, sizes and timing come from the hex, so hexes
 * don't fall in step. In art pixels at the sprites' scale.
 */
export function drawFallingHail(ctx: CanvasRenderingContext2D, h: Hex, time: number): void {
  // In steps, as pixel art moves.
  time = Math.floor(time * HAIL_FPS) / HAIL_FPS;
  const c = center(h);
  const px = SPRITE_SCALE;
  const next = hexRandom(h);
  const at = (x: number, y: number) =>
    [Math.round(c.x) + x * px, Math.round(c.y) + y * px] as const;
  ctx.save();
  for (let i = 0; i < HAIL_DROPS; i++) {
    let lx = 0;
    let ly = 0;
    for (let tries = 0; tries < 8; tries++) {
      lx = Math.round((next() - 0.5) * 30);
      ly = Math.round((next() - 0.5) * 30);
      if (insideHex(lx, ly, 5)) break;
    }
    const big = next() < 0.4;
    const local = (time + next() * HAIL_CYCLE_SECONDS) % HAIL_CYCLE_SECONDS;
    if (local < HAIL_FALL_SECONDS) {
      const k = local / HAIL_FALL_SECONDS;
      // Its shadow on the ground, darker and wider as it nears.
      const [sx, sy] = at(lx, ly + 2);
      ctx.fillStyle = `rgba(34,24,22,${(0.12 + 0.28 * k).toFixed(2)})`;
      const sw = (big ? 3 : 2) + Math.round(k * 2);
      ctx.fillRect(sx - sw * px + px, sy, (2 * sw - 1) * px, px);
      // A faint streak behind it, then the stone.
      for (const [lag, alpha] of [
        [0.16, 0.25],
        [0.08, 0.5],
        [0, 1],
      ] as const) {
        const e = Math.max(0, k - lag) ** 2;
        const [x, y] = at(
          Math.round(lx + HAIL_DRIFT * (1 - e)),
          Math.round(ly - HAIL_DROP_HEIGHT * (1 - e))
        );
        ctx.globalAlpha = alpha;
        if (lag > 0) {
          ctx.fillStyle = '#e2edf0';
          ctx.fillRect(x, y, px, px);
          continue;
        }
        const r = big ? 3 : 2;
        ctx.fillStyle = '#221816';
        ctx.fillRect(x - px, y - px, (r + 2) * px, (r + 2) * px);
        ctx.fillStyle = '#b8d1da';
        ctx.fillRect(x, y, r * px, r * px);
        ctx.fillStyle = '#fdfdfd';
        ctx.fillRect(x, y, (r - 1) * px, (r - 1) * px);
      }
      ctx.globalAlpha = 1;
    } else if (local < HAIL_FALL_SECONDS + HAIL_BURST_SECONDS) {
      // The burst: a flash where it struck and shards thrown up and out.
      const b = (local - HAIL_FALL_SECONDS) / HAIL_BURST_SECONDS;
      ctx.globalAlpha = 1 - b;
      if (b < 0.35) {
        const [x, y] = at(lx, ly);
        ctx.fillStyle = '#fdfdfd';
        ctx.fillRect(x - px, y, 3 * px, px);
        ctx.fillRect(x, y - px, px, 3 * px);
      }
      for (const angle of [-2.6, -1.9, -1.2, -0.5]) {
        const d = 2 + 6 * b;
        const [x, y] = at(
          Math.round(lx + Math.cos(angle) * d),
          Math.round(ly + Math.sin(angle) * d * 0.7 + 7 * b * b)
        );
        ctx.fillStyle = angle < -1.5 ? '#fdfdfd' : '#c4dbe2';
        ctx.fillRect(x, y, px, px);
      }
      ctx.globalAlpha = 1;
    }
  }
  ctx.restore();
}

/**
 * A bank of weather over some hexes (a sandstorm), drawn as pixel art
 * like the sprites: every pixel a solid colour or empty, see-through parts
 * and the soft outer edge dithered rather than blended. Its layers are
 * tiles of art that wrap, each drifting at its own speed, the later ones
 * behind the first (showing through its gaps), all kept to the area around
 * the hexes. It moves in steps, a few frames a second, like the units' idles.
 */
interface BankStyle {
  layers: readonly BankLayer[];
  /**
   * Where a hex's share fades, as fractions of the hex's size from its
   * centre: solid within the first, gone by the second, dithered between.
   * Neighbours' shares overlap, so a bank reads as one and only its outer
   * edge is broken up.
   */
  fade: readonly [number, number];
  /** Frames a second it moves on. */
  fps: number;
}

interface BankLayer {
  /** The tile's size in art pixels: multiples of 4, so its dithering wraps too. */
  tile: {width: number; height: number};
  /** Paints the tile, art pixel by art pixel, in solid colours (or nothing). */
  paint: (ctx: CanvasRenderingContext2D) => void;
  /** Art pixels a second it drifts. */
  x: number;
  y: number;
}

/**
 * Smooth noise in [0, 1) over a tile `width` × `height`, from a grid of
 * `cellsX` × `cellsY` random values, that wraps at the tile's edges.
 */
function tileNoise(
  next: () => number,
  width: number,
  height: number,
  cellsX: number,
  cellsY: number
): (x: number, y: number) => number {
  const grid = Array.from({length: cellsX * cellsY}, () => next());
  const v = (x: number, y: number) => grid[(y % cellsY) * cellsX + (x % cellsX)]!;
  const stepX = width / cellsX;
  const stepY = height / cellsY;
  const smooth = (t: number) => t * t * (3 - 2 * t);
  return (x: number, y: number) => {
    const gx = Math.floor(x / stepX);
    const gy = Math.floor(y / stepY);
    const tx = smooth(x / stepX - gx);
    const ty = smooth(y / stepY - gy);
    const top = v(gx, gy) + (v(gx + 1, gy) - v(gx, gy)) * tx;
    const bottom = v(gx, gy + 1) + (v(gx + 1, gy + 1) - v(gx, gy + 1)) * tx;
    return top + (bottom - top) * ty;
  };
}

/** How far a sandstorm's streaks fall for each art pixel across: a quarter, so the tile (4 times wider than tall) still wraps. */
const SANDSTORM_SLOPE = 0.25;

/**
 * Paints a sandstorm tile: noise sheared along the streaks (sloping down to
 * the right, a whole tile's height over its width, so it wraps), in `bands`
 * from low to high, each a colour; below the first is empty. `grains`: the
 * share of pixels that are dark grains instead.
 */
function paintStreaks(
  ctx: CanvasRenderingContext2D,
  seed: Hex,
  bands: readonly (readonly [number, string])[],
  grains: number
): void {
  const next = hexRandom(seed);
  const coarse = tileNoise(next, 96, 24, 3, 4);
  const fine = tileNoise(next, 96, 24, 6, 8);
  for (let y = 0; y < 24; y++) {
    for (let x = 0; x < 96; x++) {
      const sy = (y - Math.floor(x * SANDSTORM_SLOPE) + 24) % 24;
      const n = coarse(x, sy) * 0.6 + fine(x, sy) * 0.4;
      let color: string | undefined;
      for (const [from, c] of bands) if (n >= from) color = c;
      if (next() < grains) color = '#806a50';
      if (!color) continue;
      ctx.fillStyle = color;
      ctx.fillRect(x, y, 1, 1);
    }
  }
}

/**
 * Sandstorm: bright streaks of blown sand racing over a slower, solid
 * curtain of dust, in the old sandstorm image's colours, with dark grains.
 */
export const SANDSTORM_BANK: BankStyle = {
  layers: [
    {
      tile: {width: 96, height: 24},
      paint: (ctx) =>
        paintStreaks(
          ctx,
          {q: 3, r: 17},
          [
            [0.56, '#dcc39f'],
            [0.66, '#efdcbc'],
          ],
          0
        ),
      x: 16,
      y: 16 * SANDSTORM_SLOPE,
    },
    {
      tile: {width: 96, height: 24},
      paint: (ctx) =>
        paintStreaks(
          ctx,
          {q: 8, r: 1},
          [
            [0, '#aa9274'],
            [0.5, '#bea788'],
          ],
          0.025
        ),
      x: 7,
      y: 7 * SANDSTORM_SLOPE,
    },
  ],
  fade: [0.78, 1.12],
  fps: 8,
};

/**
 * A bank as last built: kept and redrawn as it is until it moves on a step
 * or its hexes change (`key`). `bounds` is the part of the canvas it
 * covers, in art pixels; `mask` the dithered area around its hexes, made
 * once for each set of hexes.
 */
interface BuiltBank {
  canvas: HTMLCanvasElement;
  mask: HTMLCanvasElement;
  key: string;
  hexes: string;
  bounds: {x: number; y: number; width: number; height: number};
}

const bankTiles = new Map<BankLayer, HTMLCanvasElement>();
const builtBanks = new Map<BankStyle, BuiltBank>();

/**
 * Every hex of one kind of weather as one bank (see `BankStyle`), unclipped,
 * so it has no hex-shaped cuts or seams. Built in art pixels and scaled up
 * unsmoothed, and rebuilt only when it moves on a step (a few times a
 * second) and only over the hexes' part of the board, so a bank costs
 * little more than drawing an image. Still when `time` is null (reduced
 * motion).
 */
export function drawBank(
  ctx: CanvasRenderingContext2D,
  style: BankStyle,
  hexes: Hex[],
  time: number | null
): void {
  if (hexes.length === 0 || typeof document === 'undefined') return;
  const width = Math.ceil(SCENE_SIZE.width / SPRITE_SCALE);
  const height = Math.ceil(SCENE_SIZE.height / SPRITE_SCALE);
  const t = Math.floor((time ?? 0) * style.fps) / style.fps;
  const offsets = style.layers.map(
    (l) => [Math.round(t * l.x) % l.tile.width, Math.round(t * l.y) % l.tile.height] as const
  );
  const hexesKey = hexes.map(hexKey).join(' ');
  const key = `${hexesKey}|${offsets.join(' ')}`;
  let built = builtBanks.get(style);
  if (built?.key !== key) {
    built = buildBank(style, hexes, hexesKey, offsets, built, width, height);
    built.key = key;
    builtBanks.set(style, built);
  }
  const {x, y, width: bw, height: bh} = built.bounds;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(
    built.canvas,
    x,
    y,
    bw,
    bh,
    x * SPRITE_SCALE,
    y * SPRITE_SCALE,
    bw * SPRITE_SCALE,
    bh * SPRITE_SCALE
  );
  ctx.restore();
}

/** Builds a bank (into `reuse`'s canvases when there are some), over its hexes' part of the board only. */
function buildBank(
  style: BankStyle,
  hexes: Hex[],
  hexesKey: string,
  offsets: (readonly [number, number])[],
  reuse: BuiltBank | undefined,
  width: number,
  height: number
): BuiltBank {
  const canvas = reuse?.canvas ?? artCanvas(width, height);
  const maskCanvas = reuse?.mask ?? artCanvas(width, height);
  const layer = canvas.getContext('2d')!;
  const sameHexes = reuse?.hexes === hexesKey;
  const bounds = sameHexes ? reuse!.bounds : bankMask(maskCanvas, style, hexes, width, height);
  const {x: x0, y: y0, width: bw, height: bh} = bounds;

  layer.globalCompositeOperation = 'source-over';
  // Other hexes than last time: what it drew before may lie outside these bounds.
  if (!sameHexes) layer.clearRect(0, 0, width, height);
  else layer.clearRect(x0, y0, bw, bh);
  style.layers.forEach((l, i) => {
    let tile = bankTiles.get(l);
    if (!tile) {
      tile = artCanvas(l.tile.width, l.tile.height);
      l.paint(tile.getContext('2d')!);
      bankTiles.set(l, tile);
    }
    const [ox, oy] = offsets[i]!;
    layer.save();
    layer.beginPath();
    layer.rect(x0, y0, bw, bh);
    layer.clip();
    // Each later layer goes behind those before it, showing through their gaps.
    layer.globalCompositeOperation = i === 0 ? 'source-over' : 'destination-over';
    layer.translate(ox, oy);
    layer.fillStyle = layer.createPattern(tile, 'repeat')!;
    layer.fillRect(
      x0 - l.tile.width,
      y0 - l.tile.height,
      bw + 2 * l.tile.width,
      bh + 2 * l.tile.height
    );
    layer.restore();
  });
  layer.globalCompositeOperation = 'destination-in';
  layer.drawImage(maskCanvas, x0, y0, bw, bh, x0, y0, bw, bh);
  layer.globalCompositeOperation = 'source-over';
  return {canvas, mask: maskCanvas, key: '', hexes: hexesKey, bounds};
}

/**
 * Makes a bank's mask: each art pixel on (opaque) or off, on near a hex's
 * centre and dithered off towards `style.fade`'s edge, so the edge breaks up
 * into pixels rather than blurring. Returns the part of the board it covers.
 */
function bankMask(
  canvas: HTMLCanvasElement,
  style: BankStyle,
  hexes: Hex[],
  width: number,
  height: number
): BuiltBank['bounds'] {
  const size = BOARD_LAYOUT.size / SPRITE_SCALE;
  const [solid, gone] = style.fade;
  const reach = Math.ceil(size * gone) + 1;
  const centres = hexes.map((h) => {
    const c = center(h);
    return {x: c.x / SPRITE_SCALE, y: c.y / SPRITE_SCALE};
  });
  const x0 = Math.max(0, Math.floor(Math.min(...centres.map((c) => c.x)) - reach));
  const y0 = Math.max(0, Math.floor(Math.min(...centres.map((c) => c.y)) - reach));
  const x1 = Math.min(width, Math.ceil(Math.max(...centres.map((c) => c.x)) + reach));
  const y1 = Math.min(height, Math.ceil(Math.max(...centres.map((c) => c.y)) + reach));
  const bw = x1 - x0;
  const bh = y1 - y0;
  // How covered each pixel is (0 to 1): its nearest hex's say.
  const cover = new Float32Array(bw * bh);
  for (const c of centres) {
    for (let y = Math.max(y0, Math.floor(c.y - reach)); y < Math.min(y1, c.y + reach); y++) {
      for (let x = Math.max(x0, Math.floor(c.x - reach)); x < Math.min(x1, c.x + reach); x++) {
        const d = Math.hypot(x + 0.5 - c.x, y + 0.5 - c.y) / size;
        const k = Math.min(1, Math.max(0, (gone - d) / (gone - solid)));
        const i = (y - y0) * bw + (x - x0);
        if (k > cover[i]!) cover[i] = k;
      }
    }
  }
  const ctx = canvas.getContext('2d')!;
  const image = ctx.createImageData(bw, bh);
  for (let y = 0; y < bh; y++)
    for (let x = 0; x < bw; x++)
      if (dithered(x + x0, y + y0, Math.round(cover[y * bw + x]! * 16)))
        image.data[(y * bw + x) * 4 + 3] = 255;
  ctx.clearRect(0, 0, width, height);
  ctx.putImageData(image, x0, y0);
  return {x: x0, y: y0, width: bw, height: bh};
}
