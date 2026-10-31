/**
 * Abilities' effects as a turn plays back (Sunlight's beam, Gale's gusts,
 * a Volley's arrows falling, Shove's blow, Haul's rope, Cleave's swing,
 * Swift Strike's thrust, Reave's swing and throw, Axe Throw's axe, Elixir's flask, the Sedative's vial and haze, Omen's clock,
 * Blessing's halo, Stomp's quake, Bite's jaws, Smash's club, the Boulder's
 * flight; Snap Shot's and Feigned Retreat's arrows are drawn by the
 * playback, Hail's stones and Grapple's fists by the board).
 */
import {hexDistance} from '@canvas/engine';
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
  cleave: drawCleave,
  reave: drawReave,
  hew: drawCleave,
  axeThrow: drawAxeThrow,
  swiftStrike: drawSwiftStrike,
  elixir: drawElixir,
  sedative: drawSedative,
  omen: drawOmen,
  blessing: drawBlessing,
  stomp: drawStomp,
  bite: drawBite,
  smash: drawSmash,
  boulder: drawBoulder,
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

/** The blade's steel, its bright edge and its outline. */
const STEEL = '#cbd5e1';
const EDGE = '#ffffff';
const OUTLINE = '#221816';

/**
 * A slash across a space: a short streak at angle `a` through (x, y),
 * drawn out from one end over `t` (0 to 1), white edge on steel, outlined.
 * Once `fade` drops below 0.4 every other pixel goes, as the Gale's do.
 */
function drawSlash(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  a: number,
  half: number,
  t: number,
  fade: number
): void {
  if (t <= 0 || fade <= 0) return;
  t = Math.min(1, t);
  const ux = Math.cos(a);
  const uy = Math.sin(a);
  const cells = artLine(
    x - ux * half,
    y - uy * half,
    x - ux * half + ux * 2 * half * t,
    y - uy * half + uy * 2 * half * t
  );
  for (const [cx, cy] of cells) {
    if (fade <= 0.4 && (cx + cy) % 2 !== 0) continue;
    artPixel(ctx, cx, cy + 1, OUTLINE);
  }
  cells.forEach(([cx, cy], i) => {
    if (fade <= 0.4 && (cx + cy) % 2 !== 0) return;
    // Thin at the ends, the bright edge along the middle.
    const end = i < 2 || i >= cells.length - 2;
    artPixel(ctx, cx, cy, end ? STEEL : EDGE);
    if (!end) artPixel(ctx, cx, cy - 1, STEEL);
  });
}

/**
 * Cleave: the great blade swings round the Vanguard, a crescent of steel
 * sweeping across the spaces it reaches (a chop along its line), and each space
 * is slashed as the swing passes it.
 */
function drawCleave(ctx: CanvasRenderingContext2D, {from, area, k}: EffectFrame): void {
  if (!from || area.length === 0) return;
  const a = center(from);
  const fade = fadeOut(k, 0.7);
  if (fade <= 0) return;
  // Each space's bearing from the user, round their mean, so the swing doesn't wrap.
  const spots = area.map((h) => {
    const c = center(h);
    return {c, dx: c.x - a.x, dy: c.y - a.y};
  });
  const mx = spots.reduce((s, p) => s + p.dx, 0);
  const my = spots.reduce((s, p) => s + p.dy, 0);
  const mean = Math.atan2(my, mx);
  const rel = spots.map((p) =>
    Math.atan2(
      Math.cos(mean) * p.dy - Math.sin(mean) * p.dx,
      Math.cos(mean) * p.dx + Math.sin(mean) * p.dy
    )
  );
  // At least a wide arc, so a line's chop still swings.
  const span = Math.max(Math.PI / 2, Math.max(...rel) - Math.min(...rel) + Math.PI / 3);
  const start = mean - span / 2;
  // The swing: over the first 45%, its head bright and thick, the arc behind it thinning out.
  const swing = Math.min(1, k / 0.45);
  const nearest = Math.min(...spots.map((p) => Math.hypot(p.dx, p.dy)));
  const radius = nearest * 0.8;
  const head = start + span * swing;
  const steps = Math.ceil((span * radius * swing) / SPRITE_SCALE);
  for (let i = 0; i <= steps; i++) {
    const t = steps ? i / steps : 1;
    const ang = lerp(start, head, t);
    const near = Math.max(0, 1 - (head - ang) / (span / 3));
    const thick = 1 + Math.round(near * 3);
    for (let j = 0; j < thick; j++) {
      const r = radius - 6 + j * 4;
      const [cx, cy] = artCell(a.x + Math.cos(ang) * r, a.y - 10 + Math.sin(ang) * r * 0.85);
      // The old part of the arc, and all of it as it fades, every other pixel.
      if ((near === 0 || fade <= 0.4) && (cx + cy) % 2 !== 0) continue;
      artPixel(ctx, cx, cy, j === thick - 1 ? EDGE : STEEL);
    }
  }
  // Each space slashed as the swing reaches its bearing (along a line, the near one first).
  spots.forEach((p, i) => {
    const reached = (rel[i]! - (start - mean)) / span;
    const further = Math.hypot(p.dx, p.dy) / nearest - 1;
    const at = Math.max(0, Math.min(0.45, reached * 0.45)) + further * 0.1;
    const t = Math.min(1, (k - at) / 0.12);
    // Across the swing's path there, tilted the way it travels.
    drawSlash(ctx, p.c.x, p.c.y - 12, mean + rel[i]! + Math.PI / 2 + 0.5, 20, t, fade);
  });
}

