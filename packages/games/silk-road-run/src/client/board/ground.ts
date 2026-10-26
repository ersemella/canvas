/**
 * The ground under everything, in each map's look (`LOOKS`): the Steppe's
 * grass, yurts and their smoke, the Gobi's sand and sandstone ruins, the
 * Flaming Mountains' red earth and burning mountains; exits
 * (cached per map), and falling hail.
 */
import {assetLoader, hexKey} from '@canvas/engine';
import type {Hex} from '@canvas/engine';
import {tileAt} from '../../rules/map';
import type {MapData, Tile} from '../../rules/map';
import {BOARD_LAYOUT, SCENE_SIZE} from '../layout';
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
import yurtImage from '../tiles/yurt.png';
import sandstoneRuinsImage from '../tiles/ruins-sandstone.png';
import sandImage from '../tiles/sand.png';
import mountainPeakImage from '../tiles/mountain-peak.png';
import mountainTwinImage from '../tiles/mountain-twin.png';
import rockImage from '../tiles/rock.png';
import redRockImage from '../tiles/rock-red.png';
import grassImage from '../tiles/grass-soft.png';
import redEarthImage from '../tiles/red-earth.png';
import mudbrickRuinsImage from '../tiles/ruins.png';
import burningMountainImage from '../tiles/mountain-burning.png';
import burningMirroredImage from '../tiles/mountain-burning-mirrored.png';

/** How a map looks (map.ts): its open ground, what its `obstacle` tile is and whether that smokes, and its mountains. */
export interface Look {
  /** The open ground's texture; yurts and ruins stand on it, mountains on `mountainGround`. */
  ground: string;
  /**
   * Laid across the board as one field (`fillHexTexture`, a seamless
   * tile), or stamped centred on each hex, mirrored on alternate hexes so
   * the board doesn't repeat (`stampHex`, a 42 × 42 hex-sized image).
   */
  stamp: boolean;
  /** The ground's colour until its texture loads. */
  colour: string;
  /** Every hex's border: a shade darker than the ground. */
  border: string;
  /** The `obstacle` tile's art; each hex picks one. */
  obstacles: string[];
  /** Smoke rises from each obstacle's crown (a yurt's). */
  smoke: boolean;
  /** The mountains' shapes, each hex picking one. */
  mountains: string[];
  /**
   * How many frames each mountain image holds, side by side, 42 pixels
   * wide each, looping at `FLAME_FPS`: 1, a still image, but for the
   * Flaming Mountains' fire.
   */
  mountainFrames: number;
  /** The ground under a mountain, a seamless tile laid like the grass. */
  mountainGround: string;
}

/**
 * The mountains' shapes, a single peak and a twin (owner, 2026-10-24),
 * each hex picking one. Drawn for the hex: 42 pixels wide, its base the
 * hex's lower half, standing on the hex's bottom edge, the peak rising
 * into the space above (`mountainClip` keeps the base inside the hex).
 */
const STEPPE_MOUNTAINS = [mountainPeakImage, mountainTwinImage];

/**
 * The Flaming Mountains' (owner, 2026-10-26): the owner's burning mountain
 * (AI-assisted), red rock cliffs with flames running up the ridges, drawn
 * as one image with the fire in it, shrunk to the hex's 42 pixels (42 ×
 * 48), its rock cut to 5 colours with an ink outline and its fire to 4,
 * each pixel taken as rock or fire by what most of it was, its rock taken
 * halfway to the red earth's browns and its outline's lower half dark
 * earth, so it sits in the ground (owner, 2026-10-26); and the same
 * mirrored, each hex picking one. Its base, drawn as a diamond, is warped
 * to the hex's lower half, flat along its bottom edge and out to its side
 * corners, its edges dark earth, so it fills its space. Its fire burns in
 * 8 frames (`mountainFrames`): only the flames above the base change, a
 * brightness rising up them, their tips flickering and embers rising from
 * the peak, while the rock and the glowing cracks low on it hold still,
 * so the mountain itself never moves (2026-10-26; frames that redrew the
 * rock made mountains look as if they shook). It took the place of red
 * sandstone ridges with flames added on their crests, which looked off.
 */
const FLAMING_MOUNTAINS = [burningMountainImage, burningMirroredImage];

