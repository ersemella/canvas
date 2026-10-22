/**
 * Abilities' effects as a turn plays back: Volley's arrows, Freeze's
 * ice and Sunlight's motes.
 */
import {hexDistance} from '@canvas/engine';
import type {Hex} from '@canvas/engine';
import type {AbilityId} from '../../rules/types';
import {BOARD_LAYOUT} from '../layout';
import {
  SPRITE_SCALE,
  artCell,
  artLine,
  artPixel,
  center,
  ditherFill,
  ditherHex,
  hexRandom,
  insideHex,
} from './pixels';

/** Frames a second the playback's effects move in: steps, like the units' idles and the weather. */
export const EFFECT_FPS = 12;

/** What an ability's effect drawing gets: who used it, where it lands, the hexes it covers, and how far through (0 to 1, in steps). */
interface EffectFrame {
  from: Hex | null;
  target: Hex;
  area: Hex[];
  k: number;
}

/**
 * Abilities with a flourish of their own as they land; the rest light up
 * their area. All drawn as pixel art, like the sprites: art pixels on the
 * art grid, solid colours, dithered rather than see-through.
 */
export const ABILITY_EFFECT: Partial<
  Record<AbilityId, (ctx: CanvasRenderingContext2D, f: EffectFrame) => void>
> = {
  volley: drawVolley,
  freeze: drawFreeze,
  sunlight: drawSunlight,
};

/** Fades an effect out over the last part of its event, from `start` (0 to 1) on. */
const fadeOut = (k: number, start = 0.8) => (k < start ? 1 : Math.max(0, (1 - k) / (1 - start)));

/**
 * A pixel-art arrow whose head is at (x, y), pointing along (ux, uy):
 * `length` art pixels of wooden shaft, outlined dark, a steel head and pale
 * fletching at the tail.
 */
export function drawPixelArrow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  ux: number,
  uy: number,
  length: number
): void {
  const reach = length * SPRITE_SCALE;
  const cells = artLine(x - ux * reach, y - uy * reach, x, y);
  // The outline: either side across the arrow's run.
  const across = Math.abs(ux) > Math.abs(uy) ? [0, 1] : [1, 0];
  for (const [cx, cy] of cells) {
    artPixel(ctx, cx - across[0]!, cy - across[1]!, '#221816');
    artPixel(ctx, cx + across[0]!, cy + across[1]!, '#221816');
  }
  cells.forEach(([cx, cy], i) => {
    const color = i >= cells.length - 2 ? '#e5e7eb' : i < 2 ? '#f5f5f4' : '#a16207';
    artPixel(ctx, cx, cy, color);
  });
}

/** Arrows per hex of a volley's area. */
const VOLLEY_ARROWS = 3;
/** The part of the event each arrow takes to fall, and the most any waits to loose. */
const VOLLEY_FLIGHT = 0.26;
const VOLLEY_STAGGER = 0.4;

/**
 * Volley: arrows rain down on the area, loosed in a ragged wave from the
 * archer's side and falling steeply, each sticking where it lands with a
 * kick of dust, the area flecked orange under them, then the lot thins out
 * and goes.
 */