/**
 * Reave: a swipe swings as Cleave's arc does; a throw sends the axe
 * spinning down its line to where it lands, slashing each space it passes.
 */
function drawReave(ctx: CanvasRenderingContext2D, f: EffectFrame): void {
  if (!f.from) return;
  if (hexDistance(f.from, f.target) <= 1) return drawCleave(ctx, f);
  drawFlyingAxe(ctx, f);
}

/** Axe Throw: Reave's spinning axe, flown over everything to the one unit it hits. */
function drawAxeThrow(ctx: CanvasRenderingContext2D, f: EffectFrame): void {
  drawFlyingAxe(ctx, {...f, area: [f.target]});
}

/** The axe spinning from `from` to `target`, slashing each space of `area` as it passes. */
function drawFlyingAxe(ctx: CanvasRenderingContext2D, f: EffectFrame): void {
  const {from, target, area, k} = f;
  if (!from) return;
  const fade = fadeOut(k, 0.75);
  if (fade <= 0) return;
  const a = center(from);
  const b = center(target);
  const t = Math.min(1, k / 0.6);
  const x = lerp(a.x, b.x, t);
  const y = lerp(a.y, b.y, t) - 14;
  // The axe: a haft and a blade at its end, turning a quarter each frame.
  const spin = Math.floor(k * 24) * (Math.PI / 2);
  const [ux, uy] = [Math.cos(spin), Math.sin(spin)];
  for (const [cx, cy] of artLine(x - ux * 10, y - uy * 10, x + ux * 10, y + uy * 10))
    artPixel(ctx, cx, cy, '#7c4a1e');
  const [bx, by] = artCell(x + ux * 10, y + uy * 10);
  for (let dx = -1; dx <= 1; dx++)
    for (let dy = -1; dy <= 1; dy++) artPixel(ctx, bx + dx, by + dy, dx || dy ? '#9ca3af' : EDGE);
  // Each space slashed as the axe passes over it.
  area.forEach((h, i) => {
    const at = (i + 1) / area.length;
    if (t < at * 0.95) return;
    const c = center(h);
    drawSlash(
      ctx,
      c.x,
      c.y - 12,
      Math.atan2(b.y - a.y, b.x - a.x) + Math.PI / 2,
      20,
      Math.min(1, (t - at * 0.95) / 0.2 + 0.4),
      fade
    );
  });
}

/**
 * Swift Strike: the Duelist's jian darts out to the unit in a thin
 * bright streak, two quick cuts cross on it, and jade speed lines run back
 * past the Duelist as its card is Hastened.
 */
function drawSwiftStrike(ctx: CanvasRenderingContext2D, {from, target, k}: EffectFrame): void {
  if (!from) return;
  const a = center(from);
  const b = center(target);
  const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  const ux = (b.x - a.x) / len;
  const uy = (b.y - a.y) / len;
  const fade = fadeOut(k, 0.7);
  if (fade <= 0) return;
  // The thrust, over the first quarter: its tail catching up as it lands.
  if (k < 0.35) {
    const h = Math.min(1, k / 0.2);
    const t = Math.max(0, (k - 0.1) / 0.25);
    for (const [cx, cy] of artLine(
      lerp(a.x, b.x, t * 0.8) + ux * 10,
      lerp(a.y, b.y, t * 0.8) + uy * 10 - 14,
      lerp(a.x, b.x, h * 0.8) + ux * 10,
      lerp(a.y, b.y, h * 0.8) + uy * 10 - 14
    )) {
      artPixel(ctx, cx, cy + 1, '#0e7490');
      artPixel(ctx, cx, cy, EDGE);
    }
  }
  // Two cuts crossing on the unit, one after the other.
  drawSlash(ctx, b.x, b.y - 12, -Math.PI / 4, 16, (k - 0.18) / 0.1, fade);
  drawSlash(ctx, b.x, b.y - 12, Math.PI / 4, 16, (k - 0.3) / 0.1, fade);
  // The glint where they cross.
  if (k >= 0.3 && k < 0.55) {
    const [gx, gy] = artCell(b.x, b.y - 12);
    const r = k < 0.42 ? 3 : 2;
    for (let i = -r; i <= r; i++) {
      artPixel(ctx, gx + i, gy, i === 0 ? EDGE : '#a5f3fc');
      artPixel(ctx, gx, gy + i, i === 0 ? EDGE : '#a5f3fc');
    }
  }
  // Haste: speed lines running back past the Duelist.
  const run = (k - 0.35) / 0.65;
  if (run > 0)
    for (const [side, lag] of [
      [-1, 0],
      [0, 0.15],
      [1, 0.3],
    ] as const) {
      const m = Math.min(1, Math.max(0, run * 1.4 - lag));
      if (m <= 0 || m >= 1) continue;
      const ox = a.x - uy * side * 12;
      const oy = a.y - 12 + ux * side * 8;
      const d0 = 4 + m * 30;
      for (const [cx, cy] of artLine(
        ox - ux * d0,
        oy - uy * d0,
        ox - ux * (d0 + 12),
        oy - uy * (d0 + 12)
      ))
        if (fade > 0.4 || (cx + cy) % 2 === 0)
          artPixel(ctx, cx, cy, m < 0.5 ? '#86efac' : '#5bb26f');
    }
}