/**
 * The Steppe's grass (owner, 2026-10-24) is the owner's `grass.png`
 * softened: its blotches at 60% of their contrast and a touch greener,
 * since at full strength it read as mud on a phone. The Gobi (2026-10-25)
 * brings back the desert board's art from before the Steppe: the sand
 * stamped per hex and the crumbling sandstone ruin, as they were
 * (2026-10-22), in place of the yurts. The Flaming Mountains (owner,
 * 2026-10-26): the owner's cracked red earth (AI-assisted, cut to 128
 * pixels and 5 colours); under the mountains, the Steppe's rock in the
 * burning mountain's browns (`rock-red.png`). Its fights have no
 * obstacles for now (map.ts); the mudbrick wall drawn for the Steppe
 * (`ruins.png`) stands in for one placed by hand on the test stage.
 */
const LOOKS: Record<string, Look> = {
  steppe: {
    ground: grassImage,
    stamp: false,
    colour: '#8e9858',
    border: '#3f4a27',
    obstacles: [yurtImage],
    smoke: true,
    mountains: STEPPE_MOUNTAINS,
    mountainFrames: 1,
    mountainGround: rockImage,
  },
  gobi: {
    ground: sandImage,
    stamp: true,
    colour: PALETTE.sand,
    border: PALETTE.sandDark,
    obstacles: [sandstoneRuinsImage],
    smoke: false,
    mountains: STEPPE_MOUNTAINS,
    mountainFrames: 1,
    mountainGround: rockImage,
  },
  flaming: {
    ground: redEarthImage,
    stamp: false,
    colour: '#97633c',
    border: '#5c3a26',
    obstacles: [mudbrickRuinsImage],
    smoke: false,
    mountains: FLAMING_MOUNTAINS,
    mountainFrames: 8,
    // The Steppe's rock in the burning mountain's own browns, so the
    // corners of its hex beside the peak read as the mountain's (owner,
    // 2026-10-26); on the red earth, they looked left unfilled.
    mountainGround: redRockImage,
  },
};

/** A map's look; the Steppe's for a map without one of its own. */
export function lookOf(map: MapData): Look {
  return LOOKS[map.id] ?? LOOKS.steppe!;
}

/** Whether a map's obstacles smoke, so the board keeps drawing frames for it. */
export const smokes = (map: MapData): boolean => lookOf(map).smoke;

/** Whether a map's mountains burn (move), so the board keeps drawing frames for it. */
export const burns = (map: MapData): boolean => lookOf(map).mountainFrames > 1;

/** The Flaming Mountains' fire, in frames a second (owner, 2026-10-26). */
export const FLAME_FPS = 8;

/** A tile's ground texture on a map: the map's open ground, or its mountains' ground under one (rock, owner, 2026-10-24). */
const textureOf = (look: Look, tile: Tile): string =>
  tile === 'mountain' ? look.mountainGround : look.ground;

/**
 * Fills a hex with a seamless pixel-art texture at the sprites' scale,
 * laid across the whole board from its origin rather than per hex, so
 * neighbouring hexes join up into one field. Each texture pixel is
 * rounded to a whole number of canvas pixels: at an uneven scale (a
 * phone's) they'd otherwise come out in mixed widths and the grass looks
 * muddy.
 */
function fillHexTexture(ctx: CanvasRenderingContext2D, h: Hex, img: HTMLImageElement): void {
  const pattern = ctx.createPattern(img, 'repeat');
  if (!pattern) return;
  const scale = ctx.getTransform().a;
  pattern.setTransform(
    new DOMMatrix().scale(Math.max(1, Math.round(SPRITE_SCALE * scale)) / scale)
  );
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  hexPath(ctx, h, 0);
  ctx.fillStyle = pattern;
  ctx.fill();
  ctx.restore();
}

/**
 * A hex-sized pixel-art image (42 × 42) clipped to a hex at the sprites'
 * scale, centred on it, mirrored when `flipX`.
 */
