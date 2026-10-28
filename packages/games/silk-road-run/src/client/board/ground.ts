/**
 * The ground under everything, in each map's look (`LOOKS`): the Steppe's
 * grass, yurts and their smoke, the Gobi's sand and oases, the
 * Flaming Mountains' red earth, beacon towers and burning ridges, the Salt
 * Flats' salt crust and their one salt dome, and the Flaming Mountains'
 * patches of scorched ground; exits (cached per map), and
 * falling hail.
 */
import {assetLoader, hexKey} from '@canvas/engine';
import type {Hex} from '@canvas/engine';
import {DOME, tileAt} from '../../rules/map';
import type {MapData, Tile} from '../../rules/map';
import {BOARD_LAYOUT, SCENE_SIZE} from '../layout';
import {PALETTE} from '../palette';
import {
  HEX_SCALE,
  SPRITE_FEET,
  SPRITE_SCALE,
  artPixel,
  center,
  hexPath,
  hexRandom,
  insideHex,
  tintHex,
} from './pixels';
import yurtImage from '../tiles/yurt.png';
import sandstoneRuinsImage from '../tiles/ruins-sandstone.png';
import oasisImage from '../tiles/oasis.png';
import sandImage from '../tiles/sand.png';
import mountainPeakImage from '../tiles/mountain-peak.png';
import mountainTwinImage from '../tiles/mountain-twin.png';
import rockImage from '../tiles/rock.png';
import grassImage from '../tiles/grass-soft.png';
import redEarthImage from '../tiles/red-earth.png';
import burningRidgeImage from '../tiles/mountain-ridge.png';
import beaconTowerImage from '../tiles/beacon-tower.png';
import scorchedEarthImage from '../tiles/scorched-earth.png';
import saltCrustImage from '../tiles/salt-crust.png';
import saltDomeImage from '../tiles/salt-dome.png';

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
  /**
   * Smoke rising from each obstacle's top (`drawObstacleSmoke`): from a
   * yurt's crown, or a beacon tower's fire; `null`, none.
   */
  smoke: Smoke | null;
  /**
   * How many frames each obstacle image holds, side by side, looping at
   * `FLAME_FPS`: 1, a still image, but for the beacon tower's pennant, on
   * the oasis's too.
   */
  obstacleFrames: number;
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
  /**
   * Scorched ground's texture (map.ts, `scorched`), a seamless tile laid
   * like the grass on the scorched spaces; `null` on a map without it.
   */
  scorchedGround: string | null;
  /**
   * One image for all the mountains, drawn once over the Salt Flats' seven
   * spaces (`DOME`) in place of one a hex; `null` on the other maps.
   */
  dome: string | null;
}

/** An obstacle's smoke: where it rises from, in art pixels above the hex's feet, and its colour (r, g, b). */
interface Smoke {
  from: number;
  colour: string;
}

/** A flat-top hex's bottom edge, below its centre. */
const MOUNTAIN_FEET = Math.floor((Math.sqrt(3) / 2) * BOARD_LAYOUT.size);

/**
 * The mountains' shapes, a single peak and a twin (owner, 2026-10-24),
 * each hex picking one. Drawn for the hex: 42 pixels wide, its base the
 * hex's lower half, standing on the hex's bottom edge, the peak rising
 * into the space above (`mountainClip` keeps the base inside the hex).
 */
const STEPPE_MOUNTAINS = [mountainPeakImage, mountainTwinImage];