/** How high the Alchemist's flask arcs, in scene pixels, and the drops it bursts into. */
/** The Sedative's vial arcs lower than the Elixir's flask. */
const SEDATIVE_ARC = 28;
/** The 4×4 art pixels of a sleepy "Z". */
const ZED: [number, number][] = [
  [0, 0],
  [1, 0],
  [2, 0],
  [3, 0],
  [2, 1],
  [1, 2],
  [0, 3],
  [1, 3],
  [2, 3],
  [3, 3],
];

/**
 * Sedative: the Alchemist floats a slim violet vial over in a low,
 * swaying arc; over the unit it uncorks, and a lavender haze settles round
 * its head while sleepy Zs drift up out of it, dizzy stars turn round its
 * brow and a small green plus rises for the heal, then it all thins away.
 * On itself, the vial just uncorks.
 */
function drawSedative(ctx: CanvasRenderingContext2D, {from, target, k}: EffectFrame): void {
  const a = from ? center(from) : center(target);
  const b = center(target);
  const flight = from && (from.q !== target.q || from.r !== target.r) ? 0.4 : 0;
  if (k < flight) {
    const t = k / flight;
    const x = lerp(a.x, b.x, t);
    const y = lerp(a.y - 22, b.y - 40, t) - Math.sin(Math.PI * t) * SEDATIVE_ARC;
    const [fx, fy] = artCell(x, y);
    // Swaying, not tumbling: the vial leans one way, then the other.
    const lean = Math.floor(t * 6) % 2 === 0 ? 0 : 1;
    const body: [number, number][] = [
      [0, 0],
      [0, 1],
      [lean, 2],
      [lean, 3],
    ];
    for (const [ox, oy] of body)
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ] as const)
        artPixel(ctx, fx + ox + dx, fy + oy + dy, OUTLINE);
    for (const [ox, oy] of body) artPixel(ctx, fx + ox, fy + oy, oy < 2 ? '#c4b5fd' : '#8b5cf6');
    artPixel(ctx, fx, fy, '#ffffff');
    artPixel(ctx, fx, fy - 1, '#a16207');
    return;
  }
  const m = flight < 1 ? (k - flight) / (1 - flight) : 1;
  const fade = fadeOut(m, 0.6);
  if (fade <= 0) return;
  const head = {x: b.x, y: b.y - 34};
  // The haze: dithered lavender, settling round the head and thinning.
  const settle = Math.min(1, m / 0.3);
  for (const [w, h, level, color] of [
    [26, 12, 3, '#a78bfa'],
    [16, 7, 5, '#ddd6fe'],
  ] as const) {
    const haze = ditherFill(ctx, color, level * fade);
    if (!haze) continue;
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(head.x, head.y - 6 + settle * 8, w * (0.6 + settle * 0.4), h, 0, 0, Math.PI * 2);
    ctx.fillStyle = haze;
    ctx.fill();
    ctx.restore();
  }
  // The cork popping off, up and away, early on.
  if (m < 0.3) {
    const [cx, cy] = artCell(head.x + m * 30, head.y - 12 - m * 40);
    artPixel(ctx, cx, cy, '#a16207');
  }
  // Sleepy Zs, staggered, drifting up and to the side, growing fainter.
  for (let i = 0; i < 3; i++) {
    const z = (m - i * 0.18) / 0.6;
    if (z <= 0 || z >= 1) continue;
    const [zx, zy] = artCell(head.x + 6 + z * 16 + i * 2, head.y - 10 - z * 34);
    const color = z < 0.6 ? '#ede9fe' : '#a78bfa';
    for (const [ox, oy] of ZED) artPixel(ctx, zx + ox, zy + oy, color);
  }
  // Dizzy stars turning round the brow.
  if (fade > 0.3)
    for (let i = 0; i < 3; i++) {
      const ang = (i / 3) * Math.PI * 2 + m * 7;
      const [sx, sy] = artCell(head.x + Math.cos(ang) * 14, head.y + 2 + Math.sin(ang) * 5);
      artPixel(ctx, sx, sy, '#fef08a');
      if (Math.sin(ang) > 0)
        for (const [ox, oy] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ] as const)
          artPixel(ctx, sx + ox, sy + oy, '#fde68a');
    }
  // The heal: a small green plus rising beside it.
  if (m > 0.15 && m < 0.75) {
    const h = (m - 0.15) / 0.6;
    const [px, py] = artCell(b.x - 16, b.y - 16 - h * 22);
    for (const [ox, oy] of [
      [0, 0],
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const)
      artPixel(ctx, px + ox, py + oy, '#86efac');
  }
}

const ELIXIR_ARC = 46;
const ELIXIR_DROPS = 10;