function drawVolley(ctx: CanvasRenderingContext2D, {from, target, area, k}: EffectFrame): void {
  const t = center(target);
  const side = from ? Math.sign(t.x - center(from).x) || 1 : 1;
  const fade = fadeOut(k);
  for (const h of area) ditherHex(ctx, h, '#fb923c', 3 * fadeOut(k, 0.6));
  // Falling from high up and back towards the archer, steeply down to the mark.
  const len = Math.hypot(side * 0.45, 1);
  const ux = (side * 0.45) / len;
  const uy = 1 / len;
  for (const h of area) {
    const c = center(h);
    const next = hexRandom(h, 3);
    for (let i = 0; i < VOLLEY_ARROWS; i++) {
      let lx = 0;
      let ly = 0;
      for (let tries = 0; tries < 8; tries++) {
        lx = (next() - 0.5) * 30;
        ly = (next() - 0.5) * 30;
        if (insideHex(lx, ly, 6)) break;
      }
      const x = c.x + lx * SPRITE_SCALE;
      const y = c.y + ly * SPRITE_SCALE;
      const start = next() * VOLLEY_STAGGER;
      // Thinning out at the end: each arrow goes at its own moment.
      if (next() > fade) continue;
      const f = (k - start) / VOLLEY_FLIGHT;
      if (f < 0) continue;
      if (f < 1) {
        const d = (1 - f) * 150;
        drawPixelArrow(ctx, x - ux * d, y - uy * d, ux, uy, 9);
        continue;
      }
      // Landed: stuck in the ground, a short way in, with a kick of dust.
      drawPixelArrow(ctx, x, y, ux, uy, 5);
      const puff = (k - start - VOLLEY_FLIGHT) / 0.15;
      if (puff < 1) {
        const [ax, ay] = artCell(x, y);
        const spread = 1 + Math.floor(puff * 4);
        for (const s of [-1, 1]) {
          artPixel(ctx, ax + s * spread, ay, '#e7d3a8');
          artPixel(ctx, ax + s * (spread + 1), ay - 1, '#d4b483');
        }
      }
    }
  }
}

/** Frost spreads a ring at a time: when the hexes this many rings out start to freeze, and how long that takes. */
const FREEZE_RING_DELAY = 0.16;
const FREEZE_GROW = 0.22;

/**
 * Ice shards as pixel sprites, rows from the top: `#` outline, `w` lit
 * face, `o` ice, `b` its shaded side. They rise from the ground, a row at a
 * time.
 */
const ICE_SHARDS = [
  ['..#..', '.#w#.', '.#wo#', '#wob#', '#wob#', '#wob#', '#oob#', '#oob#'],
  ['.#.', '#w#', '#o#', '#ob#', '#ob#'],
  ['.#..', '#w#.', '#wo#', '#ob#', '#ob#', '#ob#'],
] as const;
const ICE_COLORS: Record<string, string> = {
  '#': '#0c4a6e',
  w: '#ffffff',
  o: '#e0f2fe',
  b: '#7dd3fc',
};

/** An ice shard standing on art cell (ax, ay), its bottom `rows` rows showing. */
function drawIceShard(
  ctx: CanvasRenderingContext2D,
  shard: readonly string[],
  ax: number,
  ay: number,
  rows: number
): void {
  const height = shard.length;
  for (let r = Math.max(0, height - rows); r < height; r++) {
    const row = shard[r]!;
    for (let col = 0; col < row.length; col++) {
      const color = ICE_COLORS[row[col]!];
      if (color) artPixel(ctx, ax + col - (row.length >> 1), ay - (height - 1 - r), color);
    }
  }
}

/**
 * Freeze: a cold blast rings out from the target in pixels and the area
 * ices over, ring by ring: each hex frosts (dithered pale blue) and sprouts
 * ice shards, glinting, then the shards sink and the frost thins away.
 */
