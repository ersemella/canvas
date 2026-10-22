import {
  assetLoader,
  BaseSystem,
  hexCorners,
  hexDistance,
  hexEquals,
  hexKey,
  hexNeighbors,
  hexToPixel,
  pixelToHex,
} from '@canvas/engine';
import type {EventBus, Hex, SystemContext} from '@canvas/engine';
import {CAMEL, HEROES, RULES} from '../rules/config';
import {isFlanked, onMap, statusValue, unitAt, walkable} from '../rules/board';
import {ABILITIES} from '../rules/abilities';
import {tileAt, type MapData, type Tile} from '../rules/map';
import {mapOf} from '../rules/fight';
import type {AbilityId, FightState, StatusKind, Unit} from '../rules/types';
import {BOARD_LAYOUT, SCENE_SIZE, TRACK_AREA, trackCards, trackSlots} from './layout';
import type {TrackCard, TrackSlots} from './layout';
import type {TacticsHoverPayload} from './TacticsInputSystem';
import {Playback, eventSeconds} from './playback';
import type {PlaybackPayload} from './playback';
import {PALETTE, paletteAlpha, pixelFont} from './palette';
import bokhPortrait from './sprites/bokh-portrait.png';
import bokhSprite from './sprites/bokh.png';
import camelPortrait from './sprites/camel-portrait.png';
import camelSprite from './sprites/camel.png';
import mangudaiSprite from './sprites/mangudai.png';
import mangudaiPortrait from './sprites/mangudai-portrait.png';
import stormPortrait from './sprites/storm-portrait.png';
import stormSprite from './sprites/storm.png';
import wolfPortrait from './sprites/wolf-portrait.png';
import wolfSprite from './sprites/wolf.png';
import quicksandImage from './tiles/quicksand.png';
import ruinsImage from './tiles/ruins.png';
import sandImage from './tiles/sand.png';

export {BOARD_LAYOUT, SCENE_SIZE};

export type HighlightKind = 'path' | 'target' | 'reach' | 'landing' | 'chosen' | 'area';

/** What the page wants drawn over the board, sent as a `tactics:board` event. */
export interface BoardScene {
  fight: FightState | null;
  highlights: {hex: Hex; kind: HighlightKind}[];
  selectedUnitId: string | null;
  /** The unit tapped to look at (touch can't hover): it shows its health bar, as a hovered one does. */
  inspectedUnitId?: string | null;
  /** Units that show their health bar however they're looked at (an attack's targets while aiming). */
  healthUnitIds?: string[];
  /** Previewed outcome: where units end up and their health. */
  preview: {unitId: string; to: Hex | null; hpAfter: number; hpBefore: number; killed: boolean}[];
  /** A planned move's route, from where the unit stands to where it ends: a line along it. */
  path?: Hex[];
  /** The hexes the picked ability reaches from its user: outlined, so its range shows. */
  range?: Hex[];
  /**
   * The bow's lanes from its user: an arrow along each to a unit it may
   * target, a faint dashed line along the rest to where the arrow stops.
   */
  lanes?: {from: Hex; lanes: {hexes: Hex[]; target: boolean}[]};
  /** A throw being aimed: an arc from the unit thrown, around the thrower, to where it lands. */
  arc?: {from: Hex; around: Hex; to: Hex};
  /**
   * A step the aimed ability takes first (Pin's): a move's arrow, drawn over
   * the units, since the stepping unit's ghost would hide it under them.
   */
  step?: [Hex, Hex];
  /** Where the acting unit's card lands after the planned turn: a ghost card on the track. */
  previewSlot?: number | null;
  /** The slot the planned turn's cost aims at; when it's taken, the card yields on to `previewSlot`. */
  aimSlot?: number | null;
  /**
   * The arrow over the unit you're controlling (on unless false). Phones
   * leave it off: there it reads as "tap here", and the action bar shows the
   * unit's portrait instead.
   */
  turnArrow?: boolean;
}

/**
 * The sides' colours, from the palette (art-direction.md): lapis yours,
 * madder the enemy's. The plain shade for edges on the sand; light for
 * text and edges on the dark track and labels.
 */
const SIDE_COLOR = {player: PALETTE.lapis, enemy: PALETTE.madder};
const SIDE_LIGHT = {player: PALETTE.lapisLight, enemy: PALETTE.madderLight};
/**
 * The rug a unit stands on, filling its hex: a field in its side's colour,
 * opaque enough to stay rich over the sand, and a stitched ivory border.
 */
const RUG = {
  player: {field: paletteAlpha('lapis', 0.8), stitch: PALETTE.ivory},
  enemy: {field: paletteAlpha('madder', 0.8), stitch: PALETTE.ivory},
};
/**
 * A track card's ground, behind the portrait: two flat bands of its side's
 * colour, the light one on top, like a pixel sky; dusk when empty.
 */
