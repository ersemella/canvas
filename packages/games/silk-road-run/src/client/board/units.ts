/**
 * Units on the board: their sprites and rugs, the turn arrow, and,
 * for a unit being looked at, its health bar, status markers and damage.
 */
import {assetLoader} from '@canvas/engine';
import type {Hex} from '@canvas/engine';
import {HEROES} from '../../rules/config';
import {isFlanked, statusValue, unitAt} from '../../rules/board';
import type {FightState, StatusKind, Unit} from '../../rules/types';
import {PALETTE, paletteAlpha, pixelFont} from '../palette';
import {
  HERO_COLOR,
  HEX_SCALE,
  SIDE_COLOR,
  SPRITE_FEET,
  SPRITE_SCALE,
  center,
  hexPath,
  label,
  pixelRect,
} from './pixels';
import bokhPortrait from '../sprites/bokh-portrait.png';
import bokhSprite from '../sprites/bokh.png';
import camelPortrait from '../sprites/camel-portrait.png';
import camelSprite from '../sprites/camel.png';
import mangudaiSprite from '../sprites/mangudai.png';
import mangudaiPortrait from '../sprites/mangudai-portrait.png';
import stormPortrait from '../sprites/storm-portrait.png';
import stormSprite from '../sprites/storm.png';
import wolfPortrait from '../sprites/wolf-portrait.png';
import wolfSprite from '../sprites/wolf.png';

/**
 * The rug a unit stands on, filling its hex: a field in its side's colour,
 * opaque enough to stay rich over the sand, and a stitched ivory border.
 */
const RUG = {
  player: {field: paletteAlpha('lapis', 0.8), stitch: PALETTE.ivory},
  enemy: {field: paletteAlpha('madder', 0.8), stitch: PALETTE.ivory},
};
/**
 * Board sprites, facing right: square frames (32×32, or 36×36 for a mounted
 * hero, the camel or the wolf) side by side, a 2-frame idle from scripts/idle-sheet.py. Heroes
 * without one are drawn as a lettered disc.
 */
const HERO_SPRITE: Partial<Record<Unit['hero'], string>> = {
  bokh: bokhSprite,
  mangudai: mangudaiSprite,
  storm: stormSprite,
  camel: camelSprite,
  wolf: wolfSprite,
};
/** Track portraits (32×32, facing right), filling the card; `faceX` is the face's column. */
export const HERO_PORTRAIT: Partial<Record<Unit['hero'], {src: string; faceX: number}>> = {
  bokh: {src: bokhPortrait, faceX: 17},
  mangudai: {src: mangudaiPortrait, faceX: 18},
  storm: {src: stormPortrait, faceX: 19},
  camel: {src: camelPortrait, faceX: 19},
  wolf: {src: wolfPortrait, faceX: 22},
};
/** The health bar over an inspected unit: centred on the hex, its bottom edge `HEALTH_BAR.y` above the centre. */
export const HEALTH_BAR = {w: 60, h: 10, y: 50};
/** Status markers in a row above the health bar: their radius, and the gap between centres. */
export const MARK = {r: 6.5, step: 15};
/** How far above the hex's centre the markers' row is centred. */
const MARKS_Y = HEALTH_BAR.y + HEALTH_BAR.h + 5 + MARK.r;

/**
 * Where a looked-at unit's health bar and status markers go: above it,
 * markers on top (the board leaves room for them over the top row).
 * `top` and `bottom` bound the lot, so the tooltip can keep clear of it.
 */
export function healthStack(
  hex: Hex,
  marks: number
): {barY: number; marksY: number; top: number; bottom: number} {
  const c = center(hex);
  const barY = c.y - HEALTH_BAR.y - HEALTH_BAR.h;
  const marksY = c.y - MARKS_Y;
  const top = (marks > 0 ? marksY - MARK.r : barY) - 2;
  return {barY, marksY, top, bottom: c.y - HEALTH_BAR.y + 2};
}

/** The rug under a unit (`RUG`): its field, then a stitched border inside the hex's edge. */
export function drawRug(
  ctx: CanvasRenderingContext2D,
  h: Hex,
  side: Unit['side'],
  alpha: number
): void {
  const rug = RUG[side];
  ctx.save();
  ctx.globalAlpha = alpha;
  hexPath(ctx, h, 1);
  ctx.fillStyle = rug.field;
  ctx.fill();
  hexPath(ctx, h, 7);
  ctx.setLineDash([3, 3]);
  ctx.strokeStyle = rug.stitch;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();
}

/**
 * What a looked-at hex takes up on the board, in scene pixels: its centre's
 * x, and the top and bottom of the hex with its unit's health bar and
 * status markers. A tooltip goes above `top` or below `bottom` to keep
 * clear of them: the page's on phones.
 */
export function hexOverlaySpan(
  fight: FightState,
  h: Hex
): {x: number; top: number; bottom: number} {
  const c = center(h);
  const unit = unitAt(fight, h);
  const stack = unit && healthStack(h, statusMarks(fight, unit).length);
  const hexTop = c.y - 36 * HEX_SCALE;
  const hexBottom = c.y + 36 * HEX_SCALE;
  return {
    x: c.x,
    top: stack ? stack.top : hexTop,
    bottom: hexBottom,
  };
}