function drawFreeze(ctx: CanvasRenderingContext2D, {target, area, k}: EffectFrame): void {
  const t = center(target);
  const fade = fadeOut(k);
  // The blast: a ring of pixels racing outward from the target.
  if (k < 0.5) {
    const r = (k / 0.5) * BOARD_LAYOUT.size * 2.4;
    const seen = new Set<string>();
    for (let i = 0; i < 96; i++) {
      const a = (i / 96) * Math.PI * 2;
      for (const [rr, color] of [
        [r, '#e0f2fe'],
        [r - SPRITE_SCALE, '#7dd3fc'],
      ] as const) {
        const [ax, ay] = artCell(t.x + Math.cos(a) * rr, t.y + Math.sin(a) * rr * 0.8);
        const key = `${ax},${ay},${color}`;
        if (seen.has(key)) continue;
        seen.add(key);
        artPixel(ctx, ax, ay, color);
      }
    }
  }
  for (const h of area) {
    const g = (k - hexDistance(h, target) * FREEZE_RING_DELAY) / FREEZE_GROW;
    if (g <= 0) continue;
    const grow = Math.min(1, g);
    ditherHex(ctx, h, '#bae6fd', 4 * grow * fade);
    // Ice shards rising from the ground, in clusters, sinking again as it ends.
    const c = center(h);
    const next = hexRandom(h, 5);
    for (let i = 0; i < 4; i++) {
      let lx = 0;
      let ly = 0;
      for (let tries = 0; tries < 8; tries++) {
        lx = (next() - 0.5) * 28;
        ly = (next() - 0.5) * 26;
        if (insideHex(lx, ly, 7)) break;
      }
      const shard = ICE_SHARDS[Math.floor(next() * ICE_SHARDS.length)]!;
      const [ax, ay] = artCell(c.x + lx * SPRITE_SCALE, c.y + ly * SPRITE_SCALE);
      const rows = Math.ceil(shard.length * grow * fade);
      drawIceShard(ctx, shard, ax, ay, rows);
      drawIceShard(ctx, ICE_SHARDS[1], ax + 3, ay + 1, Math.ceil(5 * grow * fade));
    }
    // A glint on each hex as it sets: a pixel cross, growing then gone.
    const glint = g - 1;
    if (glint > 0 && glint < 1.2) {
      const arm = Math.round(Math.sin((glint / 1.2) * Math.PI) * 2);
      const [gx, gy] = artCell(c.x + 10, c.y - 12);
      artPixel(ctx, gx, gy, '#ffffff');
      for (let d = 1; d <= arm; d++)
        for (const [ox, oy] of [
          [d, 0],
          [-d, 0],
          [0, d],
          [0, -d],
        ] as const)
          artPixel(ctx, gx + ox, gy + oy, '#ffffff');
    }
  }
}

/** Golden motes rising in a sunbeam. */
const SUN_MOTES = 9;

/**
 * Sunlight: a beam of warm light falls on the target, dithered so the
 * board shows through it, brighter at its core; the ground under it glows,
 * sparkles turn round it and motes of light rise, then it thins away.
 */
function drawSunlight(ctx: CanvasRenderingContext2D, {target, k}: EffectFrame): void {
  const c = center(target);
  // In quickly, hold, out slowly.
  const glow = Math.min(1, k / 0.2) * fadeOut(k, 0.65);
  const top = c.y - 120;
  const foot = c.y + 16;
  const beam = (half: number, spread: number, bottom: number, color: string, level: number) => {
    const pattern = ditherFill(ctx, color, level * glow);
    if (!pattern) return;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(c.x - half, top);
    ctx.lineTo(c.x + half, top);
    ctx.lineTo(c.x + spread, bottom);
    ctx.lineTo(c.x - spread, bottom);
    ctx.closePath();
    ctx.fillStyle = pattern;
    ctx.fill();
    ctx.restore();
  };
  // The ground it lights, then the beam and its brighter core.
  const pool = ditherFill(ctx, '#fef08a', 4 * glow);
  if (pool) {
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(c.x, c.y + 10, 42, 26, 0, 0, Math.PI * 2);
    ctx.fillStyle = pool;
    ctx.fill();
    ctx.restore();
  }
  beam(12, 34, foot, '#fde047', 4);
  // The core stops above the unit's head, so its sprite stays clear.
  beam(4, 10, c.y - 40, '#fef9c3', 8);
  // Sparkles turning round it: pixel crosses.
  for (let i = 0; i < 4; i++) {
    if (glow < 0.3) break;
    const a = (i / 4) * Math.PI * 2 + k * 2.4;
    const [sx, sy] = artCell(c.x + Math.cos(a) * 30, c.y + 6 + Math.sin(a) * 20);
    artPixel(ctx, sx, sy, '#ffffff');
    for (const [ox, oy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const)
      artPixel(ctx, sx + ox, sy + oy, '#fde047');
  }
  // Motes of light rising through the beam.
  const next = hexRandom(target, 7);
  for (let i = 0; i < SUN_MOTES; i++) {
    const x = c.x + (next() - 0.5) * 44;
    const start = next() * 0.5;
    const shows = next() <= glow;
    const m = (k - start) / 0.5;
    if (m <= 0 || m >= 1 || !shows) continue;
    const [ax, ay] = artCell(x, c.y + 14 - m * 60);
    artPixel(ctx, ax, ay, i % 3 === 0 ? '#ffffff' : '#fde047');
  }
}