/**
 * Elixir: the Alchemist lobs a stoppered flask, turning, in an arc onto
 * the unit's space, where it bursts in a splash of green droplets and a
 * pool that soaks away. On itself, the flask just bursts.
 */
function drawElixir(ctx: CanvasRenderingContext2D, {from, target, k}: EffectFrame): void {
  const a = from ? center(from) : center(target);
  const b = center(target);
  const flight = from && (from.q !== target.q || from.r !== target.r) ? 0.45 : 0;
  if (k < flight) {
    const t = k / flight;
    const x = lerp(a.x, b.x, t);
    const y = lerp(a.y - 22, b.y - 14, t) - Math.sin(Math.PI * t) * ELIXIR_ARC;
    const [fx, fy] = artCell(x, y);
    // The flask, upright or tipped as it turns: a round green belly, a cork.
    const tipped = Math.floor(t * 4) % 2 === 1;
    const body: [number, number][] = [
      [-1, 0],
      [0, 0],
      [1, 0],
      [-1, 1],
      [0, 1],
      [1, 1],
      [0, 2],
    ];
    for (const [ox, oy] of body)
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ] as const)
        artPixel(ctx, fx + ox + dx, fy + oy + dy, OUTLINE);
    for (const [ox, oy] of body) artPixel(ctx, fx + ox, fy + oy, oy === 0 ? '#86efac' : '#5bb26f');
    artPixel(ctx, fx - 1, fy, '#ffffff');
    // The neck and cork, pointing up or off to the side.
    const [nx, ny] = tipped ? [2, 0] : [0, -1];
    const [cx, cy] = tipped ? [3, 0] : [0, -2];
    artPixel(ctx, fx + nx, fy + ny, '#bbf7d0');
    artPixel(ctx, fx + cx, fy + cy, '#a16207');
    return;
  }
  // The burst: a ring of drops thrown up and falling, a pool soaking away.
  const m = flight < 1 ? (k - flight) / (1 - flight) : 1;
  const fade = fadeOut(m, 0.6);
  if (fade <= 0) return;
  const pool = ditherFill(ctx, '#5bb26f', 5 * fade);
  if (pool) {
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(b.x, b.y + 8, 14 + m * 16, 8 + m * 9, 0, 0, Math.PI * 2);
    ctx.fillStyle = pool;
    ctx.fill();
    ctx.restore();
  }
  const next = hexRandom(target, 13);
  for (let i = 0; i < ELIXIR_DROPS; i++) {
    const ang = (i / ELIXIR_DROPS) * Math.PI * 2 + next() * 0.4;
    const speed = 18 + next() * 14;
    const x = b.x + Math.cos(ang) * speed * m;
    // Up and out, then falling back.
    const y = b.y - 10 + Math.sin(ang) * speed * m * 0.5 - Math.sin(Math.PI * m) * 16;
    const [dx, dy] = artCell(x, y);
    if (fade <= 0.4 && (dx + dy) % 2 !== 0) continue;
    artPixel(ctx, dx, dy, i % 3 === 0 ? '#ffffff' : i % 2 ? '#86efac' : '#5bb26f');
  }
  // The flask's shards, glinting.
  if (m < 0.35)
    for (const [ox, oy] of [
      [-2, -1],
      [2, -2],
      [0, 1],
    ] as const) {
      const [gx, gy] = artCell(b.x, b.y - 12);
      artPixel(
        ctx,
        gx + ox * (1 + Math.round(m * 6)),
        gy + oy * (1 + Math.round(m * 4)),
        '#e5e7eb'
      );
    }
}

/** Omen's clock face, its rim's radius in art pixels, and the ticks round it. */
const OMEN_RADIUS = 9;
const OMEN_TICKS = 12;

/**
 * Omen: a clock face of starlight over the unit, its ticks lit in turn as
 * its hand sweeps a full round (time turned for the unit's card), the
 * other hand set, then it fades.
 */
function drawOmen(ctx: CanvasRenderingContext2D, {target, k}: EffectFrame): void {
  const c = center(target);
  const appear = Math.min(1, k / 0.15);
  const fade = fadeOut(k, 0.75) * appear;
  if (fade <= 0) return;
  const [ox, oy] = artCell(c.x, c.y - 52);
  const keep = (x: number, y: number) => fade > 0.4 || (x + y) % 2 === 0;
  const put = (x: number, y: number, color: string) => {
    if (keep(x, y)) artPixel(ctx, x, y, color);
  };
  // The face: a dark dial, a plum rim, outlined.
  const r = Math.max(2, Math.round(OMEN_RADIUS * appear));
  for (let y = -r - 1; y <= r + 1; y++)
    for (let x = -r - 1; x <= r + 1; x++) {
      const d = Math.hypot(x, y);
      if (d <= r - 1) put(ox + x, oy + y, '#1f3a6e');
      else if (d <= r + 0.2) put(ox + x, oy + y, '#e3aee4');
      else if (d <= r + 1.2) put(ox + x, oy + y, OUTLINE);
    }
  // The sweep: from twelve round, over the middle of the effect.
  const sweep = Math.min(1, Math.max(0, (k - 0.15) / 0.55));
  const hand = -Math.PI / 2 + sweep * Math.PI * 2;
  for (let i = 0; i < OMEN_TICKS; i++) {
    const a = -Math.PI / 2 + (i / OMEN_TICKS) * Math.PI * 2;
    const lit = i / OMEN_TICKS <= sweep;
    const tx = ox + Math.round(Math.cos(a) * (r - 2));
    const ty = oy + Math.round(Math.sin(a) * (r - 2));
    put(tx, ty, lit ? '#ffdf5e' : '#8d4a92');
  }
  // The hour hand, set; the minute hand sweeping, a star at the pin.
  for (let j = 1; j <= Math.round((r - 3) * 0.6); j++) put(ox + j, oy, '#d4ebff');
  for (let j = 1; j <= r - 3; j++)
    put(ox + Math.round(Math.cos(hand) * j), oy + Math.round(Math.sin(hand) * j), '#ffffff');
  put(ox, oy, '#ffdf5e');
  // Motes of starlight drifting off the face once the hand comes round.
  if (sweep >= 1) {
    const next = hexRandom(target, 17);
    const m = (k - 0.7) / 0.3;
    for (let i = 0; i < 6; i++) {
      const a = next() * Math.PI * 2;
      const d = r + 2 + m * 10 * (0.5 + next());
      put(
        ox + Math.round(Math.cos(a) * d),
        oy + Math.round(Math.sin(a) * d),
        i % 2 ? '#e3aee4' : '#ffffff'
      );
    }
  }
}

