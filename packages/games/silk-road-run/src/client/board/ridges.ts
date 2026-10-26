/**
 * The Flaming Mountains' ridges (owner, 2026-10-26): not a sprite per hex
 * but one landform per clump, so neighbouring mountains join into a
 * continuous ridge. A crest runs through the centres of each clump's
 * mountains that stand side by side (in neighbouring columns), never
 * between two in one column, which would run the ridge into the screen;
 * two columns can't make a loop. A crest's loose end runs on a little,
 * east or west away from its neighbour, so it tapers to the plain; a lone
 * mountain gets a short ridge of its own. Mountains one above the other
 * stand as parallel ridges, one behind the other, as a range seen from the
 * front.
 *
 * Each ridge is a height field over the ground, drawn in art pixels from
 * the back of the board to the front, each ground point raised by its
 * height, so nearer slopes hide farther ones: straight, slightly hollow
 * slopes to a sharp, jagged crest, V-shaped gullies running down them
 * (the real mountains' erosion, which makes them look like flames) and a
 * darker band of strata every few pixels of height, shaded from the upper
 * left in the owner's ridge's red sandstone (AI-assisted art, of which the
 * colours are kept). It's drawn once per layout and cached; the fire along
 * the crests is drawn over it each frame (`drawRidges`).
 */
import {hexKey} from '@canvas/engine';
import type {Hex} from '@canvas/engine';
import {tileAt} from '../../rules/map';
import type {MapData} from '../../rules/map';
import {SCENE_SIZE} from '../layout';
import {FLAME_FPS} from './ground';
import {SPRITE_SCALE, center} from './pixels';

/** The rock's shades, darkest first: the owner's ridge's. */
const RAMP = ['#3e2017', '#4e281b', '#5f2d20', '#7f3e26', '#a2532f', '#c36b38', '#dc8941'];
/** The crest's outline: the darkest rock, not ink, so it sits in the ground. */
const OUTLINE = '#341c14';
/** The fire, from its root up: the crest glowing, then the flames. */
const FIRE = {glow: '#c83a1c', root: '#ec6a1e', body: '#f8a432', tip: '#ffdc64', ember: '#a8281a'};

/** A ridge's reach either side of its crest, its crest's height, how far a loose end runs on, in art pixels. */
const RIDGE = {halfWidth: 12, height: 21, endRun: 12};

interface Segment {
  ax: number;
  ay: number;
  bx: number;
  by: number;
  length: number;
  /** Distance to a loose end from `a`, before it and after `b` (0 at a loose end, else none), for tapering. */
  before: number;
  after: number;
}

/** A crest pixel the fire burns on: its column, its top row, its distance along the crest. */
interface Crest {
  x: number;
  y: number;
  u: number;
}

const art = (h: Hex) => {
  const c = center(h);
  return {x: c.x / SPRITE_SCALE, y: c.y / SPRITE_SCALE};
};

/** A smooth wobble along a crest, about −1 to 1, from three sines. */
const wobble = (u: number, seed: number) =>
  Math.sin(u * 0.21 + seed) * 0.5 +
  Math.sin(u * 0.53 + seed * 2.1) * 0.3 +
  Math.sin(u * 1.3 + seed * 0.7) * 0.2;

