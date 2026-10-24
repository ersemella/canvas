/**
 * The ground under everything: sand, ruins and exits (cached per map), and
 * falling hail.
 */
import {assetLoader, hexKey, hexNeighbors} from '@canvas/engine';
import type {Hex} from '@canvas/engine';
import {onMap, tileAt} from '../../rules/map';
import type {MapData, Tile} from '../../rules/map';
import {SCENE_SIZE} from '../layout';
import {PALETTE} from '../palette';
import {
  HEX_SCALE,
  SPRITE_FEET,
  SPRITE_SCALE,
  center,
  hexPath,
  hexRandom,
  insideHex,
} from './pixels';
import ruinsImage from '../tiles/ruins.png';
import sandImage from '../tiles/sand.png';

/** The ground's colour until its textures load. */
const SAND = '#d4b483';

/** The ground texture of each tile type; ruins stand on sand. */
const TILE_TEXTURE: Record<Tile, string> = {
  sand: sandImage,
  obstacle: sandImage,
};

/**
 * A pixel-art image (42×42 for a ground texture or effect) clipped to a hex,
 * at the sprites' scale, centred on it.
 */
function drawHexImage(
  ctx: CanvasRenderingContext2D,
  h: Hex,
  img: HTMLImageElement,
  opts: {flipX?: boolean} = {}
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
  ctx.drawImage(img, 0, 0, side, side, -size / 2, -size / 2, size, size);
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
 * texture finishes loading, or the canvas's scale changes.
 */
export function drawGround(ctx: CanvasRenderingContext2D, map: MapData): void {
  if (typeof document === 'undefined') {
    for (const h of map.hexes) drawTile(ctx, h, tileAt(map, h));
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
    for (const h of map.hexes) drawTile(g, h, tileAt(map, h));
    for (const h of filler(map)) drawFiller(g, h);
    ground = {canvas, key};
  }
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(ground.canvas, 0, 0, ground.canvas.width / scale, ground.canvas.height / scale);
  ctx.restore();
}

/**
 * The hexes off the map but inside its outline, where the end rows lost
 * their corners (2026-10-24): scenery, so the board's edge isn't left
 * gapped. Not spaces: nothing stands on them or answers a tap.
 */
function filler(map: MapData): Hex[] {
  const xs = map.hexes.map((h) => center(h).x);
  const ys = map.hexes.map((h) => center(h).y);
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const out = new Map<string, Hex>();
  for (const h of map.hexes)
    for (const n of hexNeighbors(h)) {
      const c = center(n);
      if (!onMap(map, n) && c.x >= minX && c.x <= maxX && c.y >= minY && c.y <= maxY)
        out.set(hexKey(n), n);
    }
  return [...out.values()];
}

/** Filler scenery: the sand darkened, with no border, so it reads as off the board. */
function drawFiller(ctx: CanvasRenderingContext2D, h: Hex): void {
  const sand = assetLoader.requestImage(sandImage);
  if (sand) drawHexImage(ctx, h, sand, {flipX: (h.q * 7 + h.r * 13) % 2 !== 0});
  ctx.save();
  hexPath(ctx, h, 0);
  ctx.fillStyle = sand ? 'rgba(34, 22, 14, 0.55)' : '#6e5a40';
  ctx.fill();
  ctx.restore();
}

/**
 * A tile's ground: its texture (sand mirrored on alternate hexes, so the
 * board doesn't repeat) and its border. Until the image loads, flat sand
 * and a code-drawn mark show. Ruins stand on sand and are
 * drawn later, by `drawRuins`.
 */
function drawTile(ctx: CanvasRenderingContext2D, h: Hex, tile: Tile): void {
  const ground = assetLoader.requestImage(TILE_TEXTURE[tile]);
  if (ground) {
    drawHexImage(ctx, h, ground, {flipX: tile === 'sand' && (h.q * 7 + h.r * 13) % 2 !== 0});
    ctx.save();
    hexPath(ctx, h, 0.5);
    ctx.strokeStyle = '#8c7350';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  } else {
    // Until the textures load: plain sand.
    ctx.save();
    hexPath(ctx, h, 0.5);
    ctx.fillStyle = SAND;
    ctx.fill();
    ctx.strokeStyle = '#8c7350';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
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
    drawRuinsMark(ctx, center(h));
  }
}

/** Ruins until their image loads: stacked blocks, a shape of their own, not only a colour (art direction). */
function drawRuinsMark(ctx: CanvasRenderingContext2D, at: {x: number; y: number}): void {
  ctx.save();
  // Drawn around the origin at the size-32 scale, then scaled to the hex.
  ctx.translate(at.x, at.y);
  ctx.scale(HEX_SCALE, HEX_SCALE);
  ctx.fillStyle = '#4a3f35';
  ctx.strokeStyle = '#2b241e';
  ctx.lineWidth = 1.5;
  for (const [dx, dy, w, h] of [
    [-14, 2, 13, 10],
    [1, 2, 13, 10],
    [-7, -9, 14, 10],
  ] as const) {
    ctx.fillRect(dx, dy, w, h);
    ctx.strokeRect(dx, dy, w, h);
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