/** The Blessing's halo: its half-width and half-height in art pixels. */
const HALO = {rx: 7, ry: 2};

/**
 * Blessing: a golden halo settles from above onto the ally, motes of light
 * falling with it, then a pale ward rises round it as a dome of dithered
 * light, and thins away.
 */
function drawBlessing(ctx: CanvasRenderingContext2D, {target, k}: EffectFrame): void {
  const c = center(target);
  const fade = fadeOut(k, 0.7);
  if (fade <= 0) return;
  const keep = (x: number, y: number) => fade > 0.4 || (x + y) % 2 === 0;
  const put = (x: number, y: number, color: string) => {
    if (keep(x, y)) artPixel(ctx, x, y, color);
  };
  // The halo: from high above, down to the head over the first half.
  const fall = Math.min(1, k / 0.45);
  const [hx, hy] = artCell(c.x, c.y - 30 - (1 - fall) * 40);
  for (let a = 0; a < 32; a++) {
    const t = (a / 32) * Math.PI * 2;
    const x = hx + Math.round(Math.cos(t) * HALO.rx);
    const y = hy + Math.round(Math.sin(t) * HALO.ry);
    put(x, y + 1, OUTLINE);
    put(x, y, a % 4 === 0 ? '#fff6c8' : '#ffdf5e');
  }
  // Motes of light falling round it.
  const next = hexRandom(target, 23);
  for (let i = 0; i < 6; i++) {
    const x = hx + Math.round((next() - 0.5) * 2 * (HALO.rx + 3));
    const y = hy - 6 + Math.round(((next() + k * 2) % 1) * 14);
    put(x, y, i % 2 ? '#ffffff' : '#ffdf5e');
  }
  // The ward: a dome over the unit, once the halo has settled.
  if (k < 0.45) return;
  const rise = Math.min(1, (k - 0.45) / 0.2);
  const [dx, dy] = artCell(c.x, c.y + 12);
  const r = Math.round(13 * rise);
  for (let a = 0; a <= 40; a++) {
    const t = Math.PI + (a / 40) * Math.PI;
    const x = dx + Math.round(Math.cos(t) * r);
    const y = dy + Math.round(Math.sin(t) * r * 1.4);
    put(x, y, a % 5 === 0 ? '#ffffff' : '#cfe8f2');
  }
}

/**
 * Stomp: the Juggernaut's foot comes down where it stands, a ring of dust
 * bursting out round it, the ground cracking, and chevrons drive out over
 * each space next to it, the way the units there are Pushed.
 */
function drawStomp(ctx: CanvasRenderingContext2D, {target, area, k}: EffectFrame): void {
  const c = center(target);
  const fade = fadeOut(k, 0.65);
  if (fade <= 0) return;
  // Cracks spreading from under its feet.
  const next = hexRandom(target, 19);
  const crack = Math.min(1, k / 0.25);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + next() * 0.6;
    const len = (16 + next() * 10) * crack;
    for (const [ax, ay] of artLine(
      c.x,
      c.y + 8,
      c.x + Math.cos(a) * len,
      c.y + 8 + Math.sin(a) * len * 0.55
    ))
      if (fade > 0.4 || (ax + ay) % 2 === 0) artPixel(ctx, ax, ay, '#5b4c68');
  }
  // The shockwave: a ring of dust spreading out flat over the ground.
  const wave = Math.min(1, k / 0.55);
  const rx = 14 + wave * 44;
  for (let i = 0; i < 36; i++) {
    const a = (i / 36) * Math.PI * 2;
    const [ax, ay] = artCell(c.x + Math.cos(a) * rx, c.y + 8 + Math.sin(a) * rx * 0.55);
    if ((fade <= 0.4 || wave >= 1) && (ax + ay) % 2 !== 0) continue;
    artPixel(ctx, ax, ay, i % 3 === 0 ? '#efdcbc' : '#d4b483');
    artPixel(ctx, ax, ay - 1, '#8c7350');
  }
  // Chevrons over each space next to it, driving outward.
  for (const h of area) {
    const n = center(h);
    const len = Math.hypot(n.x - c.x, n.y - c.y) || 1;
    const ux = (n.x - c.x) / len;
    const uy = (n.y - c.y) / len;
    const t = Math.min(1, Math.max(0, (k - 0.15) / 0.5));
    if (t <= 0) continue;
    const tip = {x: n.x + ux * (t * 18 - 6), y: n.y + uy * (t * 18 - 6) - 10};
    for (const side of [1, -1])
      for (const [ax, ay] of artLine(
        tip.x,
        tip.y,
        tip.x - ux * 10 + side * uy * 10,
        tip.y - uy * 10 - side * ux * 10
      )) {
        if (fade <= 0.4 && (ax + ay) % 2 !== 0) continue;
        artPixel(ctx, ax, ay + 1, OUTLINE);
        artPixel(ctx, ax, ay, '#f5f5f4');
      }
  }
}