/** The board's mountains' crests, as segments in art pixels (see the file's comment). */
function crests(map: MapData): Segment[] {
  const mountains = map.hexes.filter((h) => tileAt(map, h) === 'mountain');
  const isMountain = new Set(mountains.map(hexKey));
  const sideBy = (h: Hex) =>
    [
      {q: h.q + 1, r: h.r},
      {q: h.q + 1, r: h.r - 1},
      {q: h.q - 1, r: h.r},
      {q: h.q - 1, r: h.r + 1},
    ].filter((n) => isMountain.has(hexKey(n)));
  const raw: [number, number, number, number][] = [];
  for (const m of mountains) {
    const c = art(m);
    const side = sideBy(m);
    for (const n of side)
      if (n.q > m.q) {
        const d = art(n);
        raw.push([c.x, c.y, d.x, d.y]);
      }
    if (side.length === 0) raw.push([c.x - RIDGE.endRun, c.y, c.x + RIDGE.endRun, c.y]);
    else if (side.length === 1) {
      const run = side[0]!.q < m.q ? RIDGE.endRun : -RIDGE.endRun;
      raw.push(run > 0 ? [c.x, c.y, c.x + run, c.y] : [c.x + run, c.y, c.x, c.y]);
    }
  }
  const out = raw.map(([ax, ay, bx, by]) => ({
    ax,
    ay,
    bx,
    by,
    length: Math.hypot(bx - ax, by - ay),
    before: Infinity,
    after: Infinity,
  }));
  // A segment's end that meets no other is a loose end: it tapers.
  const meets = (x: number, y: number, self: Segment) =>
    out.some(
      (o) =>
        o !== self && (Math.hypot(o.ax - x, o.ay - y) < 0.5 || Math.hypot(o.bx - x, o.by - y) < 0.5)
    );
  for (const s of out) {
    if (!meets(s.ax, s.ay, s)) s.before = 0;
    if (!meets(s.bx, s.by, s)) s.after = 0;
  }
  return out;
}

/**
 * The ridges' height at a ground point, and where along the crests it is
 * (`u`, from the nearest crest point's place on the board: the crests run
 * mostly east-west, and two segments meeting give their meeting point one
 * place, so a joined ridge's skyline and gullies run on across the joint).
 */
function heightAt(segments: Segment[], x: number, y: number): {h: number; u: number; d: number} {
  let best = {d: Infinity, u: 0, end: Infinity};
  for (const s of segments) {
    const dx = s.bx - s.ax;
    const dy = s.by - s.ay;
    const t = Math.max(0, Math.min(1, ((x - s.ax) * dx + (y - s.ay) * dy) / (dx * dx + dy * dy)));
    const d = Math.hypot(x - s.ax - t * dx, y - s.ay - t * dy);
    if (d < best.d) {
      const along = t * s.length;
      const cx = s.ax + t * dx;
      const cy = s.ay + t * dy;
      best = {d, u: cx + 0.35 * cy, end: Math.min(s.before + along, s.after + s.length - along)};
    }
  }
  const {d, u, end} = best;
  if (d >= RIDGE.halfWidth) return {h: 0, u, d};
  const k = d / RIDGE.halfWidth;
  // A jagged skyline, peaks and saddles, sloping down at a loose end.
  let crest = RIDGE.height * (0.78 + 0.14 * wobble(u, 1) + 0.08 * Math.abs(Math.sin(u * 0.45)));
  const taper = (end + 4) / 14;
  if (taper < 1) crest *= Math.max(0.25, taper);
  let h = crest * (1 - k) ** 1.25;
  // Gullies: V-shaped cuts every few pixels, deepest midway down.
  const f = (((u / 5.5 + 0.6 * wobble(u * 0.4, 4)) % 1) + 1) % 1;
  const gully = Math.max(0, 1 - Math.abs(f - 0.5) * 5);
  h -= gully * 3.5 * Math.min(1, k * 2.5) * (1 - k);
  return {h: Math.max(0, h), u, d};
}

/** The rock as last drawn, and the crest the fire burns on. */
let cache: {key: string; canvas: HTMLCanvasElement; crest: Crest[]} | null = null;