/**
 * The Flaming Mountains' (owner, 2026-10-28; none stand in its fights since
 * the same day, when scorched ground took their place): a long, low escarpment drawn
 * after the owner's photo of the real ones, so a pair standing side by
 * side reads as one ridge: a flat, toothed crest, its face cut by
 * gullies fanning down from it, each rib lit on its left and shadowed on
 * its right, and rubble mounds burying their ends at the foot, below
 * which the scorched ground under it shows through. In the scorched
 * earth's own colours, so it rises out of the scorched ground around it
 * (owner, 2026-10-28; in the red earth's, it looked out of place there).
 * Its outline is the Steppe mountains', so it fits its hex the same way.
 * Set alight as in the myth (owner, 2026-10-28): its gullies glow like
 * the scorched earth's cracks, and only the fire along its crest moves, in 8
 * frames (`mountainFrames`): flames 1 to 5 pixels tall in waves, a tongue
 * flaring every few pixels, embers rising; the rock never changes. It
 * replaced a burning ridge of two low humps (2026-10-26) and, before
 * that, a burning cone
 * (`mountain-burning.png`), which read as a volcano; then the owner's
 * ridge (AI-assisted), wider than its hex, and ridges drawn in code across
 * a clump, which were too detailed and the only thing on the board
 * spanning spaces (owner, 2026-10-26).
 */
const FLAMING_MOUNTAINS = [burningRidgeImage];

/**
 * The Steppe's grass (owner, 2026-10-24) is the owner's `grass.png`
 * softened: its blotches at 60% of their contrast and a touch greener,
 * since at full strength it read as mud on a phone. The Gobi (2026-10-25)
 * brings back the desert board's art from before the Steppe: the sand
 * stamped per hex, as it was (2026-10-22), and, in place of the yurts,
 * the crumbling sandstone ruin until an oasis took its place (owner,
 * 2026-10-28; China's map again): the owner's art (AI-assisted), a Han
 * beacon tower by a spring pool with poplars, reeds and rocks, in 4
 * frames, cut to the sprites' grid (`scripts/oasis-sheet.py`, 36 × 49 a
 * frame, so its island stays in its space): only the pennant flies and
 * the water glints, the rest one frame's; blended into the sand, more at
 * its island's foot, its outline fading to the hex borders' colour
 * there. It rises over the space behind,
 * as the tower did, and blocks as any obstacle. (The same day, before it:
 * two date palms over a pool drawn in code, then the Flaming Mountains'
 * tower composed by hand on an island.) The Flaming Mountains (owner,
 * 2026-10-26): the owner's cracked red earth (AI-assisted, cut to 128
 * pixels and 5 colours); under the mountains, the Steppe's rock in the
 * burning mountain's browns (`rock-red.png`); its obstacle a Han beacon
 * tower (owner, 2026-10-26; map.ts), from the owner's art: rammed earth
 * in reed-layered bands, in the red earth's browns a little lighter,
 * chipped, with rubble at its foot and a dark-earth outline below the
 * roof so it sits in the ground, under a watch pavilion with a grey tiled roof whose corners sweep up, red posts
 * and a red pennant, the roofline being what reads as China at a glance.
 * Redrawn by hand on the sprites' grid (38 × 46, with room for the
 * pennant, which flies in 4 frames), as shrinking the art
 * left the roof a dark blob. No smoke: it would rise from the roof.
 */