const CARD_BANDS = {
  player: {top: PALETTE.lapis, bottom: PALETTE.lapisDark},
  enemy: {top: PALETTE.madder, bottom: PALETTE.madderDark},
};
/** A hard, pixel drop shadow: the outline colour, no blur. */
function pixelShadow(ctx: CanvasRenderingContext2D, offset = 2): void {
  ctx.shadowColor = PALETTE.ink;
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = offset;
  ctx.shadowOffsetY = offset;
}
const HERO_COLOR = {
  bokh: '#b45309',
  mangudai: '#15803d',
  storm: '#4f46e5',
  camel: '#a8742f',
  wolf: '#6b7280',
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
/**
 * Board decorations were drawn for hexes of size 32; this scales them to
 * the board's hexes.
 */
const HEX_SCALE = BOARD_LAYOUT.size / 32;
/**
 * 2× (64 pixels, 72 for a 36-pixel mounted sprite) keeps a sprite inside
 * its hex (about 73 wide); 1.5× until the hexes grew from 55 wide.
 */
const SPRITE_SCALE = 2;
/** How far below the hex's centre a sprite's bottom edge sits. */
const SPRITE_FEET = 29;
/** Track portraits (32×32, facing right), filling the card; `faceX` is the face's column. */
export const HERO_PORTRAIT: Partial<Record<Unit['hero'], {src: string; faceX: number}>> = {
  bokh: {src: bokhPortrait, faceX: 17},
  mangudai: {src: mangudaiPortrait, faceX: 18},
  storm: {src: stormPortrait, faceX: 19},
  camel: {src: camelPortrait, faceX: 19},
  wolf: {src: wolfPortrait, faceX: 22},
};
interface HighlightStyle {
  fill: string;
  stroke: string;
  dash?: number[];
}
/**
 * Targeting is all one light blue (your side's light lapis) (the bow's lanes'), stronger the closer it is
 * to what's picked, so it never reads as either side's tint.
 */
/** `PALETTE.lapisLight`, as channels for the highlights' opacities. */
const TARGET_RGB = '142,197,255';
/** An enemy's charging area: its side's madder (`SIDE_COLOR.enemy`). */
const ENEMY_CHARGE_RED = '176,64,46';
const targeting = (fill: number, stroke: number): HighlightStyle => ({
  fill: `rgba(${TARGET_RGB},${fill})`,
  stroke: `rgba(${TARGET_RGB},${stroke})`,
});
const HIGHLIGHT: Record<HighlightKind, HighlightStyle> = {
  /** The steps of a planned move. */
  path: targeting(0.25, 0.8),
  /** Hexes an ability can target, or a move can end on: outlined solid, so it shows over a unit's tint. */
  target: targeting(0.14, 0.9),
  /** A unit an ability reaches only after a step (Pin): dashed, as the step's hexes are. */
  reach: {...targeting(0.08, 0.9), dash: [6, 4]},
  /** An ability's second pick, once its target is (Throw's landing, Pin's step): dashed, so it never reads as a target. */
  landing: {...targeting(0.08, 1), dash: [6, 4]},
  /** The whole area an aimed ability strikes, around its target. */
  area: targeting(0.42, 1),
  chosen: targeting(0.6, 1),
};

/** The health bar over an inspected unit: centred on the hex, its bottom edge `HEALTH_BAR.y` above the centre. */
const HEALTH_BAR = {w: 60, h: 10, y: 50};
/** Status markers in a row above the health bar: their radius, and the gap between centres. */
const MARK = {r: 6.5, step: 15};
/** Seconds a gone status's marker takes to rise off its unit and fade. */
const MARK_EXPIRE_SECONDS = 0.9;
/** How many pixels it rises meanwhile. */
const MARK_EXPIRE_RISE = 18;
/** How far above the hex's centre the markers' row is centred. */
const MARKS_Y = HEALTH_BAR.y + HEALTH_BAR.h + 5 + MARK.r;

/**
 * Where a looked-at unit's health bar and status markers go: above it,
 * markers on top (the board leaves room for them over the top row).
 * `top` and `bottom` bound the lot, so the tooltip can keep clear of it.
 */
function healthStack(
  hex: Hex,
  marks: number
): {barY: number; marksY: number; top: number; bottom: number} {
  const c = center(hex);
  const barY = c.y - HEALTH_BAR.y - HEALTH_BAR.h;
  const marksY = c.y - MARKS_Y;
  const top = (marks > 0 ? marksY - MARK.r : barY) - 2;
  return {barY, marksY, top, bottom: c.y - HEALTH_BAR.y + 2};
}

/** The hovered hex's outline. */
const HOVER: HighlightStyle = {fill: paletteAlpha('ivory', 0.1), stroke: PALETTE.ivory};

/** Seconds one spent card takes to lift off the track. */
const CARD_LIFT_SECONDS = 0.18;
/** The most a whole advance takes, however many slots it passes. */
const ADVANCE_MAX_SECONDS = 1.2;

/** Seconds a card takes to slide back to the slot of its unit's next turn. */
const CARD_SLIDE_SECONDS = 0.55;
/** How many pixels the front card grows above and below while its unit acts. */
const FRONT_CARD_GROW = 5;

/** A card sliding back along the deck after its unit's turn, from the position it left. */
interface CardSlide {
  /** How far back in the deck it started (0 in front). */
  from: number;
  elapsed: number;
}

/**
 * A status that just went (expired or cleansed): its marker rises off the unit and fades,
 * shown whether or not the unit is looked at, so it's plain it has gone.
 */
interface MarkExpiry {
  unitId: string;
  mark: [string, string];
  /** Its place in the unit's row of markers before it went, and how many there were. */
  index: number;
  count: number;
  elapsed: number;
}

/**
 * The track running on after a turn: the cards from `from` up to `to` (the
 * next turn's) lift away one by one and the deck slides up behind them.
 */
interface TrackAdvance {
  from: number;
  to: number;
  /** The units whose cards sat in the passed slots, as they were before. */
  spent: Map<number, Unit>;
  elapsed: number;
}

/**
 * Draws the board: its ground (cached, see `drawGround`), the
 * track of cards along the top (3.1, as in Mana Khemia), tile markings,
 * highlights, arrow lanes, hail, charging areas, units (their health and
 * statuses only on their turn, or when hovered, tapped or in an aimed
 * attack's reach), and the
 * previewed outcome. Hovering a hex outlines it and shows its unit's health
 * and statuses; the side panel tells the rest. Plain shapes and text (brief section 9). The page drives it with
 * `tactics:board` events; taps come from `TacticsInputSystem`.
 */
export class TacticsBoardSystem extends BaseSystem {
  // After RenderSystem (995) has cleared the canvas.
  readonly priority = 996;
  private scene: BoardScene = {fight: null, highlights: [], selectedUnitId: null, preview: []};
  private hover: TacticsHoverPayload = {hex: null, unitId: null};
  private advance: TrackAdvance | null = null;
  /** Cards sliding to their units' new slots, by unit. */
  private slides = new Map<string, CardSlide>();
  /** Gone statuses' markers fading away. */
  private expiries: MarkExpiry[] = [];
  /** The fight drawn last frame, to see which statuses went since. */
  private shown: FightState | null = null;
  /** Seconds since the board started, for the units' idle animations. */
  private time = 0;
  /** The player's device asks for reduced motion: units hold still. */
  private still = false;
  /** A turn's events playing back; the page's scene waits until it ends. */
  private play: Playback | null = null;
  /** A won fight's party walking out, once the result shows (see `walkOutPlan`). */
  private walkOut: {key: string; start: number; walks: Map<string, Walk>} | null = null;
  private bus: EventBus | null = null;
  private cleanup: (() => void)[] = [];
  /** Bumped by whatever changes the board from outside a frame: the page's scene, the hover, a font loading. */
  private version = 0;
  /** What this frame would show (`frameKey`), worked out in `holdsFrame`. */
  private key: string | null = null;
  /** What the last frame drawn showed; null if it was mid-motion, so the next must draw. */
  private drawnKey: string | null = null;

  onInit({events}: Omit<SystemContext, 'deltaTime'>): void {
    const bus: EventBus = events;
    this.bus = bus;
    this.still =
      typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.cleanup.push(
      bus.on<BoardScene>('tactics:board', (scene) => {
        // During a playback the track follows the events instead.
        if (!this.play) this.startTrackMotion(this.scene.fight, scene.fight);
        this.scene = scene;
        this.version++;
      })
    );
    this.cleanup.push(
      bus.on<PlaybackPayload>('tactics:playback', (payload) => {
        this.play = new Playback(payload);
        // Reduced motion, or nothing to show: straight to the result.
        if (this.still || this.play.events.length === 0) this.endPlayback();
      })
    );
    this.cleanup.push(bus.on('tactics:playback-skip', () => this.endPlayback()));
    this.cleanup.push(
      bus.on<TacticsHoverPayload>('tactics:hover', (hover) => {
        this.hover = hover;
        this.version++;
      })
    );
    // Labels drawn before the pixel font loaded were drawn in a fallback.
    if (typeof document !== 'undefined' && document.fonts) {
      const fontsLoaded = () => this.version++;
      document.fonts.addEventListener('loadingdone', fontsLoaded);
      this.cleanup.push(() => document.fonts.removeEventListener('loadingdone', fontsLoaded));
    }
  }

  /**
   * True when this frame would draw what the last one did, so the canvas is
   * left as it is: the board is pixel art, which steps a few times a second
   * (idle frames, quicksand, weather, hail, the turn arrow's bob), so most
   * frames have nothing new unless something is moving.
   */
  holdsFrame({deltaTime, canvas}: SystemContext): boolean {
    this.key = this.frameKey(this.time + deltaTime, canvas);
    return this.key !== null && this.key === this.drawnKey;
  }

  /**
   * Everything a still frame depends on at `time`: what the page and the
   * hover last sent, which images have loaded, the canvas's size, and the
   * step each stepped animation is on. Null while something moves smoothly
   * (a playback, the track running on, cards sliding, statuses fading), when
   * every frame differs.
   */
  private frameKey(time: number, canvas: HTMLCanvasElement): string | null {
    const {fight} = this.scene;
    if (!fight || this.play || this.advance || this.slides.size > 0 || this.expiries.length > 0)
      return null;
    const parts: number[] = [this.version, assetLoader.settled, canvas.width, canvas.height];
    if (!this.still) {
      for (const u of fight.units) if (u.alive && u.hex) parts.push(idleFrame(u.id, time));
      const map = mapOf(fight);
      if (map.hexes.some((h) => tileAt(map, h) === 'hazard'))
        parts.push(Math.floor(time / QUICKSAND_FRAME_SECONDS));
      if (map.hexes.some((h) => tileAt(map, h) === 'conceal'))
        parts.push(Math.floor(time * SANDSTORM_BANK.fps));
      if (fight.effects.length > 0) parts.push(Math.floor(time * HAIL_FPS));
      if (this.scene.turnArrow !== false) parts.push(turnArrowBob(time));
    }
    return parts.join(' ');
  }

  /**
   * Where each of a won fight's party is on its walk out (see
   * `walkOutPlan`), timed from when the result first showed; a unit gone
   * past the board's edge is 'gone'. Null when no one walks: the fight isn't
   * won, it has no living camel, or the device asks for reduced motion
   * (everyone stays put).
   */
  private walkingParty(fight: FightState): Map<string, {at: Point; alpha: number} | 'gone'> | null {
    const camel = fight.phase === 'won' ? fight.units.find((u) => u.hero === CAMEL) : undefined;
    if (this.still || !camel?.alive || !camel.hex) {
      this.walkOut = null;
      return null;
    }
    const key = `${fight.mapId} ${fight.currentSlot} ${hexKey(camel.hex)}`;
    if (this.walkOut?.key !== key) {
      const walks = walkOutPlan(fight);
      this.walkOut = walks && {key, start: this.time, walks};
    }
    if (!this.walkOut) return null;
    const out = new Map<string, {at: Point; alpha: number} | 'gone'>();
    for (const [id, walk] of this.walkOut.walks)
      out.set(id, walkPosition(walk, this.time - this.walkOut.start));
    return out;
  }

  /** Ends a playback (finished or skipped): the page's scene shows again. */
  private endPlayback(): void {
    if (!this.play) return;
    this.play = null;
    this.bus?.emit('tactics:playback-done', {});
  }

  onDestroy(): void {
    for (const fn of this.cleanup) fn();
    this.cleanup = [];
  }

  /**
   * The fight shown changed: slide the cards whose units' slots moved (a
   * finished turn's card going back along the deck), and run the track on
   * when the turn moved it.
   */
  private startTrackMotion(before: FightState | null, after: FightState | null): void {
    if (!before || !after || before.mapId !== after.mapId) return;
    if (this.still) return;
    this.startSlides(before, after);
    this.startAdvance(before, after);
  }

  /** Each card whose unit's slot changed slides there from wherever it shows now. */
  private startSlides(before: FightState, after: FightState): void {
    const start = this.advance ? trackStart(this.advance) : before.currentSlot;
    for (const u of after.units) {
      const was = before.units.find((v) => v.id === u.id);
      if (!u.alive || u.slot === null || !was?.alive || was.slot === null) continue;
      if (was.slot === u.slot) continue;
      const slide = this.slides.get(u.id);
      const from = slide ? slideIndex(slide, was.slot, start) : Math.max(0, was.slot - start);
      this.slides.set(u.id, {from, elapsed: 0});
    }
  }

  /** A turn moved the track on: animate the cards it passed, from wherever the deck shows now. */
  private startAdvance(before: FightState, after: FightState): void {
    if (after.currentSlot <= before.currentSlot) return;
    const prev = this.advance;
    const from = prev ? Math.floor(trackStart(prev)) : before.currentSlot;
    const spent = new Map(prev?.spent);
    for (const u of before.units) {
      if (!u.alive || u.slot === null || u.slot < before.currentSlot || u.slot >= after.currentSlot)
        continue;
      // A card still on the track slides to its new slot instead.
      const now = after.units.find((v) => v.id === u.id);
      if (now?.alive && now.slot !== null && now.slot >= after.currentSlot) continue;
      spent.set(u.slot, u);
    }
    this.advance = {from, to: after.currentSlot, spent, elapsed: 0};
  }

  /** Each status that went (expired or cleansed) from `before` to `after` starts fading off its unit. */
  private startExpiries(before: FightState | null, after: FightState): void {
    // Not across fights, nor back in time.
    if (!before || before.mapId !== after.mapId || after.currentSlot < before.currentSlot) return;
    for (const u of after.units) {
      const was = before.units.find((v) => v.id === u.id);
      if (!u.alive || !was?.alive) continue;
      const marks = statusMarks(before, was);
      const now = new Set(statusMarks(after, u).map(([m]) => m));
      marks.forEach((mark, index) => {
        // Flanked isn't a status: it comes and goes as units move.
        const status = STATUS_KINDS.some((k) => STATUS_MARK[k][0] === mark[0]);
        if (status && !now.has(mark[0]))
          this.expiries.push({unitId: u.id, mark, index, count: marks.length, elapsed: 0});
      });
    }
  }

  onUpdate({ctx, deltaTime, world}: SystemContext): void {
    if (world.frameHeld) {
      this.time += deltaTime;
      return;
    }
    let playing: Playback | null = null;
    if (this.play) {
      const before = this.play.display;
      if (this.play.step(deltaTime)) {
        playing = this.play;
        if (playing.display !== before) this.startTrackMotion(before, playing.display);
      } else {
        this.endPlayback();
      }
    }
    // While playing back, the board shows the events' fight, without the page's highlights.
    const scene: BoardScene = playing ? playbackScene(playing) : this.scene;
    const {fight} = scene;
    if (!fight) return;
    if (fight !== this.shown) {
      this.startExpiries(this.shown, fight);
      this.shown = fight;
    }
    this.time += deltaTime;
    for (const e of this.expiries) e.elapsed += deltaTime;
    this.expiries = this.expiries.filter((e) => e.elapsed < MARK_EXPIRE_SECONDS);
    if (this.advance) {
      this.advance.elapsed += deltaTime;
      if (trackStart(this.advance) >= this.advance.to) this.advance = null;
    }
    for (const [id, slide] of this.slides) {
      slide.elapsed += deltaTime;
      if (slide.elapsed >= CARD_SLIDE_SECONDS) this.slides.delete(id);
    }
    const map = mapOf(fight);
    // The board's weather moves with time, unless the device asks for reduced motion.
    const t = this.still ? null : this.time;
    drawGround(ctx, map, t);
    for (const h of map.exits) drawExit(ctx, h);
    const sandstorm = map.hexes.filter((h) => tileAt(map, h) === 'conceal');
    drawBank(ctx, SANDSTORM_BANK, sandstorm, t);
    for (const h of map.hexes) if (tileAt(map, h) === 'obstacle') drawRuins(ctx, h);
    // A won fight: the party walks out, off their hexes (no rugs), once the playback ends.
    const walking = playing ? null : this.walkingParty(fight);
    // A frame mid-motion: the next draws again whatever the key says.
    const moving =
      playing !== null ||
      this.advance !== null ||
      this.slides.size > 0 ||
      this.expiries.length > 0 ||
      [...(walking?.values() ?? [])].some((w) => w !== 'gone');
    this.drawnKey = moving ? null : this.key;
    // Each unit stands on a rug in its side's colour, under the highlights so moves and targets still show.
    const previewed = new Map(scene.preview.map((p) => [p.unitId, p]));
    for (const u of fight.units) {
      const hex = u.hex;
      if (!u.alive || !hex || walking?.has(u.id)) continue;
      const p = previewed.get(u.id);
      const moved = Boolean(p?.to && hexKey(p.to) !== hexKey(hex));
      drawRug(ctx, hex, u.side, moved || p?.killed ? 0.4 : 1);
      if (p?.to && moved && !p.killed) drawRug(ctx, p.to, u.side, 0.7);
    }
    for (const h of scene.highlights) fillHex(ctx, h.hex, HIGHLIGHT[h.kind]);
    // The hovered hex's outline goes under the units, so it never crosses a sprite.
    if (this.hover.hex) fillHex(ctx, this.hover.hex, HOVER);
    if (scene.path && scene.path.length > 1) drawPath(ctx, scene.path);
    for (const u of fight.units) if (u.alive && u.charging) drawCharge(ctx, map, u);

    const acting = fight.awaiting;
    // A unit's border covers its hex's outline, so a targeted unit rings itself.
    const targeted = new Map<string, 'target' | 'reach' | 'chosen'>();
    for (const h of scene.highlights)
      if (
        h.kind === 'chosen' ||
        ((h.kind === 'target' || h.kind === 'reach') && !targeted.has(hexKey(h.hex)))
      )
        targeted.set(hexKey(h.hex), h.kind);
    for (const u of fight.units) {
      const hex = u.hex;
      if (!u.alive || !hex) continue;
      const walk = walking?.get(u.id);
      if (walk) {
        if (walk !== 'gone')
          drawUnit(ctx, u, hex, {
            acting: false,
            selected: false,
            faded: false,
            frame: Math.floor(this.time / WALK_OUT_STEP_SECONDS),
            at: walk.at,
            alpha: walk.alpha,
          });
        continue;
      }
      const p = previewed.get(u.id);
      const moved = p && p.to && hexKey(p.to) !== hexKey(hex);
      drawUnit(ctx, u, hex, {
        acting: u.id === acting,
        selected: u.id === scene.selectedUnitId || u.id === this.hover.unitId,
        faded: Boolean(moved || p?.killed),
        frame: this.still ? 0 : idleFrame(u.id, this.time),
        targeted: targeted.get(hexKey(hex)),
        ...(playing ? {at: steppingAt(playing, u.id)} : {}),
      });
      if (p && moved && !p.killed)
        drawUnit(ctx, u, p.to!, {
          acting: false,
          selected: false,
          faded: false,
          ghost: true,
          frame: 0,
        });
      if (p && p.hpAfter !== p.hpBefore) {
        const at = center(p.to ?? hex);
        drawDamage(ctx, at.x, at.y - 22, p.hpBefore - p.hpAfter, p.killed);
      }
    }

    if (scene.range) drawRangeOutline(ctx, scene.range);
    if (scene.lanes) drawLanes(ctx, scene.lanes.from, scene.lanes.lanes);
    if (scene.arc) drawThrowArc(ctx, scene.arc.from, scene.arc.around, scene.arc.to);
    if (scene.step) drawPath(ctx, scene.step);

    // Hail falls in front of whoever stands in it; with reduced motion, held mid-fall.
    for (const effect of fight.effects) drawFallingHail(ctx, effect.hex, t ?? HAIL_STILL_SECONDS);

    if (playing) drawPlaybackEvent(ctx, playing);

    // Health and statuses show only on the unit whose turn it is, the unit
    // being looked at (hovered on the board or the track, or tapped), and
    // whoever an attack being aimed could hit, where the turn would move it.
    const looked = new Set<string>();
    if (fight.awaiting) looked.add(fight.awaiting);
    if (scene.inspectedUnitId) looked.add(scene.inspectedUnitId);
    for (const id of scene.healthUnitIds ?? []) looked.add(id);
    if (this.hover.unitId) looked.add(this.hover.unitId);
    const hovered = this.hover.hex && unitAt(fight, this.hover.hex);
    if (hovered) looked.add(hovered.id);
    for (const u of fight.units) {
      const hex = u.hex;
      if (!u.alive || !hex || !looked.has(u.id)) continue;
      const p = previewed.get(u.id);
      const at = p?.to && !p.killed ? p.to : hex;
      const marks = statusMarks(fight, u);
      const stack = healthStack(at, marks.length);
      drawHealthBar(ctx, u, at, stack.barY, p?.hpBefore ?? u.hp, p?.hpAfter);
      drawStatusMarks(ctx, marks, at, stack.marksY);
    }
    // The unit you're controlling: an arrow over it, so it never needs finding.
    // Not while a turn plays back, when whoever the events move is acting.
    const yours = fight.units.find((u) => u.id === fight.awaiting);
    if (
      this.scene.turnArrow !== false &&
      !playing &&
      fight.phase === 'fight' &&
      yours?.alive &&
      yours.hex &&
      yours.side === 'player'
    ) {
      const p = previewed.get(yours.id);
      const at = p?.to && !p.killed ? p.to : yours.hex;
      drawTurnArrow(ctx, at, statusMarks(fight, yours).length, t);
    }
    for (const e of this.expiries) {
      const u = fight.units.find((v) => v.id === e.unitId);
      const hex = u?.hex;
      if (!u?.alive || !hex) continue;
      const k = e.elapsed / MARK_EXPIRE_SECONDS;
      const c = center(hex);
      const x = c.x + (e.index - (e.count - 1) / 2) * MARK.step;
      // Reduced motion: it fades where it was.
      const rise = this.still ? 0 : MARK_EXPIRE_RISE * (1 - (1 - k) ** 2);
      const y = healthStack(hex, e.count).marksY - rise;
      drawStatusMark(ctx, e.mark, x, y, 1 - k * k);
    }

    drawTrack(
      ctx,
      fight,
      trackCards(fight, scene.previewSlot ?? null),
      scene.previewSlot ?? null,
      scene.aimSlot ?? null,
      this.advance,
      this.slides,
      {
        selected: scene.selectedUnitId,
        hovered: this.hover.unitId,
      }
    );
  }
}

/**
 * The slot in front of the deck partway through an advance: each passed
 * card in turn eases off over its share of the time.
 */
function trackStart(a: TrackAdvance): number {
  const n = a.to - a.from;
  const step = Math.min(CARD_LIFT_SECONDS, ADVANCE_MAX_SECONDS / n);
  const u = a.elapsed / step;
  if (u >= n) return a.to;
  const k = Math.floor(u);
  const t = u - k;
  return a.from + k + t * t * (3 - 2 * t);
}

/** How far through a slide, eased: 0 where the card left, 1 at its slot. */
function slideProgress(s: CardSlide): number {
  const t = Math.min(1, s.elapsed / CARD_SLIDE_SECONDS);
  return t * t * (3 - 2 * t);
}

/**
 * How far back in the deck a sliding card shows: on its way from where it
 * left to its slot, which itself moves forward while the track runs on.
 */
function slideIndex(s: CardSlide, slot: number, start: number): number {
  const e = slideProgress(s);
  return s.from * (1 - e) + Math.max(0, slot - start) * e;
}

function center(h: Hex): {x: number; y: number} {
  return hexToPixel(h, BOARD_LAYOUT);
}

function hexPath(ctx: CanvasRenderingContext2D, h: Hex, inset = 1): void {
  const c = center(h);
  ctx.beginPath();
  hexCorners('pointy', BOARD_LAYOUT.size - inset).forEach((p, i) =>
    i === 0 ? ctx.moveTo(c.x + p.x, c.y + p.y) : ctx.lineTo(c.x + p.x, c.y + p.y)
  );
  ctx.closePath();
}

function fillHex(ctx: CanvasRenderingContext2D, h: Hex, style: HighlightStyle): void {
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

function tintHex(ctx: CanvasRenderingContext2D, h: Hex, color: string, alpha: number): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  hexPath(ctx, h, 1);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}

/** The rug under a unit (`RUG`): its field, then a stitched border inside the hex's edge. */
function drawRug(ctx: CanvasRenderingContext2D, h: Hex, side: Unit['side'], alpha: number): void {
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

/** A card's ground (`CARD_BANDS`): filled dark (casting its shadow), then the light band on top. */
function bandCard(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  side: Unit['side']
): void {
  const bands = CARD_BANDS[side];
  ctx.fillStyle = bands.bottom;
  ctx.fill();
  ctx.save();
  ctx.shadowColor = 'transparent';
  ctx.clip();
  ctx.fillStyle = bands.top;
  ctx.fillRect(x, y, w, Math.round(h * 0.6));
  ctx.restore();
}

/**
 * A numbered step badge on a hex's left edge, clear of the status markers
 * and damage labels above a unit; a second one on the same hex sits on the right.
 */
function pixelRect(
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

/**
 * The track as a fanned deck, as in Mana Khemia: a card for every
 * slot from now on, empty ones blank, the current one in front at the left
 * and each later one tucked behind the one before, showing a strip with
 * its unit. The planned turn's landing card is dashed; when it had to yield
 * past taken slots, the slot its cost aimed at is marked too, with an arrow
 * on to where it lands. The acting unit's card stands a little taller in
 * front. After a turn, its card slides back to its new slot over the
 * others, and the empty cards it passed lift up off the track one by one,
 * the rest sliding forward, until the next turn's card is in front.
 */
function drawTrack(
  ctx: CanvasRenderingContext2D,
  fight: FightState,
  cards: TrackCard[],
  previewSlot: number | null,
  aimSlot: number | null,
  advance: TrackAdvance | null,
  slides: Map<string, CardSlide>,
  opts: {selected: string | null; hovered: string | null}
): void {
  const {x, y, width, height} = TRACK_AREA;
  const start = advance ? trackStart(advance) : fight.currentSlot;
  const deck = trackSlots(fight, previewSlot, start);
  ctx.save();
  pixelRect(ctx, x, y, width, height, 3);
  ctx.fillStyle = PALETTE.dusk0;
  ctx.fill();
  ctx.strokeStyle = PALETTE.ink;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();

  const bySlot = new Map(cards.map((c) => [c.slot, c]));
  const sliding: {u: Unit; i: number}[] = [];
  // Back to front, so each card covers the left of the one behind it.
  for (let slot = Math.ceil(start + deck.count - 1); slot >= Math.floor(start); slot--) {
    const passed = advance !== null && slot < advance.to;
    const spent = passed ? advance.spent.get(slot) : undefined;
    const card = passed ? undefined : bySlot.get(slot);
    const u = spent ?? (card ? fight.units.find((v) => v.id === card.unitId)! : null);
    const ghost = Boolean(card?.ghost);
    const slide = u && !ghost && !spent ? slides.get(u.id) : undefined;
    if (slide) {
      // Drawn last, over the cards it passes; its slot shows empty until it lands.
      sliding.push({u: u!, i: slideIndex(slide, slot, start)});
      drawCard(
        ctx,
        deck,
        null,
        {i: Math.max(0, slot - start), lift: 0, ghost: false, grow: 0},
        opts
      );
      continue;
    }
    // How far back in the deck it sits (0 in front), and how far a passed card has lifted.
    const i = Math.max(0, slot - start);
    const lift = passed ? Math.min(1, Math.max(0, start - slot)) : 0;
    const acting = Boolean(card && !ghost && u!.id === fight.awaiting);
    // The card of the unit acting grows as it comes to the front.
    const grow = acting ? Math.max(0, 1 - i) : 0;
    drawCard(ctx, deck, u, {i, lift, ghost, acting, grow}, opts);
  }
  for (const {u, i} of sliding) {
    const acting = u.id === fight.awaiting;
    drawCard(ctx, deck, u, {i, lift: 0, ghost: false, acting, grow: Math.max(0, 1 - i)}, opts);
  }
  if (!advance && previewSlot !== null && aimSlot !== null && aimSlot < previewSlot)
    drawYield(ctx, deck, aimSlot, previewSlot);
}

/**
 * One deck card, `i` cards back from the front (fractional while the deck
 * moves): blank when empty, a dashed outline for the planned landing, else
 * its unit's portrait. `lift` is how far a passed card has lifted off the
 * track; `grow` how much taller the acting unit's front card stands.
 */
function drawCard(
  ctx: CanvasRenderingContext2D,
  deck: TrackSlots,
  u: Unit | null,
  card: {i: number; lift: number; ghost: boolean; acting?: boolean; grow: number},
  opts: {selected: string | null; hovered: string | null}
): void {
  const {i, lift, ghost, grow} = card;
  const acting = Boolean(card.acting);
  const cx = deck.x0 + i * deck.w;
  const h = deck.h + 2 * FRONT_CARD_GROW * grow;
  const cy = deck.y - FRONT_CARD_GROW * grow - lift * (deck.y + deck.h + 4);
  ctx.save();
  ctx.globalAlpha = 1 - lift * 0.6;
  pixelShadow(ctx);
  pixelRect(ctx, cx, cy, deck.cardW, h, 3);
  // The ghost is just an outline where the acting card lands: no portrait,
  // so the acting unit doesn't show twice.
  if (!u || ghost) {
    ctx.fillStyle = PALETTE.dusk1;
    ctx.fill();
  } else {
    bandCard(ctx, cx, cy, deck.cardW, h, u.side);
  }
  ctx.shadowColor = 'transparent';
  const strokeBorder = () => {
    ctx.setLineDash(ghost ? [3, 2] : []);
    ctx.strokeStyle = !u
      ? PALETTE.dusk2
      : acting
        ? PALETTE.goldLight
        : ghost
          ? PALETTE.lapisLight
          : u.id === opts.selected || u.id === opts.hovered
            ? PALETTE.ivory
            : SIDE_LIGHT[u.side];
    ctx.lineWidth = acting || ghost ? 2.5 : 1.25;
    // The ghost's thick dashes sit inside its edge, so none show past the card in front.
    if (ghost) pixelRect(ctx, cx + 1.25, cy + 1.25, deck.cardW - 2.5, h - 2.5, 4);
    ctx.stroke();
    ctx.setLineDash([]);
  };
  strokeBorder();
  if (!u && !ghost) {
    // An empty card's lit right edge, one art pixel wide, over the card
    // behind (each card covers the left of the next): the seams in a run of
    // empty cards, quietly (they matter little).
    ctx.fillStyle = PALETTE.dusk3;
    ctx.fillRect(Math.round(cx + deck.cardW - 3), Math.round(cy + 3), 2, Math.round(h - 6));
  }

  if (u && !ghost) {
    // The unit sits in the strip that shows; the front card shows whole,
    // and a card sliding to the front carries its unit across to the middle.
    const back = Math.min(1, i);
    const mid = cx + deck.cardW / 2 + back * (deck.cardW / 2 - deck.w / 2);
    const portrait = HERO_PORTRAIT[u.hero];
    const img = portrait && assetLoader.requestImage(portrait.src);
    if (img) {
      // The portrait fills the card, full height; its face sits where the unit
      // would (the strip that shows, on a card behind). Enemies face left.
      const scale = Math.max(h, deck.cardW) / img.height;
      const faceX = (u.side === 'enemy' ? img.width - portrait.faceX : portrait.faceX) * scale;
      ctx.save();
      pixelRect(ctx, cx, cy, deck.cardW, h, 3);
      ctx.clip();
      ctx.imageSmoothingEnabled = false;
      ctx.translate(Math.round(mid - faceX), Math.round(cy));
      if (u.side === 'enemy') {
        ctx.translate(img.width * scale, 0);
        ctx.scale(-1, 1);
      }
      ctx.drawImage(img, 0, 0, img.width * scale, img.height * scale);
      ctx.restore();
      if (u.charging) greyOut(ctx, cx, cy, deck.cardW, h);
      // The border again, over the portrait.
      pixelRect(ctx, cx, cy, deck.cardW, h, 3);
      strokeBorder();
    } else {
      // No portrait yet: a disc in the hero's colour with its letter.
      const r = Math.min(11, deck.w / 2 - 2);
      ctx.beginPath();
      ctx.arc(mid, cy + h / 2 - 4, r, 0, Math.PI * 2);
      ctx.fillStyle = HERO_COLOR[u.hero];
      ctx.fill();
      ctx.strokeStyle = SIDE_LIGHT[u.side];
      ctx.lineWidth = 1.5;
      ctx.stroke();
      label(ctx, HEROES[u.hero].letter, mid, cy + h / 2 - 3, PALETTE.ivory, 11, true);
    }
    // A charging card: greyed (the unit waits on its spell, it takes no turn)
    // with the spell's mark; the ability triggers when this slot comes up.
    if (u.charging) drawChargeMark(ctx, cx + deck.cardW - deck.w / 2, cy + h - 9);
    // A card whose last turn was skipped (it could only Hold): marked till it next acts.
    else if (u.skipped) drawSkipMark(ctx, cx + deck.cardW - deck.w / 2, cy + h - 9);
    // A unit whose ultimate is ready: a star high in its showing strip, clear of the marks below.
    if (ultimateReady(u)) drawUltimateMark(ctx, cx + deck.cardW - deck.w / 2, cy + 9);
  }
  ctx.restore();
}

/** Drains a card's colour and darkens it: a charging unit's card. */
function greyOut(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  ctx.save();
  pixelRect(ctx, x, y, w, h, 5);
  ctx.clip();
  ctx.globalCompositeOperation = 'saturation';
  ctx.fillStyle = '#808080';
  ctx.fillRect(x, y, w, h);
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = paletteAlpha('dusk0', 0.45);
  ctx.fillRect(x, y, w, h);
  ctx.restore();
}

/** A charging card's mark: an hourglass in a purple disc, low in its showing strip. */
function drawChargeMark(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, 7, 0, Math.PI * 2);
  ctx.fillStyle = PALETTE.plumDark;
  ctx.fill();
  ctx.strokeStyle = PALETTE.plumLight;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x - 3, y - 4);
  ctx.lineTo(x + 3, y - 4);
  ctx.lineTo(x - 3, y + 4);
  ctx.lineTo(x + 3, y + 4);
  ctx.closePath();
  ctx.fillStyle = PALETTE.ivory;
  ctx.fill();
  ctx.restore();
}

/** Whether a unit has an ultimate, charged and not yet used this fight. */
function ultimateReady(u: Unit): boolean {
  return (
    HEROES[u.hero].ultimate !== undefined &&
    !u.ultimateUsed &&
    u.ultimateCharge >= RULES.ultimateCharge
  );
}

/** A ready ultimate's mark: a four-pointed ivory star in a plum disc, high in its showing strip. */
function drawUltimateMark(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, 7, 0, Math.PI * 2);
  ctx.fillStyle = PALETTE.plum;
  ctx.fill();
  ctx.strokeStyle = PALETTE.plumLight;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.beginPath();
  for (let k = 0; k < 8; k++) {
    const r = k % 2 === 0 ? 5 : 1.6;
    const a = (k * Math.PI) / 4 - Math.PI / 2;
    const px = x + r * Math.cos(a);
    const py = y + r * Math.sin(a);
    if (k === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = PALETTE.ivory;
  ctx.fill();
  ctx.restore();
}

/** A skipped turn's mark: a skip sign (two chevrons and a bar) in a dark disc. */
function drawSkipMark(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, 7, 0, Math.PI * 2);
  ctx.fillStyle = PALETTE.dusk1;
  ctx.fill();
  ctx.strokeStyle = PALETTE.dusk4;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = PALETTE.ivory;
  for (const dx of [-4, -0.5]) {
    ctx.beginPath();
    ctx.moveTo(x + dx, y - 3.5);
    ctx.lineTo(x + dx + 3.5, y);
    ctx.lineTo(x + dx, y + 3.5);
    ctx.closePath();
    ctx.fill();
  }
  ctx.fillRect(x + 3, y - 3.5, 1.5, 7);
  ctx.restore();
}

/**
 * A card that yields (3.3): the strip of the slot its cost aimed at,
 * outlined dashed, and an arrow below the units from there to where it
 * lands, over the cards in the way.
 */
function drawYield(
  ctx: CanvasRenderingContext2D,
  deck: TrackSlots,
  aim: number,
  land: number
): void {
  // The middle of a slot's showing strip: the right `w` of its card.
  const mid = (slot: number) => deck.x0 + (slot - deck.start) * deck.w + deck.cardW - deck.w / 2;
  const left = mid(aim) - deck.w / 2;
  ctx.save();
  ctx.setLineDash([3, 2]);
  ctx.strokeStyle = PALETTE.lapisLight;
  ctx.lineWidth = 2;
  pixelRect(ctx, left + 1, deck.y + 1, deck.w - 2, deck.h - 2, 4);
  ctx.stroke();
  ctx.setLineDash([]);
  const y = deck.y + deck.h - 18;
  const x1 = mid(aim);
  const x2 = mid(land) - 4;
  // Dark under the blue, so it reads over any card.
  for (const [color, width] of [
    [PALETTE.ink, 4],
    [PALETTE.lapisLight, 2],
  ] as const) {
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(x1, y);
    ctx.lineTo(x2 - 2, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x2 + width / 2 + 2, y);
    ctx.lineTo(x2 - 5, y - 4 - width / 2);
    ctx.lineTo(x2 - 5, y + 4 + width / 2);
    ctx.closePath();
    ctx.fill();
  }
  ctx.beginPath();
  ctx.arc(x1, y, 2.5, 0, Math.PI * 2);
  ctx.fill();
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

/** The ground's colour until its textures load. */
const SAND = '#d4b483';

/** The ground texture of each tile type; ruins stand on sand. */
const TILE_TEXTURE: Record<Tile, string> = {
  sand: sandImage,
  obstacle: sandImage,
  hazard: quicksandImage,
  // The sandstorm blows over sand, drawn by `drawBank` across all its hexes.
  conceal: sandImage,
};

/**
 * A pixel-art image (42×42 for a ground texture or effect) clipped to a hex,
 * at the sprites' scale, centred on it. A sheet of square frames side by
 * side (quicksand's) shows its `frame`th.
 */
function drawHexImage(
  ctx: CanvasRenderingContext2D,
  h: Hex,
  img: HTMLImageElement,
  opts: {flipX?: boolean; frame?: number} = {}
): void {
  const c = center(h);
  const side = img.height;
  const size = side * SPRITE_SCALE;
  ctx.save();
  hexPath(ctx, h, 0);
  ctx.clip();
  ctx.imageSmoothingEnabled = false;
  ctx.translate(Math.round(c.x), Math.round(c.y));
  if (opts.flipX) ctx.scale(-1, 1);
  ctx.drawImage(img, (opts.frame ?? 0) * side, 0, side, side, -size / 2, -size / 2, size, size);
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
 * texture finishes loading, or the canvas's scale changes. Only quicksand,
 * which flows, is drawn each frame, over its still copy.
 */
function drawGround(ctx: CanvasRenderingContext2D, map: MapData, time: number | null): void {
  if (typeof document === 'undefined') {
    for (const h of map.hexes) drawTile(ctx, h, tileAt(map, h), time);
    return;
  }
  let mapKey = mapKeys.get(map);
  if (mapKey === undefined) {
    mapKey = map.hexes.map((h) => `${hexKey(h)}:${tileAt(map, h)}`).join(' ');
    mapKeys.set(map, mapKey);
  }
  const loaded = [...new Set(Object.values(TILE_TEXTURE))]
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
    for (const h of map.hexes) drawTile(g, h, tileAt(map, h), null);
    ground = {canvas, key};
  }
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(ground.canvas, 0, 0, ground.canvas.width / scale, ground.canvas.height / scale);
  ctx.restore();
  if (time !== null)
    for (const h of map.hexes) if (tileAt(map, h) === 'hazard') drawTile(ctx, h, 'hazard', time);
}

/** Seconds each of quicksand's frames shows: a slow step, like the units' idles. */
const QUICKSAND_FRAME_SECONDS = 0.3;

/**
 * Which of quicksand's frames (scripts/quicksand-sheet.py: its bands a step
 * further in each frame, so the sand seems to flow in) shows at a time.
 * Hexes start at different frames, so they don't flow in step.
 */
function quicksandFrame(sheet: HTMLImageElement, h: Hex, time: number): number {
  const frames = Math.max(1, Math.round(sheet.width / sheet.height));
  const start = Math.floor(hexRandom(h, 9)() * frames);
  return (Math.floor(time / QUICKSAND_FRAME_SECONDS) + start) % frames;
}

/**
 * A tile's ground: its texture (sand mirrored on alternate hexes, so the
 * board doesn't repeat) and its border. Until the image loads, flat sand
 * and a code-drawn mark show. Ruins stand on sand and are
 * drawn later, by `drawRuins`.
 */
function drawTile(ctx: CanvasRenderingContext2D, h: Hex, tile: Tile, time: number | null): void {
  const ground = assetLoader.requestImage(TILE_TEXTURE[tile]);
  if (ground) {
    drawHexImage(ctx, h, ground, {
      flipX: tile === 'sand' && (h.q * 7 + h.r * 13) % 2 !== 0,
      // Quicksand flows in, frame by frame.
      frame: tile === 'hazard' && time !== null ? quicksandFrame(ground, h, time) : 0,
    });
    ctx.save();
    hexPath(ctx, h, 0.5);
    ctx.strokeStyle = '#8c7350';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  } else {
    // Until the textures load: plain sand, with a mark for the tiles that do something.
    ctx.save();
    hexPath(ctx, h, 0.5);
    ctx.fillStyle = SAND;
    ctx.fill();
    ctx.strokeStyle = '#8c7350';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
    if (tile === 'hazard' || tile === 'conceal') drawTileMark(ctx, center(h), tile);
  }
}

/**
 * An exit, the road out (camel.md, 18.2): a worn ivory border and two
 * chevrons pointing off the board, outlined in ink like the sprites.
 */
function drawExit(ctx: CanvasRenderingContext2D, h: Hex): void {
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
  ctx.lineJoin = 'miter';
  for (const dx of [-6, 3]) {
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

/** A ruin standing on its hex like a unit: over sandstorm and hail, so it always reads as blocked. */
function drawRuins(ctx: CanvasRenderingContext2D, h: Hex): void {
  const ruins = assetLoader.requestImage(ruinsImage);
  if (ruins) {
    const c = center(h);
    const size = ruins.width * SPRITE_SCALE;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(
      ruins,
      Math.round(c.x - size / 2),
      Math.round(c.y + SPRITE_FEET - size),
      size,
      size
    );
    ctx.restore();
  } else {
    drawTileMark(ctx, center(h), 'obstacle');
  }
}

/** Each tile type has its own shape, not only its own colour (art direction). */
function drawTileMark(
  ctx: CanvasRenderingContext2D,
  at: {x: number; y: number},
  tile: string
): void {
  ctx.save();
  // Drawn around the origin at the size-32 scale, then scaled to the hex.
  ctx.translate(at.x, at.y);
  ctx.scale(HEX_SCALE, HEX_SCALE);
  const c = {x: 0, y: 0};
  if (tile === 'obstacle') {
    // Ruins: stacked blocks.
    ctx.fillStyle = '#4a3f35';
    ctx.strokeStyle = '#2b241e';
    ctx.lineWidth = 1.5;
    for (const [dx, dy, w, h] of [
      [-14, 2, 13, 10],
      [1, 2, 13, 10],
      [-7, -9, 14, 10],
    ] as const) {
      ctx.fillRect(c.x + dx, c.y + dy, w, h);
      ctx.strokeRect(c.x + dx, c.y + dy, w, h);
    }
  } else if (tile === 'hazard') {
    // Quicksand: a spiral.
    ctx.strokeStyle = '#5c4320';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let a = 0; a < Math.PI * 5; a += 0.2) {
      const r = 2 + a * 1.1;
      const x = c.x + Math.cos(a) * r;
      const y = c.y + Math.sin(a) * r * 0.75;
      if (a === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  } else if (tile === 'conceal') {
    // Sandstorm: drifting wavy lines.
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.lineWidth = 2;
    for (const dy of [-10, 0, 10]) {
      ctx.beginPath();
      for (let dx = -16; dx <= 16; dx += 2) {
        const y = c.y + dy + Math.sin((dx + dy) / 4) * 2.5;
        if (dx === -16) ctx.moveTo(c.x + dx, y);
        else ctx.lineTo(c.x + dx, y);
      }
      ctx.stroke();
    }
  }
  ctx.restore();
}

/** A seeded random sequence in [0, 1) from a hex, so each hex has its own pattern. */
function hexRandom(h: Hex, salt = 0): () => number {
  let seed = ((h.q * 73856093) ^ (h.r * 19349663) ^ (salt * 83492791)) >>> 0;
  return () => (seed = (seed * 1103515245 + 12345) >>> 0) / 2 ** 32;
}

/** Whether a point (art pixels from a hex's centre) lies `margin` art pixels inside the hex. */
function insideHex(x: number, y: number, margin: number): boolean {
  const s = BOARD_LAYOUT.size / SPRITE_SCALE - margin;
  const ax = Math.abs(x);
  return ax <= (Math.sqrt(3) / 2) * s && Math.abs(y) <= s - ax / Math.sqrt(3);
}

/** Hailstones falling on a hail hex: each drops in turn from above the board, bursting as it lands. */
const HAIL_DROPS = 10;
const HAIL_CYCLE_SECONDS = 1.1;
const HAIL_FALL_SECONDS = 0.3;
const HAIL_BURST_SECONDS = 0.24;
/** Frames a second it falls in. */
const HAIL_FPS = 12;
/** How far above its landing spot a stone starts, and how far the wind carries it meanwhile, in art pixels. */
const HAIL_DROP_HEIGHT = 22;
const HAIL_DRIFT = 7;
/** The moment shown with reduced motion: a few stones in the air, none bursting. */
const HAIL_STILL_SECONDS = 0.3;

/**
 * Hailstones falling onto a hail hex, from well above it and slanting with
 * the wind, a shadow growing under each as it nears the ground; on landing
 * it bursts into shards. This is all a hail hex shows: no ground image.
 * Drawn over the units, unclipped, so stones fall in front of whoever
 * stands there. Their spots, sizes and timing come from the hex, so hexes
 * don't fall in step. In art pixels at the sprites' scale.
 */
function drawFallingHail(ctx: CanvasRenderingContext2D, h: Hex, time: number): void {
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

/**
 * A bank of weather over some hexes (a sandstorm), drawn as pixel art
 * like the sprites: every pixel a solid colour or empty, see-through parts
 * and the soft outer edge dithered rather than blended. Its layers are
 * tiles of art that wrap, each drifting at its own speed, the later ones
 * behind the first (showing through its gaps), all kept to the area around
 * the hexes. It moves in steps, a few frames a second, like the units' idles.
 */
interface BankStyle {
  layers: readonly BankLayer[];
  /**
   * Where a hex's share fades, as fractions of the hex's size from its
   * centre: solid within the first, gone by the second, dithered between.
   * Neighbours' shares overlap, so a bank reads as one and only its outer
   * edge is broken up.
   */
  fade: readonly [number, number];
  /** Frames a second it moves on. */
  fps: number;
}

interface BankLayer {
  /** The tile's size in art pixels: multiples of 4, so its dithering wraps too. */
  tile: {width: number; height: number};
  /** Paints the tile, art pixel by art pixel, in solid colours (or nothing). */
  paint: (ctx: CanvasRenderingContext2D) => void;
  /** Art pixels a second it drifts. */
  x: number;
  y: number;
}

/** A 4×4 ordered-dither threshold (0 to 15) for each art pixel: a pixel at `level` (0 to 16) shows when its threshold is below it. */
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const dithered = (x: number, y: number, level: number) => BAYER[(y & 3) * 4 + (x & 3)]! < level;

/**
 * Smooth noise in [0, 1) over a tile `width` × `height`, from a grid of
 * `cellsX` × `cellsY` random values, that wraps at the tile's edges.
 */
function tileNoise(
  next: () => number,
  width: number,
  height: number,
  cellsX: number,
  cellsY: number
): (x: number, y: number) => number {
  const grid = Array.from({length: cellsX * cellsY}, () => next());
  const v = (x: number, y: number) => grid[(y % cellsY) * cellsX + (x % cellsX)]!;
  const stepX = width / cellsX;
  const stepY = height / cellsY;
  const smooth = (t: number) => t * t * (3 - 2 * t);
  return (x: number, y: number) => {
    const gx = Math.floor(x / stepX);
    const gy = Math.floor(y / stepY);
    const tx = smooth(x / stepX - gx);
    const ty = smooth(y / stepY - gy);
    const top = v(gx, gy) + (v(gx + 1, gy) - v(gx, gy)) * tx;
    const bottom = v(gx, gy + 1) + (v(gx + 1, gy + 1) - v(gx, gy + 1)) * tx;
    return top + (bottom - top) * ty;
  };
}

/** How far a sandstorm's streaks fall for each art pixel across: a quarter, so the tile (4 times wider than tall) still wraps. */
const SANDSTORM_SLOPE = 0.25;

/**
 * Paints a sandstorm tile: noise sheared along the streaks (sloping down to
 * the right, a whole tile's height over its width, so it wraps), in `bands`
 * from low to high, each a colour; below the first is empty. `grains`: the
 * share of pixels that are dark grains instead.
 */
function paintStreaks(
  ctx: CanvasRenderingContext2D,
  seed: Hex,
  bands: readonly (readonly [number, string])[],
  grains: number
): void {
  const next = hexRandom(seed);
  const coarse = tileNoise(next, 96, 24, 3, 4);
  const fine = tileNoise(next, 96, 24, 6, 8);
  for (let y = 0; y < 24; y++) {
    for (let x = 0; x < 96; x++) {
      const sy = (y - Math.floor(x * SANDSTORM_SLOPE) + 24) % 24;
      const n = coarse(x, sy) * 0.6 + fine(x, sy) * 0.4;
      let color: string | undefined;
      for (const [from, c] of bands) if (n >= from) color = c;
      if (next() < grains) color = '#806a50';
      if (!color) continue;
      ctx.fillStyle = color;
      ctx.fillRect(x, y, 1, 1);
    }
  }
}

/**
 * Sandstorm: bright streaks of blown sand racing over a slower, solid
 * curtain of dust, in the old sandstorm image's colours, with dark grains.
 */
const SANDSTORM_BANK: BankStyle = {
  layers: [
    {
      tile: {width: 96, height: 24},
      paint: (ctx) =>
        paintStreaks(
          ctx,
          {q: 3, r: 17},
          [
            [0.56, '#dcc39f'],
            [0.66, '#efdcbc'],
          ],
          0
        ),
      x: 16,
      y: 16 * SANDSTORM_SLOPE,
    },
    {
      tile: {width: 96, height: 24},
      paint: (ctx) =>
        paintStreaks(
          ctx,
          {q: 8, r: 1},
          [
            [0, '#aa9274'],
            [0.5, '#bea788'],
          ],
          0.025
        ),
      x: 7,
      y: 7 * SANDSTORM_SLOPE,
    },
  ],
  fade: [0.78, 1.12],
  fps: 8,
};

/**
 * A bank as last built: kept and redrawn as it is until it moves on a step
 * or its hexes change (`key`). `bounds` is the part of the canvas it
 * covers, in art pixels; `mask` the dithered area around its hexes, made
 * once for each set of hexes.
 */
interface BuiltBank {
  canvas: HTMLCanvasElement;
  mask: HTMLCanvasElement;
  key: string;
  hexes: string;
  bounds: {x: number; y: number; width: number; height: number};
}

const bankTiles = new Map<BankLayer, HTMLCanvasElement>();
const builtBanks = new Map<BankStyle, BuiltBank>();

function artCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

/**
 * Every hex of one kind of weather as one bank (see `BankStyle`), unclipped,
 * so it has no hex-shaped cuts or seams. Built in art pixels and scaled up
 * unsmoothed, and rebuilt only when it moves on a step (a few times a
 * second) and only over the hexes' part of the board, so a bank costs
 * little more than drawing an image. Still when `time` is null (reduced
 * motion).
 */
function drawBank(
  ctx: CanvasRenderingContext2D,
  style: BankStyle,
  hexes: Hex[],
  time: number | null
): void {
  if (hexes.length === 0 || typeof document === 'undefined') return;
  const width = Math.ceil(SCENE_SIZE.width / SPRITE_SCALE);
  const height = Math.ceil(SCENE_SIZE.height / SPRITE_SCALE);
  const t = Math.floor((time ?? 0) * style.fps) / style.fps;
  const offsets = style.layers.map(
    (l) => [Math.round(t * l.x) % l.tile.width, Math.round(t * l.y) % l.tile.height] as const
  );
  const hexesKey = hexes.map(hexKey).join(' ');
  const key = `${hexesKey}|${offsets.join(' ')}`;
  let built = builtBanks.get(style);
  if (built?.key !== key) {
    built = buildBank(style, hexes, hexesKey, offsets, built, width, height);
    built.key = key;
    builtBanks.set(style, built);
  }
  const {x, y, width: bw, height: bh} = built.bounds;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(
    built.canvas,
    x,
    y,
    bw,
    bh,
    x * SPRITE_SCALE,
    y * SPRITE_SCALE,
    bw * SPRITE_SCALE,
    bh * SPRITE_SCALE
  );
  ctx.restore();
}

/** Builds a bank (into `reuse`'s canvases when there are some), over its hexes' part of the board only. */
function buildBank(
  style: BankStyle,
  hexes: Hex[],
  hexesKey: string,
  offsets: (readonly [number, number])[],
  reuse: BuiltBank | undefined,
  width: number,
  height: number
): BuiltBank {
  const canvas = reuse?.canvas ?? artCanvas(width, height);
  const maskCanvas = reuse?.mask ?? artCanvas(width, height);
  const layer = canvas.getContext('2d')!;
  const sameHexes = reuse?.hexes === hexesKey;
  const bounds = sameHexes ? reuse!.bounds : bankMask(maskCanvas, style, hexes, width, height);
  const {x: x0, y: y0, width: bw, height: bh} = bounds;

  layer.globalCompositeOperation = 'source-over';
  // Other hexes than last time: what it drew before may lie outside these bounds.
  if (!sameHexes) layer.clearRect(0, 0, width, height);
  else layer.clearRect(x0, y0, bw, bh);
  style.layers.forEach((l, i) => {
    let tile = bankTiles.get(l);
    if (!tile) {
      tile = artCanvas(l.tile.width, l.tile.height);
      l.paint(tile.getContext('2d')!);
      bankTiles.set(l, tile);
    }
    const [ox, oy] = offsets[i]!;
    layer.save();
    layer.beginPath();
    layer.rect(x0, y0, bw, bh);
    layer.clip();
    // Each later layer goes behind those before it, showing through their gaps.
    layer.globalCompositeOperation = i === 0 ? 'source-over' : 'destination-over';
    layer.translate(ox, oy);
    layer.fillStyle = layer.createPattern(tile, 'repeat')!;
    layer.fillRect(
      x0 - l.tile.width,
      y0 - l.tile.height,
      bw + 2 * l.tile.width,
      bh + 2 * l.tile.height
    );
    layer.restore();
  });
  layer.globalCompositeOperation = 'destination-in';
  layer.drawImage(maskCanvas, x0, y0, bw, bh, x0, y0, bw, bh);
  layer.globalCompositeOperation = 'source-over';
  return {canvas, mask: maskCanvas, key: '', hexes: hexesKey, bounds};
}

/**
 * Makes a bank's mask: each art pixel on (opaque) or off, on near a hex's
 * centre and dithered off towards `style.fade`'s edge, so the edge breaks up
 * into pixels rather than blurring. Returns the part of the board it covers.
 */
function bankMask(
  canvas: HTMLCanvasElement,
  style: BankStyle,
  hexes: Hex[],
  width: number,
  height: number
): BuiltBank['bounds'] {
  const size = BOARD_LAYOUT.size / SPRITE_SCALE;
  const [solid, gone] = style.fade;
  const reach = Math.ceil(size * gone) + 1;
  const centres = hexes.map((h) => {
    const c = center(h);
    return {x: c.x / SPRITE_SCALE, y: c.y / SPRITE_SCALE};
  });
  const x0 = Math.max(0, Math.floor(Math.min(...centres.map((c) => c.x)) - reach));
  const y0 = Math.max(0, Math.floor(Math.min(...centres.map((c) => c.y)) - reach));
  const x1 = Math.min(width, Math.ceil(Math.max(...centres.map((c) => c.x)) + reach));
  const y1 = Math.min(height, Math.ceil(Math.max(...centres.map((c) => c.y)) + reach));
  const bw = x1 - x0;
  const bh = y1 - y0;
  // How covered each pixel is (0 to 1): its nearest hex's say.
  const cover = new Float32Array(bw * bh);
  for (const c of centres) {
    for (let y = Math.max(y0, Math.floor(c.y - reach)); y < Math.min(y1, c.y + reach); y++) {
      for (let x = Math.max(x0, Math.floor(c.x - reach)); x < Math.min(x1, c.x + reach); x++) {
        const d = Math.hypot(x + 0.5 - c.x, y + 0.5 - c.y) / size;
        const k = Math.min(1, Math.max(0, (gone - d) / (gone - solid)));
        const i = (y - y0) * bw + (x - x0);
        if (k > cover[i]!) cover[i] = k;
      }
    }
  }
  const ctx = canvas.getContext('2d')!;
  const image = ctx.createImageData(bw, bh);
  for (let y = 0; y < bh; y++)
    for (let x = 0; x < bw; x++)
      if (dithered(x + x0, y + y0, Math.round(cover[y * bw + x]! * 16)))
        image.data[(y * bw + x) * 4 + 3] = 255;
  ctx.clearRect(0, 0, width, height);
  ctx.putImageData(image, x0, y0);
  return {x: x0, y: y0, width: bw, height: bh};
}

/** A planned move's route: a line through the hexes' centres, with a head on the last. */
function drawPath(ctx: CanvasRenderingContext2D, path: Hex[]): void {
  const points = path.map(center);
  const a = points[points.length - 2]!;
  const b = points[points.length - 1]!;
  const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  const ux = (b.x - a.x) / len;
  const uy = (b.y - a.y) / len;
  // Stop short of the last centre, so the head sits clear of the ghost's feet.
  const end = {x: b.x - ux * 12, y: b.y - uy * 12};
  ctx.save();
  ctx.strokeStyle = PALETTE.lapisLight;
  ctx.fillStyle = PALETTE.lapisLight;
  ctx.lineWidth = 3;
  ctx.lineJoin = 'miter';
  ctx.lineCap = 'square';
  pixelShadow(ctx, 1);
  ctx.beginPath();
  ctx.moveTo(points[0]!.x, points[0]!.y);
  for (const p of points.slice(1, -1)) ctx.lineTo(p.x, p.y);
  ctx.lineTo(end.x, end.y);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(end.x + ux * 8, end.y + uy * 8);
  ctx.lineTo(end.x - ux * 4 - uy * 7, end.y - uy * 4 + ux * 7);
  ctx.lineTo(end.x - ux * 4 + uy * 7, end.y - uy * 4 - ux * 7);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/**
 * A throw being aimed: a dashed arc swinging around the thrower (`around`)
 * from the unit thrown to where it lands, the way it goes in the playback,
 * with a head there. It starts and stops clear of the sprites' middles.
 */
function drawThrowArc(ctx: CanvasRenderingContext2D, from: Hex, around: Hex, to: Hex): void {
  const c = center(around);
  const a = center(from);
  const b = center(to);
  const radius = Math.hypot(a.x - c.x, a.y - c.y);
  const start = Math.atan2(a.y - c.y, a.x - c.x);
  // The shorter way round.
  let turn = Math.atan2(b.y - c.y, b.x - c.x) - start;
  if (turn > Math.PI) turn -= 2 * Math.PI;
  if (turn < -Math.PI) turn += 2 * Math.PI;
  const at = (t: number) => ({
    x: c.x + radius * Math.cos(start + turn * t),
    y: c.y + radius * Math.sin(start + turn * t),
  });
  // Clear of each end's sprite: about a third of a hex along the arc.
  const margin = Math.min(0.35, 22 / (radius * Math.abs(turn) || 1));
  const points = Array.from({length: 17}, (_, i) => at(margin + (i / 16) * (1 - 2 * margin)));
  const end = points[points.length - 1]!;
  const prev = points[points.length - 2]!;
  const len = Math.hypot(end.x - prev.x, end.y - prev.y) || 1;
  const ux = (end.x - prev.x) / len;
  const uy = (end.y - prev.y) / len;
  ctx.save();
  ctx.strokeStyle = PALETTE.lapisLight;
  ctx.fillStyle = PALETTE.lapisLight;
  ctx.lineWidth = 3;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'square';
  pixelShadow(ctx, 1);
  ctx.beginPath();
  ctx.moveTo(points[0]!.x, points[0]!.y);
  for (const p of points.slice(1)) ctx.lineTo(p.x, p.y);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(end.x + ux * 9, end.y + uy * 9);
  ctx.lineTo(end.x - ux * 4 - uy * 7, end.y - uy * 4 + ux * 7);
  ctx.lineTo(end.x - ux * 4 + uy * 7, end.y - uy * 4 - ux * 7);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/**
 * The edge of an ability's range: a dashed light lapis line, over ink so
 * it reads on the sand and the rugs, along every side of `hexes` that
 * borders a hex outside them.
 */
function drawRangeOutline(ctx: CanvasRenderingContext2D, hexes: Hex[]): void {
  const inside = new Set(hexes.map(hexKey));
  const corners = hexCorners('pointy', BOARD_LAYOUT.size);
  const edges: [{x: number; y: number}, {x: number; y: number}][] = [];
  for (const h of hexes) {
    const c = center(h);
    corners.forEach((p, i) => {
      const q = corners[(i + 1) % corners.length]!;
      // The hex across this side has its centre twice as far as the side's middle.
      const across = pixelToHex({x: c.x + p.x + q.x, y: c.y + p.y + q.y}, BOARD_LAYOUT);
      if (!inside.has(hexKey(across)))
        edges.push([
          {x: c.x + p.x, y: c.y + p.y},
          {x: c.x + q.x, y: c.y + q.y},
        ]);
    });
  }
  ctx.save();
  ctx.lineCap = 'round';
  for (const [color, width, dash] of [
    [PALETTE.ink, 5, []],
    [PALETTE.lapisLight, 2.5, [7, 5]],
  ] as const) {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.setLineDash([...dash]);
    ctx.beginPath();
    for (const [a, b] of edges) {
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
    }
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * The bow's lanes from `from`: to a unit it may target, a light lapis
 * arrow pointing at it; along any other lane (blocked by an ally, a ruin
 * or the edge), a faint dashed line to where the arrow would stop, so it's
 * plain why that enemy can't be shot.
 */
function drawLanes(
  ctx: CanvasRenderingContext2D,
  from: Hex,
  lanes: {hexes: Hex[]; target: boolean}[]
): void {
  const a = center(from);
  for (const lane of lanes) {
    const last = lane.hexes[lane.hexes.length - 1];
    if (!last) continue;
    const b = center(last);
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const ux = (b.x - a.x) / len;
    const uy = (b.y - a.y) / len;
    const start = {x: a.x + ux * 26, y: a.y + uy * 26};
    ctx.save();
    ctx.lineCap = 'square';
    if (lane.target) {
      // The head stops at the target's hex, pointing at it.
      const end = {x: b.x - ux * 34, y: b.y - uy * 34};
      ctx.strokeStyle = PALETTE.lapisLight;
      ctx.fillStyle = PALETTE.lapisLight;
      ctx.lineWidth = 3;
      pixelShadow(ctx, 1);
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x - ux * 4, end.y - uy * 4);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(end.x + ux * 8, end.y + uy * 8);
      ctx.lineTo(end.x - ux * 6 - uy * 8, end.y - uy * 6 + ux * 8);
      ctx.lineTo(end.x - ux * 6 + uy * 8, end.y - uy * 6 - ux * 8);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.globalAlpha = 0.6;
      ctx.strokeStyle = PALETTE.lapisLight;
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 5]);
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    ctx.restore();
  }
}

/**
 * A charging ability's area, until it triggers: light blue for your own, as all
 * your targeting is; for an enemy's a red outline only, so it reads as a
 * threat without looking like the tint under an enemy unit.
 */
function drawCharge(ctx: CanvasRenderingContext2D, map: MapData, u: Unit): void {
  const {ability, target} = u.charging!;
  const radius = ABILITIES[ability].radius ?? 0;
  const rgb = u.side === 'enemy' ? ENEMY_CHARGE_RED : TARGET_RGB;
  ctx.save();
  ctx.setLineDash([5, 4]);
  for (let q = -radius; q <= radius; q++) {
    for (let r = -radius; r <= radius; r++) {
      const h = {q: target.q + q, r: target.r + r};
      if (hexDistance(h, target) > radius || !onMap(map, h)) continue;
      hexPath(ctx, h, 4);
      if (u.side !== 'enemy') {
        ctx.fillStyle = `rgba(${rgb},0.2)`;
        ctx.fill();
      }
      ctx.strokeStyle = `rgba(${rgb},0.9)`;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }
  ctx.restore();
  const c = center(target);
  label(ctx, ABILITIES[ability].name, c.x, c.y + 24 * HEX_SCALE, `rgb(${rgb})`, 10);
}

/** The page's scene during a playback: the events' fight, health on whoever the event is about. */
function playbackScene(play: Playback): BoardScene {
  const e = play.current;
  return {
    fight: play.display,
    highlights: [],
    selectedUnitId: null,
    preview: [],
    healthUnitIds: e && e.kind !== 'death' ? [e.unitId] : [],
  };
}

const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

type Point = {x: number; y: number};

/** Seconds a unit takes for each hex of a won fight's walk out. */
const WALK_OUT_HEX_SECONDS = 0.9;
/** Seconds each of its frames shows as it walks: a quicker bob than its idle. */
const WALK_OUT_STEP_SECONDS = 0.3;

/** One unit's walk out: hex centres to the exit and one past the edge, after `delay` seconds. */
interface Walk {
  route: Point[];
  delay: number;
}

/**
 * A won fight's walk out (camel.md): the camel heads for its nearest exit,
 * and every living hero for the same one, each along its shortest walkable
 * path (around any enemies still standing where there is a way), then one
 * hex further, off the board's edge. Nearest first, they reach the exit one
 * hex's time apart, so no two stand on it at once. A unit that can't reach
 * it stays put. Null if the camel can't reach an exit.
 */
function walkOutPlan(fight: FightState): Map<string, Walk> | null {
  const map = mapOf(fight);
  const party = fight.units.filter((u) => u.alive && u.hex && u.side === 'player');
  const camel = party.find((u) => u.hero === CAMEL);
  if (!camel) return null;
  const toExit = walkPath(fight, camel.hex!, (h) => map.exits.some((e) => hexEquals(e, h)));
  if (!toExit) return null;
  const exit = toExit[toExit.length - 1]!;
  const paths = party
    .map((u) => ({
      u,
      path: u === camel ? toExit : walkPath(fight, u.hex!, (h) => hexEquals(h, exit)),
    }))
    .filter((p): p is {u: Unit; path: Hex[]} => p.path !== null)
    .sort((a, b) => a.path.length - b.path.length);
  const walks = new Map<string, Walk>();
  // When each reaches the exit, in hexes' time from the start.
  let arrival = -Infinity;
  for (const {u, path} of paths) {
    const steps = path.length - 1;
    arrival = Math.max(steps, arrival + 1);
    const route = path.map(center);
    const end = route[route.length - 1]!;
    // The exits stick out on the right: walk on one hex width past them.
    route.push({x: end.x + Math.sqrt(3) * BOARD_LAYOUT.size, y: end.y});
    walks.set(u.id, {route, delay: (arrival - steps) * WALK_OUT_HEX_SECONDS});
  }
  return walks;
}

/**
 * The shortest walkable path from `from` to a hex that is `goal`, start
 * included: around enemies still standing where there is a way, through
 * them where there isn't (the party is walking too, so it doesn't block).
 */
function walkPath(fight: FightState, from: Hex, goal: (h: Hex) => boolean): Hex[] | null {
  const map = mapOf(fight);
  const search = (aroundEnemies: boolean): Hex[] | null => {
    const came = new Map<string, Hex | null>([[hexKey(from), null]]);
    let frontier = [from];
    while (frontier.length > 0) {
      const next: Hex[] = [];
      for (const h of frontier) {
        if (goal(h)) {
          const path: Hex[] = [];
          for (let at: Hex | null = h; at; at = came.get(hexKey(at))!) path.unshift(at);
          return path;
        }
        for (const n of hexNeighbors(h)) {
          if (came.has(hexKey(n)) || !walkable(map, n)) continue;
          if (aroundEnemies && unitAt(fight, n)?.side === 'enemy') continue;
          came.set(hexKey(n), h);
          next.push(n);
        }
      }
      frontier = next;
    }
    return null;
  };
  return search(true) ?? search(false);
}

/** Where a walk has got to `t` seconds in: waiting at its start, on its way, fading past the edge, or gone. */
function walkPosition(walk: Walk, t: number): {at: Point; alpha: number} | 'gone' {
  const {route} = walk;
  const last = route.length - 1;
  const k = (t - walk.delay) / WALK_OUT_HEX_SECONDS;
  if (k < 0) return {at: route[0]!, alpha: 1};
  if (k >= last) return 'gone';
  const i = Math.floor(k);
  const f = k - i;
  const a = route[i]!;
  const b = route[i + 1]!;
  return {
    at: {x: Math.round(lerp(a.x, b.x, f)), y: Math.round(lerp(a.y, b.y, f))},
    alpha: i === last - 1 ? 1 - f : 1,
  };
}

/** Where a unit is drawn while a playback moves it (between two hexes), or undefined. */
function steppingAt(play: Playback, unitId: string): {x: number; y: number} | undefined {
  const e = play.current;
  if (e?.kind !== 'step' || e.unitId !== unitId) return undefined;
  const k = play.progress;
  // A push snaps away and slows; the rest move evenly.
  const t = e.how === 'push' ? 1 - (1 - k) * (1 - k) : k;
  const a = center(e.from);
  const b = center(e.to);
  // A thrown unit arcs through the air.
  const lift = e.how === 'throw' || e.how === 'leap' ? Math.sin(Math.PI * k) * 26 : 0;
  return {x: Math.round(lerp(a.x, b.x, t)), y: Math.round(lerp(a.y, b.y, t) - lift)};
}

/**
 * What the event showing now adds over the board: the name of whoever's
 * turn it is, an ability's name and the area or line it strikes, a hit's
 * number rising with a red flash, healing in green, a fallen unit fading.
 */
function drawPlaybackEvent(ctx: CanvasRenderingContext2D, play: Playback): void {
  const e = play.current;
  if (!e) return;
  const k = play.progress;
  const fight = play.display;
  const map = mapOf(fight);
  const u = fight.units.find((v) => v.id === e.unitId);
  if (!u) return;
  const titleY = (h: Hex) => center(h).y - (HEALTH_BAR.y + HEALTH_BAR.h + 12);
  const title = (h: Hex, text: string, color: string) => {
    ctx.save();
    ctx.globalAlpha = k < 0.75 ? 1 : (1 - k) * 4;
    const c = center(h);
    ctx.font = pixelFont(12);
    const w = ctx.measureText(text).width + 12;
    ctx.fillStyle = PALETTE.dusk0;
    ctx.fillRect(c.x - w / 2, titleY(h) - 9, w, 18);
    label(ctx, text, c.x, titleY(h), color, 12, true);
    ctx.restore();
  };
  switch (e.kind) {
    case 'turn':
      if (u.hex)
        title(
          u.hex,
          `${u.side === 'player' ? 'Your' : 'Enemy'} ${HEROES[u.hero].name}`,
          SIDE_LIGHT[u.side]
        );
      return;
    case 'action':
    case 'charge': {
      const def = ABILITIES[e.ability];
      const name = e.kind === 'charge' ? `Charging ${def.name}` : def.name;
      // The area the playback lights up when it lands; the target hex alone for the rest.
      const radius = def.radius ?? 0;
      const area = e.target ? map.hexes.filter((h) => hexDistance(h, e.target!) <= radius) : [];
      const effect = e.kind === 'action' ? ABILITY_EFFECT[e.ability] : undefined;
      // Effects move in steps, as pixel art does.
      const steps = eventSeconds(e, false) * EFFECT_FPS;
      const stepped = steps > 0 ? Math.floor(k * steps) / steps : k;
      if (e.target && effect) {
        effect(ctx, {from: u.hex, target: e.target, area, k: stepped});
      } else if (e.target) {
        ctx.save();
        ctx.globalAlpha = 1 - k * 0.6;
        for (const h of area)
          fillHex(ctx, h, e.kind === 'charge' ? HIGHLIGHT.target : HIGHLIGHT.area);
        ctx.restore();
      }
      // An arrow flying from the bow to its mark.
      if (e.ability === 'bow' && e.target && u.hex && stepped < 0.7) {
        const a = center(u.hex);
        const b = center(e.target);
        const t = stepped / 0.7;
        const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
        drawPixelArrow(
          ctx,
          lerp(a.x, b.x, t),
          lerp(a.y, b.y, t) - 18,
          (b.x - a.x) / len,
          (b.y - a.y) / len,
          7
        );
      }
      // The name last, over the effect.
      if (u.hex) title(u.hex, name, e.kind === 'charge' ? PALETTE.plumLight : PALETTE.lapisLight);
      return;
    }
    case 'damage':
    case 'heal': {
      if (!u.hex) return;
      const c = center(u.hex);
      if (e.kind === 'damage') tintHex(ctx, u.hex, paletteAlpha('madder', 0.55), 1 - k);
      const amount = e.kind === 'damage' ? e.amount : -e.amount;
      drawDamage(ctx, c.x, c.y - 22 - k * 16, amount, e.kind === 'damage' && u.hp === 0);
      return;
    }
    case 'death':
      drawUnit(ctx, u, e.hex, {
        acting: false,
        selected: false,
        faded: false,
        frame: 0,
        alpha: 1 - k,
      });
      return;
    case 'skip':
      if (u.hex) title(u.hex, 'Turn skipped: can only hold', PALETTE.dusk4);
      return;
    case 'step':
      return;
  }
}

/** Frames a second the playback's effects move in: steps, like the units' idles and the weather. */
const EFFECT_FPS = 12;

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
const ABILITY_EFFECT: Partial<
  Record<AbilityId, (ctx: CanvasRenderingContext2D, f: EffectFrame) => void>
> = {
  volley: drawVolley,
  freeze: drawFreeze,
  sunlight: drawSunlight,
};

/** Fades an effect out over the last part of its event, from `start` (0 to 1) on. */
const fadeOut = (k: number, start = 0.8) => (k < start ? 1 : Math.max(0, (1 - k) / (1 - start)));

/** One art pixel (a square of `SPRITE_SCALE` scene pixels) at art-grid cell (ax, ay). */
function artPixel(ctx: CanvasRenderingContext2D, ax: number, ay: number, color: string): void {
  ctx.fillStyle = color;
  ctx.fillRect(ax * SPRITE_SCALE, ay * SPRITE_SCALE, SPRITE_SCALE, SPRITE_SCALE);
}

/** The art-grid cell holding a scene point. */
const artCell = (x: number, y: number) =>
  [Math.round(x / SPRITE_SCALE), Math.round(y / SPRITE_SCALE)] as const;

/** The art-grid cells of a line between two scene points, from the first (Bresenham's). */
function artLine(x0: number, y0: number, x1: number, y1: number): [number, number][] {
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
function ditherFill(
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
function ditherHex(ctx: CanvasRenderingContext2D, h: Hex, color: string, level: number): void {
  const pattern = ditherFill(ctx, color, level);
  if (!pattern) return;
  ctx.save();
  hexPath(ctx, h, 2);
  ctx.fillStyle = pattern;
  ctx.fill();
  ctx.restore();
}

/**
 * A pixel-art arrow whose head is at (x, y), pointing along (ux, uy):
 * `length` art pixels of wooden shaft, outlined dark, a steel head and pale
 * fletching at the tail.
 */
function drawPixelArrow(
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

/** Frost spreads a ring at a time: when the hexes this many rings out start to freeze, and how long that takes. */
const FREEZE_RING_DELAY = 0.16;
const FREEZE_GROW = 0.22;

/**
 * Ice shards as pixel sprites, rows from the top: `#` outline, `w` lit
 * face, `o` ice, `b` its shaded side. They rise from the ground, a row at a
 * time.
 */
const ICE_SHARDS = [
  ['..#..', '.#w#.', '.#wo#', '#wob#', '#wob#', '#wob#', '#oob#', '#oob#'],
  ['.#.', '#w#', '#o#', '#ob#', '#ob#'],
  ['.#..', '#w#.', '#wo#', '#ob#', '#ob#', '#ob#'],
] as const;
const ICE_COLORS: Record<string, string> = {
  '#': '#0c4a6e',
  w: '#ffffff',
  o: '#e0f2fe',
  b: '#7dd3fc',
};

/** An ice shard standing on art cell (ax, ay), its bottom `rows` rows showing. */
function drawIceShard(
  ctx: CanvasRenderingContext2D,
  shard: readonly string[],
  ax: number,
  ay: number,
  rows: number
): void {
  const height = shard.length;
  for (let r = Math.max(0, height - rows); r < height; r++) {
    const row = shard[r]!;
    for (let col = 0; col < row.length; col++) {
      const color = ICE_COLORS[row[col]!];
      if (color) artPixel(ctx, ax + col - (row.length >> 1), ay - (height - 1 - r), color);
    }
  }
}

/**
 * Freeze: a cold blast rings out from the target in pixels and the area
 * ices over, ring by ring: each hex frosts (dithered pale blue) and sprouts
 * ice shards, glinting, then the shards sink and the frost thins away.
 */
function drawFreeze(ctx: CanvasRenderingContext2D, {target, area, k}: EffectFrame): void {
  const t = center(target);
  const fade = fadeOut(k);
  // The blast: a ring of pixels racing outward from the target.
  if (k < 0.5) {
    const r = (k / 0.5) * BOARD_LAYOUT.size * 2.4;
    const seen = new Set<string>();
    for (let i = 0; i < 96; i++) {
      const a = (i / 96) * Math.PI * 2;
      for (const [rr, color] of [
        [r, '#e0f2fe'],
        [r - SPRITE_SCALE, '#7dd3fc'],
      ] as const) {
        const [ax, ay] = artCell(t.x + Math.cos(a) * rr, t.y + Math.sin(a) * rr * 0.8);
        const key = `${ax},${ay},${color}`;
        if (seen.has(key)) continue;
        seen.add(key);
        artPixel(ctx, ax, ay, color);
      }
    }
  }
  for (const h of area) {
    const g = (k - hexDistance(h, target) * FREEZE_RING_DELAY) / FREEZE_GROW;
    if (g <= 0) continue;
    const grow = Math.min(1, g);
    ditherHex(ctx, h, '#bae6fd', 4 * grow * fade);
    // Ice shards rising from the ground, in clusters, sinking again as it ends.
    const c = center(h);
    const next = hexRandom(h, 5);
    for (let i = 0; i < 4; i++) {
      let lx = 0;
      let ly = 0;
      for (let tries = 0; tries < 8; tries++) {
        lx = (next() - 0.5) * 28;
        ly = (next() - 0.5) * 26;
        if (insideHex(lx, ly, 7)) break;
      }
      const shard = ICE_SHARDS[Math.floor(next() * ICE_SHARDS.length)]!;
      const [ax, ay] = artCell(c.x + lx * SPRITE_SCALE, c.y + ly * SPRITE_SCALE);
      const rows = Math.ceil(shard.length * grow * fade);
      drawIceShard(ctx, shard, ax, ay, rows);
      drawIceShard(ctx, ICE_SHARDS[1], ax + 3, ay + 1, Math.ceil(5 * grow * fade));
    }
    // A glint on each hex as it sets: a pixel cross, growing then gone.
    const glint = g - 1;
    if (glint > 0 && glint < 1.2) {
      const arm = Math.round(Math.sin((glint / 1.2) * Math.PI) * 2);
      const [gx, gy] = artCell(c.x + 10, c.y - 12);
      artPixel(ctx, gx, gy, '#ffffff');
      for (let d = 1; d <= arm; d++)
        for (const [ox, oy] of [
          [d, 0],
          [-d, 0],
          [0, d],
          [0, -d],
        ] as const)
          artPixel(ctx, gx + ox, gy + oy, '#ffffff');
    }
  }
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

/** Seconds each idle frame shows. */
const IDLE_FRAME_SECONDS = 0.6;

/**
 * A unit's idle frame at a time: frames alternate every `IDLE_FRAME_SECONDS`,
 * each unit offset by its id so the board doesn't breathe in step.
 */
function idleFrame(unitId: string, time: number): number {
  let offset = 0;
  for (const ch of unitId) offset = (offset * 31 + ch.charCodeAt(0)) % 997;
  return Math.floor(time / IDLE_FRAME_SECONDS + offset / 997);
}

function drawUnit(
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
function turnArrowBob(time: number): number {
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
function drawTurnArrow(
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
const STATUS_MARK: Record<StatusKind, [string, string]> = {
  immobilized: ['I', PALETTE.sky],
  slowed: ['S', PALETTE.plumLight],
  vulnerable: ['V', PALETTE.gold],
  crushed: ['C', PALETTE.madder],
  taunted: ['T', PALETTE.goldLight],
};
const STATUS_KINDS = Object.keys(STATUS_MARK) as StatusKind[];

/** A unit's status markers: I(mmobilized), S(lowed), V(ulnerable), C(rushed), T(aunted), F(lanked). */
function statusMarks(fight: FightState, u: Unit): [string, string][] {
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
function drawStatusMarks(
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
function drawStatusMark(
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
function drawHealthBar(
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

function drawDamage(
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

function label(
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