/** A row of teeth for Bite's jaws: art pixels across, the fangs longer. */
const BITE_TEETH = [2, 1, 1, 1, 2];

/**
 * Bite: jaws snap shut on the unit, the upper and lower rows of teeth
 * closing from above and below, then a flash where they meet.
 */
function drawBite(ctx: CanvasRenderingContext2D, {target, k}: EffectFrame): void {
  const c = center(target);
  const fade = fadeOut(k, 0.6);
  if (fade <= 0) return;
  const [ox, oy] = artCell(c.x, c.y - 14);
  // Open wide, then snapped shut by 0.35, a jolt as they close.
  const close = Math.min(1, k / 0.35);
  const gap = Math.round((1 - close * close) * 9);
  const keep = (x: number, y: number) => fade > 0.4 || (x + y) % 2 === 0;
  const half = BITE_TEETH.length;
  for (const dir of [-1, 1]) {
    const gumY = oy + dir * (gap + 3);
    // The jaw's gum line, its ends curving round to the other jaw's, as a mouth's.
    for (let x = -half * 2; x <= half * 2; x++) {
      const y = gumY - dir * Math.round((x * x) / 30);
      if (!keep(ox + x, y)) continue;
      artPixel(ctx, ox + x, y + dir, OUTLINE);
      artPixel(ctx, ox + x, y, '#b0402e');
    }
    // Its teeth, pointing at the other jaw.
    BITE_TEETH.forEach((len, i) => {
      for (const side of [-1, 1]) {
        const x = side * (i * 2 + 1);
        const base = gumY - dir * Math.round((x * x) / 30);
        for (let j = 1; j <= len; j++) {
          const y = base - dir * j;
          if (keep(ox + x, y)) artPixel(ctx, ox + x, y, j === len ? '#e5e7eb' : '#ffffff');
        }
      }
    });
  }
  // The snap: a burst of red where they meet.
  if (close >= 1 && k < 0.6)
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const d = 6 + Math.round(((k - 0.35) / 0.25) * 6);
      const [bx, by] = artCell(c.x + Math.cos(a) * d * 2, c.y - 14 + Math.sin(a) * d);
      artPixel(ctx, bx, by, i % 2 ? '#f2a48e' : '#ffffff');
    }
}

/** The Cyclops's club: dark wood, its grain, and the knots studding its head. */
const CLUB = {wood: '#7c4a21', grain: '#a0662f', knot: '#5a3417'};

/**
 * Chevrons over each of `area`'s spaces but `from`'s own, driving outward
 * from `from` (Stomp's, the Boulder's Push), `t` 0 to 1 along their run.
 */
function drawPushChevrons(
  ctx: CanvasRenderingContext2D,
  from: Hex,
  area: Hex[],
  t: number,
  fade: number
): void {
  if (t <= 0) return;
  const c = center(from);
  for (const h of area) {
    if (h.q === from.q && h.r === from.r) continue;
    const n = center(h);
    const len = Math.hypot(n.x - c.x, n.y - c.y) || 1;
    const ux = (n.x - c.x) / len;
    const uy = (n.y - c.y) / len;
    const tip = {x: n.x + ux * (t * 18 - 6), y: n.y + uy * (t * 18 - 6) - 10};
    for (const side of [1, -1])
      for (const [ax, ay] of artLine(
        tip.x,
        tip.y,
        tip.x - ux * 10 + side * uy * 10,
        tip.y - uy * 10 - side * ux * 10
      )) {
        if (fade <= 0.4 && (ax + ay) % 2 !== 0) continue;
        artPixel(ctx, ax, ay + 1, OUTLINE);
        artPixel(ctx, ax, ay, '#f5f5f4');
      }
  }
}

/** A flat ring of dust spreading over the ground round (x, y), `rx` wide. */
function drawDustRing(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  rx: number,
  fade: number
): void {
  for (let i = 0; i < 28; i++) {
    const a = (i / 28) * Math.PI * 2;
    const [ax, ay] = artCell(x + Math.cos(a) * rx, y + Math.sin(a) * rx * 0.55);
    if (fade <= 0.4 && (ax + ay) % 2 !== 0) continue;
    artPixel(ctx, ax, ay, i % 3 === 0 ? '#efdcbc' : '#d4b483');
    artPixel(ctx, ax, ay - 1, '#8c7350');
  }
}

