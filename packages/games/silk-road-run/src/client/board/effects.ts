/**
 * Abilities' effects as a turn plays back (Sunlight's beam, Gale's gusts,
 * a Volley's arrows falling, Shove's blow, Haul's rope; Longshot's and
 * Feigned Retreat's arrows are drawn by the playback).
 */
import type {Hex} from '@canvas/engine';
import type {AbilityId} from '../../rules/types';
import {
  SPRITE_SCALE,
  artCell,
  artLine,
  artPixel,
  center,
  ditherFill,
  hexRandom,
  lerp,
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
  sunlight: drawSunlight,
  gale: drawGale,
  volley: drawVolley,
  shove: drawShove,
  haul: drawHaul,
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

/** Arrows in a Volley, and how high above their space they start, in scene pixels. */
const VOLLEY_ARROWS = 7;
const VOLLEY_HEIGHT = 110;

/**
 * Volley landing: arrows drop from high above onto the space, one after
 * another, each sticking where it lands, its fletching left showing.
 */
function drawVolley(ctx: CanvasRenderingContext2D, {target, k}: EffectFrame): void {
  const c = center(target);
  const next = hexRandom(target, 11);
  const fade = fadeOut(k);
  for (let i = 0; i < VOLLEY_ARROWS; i++) {
    const x = c.x + (next() - 0.5) * 50;
    const y = c.y + (next() - 0.5) * 26;
    const start = (i / VOLLEY_ARROWS) * 0.45;
    const m = Math.min(1, (k - start) / 0.25);
    if (m <= 0 || fade <= 0) continue;
    // Falling, then stuck: a short shaft above the ground.
    const fall = (1 - m) * VOLLEY_HEIGHT;
    drawPixelArrow(ctx, x, y - fall, 0, 1, m < 1 ? 7 : 3);
  }
}

/**
 * Gale: gusts curl out from the space over its neighbours, ivory streaks
 * blowing outward, a swirl at the centre.
 */
function drawGale(ctx: CanvasRenderingContext2D, {target, area, k}: EffectFrame): void {
  const c = center(target);
  const fade = fadeOut(k, 0.7);
  if (fade <= 0) return;
  // The swirl: pixels turning round the centre.
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + k * 9;
    const r = 6 + (i % 3) * 5;
    const [ax, ay] = artCell(c.x + Math.cos(a) * r, c.y + Math.sin(a) * r * 0.6);
    artPixel(ctx, ax, ay, i % 2 ? '#f5f5f4' : '#bae6fd');
  }
  // A streak blowing out over each neighbour, from the centre.
  for (const h of area) {
    if (h.q === target.q && h.r === target.r) continue;
    const n = center(h);
    const ux = n.x - c.x;
    const uy = n.y - c.y;
    for (const lag of [0, 0.18]) {
      const t = Math.min(1, Math.max(0, k * 1.4 - lag));
      const head = 0.25 + t * 0.85;
      const tail = Math.max(0.15, head - 0.35);
      for (const [ax, ay] of artLine(
        c.x + ux * tail,
        c.y + uy * tail,
        c.x + ux * head,
        c.y + uy * head
      ))
        if (fade > 0.4 || (ax + ay) % 2 === 0) artPixel(ctx, ax, ay, lag ? '#bae6fd' : '#f5f5f4');
    }
  }
}

/**
 * Shove: the Grappler's blow lands, a burst on the struck unit's side
 * facing it, and chevrons drive on the way it is Pushed.
 */
function drawShove(ctx: CanvasRenderingContext2D, {from, target, k}: EffectFrame): void {
  if (!from) return;
  const a = center(from);
  const b = center(target);
  const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  const ux = (b.x - a.x) / len;
  const uy = (b.y - a.y) / len;
  const fade = fadeOut(k, 0.6);
  if (fade <= 0) return;
  // The burst: short rays from where the blow lands.
  const hit = {x: b.x - ux * 14, y: b.y - uy * 14 - 10};
  const burst = Math.min(1, k / 0.3) * 18;
  for (let i = 0; i < 8; i++) {
    const r = (i / 8) * Math.PI * 2;
    for (const [ax, ay] of artLine(
      hit.x + Math.cos(r) * burst * 0.4,
      hit.y + Math.sin(r) * burst * 0.4,
      hit.x + Math.cos(r) * burst,
      hit.y + Math.sin(r) * burst
    ))
      artPixel(ctx, ax, ay, i % 2 ? '#fde047' : '#ffffff');
  }
  // Two chevrons driving on past the target.
  for (const lag of [0, 0.15]) {
    const t = Math.min(1, Math.max(0, (k - lag) * 1.6));
    const tip = {x: b.x + ux * (10 + t * 34), y: b.y + uy * (10 + t * 34) - 10};
    for (const side of [1, -1])
      for (const [ax, ay] of artLine(
        tip.x,
        tip.y,
        tip.x - ux * 14 + side * uy * 14,
        tip.y - uy * 14 - side * ux * 14
      )) {
        artPixel(ctx, ax, ay + 1, '#221816');
        artPixel(ctx, ax, ay, '#f5f5f4');
      }
  }
}

/**
 * Haul: a rope flies from the Grappler to the unit and draws taut, then
 * slackens as it is Pulled in.
 */
function drawHaul(ctx: CanvasRenderingContext2D, {from, target, k}: EffectFrame): void {
  if (!from) return;
  const a = center(from);
  const b = center(target);
  const fade = fadeOut(k, 0.7);
  if (fade <= 0) return;
  // Out to the unit over the first third, then held.
  const reach = Math.min(1, k / 0.35);
  const end = {x: lerp(a.x, b.x, reach), y: lerp(a.y, b.y, reach) - 10};
  const cells = artLine(a.x, a.y - 10, end.x, end.y);
  cells.forEach(([ax, ay], i) => {
    // Twisted rope: two tones, a sag while it flies.
    const sag = reach < 1 ? Math.round(Math.sin((i / cells.length) * Math.PI) * 2) : 0;
    artPixel(ctx, ax, ay + sag + 1, '#221816');
    artPixel(ctx, ax, ay + sag, i % 2 ? '#a16207' : '#ca8a04');
  });
  // The loop round the unit, once the rope reaches it.
  if (reach >= 1)
    for (let i = 0; i < 12; i++) {
      const r = (i / 12) * Math.PI * 2;
      const [ax, ay] = artCell(b.x + Math.cos(r) * 12, b.y - 10 + Math.sin(r) * 7);
      artPixel(ctx, ax, ay, i % 2 ? '#a16207' : '#ca8a04');
    }
}

/**
 * A Volley in the air, on the board until it lands: its space ringed in
 * the archer's colour, dashed, with arrows hanging above it, pointing down.
 */
export function drawVolleyMark(ctx: CanvasRenderingContext2D, h: Hex, color: string): void {
  const c = center(h);
  // Over the head of whoever stands there, so they still show.
  for (const dx of [-16, 0, 16])
    drawPixelArrow(ctx, c.x + dx, c.y - 30 - Math.abs(dx) / 3, 0, 1, 8);
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.setLineDash([4, 5]);
  ctx.beginPath();
  ctx.ellipse(c.x, c.y + 6, 22, 13, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}
