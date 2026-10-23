/** Abilities' effects as a turn plays back: the bow's arrow. */
import {SPRITE_SCALE, artLine, artPixel} from './pixels';

/** Frames a second the playback's effects move in: steps, like the units' idles and the weather. */
export const EFFECT_FPS = 12;

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
