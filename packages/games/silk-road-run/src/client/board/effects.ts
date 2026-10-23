/** Abilities' effects as a turn plays back: the bow's arrow, Volley's arrows. */
import type {Hex} from '@canvas/engine';
import type {AbilityId} from '../../rules/types';
import {
  SPRITE_SCALE,
  artCell,
  artLine,
  artPixel,
  center,
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
