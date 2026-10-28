/**
 * Abilities' effects as a turn plays back (Sunlight's beam, Gale's gusts,
 * a Volley's arrows falling, Shove's blow, Haul's rope, Cleave's swing,
 * Swift Strike's thrust, Elixir's flask, Omen's clock, Stomp's quake,
 * Bite's jaws; Snap Shot's and Feigned Retreat's arrows are drawn by the
 * playback, Hail's stones and Grapple's fists by the board).
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
  cleave: drawCleave,
  swiftStrike: drawSwiftStrike,
  elixir: drawElixir,
  omen: drawOmen,
  stomp: drawStomp,
  bite: drawBite,
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