const LOOKS: Record<string, Look> = {
  steppe: {
    ground: grassImage,
    stamp: false,
    colour: '#8e9858',
    border: '#3f4a27',
    obstacles: [yurtImage],
    // The crown's middle, 2 rows down the 24-row yurt.
    smoke: {from: 22, colour: '240, 236, 228'},
    obstacleFrames: 1,
    mountains: STEPPE_MOUNTAINS,
    mountainFrames: 1,
    mountainGround: rockImage,
    scorchedGround: null,
    dome: null,
  },
  gobi: {
    ground: sandImage,
    stamp: true,
    colour: PALETTE.sand,
    border: PALETTE.sandDark,
    obstacles: [oasisImage],
    smoke: null,
    // Its beacon's pennant flies in 4 frames.
    obstacleFrames: 4,
    mountains: STEPPE_MOUNTAINS,
    mountainFrames: 1,
    mountainGround: rockImage,
    scorchedGround: null,
    dome: null,
  },
  flaming: {
    ground: redEarthImage,
    stamp: false,
    colour: '#97633c',
    border: '#5c3a26',
    obstacles: [beaconTowerImage],
    smoke: null,
    // Its pennant flies in 4 frames.
    obstacleFrames: 4,
    mountains: FLAMING_MOUNTAINS,
    mountainFrames: 8,
    // No mountains stand on it now (owner, 2026-10-28); the ridge and the
    // ground under it stay as its look's, in the scorched earth's colours
    // (the red earth from 2026-10-26, the Steppe's rock before).
    mountainGround: scorchedEarthImage,
    scorchedGround: scorchedEarthImage,
    dome: null,
  },
  // The Salt Flats (owner, 2026-10-26): the owner's salt crust and salt
  // dome (AI-assisted), cut to their own pixel grids (156 pixels and 5
  // colours, its cracks pulled 45% towards the salt, as at full contrast
  // they were as dark as the hex borders and hid them; the dome, 144
  // wide, taken to 100 by 108 and 8 colours, narrower and taller than
  // drawn so it stays within its seven spaces (124 wide at first, it
  // reached over the spaces beside them; owner, 2026-10-26), then its colours taken 60% of the way
  // to the crust's, its pinks to a dusty clay, and its outline the hex
  // borders' grey, as in the art's own whites and pinks, and with a dark
  // outline, it stood out; owner, 2026-10-26). A yurt placed there by hand
  // is the sandstone ruin; its fights have none (salt-flats.md).
  salt: {
    ground: saltCrustImage,
    stamp: false,
    colour: '#e9e1d7',
    border: '#7d7570',
    obstacles: [sandstoneRuinsImage],
    smoke: null,
    obstacleFrames: 1,
    mountains: [],
    mountainFrames: 1,
    mountainGround: saltCrustImage,
    scorchedGround: null,
    dome: saltDomeImage,
  },
};

// The Flaming Mountains with their ridges burning (map.ts, `RIDGES`): the same look.
LOOKS.ridges = LOOKS.flaming!;

/** A map's look; the Steppe's for a map without one of its own. */
export function lookOf(map: MapData): Look {
  return LOOKS[map.id] ?? LOOKS.steppe!;
}

/** Whether a map's obstacles smoke, so the board keeps drawing frames for it. */
export const smokes = (map: MapData): boolean => lookOf(map).smoke !== null;

/** Whether a map's mountains burn (move), so the board keeps drawing frames for it. */
export const burns = (map: MapData): boolean => lookOf(map).mountainFrames > 1;

/** Whether a map's obstacles move (a pennant flying), so the board keeps drawing frames for it. */
export const flies = (map: MapData): boolean => lookOf(map).obstacleFrames > 1;

/**
 * The Flaming Mountains' fire, the beacon towers' pennants (the oases' too), in frames a
 * second: 3 (owner, 2026-10-26; 8 at first, quicker than the units' idles,
 * which change every 0.6 seconds).
 */
export const FLAME_FPS = 3;

/**
 * A tile's ground texture on a map: the map's open ground, its mountains'
 * ground under one (rock, owner, 2026-10-24), or its scorched ground
 * (owner, 2026-10-28).
 */
const textureOf = (look: Look, tile: Tile): string =>
  tile === 'mountain'
    ? look.mountainGround
    : tile === 'scorched' && look.scorchedGround
      ? look.scorchedGround
      : look.ground;

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
  const loaded = [look.ground, look.mountainGround, look.scorchedGround ?? look.ground]
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
 * chevrons pointing off the board towards `out` (`pastExit`), outlined in ink
 * like the sprites. The chevrons bounce (`exitArrowPush`), unless the
 * device asks for reduced motion (`time` null).
 */
