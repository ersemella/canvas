/**
 * The board's drawing primitives, shared by every layer: hex outlines
 * and fills, pixel-art rectangles, labels, sizes and side colours,
 * per-hex randomness, and the art grid's pixels, lines and dithering.
 */
import {hexCorners, hexToPixel} from '@canvas/engine';
import type {Hex} from '@canvas/engine';
import {BOARD_LAYOUT} from '../layout';
import {PALETTE, pixelFont} from '../palette';

/**
 * The sides' colours, from the palette (art-direction.md): lapis yours,
 * madder the enemy's. The plain shade for edges on the sand; light for
 * text and edges on the dark track and labels.
 */
export const SIDE_COLOR = {player: PALETTE.lapis, enemy: PALETTE.madder};
export const SIDE_LIGHT = {player: PALETTE.lapisLight, enemy: PALETTE.madderLight};
/** A hard, pixel drop shadow: the outline colour, no blur. */
export function pixelShadow(ctx: CanvasRenderingContext2D, offset = 2): void {
  ctx.shadowColor = PALETTE.ink;
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = offset;
  ctx.shadowOffsetY = offset;
}
export const HERO_COLOR = {
  bokh: '#b45309',
  mangudai: '#15803d',
  storm: '#4f46e5',
  modao: '#9f1239',
  camel: '#a8742f',
  wolf: '#6b7280',
};
/**
 * Board decorations were drawn for hexes of size 32; this scales them to
 * the board's hexes.
 */
export const HEX_SCALE = BOARD_LAYOUT.size / 32;
/**
 * 2× (64 pixels, 72 for a 36-pixel mounted sprite) keeps a sprite inside
 * its hex (about 73 wide); 1.5× until the hexes grew from 55 wide.
 */
export const SPRITE_SCALE = 2;
/** How far below the hex's centre a sprite's bottom edge sits. */
export const SPRITE_FEET = 29;
export interface HighlightStyle {
  fill: string;
  stroke: string;
  dash?: number[];
}
/**
 * Targeting is all one light blue (your side's light lapis) (the bow's lanes'), stronger the closer it is
 * to what's picked, so it never reads as either side's tint.
 */
/** `PALETTE.lapisLight`, as channels for the highlights' opacities. */
export const TARGET_RGB = '142,197,255';
/** An enemy's charging area: its side's madder (`SIDE_COLOR.enemy`). */
export const ENEMY_CHARGE_RED = '176,64,46';
export function center(h: Hex): {x: number; y: number} {
  return hexToPixel(h, BOARD_LAYOUT);
}

export function hexPath(ctx: CanvasRenderingContext2D, h: Hex, inset = 1): void {
  const c = center(h);
  ctx.beginPath();
  hexCorners('pointy', BOARD_LAYOUT.size - inset).forEach((p, i) =>
    i === 0 ? ctx.moveTo(c.x + p.x, c.y + p.y) : ctx.lineTo(c.x + p.x, c.y + p.y)
  );
  ctx.closePath();
}

export function fillHex(ctx: CanvasRenderingContext2D, h: Hex, style: HighlightStyle): void {
  ctx.save();
  hexPath(ctx, h, style.dash ? 4 : 2);
  ctx.fillStyle = style.fill;
  ctx.fill();
  ctx.setLineDash(style.dash ?? []);
  ctx.strokeStyle = style.stroke;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
}

export function tintHex(ctx: CanvasRenderingContext2D, h: Hex, color: string, alpha: number): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  hexPath(ctx, h, 1);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}

/**
 * A numbered step badge on a hex's left edge, clear of the status markers
 * and damage labels above a unit; a second one on the same hex sits on the right.
 */
export function pixelRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  // Pixel art's rounded corner: one square step cut out, not an arc.
  const c = Math.min(r, 3);
  ctx.beginPath();
  ctx.moveTo(x + c, y);
  ctx.lineTo(x + w - c, y);
  ctx.lineTo(x + w - c, y + c);
  ctx.lineTo(x + w, y + c);
  ctx.lineTo(x + w, y + h - c);
  ctx.lineTo(x + w - c, y + h - c);
  ctx.lineTo(x + w - c, y + h);
  ctx.lineTo(x + c, y + h);
  ctx.lineTo(x + c, y + h - c);
  ctx.lineTo(x, y + h - c);
  ctx.lineTo(x, y + c);
  ctx.lineTo(x + c, y + c);
  ctx.closePath();
}