function drawRock(map: MapData): {canvas: HTMLCanvasElement; crest: Crest[]} {
  const segments = crests(map);
  const width = Math.ceil(SCENE_SIZE.width / SPRITE_SCALE);
  const height = Math.ceil(SCENE_SIZE.height / SPRITE_SCALE);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const crest: Crest[] = [];
  if (!segments.length) return {canvas, crest};
  const pad = RIDGE.halfWidth + 2;
  const x0 = Math.max(1, Math.floor(Math.min(...segments.flatMap((s) => [s.ax, s.bx])) - pad));
  const x1 = Math.min(
    width - 2,
    Math.ceil(Math.max(...segments.flatMap((s) => [s.ax, s.bx])) + pad)
  );
  const y0 = Math.max(1, Math.floor(Math.min(...segments.flatMap((s) => [s.ay, s.by])) - pad));
  const y1 = Math.min(
    height - 2,
    Math.ceil(Math.max(...segments.flatMap((s) => [s.ay, s.by])) + pad)
  );
  const w = x1 - x0 + 3;
  const field = new Float32Array(w * (y1 - y0 + 3));
  const at = (x: number, y: number) => field[(y - y0 + 1) * w + (x - x0 + 1)] ?? 0;
  const near = new Map<number, {u: number; d: number}>();
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const p = heightAt(segments, x, y);
      field[(y - y0 + 1) * w + (x - x0 + 1)] = p.h;
      near.set(y * width + x, p);
    }
  const g = canvas.getContext('2d')!;
  const top = new Map<number, {y: number; u: number; crest: boolean}>();
  // Back to front, so nearer slopes paint over farther ones.
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const h = at(x, y);
      if (h < 0.6) continue;
      const gx = at(x + 1, y) - at(x - 1, y);
      const gy = at(x, y + 1) - at(x, y - 1);
      // Lit from the upper left and a little in front; strata every 5 pixels up.
      let light = 0.5 - 0.11 * gx + 0.06 * gy + 0.012 * h;
      if (Math.floor(h) % 5 === 4) light -= 0.13;
      let shade = Math.max(0, Math.min(RAMP.length - 1, Math.floor(light * RAMP.length)));
      // Dark earth at the foot.
      if (h < 1.6) shade = Math.min(shade, 2);
      const t = y - Math.round(h);
      g.fillStyle = RAMP[shade]!;
      g.fillRect(x, t, 1, y - t + 1);
      const p = near.get(y * width + x)!;
      const seen = top.get(x);
      if (!seen || t <= seen.y) top.set(x, {y: t, u: p.u, crest: p.d < 1.5 && h > 5});
    }
  g.fillStyle = OUTLINE;
  for (const [x, {y, u, crest: onCrest}] of top) {
    g.fillRect(x, y - 1, 1, 1);
    if (onCrest) crest.push({x, y: y - 1, u});
  }
  return {canvas, crest};
}

/** A number in [0, 1) from a crest pixel and a frame, for the fire's flicker. */
const hash = (a: number, b: number) => {
  const n = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453;
  return n - Math.floor(n);
};

/**
 * The ridges, in front of the units, with their fire: flames 1 to 6
 * pixels tall along every crest, rising and falling in waves that run
 * along it, taller tongues flaring out of step, sparks above the tips and
 * embers rising off it. Only the fire moves; held on its first frame for
 * reduced motion (`time` null).
 */
export function drawRidges(ctx: CanvasRenderingContext2D, map: MapData, time: number | null): void {
  if (typeof document === 'undefined') return;
  const key = `${map.id}|${map.hexes
    .filter((h) => tileAt(map, h) === 'mountain')
    .map(hexKey)
    .join(' ')}`;
  if (cache?.key !== key) cache = {key, ...drawRock(map)};
  const px = SPRITE_SCALE;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(cache.canvas, 0, 0, cache.canvas.width * px, cache.canvas.height * px);
  const f = time === null ? 0 : Math.floor(time * FLAME_FPS);
  const dot = (x: number, y: number, colour: string) => {
    ctx.fillStyle = colour;
    ctx.fillRect(x * px, y * px, px, px);
  };
  for (const {x, y, u} of cache.crest) {
    const wave = 0.5 + 0.5 * Math.sin(u * 0.5 - f * 1.2);
    const tongue = Math.floor(u) % 6 < 2 ? 3 * Math.max(0, Math.sin(f * 1.9 + u * 3.1)) : 0;
    const tall = Math.round(1 + 2.5 * wave + tongue);
    dot(x, y + 1, FIRE.glow);
    for (let k = 0; k < tall; k++)
      dot(x, y - k, k === tall - 1 ? FIRE.tip : k === 0 ? FIRE.root : FIRE.body);
    if (hash(x, f) < 0.08) dot(x, y - tall - 1, FIRE.body);
  }
  // Embers: one in every 12 crest pixels, each rising out of step.
  for (let i = 0; i < cache.crest.length; i += 12) {
    const {x, y} = cache.crest[i]!;
    const t = (f + i * 3) % 10;
    if (t < 7) dot(x + Math.floor(t / 3), y - 3 - t, t < 4 ? FIRE.body : FIRE.ember);
  }
  ctx.restore();
}