function stampHex(
  ctx: CanvasRenderingContext2D,
  h: Hex,
  img: HTMLImageElement,
  flipX: boolean
): void {
  const c = center(h);
  const size = img.height * SPRITE_SCALE;
  ctx.save();
  hexPath(ctx, h, 0);
  ctx.clip();
  ctx.imageSmoothingEnabled = false;
  ctx.translate(Math.round(c.x), Math.round(c.y));
  if (flipX) ctx.scale(-1, 1);
  ctx.drawImage(img, -size / 2, -size / 2, size, size);
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
  const look = lookOf(map);
  if (typeof document === 'undefined') {
    for (const h of map.hexes) drawTile(ctx, h, tileAt(map, h), look);
    return;
  }
  let mapKey = mapKeys.get(map);
  if (mapKey === undefined) {
    mapKey = `${map.id}|${map.hexes.map((h) => `${hexKey(h)}:${tileAt(map, h)}`).join(' ')}`;
    mapKeys.set(map, mapKey);
  }
  const loaded = [look.ground, look.mountainGround]
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
    for (const h of map.hexes) drawTile(g, h, tileAt(map, h), look);
    ground = {canvas, key};
  }
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(ground.canvas, 0, 0, ground.canvas.width / scale, ground.canvas.height / scale);
  ctx.restore();
}

/**
 * A tile's ground in the map's look: its texture, one field across the
 * board or stamped per hex, and its border. Until the image loads, the
 * look's flat colour shows. Yurts, ruins and mountains stand on it and are
 * drawn later, by `drawObstacle`.
 */
function drawTile(ctx: CanvasRenderingContext2D, h: Hex, tile: Tile, look: Look): void {
  const ground = assetLoader.requestImage(textureOf(look, tile));
  if (ground) {
    if (look.stamp && tile !== 'mountain') stampHex(ctx, h, ground, (h.q * 7 + h.r * 13) % 2 !== 0);
    else fillHexTexture(ctx, h, ground);
    ctx.save();
    hexPath(ctx, h, 0.5);
    ctx.strokeStyle = look.border;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  } else {
    // Until the textures load: the look's plain ground.
    ctx.save();
    hexPath(ctx, h, 0.5);
    ctx.fillStyle = look.colour;
    ctx.fill();
    ctx.strokeStyle = look.border;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  }
}

/**
 * The exit's chevrons bounce off the board together: they push out a few
 * art pixels towards the edge and back.
 */
const EXIT_ARROW = {push: 3, seconds: 1.1};

/** How far the exit's chevrons have pushed out at a time, in whole art pixels. */
export function exitArrowPush(time: number): number {
  return Math.round(
    (EXIT_ARROW.push * (1 - Math.cos((time * 2 * Math.PI) / EXIT_ARROW.seconds))) / 2
  );
}

/**
 * An exit, the road out (camel.md, 18.2): a worn ivory border and two
 * chevrons pointing down off the board's bottom point, outlined in ink
 * like the sprites. The chevrons bounce (`exitArrowPush`), unless the
 * device asks for reduced motion (`time` null).
 */