/**
 * Smash: the Cyclops's knotted club swings up and over and comes
 * down on the unit, a starburst where it lands, then a puff of dust round
 * the unit's feet and chips of earth flying.
 */
function drawSmash(ctx: CanvasRenderingContext2D, {from, target, k}: EffectFrame): void {
  if (!from) return;
  const a = center(from);
  const b = center(target);
  const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  const ux = (b.x - a.x) / len;
  const fade = fadeOut(k, 0.7);
  if (fade <= 0) return;
  // The swing, until it lands at 0.35: the club turns about the giant's
  // shoulder from raised behind it to down on the unit's head.
  if (k < 0.45) {
    const pivot = {x: lerp(a.x, b.x, 0.3), y: lerp(a.y, b.y, 0.3) - 34};
    const head = {x: b.x, y: b.y - 16};
    const down = Math.atan2(head.y - pivot.y, head.x - pivot.x);
    // Raised: back over the shoulder, away from the unit.
    const raised = -Math.PI / 2 - Math.sign(ux || 1) * 0.9;
    const swing = Math.min(1, k / 0.35);
    const angle = lerp(raised, down, swing * swing);
    const reach = Math.hypot(head.x - pivot.x, head.y - pivot.y);
    const tip = {x: pivot.x + Math.cos(angle) * reach, y: pivot.y + Math.sin(angle) * reach};
    const grip = {x: lerp(pivot.x, tip.x, 0.25), y: lerp(pivot.y, tip.y, 0.25)};
    // A blur of where it has been, just before it lands.
    if (swing > 0.5 && swing < 1)
      for (const back of [0.18, 0.32]) {
        const ba = lerp(raised, down, Math.max(0, swing - back) ** 2);
        for (const [cx, cy] of artLine(
          pivot.x + Math.cos(ba) * reach * 0.7,
          pivot.y + Math.sin(ba) * reach * 0.7,
          pivot.x + Math.cos(ba) * reach,
          pivot.y + Math.sin(ba) * reach
        ))
          if ((cx + cy) % 2 === 0) artPixel(ctx, cx, cy, '#f5f5f4');
      }
    // The shaft, thickening to its head, outlined.
    const cells = artLine(grip.x, grip.y, tip.x, tip.y);
    cells.forEach(([cx, cy], i) => {
      const w = i < cells.length * 0.4 ? 1 : i < cells.length * 0.75 ? 2 : 3;
      for (let dx = -w; dx <= w; dx++)
        for (let dy = -w; dy <= w; dy++) {
          const edge = Math.abs(dx) === w || Math.abs(dy) === w;
          artPixel(ctx, cx + dx, cy + dy, edge ? OUTLINE : i % 3 ? CLUB.wood : CLUB.grain);
        }
    });
    // The knots studding its head.
    const [hx, hy] = artCell(tip.x, tip.y);
    for (const [dx, dy] of [
      [-4, -1],
      [2, -4],
      [4, 2],
      [-1, 4],
    ] as const) {
      artPixel(ctx, hx + dx, hy + dy, OUTLINE);
      artPixel(ctx, hx + Math.sign(dx) * (Math.abs(dx) - 1), hy + dy, CLUB.knot);
    }
  }
  // The blow lands: a starburst over the unit's head.
  if (k >= 0.33 && k < 0.6) {
    const t = (k - 0.33) / 0.27;
    const [cx, cy] = artCell(b.x, b.y - 16);
    for (let i = 0; i < 10; i++) {
      const r = (i / 10) * Math.PI * 2;
      const inner = 2 + t * 4;
      const outer = (i % 2 ? 6 : 10) + t * 4;
      for (let d = inner; d <= outer; d++)
        artPixel(
          ctx,
          cx + Math.round(Math.cos(r) * d),
          cy + Math.round(Math.sin(r) * d * 0.8),
          d > outer - 2 ? '#fde047' : '#ffffff'
        );
    }
  }
  // Dust round its feet, and chips of earth thrown up.
  if (k >= 0.35) {
    const t = Math.min(1, (k - 0.35) / 0.4);
    drawDustRing(ctx, b.x, b.y + 8, 10 + t * 22, fade);
    const next = hexRandom(target, 23);
    for (let i = 0; i < 6; i++) {
      const dir = (next() - 0.5) * 2.4;
      const speed = 14 + next() * 14;
      const x = b.x + Math.sin(dir) * speed * t;
      const y = b.y + 8 - Math.cos(dir) * speed * t * 1.4 + 40 * t * t;
      if (fade > 0.4 || i % 2 === 0) artPixel(ctx, ...artCell(x, y), i % 2 ? '#8c7350' : '#5b4c68');
    }
  }
}

/** The Boulder: its flight's top, by the distance thrown, and its radius, in art pixels. */
const BOULDER = {arc: 0.45, minArc: 26, maxArc: 70, r: 6};
/** The share of the Boulder's playback spent in the air. */
const BOULDER_FLIGHT = 0.5;