/** Seconds each idle frame shows. */
const IDLE_FRAME_SECONDS = 0.6;

/**
 * A unit's idle frame at a time: frames alternate every `IDLE_FRAME_SECONDS`,
 * each unit offset by its id so the board doesn't breathe in step.
 */
export function idleFrame(unitId: string, time: number): number {
  let offset = 0;
  for (const ch of unitId) offset = (offset * 31 + ch.charCodeAt(0)) % 997;
  return Math.floor(time / IDLE_FRAME_SECONDS + offset / 997);
}

export function drawUnit(
  ctx: CanvasRenderingContext2D,
  u: Unit,
  hex: Hex,
  opts: {
    acting: boolean;
    selected: boolean;
    faded: boolean;
    ghost?: boolean;
    /** The sprite sheet's frame to show (wraps around the sheet's frames). */
    frame: number;
    /** Where to draw it instead of its hex, mid-move in a playback; no hex border then. */
    at?: {x: number; y: number} | undefined;
    /** Opacity, for a unit fading out as it falls. */
    alpha?: number;
    /**
     * An ability being aimed can target it (or has): a light blue ring
     * inside its border, dashed when it's reached only after a step.
     */
    targeted?: 'target' | 'reach' | 'chosen' | undefined;
  }
): void {
  const c = opts.at ?? center(hex);
  ctx.save();
  ctx.globalAlpha = (opts.faded ? 0.35 : opts.ghost ? 0.85 : 1) * (opts.alpha ?? 1);
  if (!opts.at) {
    // The hex's border: gold on the unit whose turn it is, as its turn
    // arrow is, white when selected, otherwise its side's colour (the hex is
    // tinted to match).
    hexPath(ctx, hex, 2.5);
    if (opts.ghost) ctx.setLineDash([5, 4]);
    ctx.strokeStyle = opts.acting
      ? PALETTE.goldLight
      : opts.selected
        ? PALETTE.ivory
        : SIDE_COLOR[u.side];
    ctx.lineWidth = opts.acting ? 4 : opts.selected ? 3.5 : 3;
    ctx.stroke();
    ctx.setLineDash([]);
    if (opts.targeted) {
      // Over ink, so it shows on your own lapis rug as on the enemy's.
      const width = opts.targeted === 'chosen' ? 4 : 3;
      hexPath(ctx, hex, 6.5);
      ctx.strokeStyle = PALETTE.ink;
      ctx.lineWidth = width + 2.5;
      ctx.stroke();
      ctx.strokeStyle = PALETTE.lapisLight;
      ctx.lineWidth = width;
      if (opts.targeted === 'reach') ctx.setLineDash([6, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }
  const sprite = HERO_SPRITE[u.hero];
  const img = sprite && assetLoader.requestImage(sprite);
  if (img) {
    // A sheet of square frames side by side (one frame for a still sprite).
    // Unsmoothed, so the pixels stay crisp; enemies face left.
    const side = img.height;
    const frames = Math.max(1, Math.round(img.width / side));
    const size = side * SPRITE_SCALE;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.translate(Math.round(c.x), Math.round(c.y + SPRITE_FEET - size));
    if (u.side === 'enemy') ctx.scale(-1, 1);
    ctx.drawImage(img, (opts.frame % frames) * side, 0, side, side, -size / 2, 0, size, size);
    ctx.restore();
  } else {
    // No sprite yet (or still loading): a disc in the hero's colour with its letter.
    ctx.beginPath();
    ctx.arc(c.x, c.y, 15 * HEX_SCALE, 0, Math.PI * 2);
    ctx.fillStyle = HERO_COLOR[u.hero];
    ctx.fill();
    ctx.strokeStyle = PALETTE.ink;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    label(ctx, HEROES[u.hero].letter, c.x, c.y + 1, PALETTE.ivory, 15, true);
  }
  ctx.restore();
}

/**
 * The turn arrow's rows, top to bottom, in art pixels of `TURN_ARROW.px`
 * screen pixels: a stubby stem over a point.
 */
const TURN_ARROW_ROWS = [3, 3, 9, 7, 5, 3, 1];
const TURN_ARROW = {px: 3, gap: 3, bob: 5, bobSeconds: 0.9};

/** How far the turn arrow has bobbed up at a time, in whole pixels. */
export function turnArrowBob(time: number): number {
  return Math.round(
    (TURN_ARROW.bob * (1 + Math.sin((time * 2 * Math.PI) / TURN_ARROW.bobSeconds))) / 2
  );
}

/**
 * The arrow over the unit you're controlling: gold, which no side or
 * targeting colour uses, so it shows on the sand and over either side's
 * rugs. It points down at the unit from above its health bar and statuses,
 * and bobs, unless the device asks for reduced motion (`time` null).
 */
export function drawTurnArrow(
  ctx: CanvasRenderingContext2D,
  hex: Hex,
  marks: number,
  time: number | null
): void {
  const {px, gap} = TURN_ARROW;
  const h = TURN_ARROW_ROWS.length * px;
  const bob = time === null ? 0 : turnArrowBob(time);
  const top = Math.round(healthStack(hex, marks).top - gap - h - bob);
  const x = Math.round(center(hex).x);
  ctx.save();
  // An ink outline one art pixel round every row, then the gold on top,
  // a lighter left half for the light from the top left.
  ctx.fillStyle = PALETTE.ink;
  TURN_ARROW_ROWS.forEach((w, i) =>
    ctx.fillRect(x - ((w + 2) * px) / 2, top + (i - 1) * px, (w + 2) * px, 3 * px)
  );
  TURN_ARROW_ROWS.forEach((w, i) => {
    const left = x - (w * px) / 2;
    const half = Math.ceil(w / 2) * px;
    ctx.fillStyle = PALETTE.goldLight;
    ctx.fillRect(left, top + i * px, half, px);
    ctx.fillStyle = PALETTE.gold;
    ctx.fillRect(left + half, top + i * px, w * px - half, px);
  });
  ctx.restore();
}

/** Each status's marker: its letter and colour, in the order a row shows them. */
export const STATUS_MARK: Record<StatusKind, [string, string]> = {
  immobilized: ['I', PALETTE.sky],
  slowed: ['S', PALETTE.plumLight],
  vulnerable: ['V', PALETTE.gold],
  crushed: ['C', PALETTE.madder],
  taunted: ['T', PALETTE.goldLight],
  barrier: ['B', PALETTE.ivory],
};
export const STATUS_KINDS = Object.keys(STATUS_MARK) as StatusKind[];

/** A unit's status markers: I(mmobilized), S(lowed), V(ulnerable), C(rushed), T(aunted), B(arrier), F(lanked). */
export function statusMarks(fight: FightState, u: Unit): [string, string][] {
  const marks: [string, string][] = [];
  for (const kind of STATUS_KINDS) {
    const on =
      kind === 'taunted' ? u.statuses.some((s) => s.kind === kind) : statusValue(u, kind) > 0;
    if (on) marks.push(STATUS_MARK[kind]);
  }
  if (isFlanked(fight, u)) marks.push(['F', PALETTE.madderLight]);
  return marks;
}

/** A looked-at unit's status markers, in a centred row at `y` (see `healthStack`). */
export function drawStatusMarks(
  ctx: CanvasRenderingContext2D,
  marks: [string, string][],
  hex: Hex,
  y: number
): void {
  const c = center(hex);
  marks.forEach((mark, i) => {
    drawStatusMark(ctx, mark, c.x + (i - (marks.length - 1) / 2) * MARK.step, y);
  });
}

/** One status marker centred at (`x`, `y`). */
export function drawStatusMark(
  ctx: CanvasRenderingContext2D,
  [m, color]: [string, string],
  x: number,
  y: number,
  alpha = 1
): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.beginPath();
  ctx.arc(x, y, MARK.r, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = PALETTE.ink;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  label(ctx, m, x, y + 0.5, PALETTE.ink, 9, true);
  ctx.restore();
}

/**
 * A looked-at unit's health, floating over (or under) its sprite at `y`
 * (see `healthStack`); just the bar (the numbers are in the page's details). A previewed change
 * shows the health it would lose as a pale stretch past the bar's end (or
 * gain, in green).
 */
export function drawHealthBar(
  ctx: CanvasRenderingContext2D,
  u: Unit,
  hex: Hex,
  y: number,
  hp: number,
  hpAfter?: number
): void {
  const c = center(hex);
  const {w, h} = HEALTH_BAR;
  const x = c.x - w / 2;
  const after = hpAfter ?? hp;
  const frac = (n: number) => Math.min(1, Math.max(0, n / u.maxHp));
  ctx.save();
  pixelRect(ctx, x - 2, y - 2, w + 4, h + 4, 4);
  ctx.fillStyle = PALETTE.dusk0;
  ctx.fill();
  ctx.strokeStyle = SIDE_COLOR[u.side];
  ctx.lineWidth = 1.5;
  ctx.stroke();
  const f = frac(after);
  if (after !== hp) {
    ctx.fillStyle = after < hp ? paletteAlpha('madderLight', 0.5) : paletteAlpha('jade', 0.5);
    ctx.fillRect(x + w * Math.min(f, frac(hp)), y, w * Math.abs(f - frac(hp)), h);
  }
  ctx.fillStyle = f > 0.5 ? PALETTE.jade : f > 0.25 ? PALETTE.gold : PALETTE.madder;
  ctx.fillRect(x, y, w * Math.min(f, frac(hp)), h);
  ctx.restore();
}

export function drawDamage(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  amount: number,
  killed: boolean
): void {
  const text = killed ? `-${amount} ✕` : amount > 0 ? `-${amount}` : `+${-amount}`;
  ctx.save();
  ctx.font = pixelFont(13);
  const w = ctx.measureText(text).width + 8;
  ctx.fillStyle = PALETTE.dusk0;
  ctx.fillRect(x - w / 2, y - 9, w, 17);
  ctx.restore();
  label(ctx, text, x, y, amount >= 0 ? PALETTE.madderLight : PALETTE.jade, 13, true);
}