export function drawExit(ctx: CanvasRenderingContext2D, h: Hex, time: number | null = null): void {
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
  ctx.rotate(Math.PI / 2);
  ctx.lineJoin = 'miter';
  const push = time === null ? 0 : exitArrowPush(time);
  for (const at of [-6, 3]) {
    const dx = at + push;
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

/** A flat-top hex's bottom edge, below its centre. */
const MOUNTAIN_FEET = Math.floor((Math.sqrt(3) / 2) * BOARD_LAYOUT.size);

/**
 * A yurt, a ruin or a mountain standing on its hex like a unit: over hail,
 * so it always reads as blocked. The yurt (owner, 2026-10-24) is redrawn
 * from the owner's art on the sprites' grid: 32 × 24 art pixels; the
 * Gobi's sandstone ruin and the mudbrick wall are 32 × 32. `map` gives the look.
 */
export function drawObstacle(
  ctx: CanvasRenderingContext2D,
  h: Hex,
  map: MapData,
  mountain = false,
  time: number | null = null
): void {
  const look = lookOf(map);
  const images = mountain ? look.mountains : look.obstacles;
  const art = assetLoader.requestImage(images[Math.floor(hexRandom(h, 1)() * images.length)]!);
  if (!art) {
    drawObstacleMark(ctx, center(h));
    return;
  }
  // A burning mountain's frame, each hex out of step; the first held for reduced motion.
  const frames = mountain ? look.mountainFrames : 1;
  const frameWidth = art.width / frames;
  const offset = Math.floor(hexRandom(h, 3)() * frames);
  const frame = time === null ? 0 : (Math.floor(time * FLAME_FPS) + offset) % frames;
  const c = center(h);
  const width = frameWidth * SPRITE_SCALE;
  const height = art.height * SPRITE_SCALE;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  if (mountain) mountainClip(ctx, c);
  ctx.drawImage(
    art,
    frame * frameWidth,
    0,
    frameWidth,
    art.height,
    Math.round(c.x - width / 2),
    Math.round(c.y + (mountain ? MOUNTAIN_FEET : SPRITE_FEET) - height),
    width,
    height
  );
  ctx.restore();
}

/** Smoke from a yurt's crown: puffs at a time, a cycle each, in steps of this many frames a second. */
const SMOKE = {puffs: 6, seconds: 3.6, rise: 22, drift: 6};
export const SMOKE_FPS = 8;
/** The moment shown with reduced motion: a few puffs in the air. */
const SMOKE_STILL_SECONDS = 1.1;
/** The smoke hole, in art pixels from the hex's centre: the crown's middle, 2 rows down the 24-row yurt. */
const SMOKE_FROM = {x: 0, y: SPRITE_FEET / SPRITE_SCALE - 24 + 2};

/**
 * Smoke rising from a yurt's crown, as pixel art: square puffs that grow,
 * drift with the wind and fade as they rise, each yurt out of step with
 * the others. Held still at one moment when the device asks for reduced
 * motion (`time` null).
 */
export function drawYurtSmoke(ctx: CanvasRenderingContext2D, h: Hex, time: number | null): void {
  const t = Math.floor((time ?? SMOKE_STILL_SECONDS) * SMOKE_FPS) / SMOKE_FPS;
  const offset = hexRandom(h, 2)() * SMOKE.seconds;
  const c = center(h);
  const px = SPRITE_SCALE;
  ctx.save();
  for (let i = 0; i < SMOKE.puffs; i++) {
    const f = ((((t + offset) / SMOKE.seconds + i / SMOKE.puffs) % 1) + 1) % 1;
    const size = 2 + Math.floor(f * 2.5);
    const x = SMOKE_FROM.x + f * SMOKE.drift + Math.sin(f * 2 * Math.PI + i) * 1.2;
    const y = SMOKE_FROM.y - f * SMOKE.rise;
    ctx.fillStyle = `rgba(240, 236, 228, ${(0.95 * (1 - f * f)).toFixed(2)})`;
    ctx.fillRect(
      Math.round(c.x + Math.round(x - size / 2) * px),
      Math.round(c.y + Math.round(y - size / 2) * px),
      size * px,
      size * px
    );
  }
  ctx.restore();
}

/**
 * Where a mountain may draw: its base, below the hex's middle, inside the
 * hex's lower half, so it sits cleanly in its space; its peaks, above the
 * middle, free to rise and spread over the hexes beyond.
 */
function mountainClip(ctx: CanvasRenderingContext2D, c: {x: number; y: number}): void {
  const s = BOARD_LAYOUT.size;
  const h = (Math.sqrt(3) / 2) * s;
  const far = 4 * s;
  ctx.beginPath();
  ctx.moveTo(c.x - far, c.y - far);
  ctx.lineTo(c.x + far, c.y - far);
  ctx.lineTo(c.x + far, c.y);
  ctx.lineTo(c.x + s, c.y);
  ctx.lineTo(c.x + s / 2, c.y + h);
  ctx.lineTo(c.x - s / 2, c.y + h);
  ctx.lineTo(c.x - s, c.y);
  ctx.lineTo(c.x - far, c.y);
  ctx.closePath();
  ctx.clip();
}

/** A yurt, a ruin or a mountain until its image loads: stacked blocks, a shape of their own, not only a colour (art direction). */
function drawObstacleMark(ctx: CanvasRenderingContext2D, at: {x: number; y: number}): void {
  ctx.save();
  // Drawn around the origin at the size-32 scale, then scaled to the hex.
  ctx.translate(at.x, at.y);
  ctx.scale(HEX_SCALE, HEX_SCALE);
  ctx.fillStyle = '#a67c50';
  ctx.strokeStyle = '#221816';
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