/** A rough grey boulder, `r` art pixels round, centred on art cell (cx, cy), its light turning with `spin`. */
function drawRock(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, spin: number) {
  const lx = Math.round(Math.cos(spin) * r * 0.5);
  const ly = Math.round(Math.sin(spin) * r * 0.5);
  for (let dx = -r - 1; dx <= r + 1; dx++)
    for (let dy = -r - 1; dy <= r + 1; dy++) {
      const d = Math.hypot(dx, dy * 1.1);
      if (d > r + 0.6) continue;
      let color = d > r - 0.4 ? OUTLINE : '#7d8288';
      if (color !== OUTLINE) {
        if (Math.hypot(dx + lx, dy + ly) < r * 0.5) color = '#b8bcc1';
        else if (Math.hypot(dx - lx, dy - ly) < r * 0.6) color = '#5c6066';
      }
      artPixel(ctx, cx + dx, cy + dy, color);
    }
}

/**
 * Boulder: the Cyclops heaves a boulder, which turns over as it
 * arcs down the lane, its shadow running along the ground beneath, and
 * lands on the unit: it shatters into chips, a ring of dust bursts out,
 * and chevrons drive over the spaces round it, the way the units there are
 * Pushed.
 */
function drawBoulder(ctx: CanvasRenderingContext2D, {from, target, area, k}: EffectFrame): void {
  const a = from ? center(from) : center(target);
  const b = center(target);
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  if (k < BOULDER_FLIGHT) {
    const t = k / BOULDER_FLIGHT;
    const top = Math.min(BOULDER.maxArc, Math.max(BOULDER.minArc, len * BOULDER.arc));
    const x = lerp(a.x, b.x, t);
    const ground = lerp(a.y, b.y, t);
    // Its shadow, dithered, smaller the higher it flies.
    const lift = Math.sin(Math.PI * t) * top;
    const [sx, sy] = artCell(x, ground + 6);
    const sr = Math.max(1, Math.round(BOULDER.r * (1 - (lift / top) * 0.5)));
    for (let dx = -sr; dx <= sr; dx++)
      if ((sx + dx + sy) % 2 === 0) artPixel(ctx, sx + dx, sy, '#3b3226');
    // Out of the giant's hand above its head, over to the unit's.
    const [cx, cy] = artCell(x, ground - 24 - lift);
    drawRock(ctx, cx, cy, BOULDER.r, t * Math.PI * 3);
    return;
  }
  const t = (k - BOULDER_FLIGHT) / (1 - BOULDER_FLIGHT);
  const fade = fadeOut(t, 0.6);
  if (fade <= 0) return;
  // The impact: a flash, the boulder squashed on the unit for a moment.
  const [cx, cy] = artCell(b.x, b.y - 16);
  if (t < 0.15) drawRock(ctx, cx, cy + 1, BOULDER.r, 0);
  if (t < 0.3)
    for (let i = 0; i < 8; i++) {
      const r = (i / 8) * Math.PI * 2;
      for (let d = 3; d <= 7 + t * 10; d++)
        artPixel(
          ctx,
          cx + Math.round(Math.cos(r) * d),
          cy + Math.round(Math.sin(r) * d * 0.8),
          d % 3 ? '#ffffff' : '#fde047'
        );
    }
  // It shatters: chips arcing out and falling.
  const next = hexRandom(target, 29);
  for (let i = 0; i < 9; i++) {
    const dir = (i / 9) * Math.PI * 2 + next() * 0.5;
    const speed = 22 + next() * 16;
    const x = b.x + Math.cos(dir) * speed * t;
    const y = b.y - 16 + Math.sin(dir) * speed * t * 0.6 - 30 * t + 60 * t * t;
    const [px, py] = artCell(x, y);
    if (fade <= 0.4 && i % 2) continue;
    artPixel(ctx, px, py, OUTLINE);
    artPixel(ctx, px + 1, py, i % 3 ? '#7d8288' : '#b8bcc1');
    if (i % 2 === 0) artPixel(ctx, px, py - 1, '#5c6066');
  }
  // Dust bursting out over the ground, and the Push round where it landed.
  drawDustRing(ctx, b.x, b.y + 8, 14 + Math.min(1, t / 0.6) * 40, fade);
  drawPushChevrons(ctx, target, area, Math.min(1, t / 0.5), fade);
}

/**
 * A Volley in the air, on the board until it lands: its space ringed in
 * the archer's colour, dashed, with arrows hanging above it, pointing down.
 */
/**
 * Where a Priest's Invocation will land (`ShotInAir.ability`): a dashed ring
 * on each space of its area, in his side's light colour, and a small cross
 * of light over its centre.
 */
export function drawInvocationMark(
  ctx: CanvasRenderingContext2D,
  centre: Hex,
  area: Hex[],
  color: string
): void {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.setLineDash([4, 5]);
  for (const h of area) {
    const c = center(h);
    ctx.beginPath();
    ctx.ellipse(c.x, c.y + 6, 22, 13, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
  const c = center(centre);
  ctx.fillStyle = color;
  ctx.fillRect(c.x - 2, c.y - 44, 4, 16);
  ctx.fillRect(c.x - 7, c.y - 40, 14, 4);
}

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