export function drawExit(
  ctx: CanvasRenderingContext2D,
  h: Hex,
  out: Hex,
  time: number | null = null
): void {
  ctx.save();
  hexPath(ctx, h, 3);
  ctx.setLineDash([4, 3]);
  ctx.strokeStyle = PALETTE.ivory;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.setLineDash([]);
  const c = center(h);
  const to = center(out);
  ctx.translate(Math.round(c.x), Math.round(c.y));
  ctx.scale(HEX_SCALE, HEX_SCALE);
  ctx.rotate(Math.atan2(to.y - c.y, to.x - c.x));
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

/**
 * A yurt, a ruin or a mountain standing on its hex like a unit: over hail,
 * so it always reads as blocked. The yurt (owner, 2026-10-24) is redrawn
 * from the owner's art on the sprites' grid: 32 × 24 art pixels; the
 * sandstone ruin and the mudbrick wall are 32 × 32, the beacon tower
 * 38 × 46, the Gobi's oasis 36 × 49. `map` gives the look.
 */
export function drawObstacle(
  ctx: CanvasRenderingContext2D,
  h: Hex,
  map: MapData,
  mountain = false,
  time: number | null = null
): void {
  const look = lookOf(map);
  if (mountain && look.dome) {
    // The dome is drawn once, from its centre space.
    if (h.q === 0 && h.r === 0) drawDome(ctx, look.dome);
    return;
  }
  const images = mountain ? look.mountains : look.obstacles;
  const art = assetLoader.requestImage(images[Math.floor(hexRandom(h, 1)() * images.length)]!);
  if (!art) {
    drawObstacleMark(ctx, center(h));
    return;
  }
  // A burning mountain's or a flying pennant's frame, each hex out of step; the first held for reduced motion.
  const frames = mountain ? look.mountainFrames : look.obstacleFrames;
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

/**
 * The Salt Flats' salt dome (owner, 2026-10-26): one image over its seven
 * spaces (`DOME`), centred on the middle one, its foot on the bottom
 * space's bottom edge. Clipped as seven mountains are (`mountainClip`):
 * inside its spaces below their middles, free above them, so it rises over
 * the spaces behind it but never covers the units in front.
 */
function drawDome(ctx: CanvasRenderingContext2D, src: string): void {
  const art = assetLoader.requestImage(src);
  const c = center({q: 0, r: 0});
  if (!art) {
    drawObstacleMark(ctx, c);
    return;
  }
  const width = art.width * SPRITE_SCALE;
  const height = art.height * SPRITE_SCALE;
  const foot = center({q: 0, r: 1}).y + MOUNTAIN_FEET;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.beginPath();
  for (const h of DOME) mountainClipPath(ctx, center(h));
  ctx.clip();
  ctx.drawImage(art, Math.round(c.x - width / 2), Math.round(foot - height), width, height);
  ctx.restore();
}

/** Smoke from a yurt's crown or a beacon's fire: puffs at a time, a cycle each, in steps of this many frames a second. */
const SMOKE = {puffs: 6, seconds: 3.6, rise: 22, drift: 6};
export const SMOKE_FPS = 8;
/** The moment shown with reduced motion: a few puffs in the air. */
const SMOKE_STILL_SECONDS = 1.1;
/**
 * Smoke rising from an obstacle's top in the map's look (`Look.smoke`), a
 * yurt's crown or a beacon tower's fire, as pixel art: square puffs that
 * grow, drift with the wind and fade as they rise, each out of step with
 * the others. Held still at one moment when the device asks for reduced
 * motion (`time` null).
 */
export function drawObstacleSmoke(
  ctx: CanvasRenderingContext2D,
  h: Hex,
  map: MapData,
  time: number | null
): void {
  const smoke = lookOf(map).smoke;
  if (!smoke) return;
  const from = {x: 0, y: SPRITE_FEET / SPRITE_SCALE - smoke.from};
  const t = Math.floor((time ?? SMOKE_STILL_SECONDS) * SMOKE_FPS) / SMOKE_FPS;
  const offset = hexRandom(h, 2)() * SMOKE.seconds;
  const c = center(h);
  const px = SPRITE_SCALE;
  ctx.save();
  for (let i = 0; i < SMOKE.puffs; i++) {
    const f = ((((t + offset) / SMOKE.seconds + i / SMOKE.puffs) % 1) + 1) % 1;
    const size = 2 + Math.floor(f * 2.5);
    const x = from.x + f * SMOKE.drift + Math.sin(f * 2 * Math.PI + i) * 1.2;
    const y = from.y - f * SMOKE.rise;
    ctx.fillStyle = `rgba(${smoke.colour}, ${(0.95 * (1 - f * f)).toFixed(2)})`;
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
  ctx.beginPath();
  mountainClipPath(ctx, c);
  ctx.clip();
}

/** `mountainClip`'s shape, added to the current path, so several can make one clip (the dome's). */
function mountainClipPath(ctx: CanvasRenderingContext2D, c: {x: number; y: number}): void {
  const s = BOARD_LAYOUT.size;
  const h = (Math.sqrt(3) / 2) * s;
  const far = 4 * s;
  ctx.moveTo(c.x - far, c.y - far);
  ctx.lineTo(c.x + far, c.y - far);
  ctx.lineTo(c.x + far, c.y);
  ctx.lineTo(c.x + s, c.y);
  ctx.lineTo(c.x + s / 2, c.y + h);
  ctx.lineTo(c.x - s / 2, c.y + h);
  ctx.lineTo(c.x - s, c.y);
  ctx.lineTo(c.x - far, c.y);
  ctx.closePath();
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

/** Frames a second a fire's flames flicker in. */
export const FIRE_FPS = 6;
const FIRE_TONGUES = 7;
/** A tongue's colours, its base to its tip. */
const FIRE_COLORS = ['#7c2d12', '#c2410c', '#f59e0b', '#fde68a'];

/**
 * A burning space (the Fan Lady's Fan the Flames): the ground glowing, and
 * tongues of flame 2 to 6 art pixels tall flickering over it, each from a
 * spot the hex picks, so hexes don't flicker in step. Drawn under the
 * units, so a unit standing in it stands in the flames. `time` null: still.
 */
export function drawFire(ctx: CanvasRenderingContext2D, h: Hex, time: number | null): void {
  const c = center(h);
  const px = SPRITE_SCALE;
  const frame = time === null ? 0 : Math.floor(time * FIRE_FPS);
  const next = hexRandom(h, 7);
  ctx.save();
  tintHex(ctx, h, '#ea580c', 0.32);
  for (let i = 0; i < FIRE_TONGUES; i++) {
    let lx = 0;
    let ly = 0;
    for (let tries = 0; tries < 8; tries++) {
      lx = Math.round((next() - 0.5) * 26);
      ly = Math.round((next() - 0.5) * 22);
      if (insideHex(lx, ly, 4)) break;
    }
    const phase = Math.floor(next() * 4);
    const height = 2 + ((frame + phase) % 4) + (i % 2);
    const x0 = Math.round(c.x / px) + lx;
    const y0 = Math.round(c.y / px) + ly;
    for (let dy = 0; dy < height; dy++) {
      const color = FIRE_COLORS[Math.min(3, Math.floor((dy / height) * 4))]!;
      // Wider at the base, a flicker to one side at the tip.
      const sway = dy === height - 1 ? ((frame + i) % 3) - 1 : 0;
      const width = dy < height / 2 ? 2 : 1;
      for (let dx = 0; dx < width; dx++) artPixel(ctx, x0 + dx + sway, y0 - dy, color);
    }
  }
  ctx.restore();
}

/**
 * The Banana-leaf Fan lying where the Fan Lady fell, in art pixels: `o`
 * the outline, `#` the leaf, `=` its ribs, `|` the handle.
 */
const FAN = [
  '....ooooooo....', //
  '..oo#######oo..',
  '.o##=##=##=##o.',
  'o###=##=##=###o',
  'o####=#=#=####o',
  '.o####===####o.',
  '..oo###=###oo..',
  '....oo#=#oo....',
  '......o|o......',
  '......o|o......',
  '......o|o......',
  '.......o.......',
];
const FAN_COLOR: Record<string, string> = {
  o: PALETTE.ink,
  '#': '#65a30d',
  '=': '#3f6212',
  '|': '#92400e',
};

/** The dropped fan on `h`, on the ground. */
export function drawFan(ctx: CanvasRenderingContext2D, h: Hex): void {
  const c = center(h);
  const left = Math.round(c.x / SPRITE_SCALE) - 7;
  const top = Math.round(c.y / SPRITE_SCALE) - 6;
  FAN.forEach((row, dy) =>
    [...row].forEach((ch, dx) => {
      const color = FAN_COLOR[ch];
      if (color) artPixel(ctx, left + dx, top + dy, color);
    })
  );
}