/** A seeded random sequence in [0, 1) from a hex, so each hex has its own pattern. */
export function hexRandom(h: Hex, salt = 0): () => number {
  let seed = ((h.q * 73856093) ^ (h.r * 19349663) ^ (salt * 83492791)) >>> 0;
  return () => (seed = (seed * 1103515245 + 12345) >>> 0) / 2 ** 32;
}

/** Whether a point (art pixels from a hex's centre) lies `margin` art pixels inside the hex. */
export function insideHex(x: number, y: number, margin: number): boolean {
  const s = BOARD_LAYOUT.size / SPRITE_SCALE - margin;
  const ax = Math.abs(x);
  return ax <= (Math.sqrt(3) / 2) * s && Math.abs(y) <= s - ax / Math.sqrt(3);
}

/** A 4×4 ordered-dither threshold (0 to 15) for each art pixel: a pixel at `level` (0 to 16) shows when its threshold is below it. */
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
export const dithered = (x: number, y: number, level: number) =>
  BAYER[(y & 3) * 4 + (x & 3)]! < level;

export function artCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

export const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

export type Point = {x: number; y: number};

/** One art pixel (a square of `SPRITE_SCALE` scene pixels) at art-grid cell (ax, ay). */
export function artPixel(
  ctx: CanvasRenderingContext2D,
  ax: number,
  ay: number,
  color: string
): void {
  ctx.fillStyle = color;
  ctx.fillRect(ax * SPRITE_SCALE, ay * SPRITE_SCALE, SPRITE_SCALE, SPRITE_SCALE);
}

/** The art-grid cell holding a scene point. */
export const artCell = (x: number, y: number) =>
  [Math.round(x / SPRITE_SCALE), Math.round(y / SPRITE_SCALE)] as const;

/** The art-grid cells of a line between two scene points, from the first (Bresenham's). */
export function artLine(x0: number, y0: number, x1: number, y1: number): [number, number][] {
  let [ax, ay] = artCell(x0, y0);
  const [bx, by] = artCell(x1, y1);
  const dx = Math.abs(bx - ax);
  const dy = -Math.abs(by - ay);
  const sx = ax < bx ? 1 : -1;
  const sy = ay < by ? 1 : -1;
  let err = dx + dy;
  const cells: [number, number][] = [];
  for (;;) {
    cells.push([ax, ay]);
    if (ax === bx && ay === by) return cells;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      ax += sx;
    }
    if (e2 <= dx) {
      err += dx;
      ay += sy;
    }
  }
}

const ditherPatterns = new Map<string, CanvasPattern | null>();

/**
 * A fill of `color` in art pixels, `level` of every 16 shown (an ordered
 * dither, on the same grid as the weather's): how pixel art shows light or
 * a tint without blending.
 */
export function ditherFill(
  ctx: CanvasRenderingContext2D,
  color: string,
  level: number
): CanvasPattern | null {
  const lvl = Math.max(0, Math.min(16, Math.round(level)));
  const key = `${color}|${lvl}`;
  if (ditherPatterns.has(key)) return ditherPatterns.get(key)!;
  let pattern: CanvasPattern | null = null;
  if (lvl > 0 && typeof document !== 'undefined') {
    const tile = artCanvas(4 * SPRITE_SCALE, 4 * SPRITE_SCALE);
    const t = tile.getContext('2d')!;
    t.fillStyle = color;
    for (let y = 0; y < 4; y++)
      for (let x = 0; x < 4; x++)
        if (dithered(x, y, lvl))
          t.fillRect(x * SPRITE_SCALE, y * SPRITE_SCALE, SPRITE_SCALE, SPRITE_SCALE);
    pattern = ctx.createPattern(tile, 'repeat');
  }
  ditherPatterns.set(key, pattern);
  return pattern;
}

/** A hex filled with a dithered `color` (see `ditherFill`). */
export function ditherHex(
  ctx: CanvasRenderingContext2D,
  h: Hex,
  color: string,
  level: number
): void {
  const pattern = ditherFill(ctx, color, level);
  if (!pattern) return;
  ctx.save();
  hexPath(ctx, h, 2);
  ctx.fillStyle = pattern;
  ctx.fill();
  ctx.restore();
}

export function label(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  color: string,
  size: number,
  bold = false
): void {
  ctx.save();
  // The pixel font has one weight: `bold` sets the text off with an ink outline instead.
  ctx.font = pixelFont(size);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (bold) {
    ctx.strokeStyle = PALETTE.ink;
    ctx.lineWidth = 3;
    ctx.lineJoin = 'miter';
    ctx.strokeText(text, x, y);
  }
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
  ctx.restore();
}
