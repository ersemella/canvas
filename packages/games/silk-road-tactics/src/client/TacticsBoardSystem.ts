import {
  assetLoader,
  BaseSystem,
  hexCorners,
  hexDistance,
  hexEquals,
  hexKey,
  hexToPixel,
} from '@canvas/engine';
import type {EventBus, Hex, SystemContext} from '@canvas/engine';
import {HEROES} from '../rules/config';
import {fogAt, isFlanked, statusValue} from '../rules/board';
import {ABILITIES} from '../rules/abilities';
import {ABILITY} from '../rules/config';
import {fogInfo, hailInfo, TILE_INFO} from '../rules/info';
import {MAPS, tileAt, type Tile} from '../rules/map';
import type {AbilityId, FightState, StatusKind, Unit} from '../rules/types';
import {BOARD_LAYOUT, SCENE_SIZE, TRACK_AREA, trackCards, trackSlots} from './layout';
import type {TrackCard, TrackSlots} from './layout';
import type {TacticsHoverPayload} from './TacticsInputSystem';
import {Playback} from './playback';
import type {PlaybackPayload} from './playback';
import bokhPortrait from './sprites/bokh-portrait.png';
import bokhSprite from './sprites/bokh.png';
import mangudaiSprite from './sprites/mangudai.png';
import mangudaiPortrait from './sprites/mangudai-portrait.png';
import stormPortrait from './sprites/storm-portrait.png';
import stormSprite from './sprites/storm.png';
import fogImage from './tiles/fog.png';
import hailImage from './tiles/hail.png';
import quicksandImage from './tiles/quicksand.png';
import ruinsImage from './tiles/ruins.png';
import sandImage from './tiles/sand.png';
import sandstormImage from './tiles/sandstorm.png';

export {BOARD_LAYOUT, SCENE_SIZE};

export type HighlightKind = 'zone' | 'path' | 'target' | 'chosen' | 'area' | 'lane' | 'melee';

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
  /** Units shown at other hexes than the fight's (deployment being arranged). */
  positions?: Record<string, Hex>;
  /** Where the acting unit's card lands after the planned turn: a ghost card on the track. */
  previewSlot?: number | null;
  /** The slot the planned turn's cost aims at; when it's taken, the card yields on to `previewSlot`. */
  aimSlot?: number | null;
  /** Arrow flights to draw (the bow's lanes): `hits` when it ends on a unit. */
  arrows?: {from: Hex; to: Hex; hits: boolean}[];
}

const SIDE_COLOR = {player: '#60a5fa', enemy: '#f87171'};
/** The tint over the whole hex a unit stands on: its side's colour. */
const SIDE_TINT = {player: 'rgba(59,130,246,0.38)', enemy: 'rgba(239,68,68,0.38)'};
const HERO_COLOR = {bokh: '#b45309', mangudai: '#15803d', storm: '#4f46e5'};
/**
 * Board sprites, facing right: square frames (32×32, or 36×36 for a mounted
 * hero) side by side, a 2-frame idle from scripts/idle-sheet.py. Heroes
 * without one are drawn as a lettered disc.
 */
const HERO_SPRITE: Partial<Record<Unit['hero'], string>> = {
  bokh: bokhSprite,
  mangudai: mangudaiSprite,
  storm: stormSprite,
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
const HERO_PORTRAIT: Partial<Record<Unit['hero'], {src: string; faceX: number}>> = {
  bokh: {src: bokhPortrait, faceX: 17},
  mangudai: {src: mangudaiPortrait, faceX: 18},
  storm: {src: stormPortrait, faceX: 19},
};
interface HighlightStyle {
  fill: string;
  stroke: string;
  dash?: number[];
}
const HIGHLIGHT: Record<HighlightKind, HighlightStyle> = {
  zone: {fill: 'rgba(96,165,250,0.18)', stroke: 'rgba(96,165,250,0.5)'},
  path: {fill: 'rgba(250,204,21,0.25)', stroke: 'rgba(250,204,21,0.8)'},
  /** Hexes an ability can target: purple, outlined solid, so it never reads as the enemy's red tint. */
  target: {fill: 'rgba(192,132,252,0.18)', stroke: 'rgba(192,132,252,0.95)'},
  chosen: {fill: 'rgba(192,132,252,0.45)', stroke: '#fde047'},
  area: {fill: 'rgba(251,146,60,0.28)', stroke: 'rgba(251,146,60,0.9)'},
  /** Hexes an arrow flies over. */
  lane: {fill: 'rgba(253,224,71,0.14)', stroke: 'rgba(253,224,71,0.35)'},
  /** The hexes a melee ability reaches, around its targets. */
  melee: {fill: 'rgba(192,132,252,0.12)', stroke: 'rgba(192,132,252,0.75)', dash: [5, 3]},
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
 * markers on top, or, when the track would cover that (the top row),
 * below its feet with the markers under the bar. `top` and `bottom` bound
 * the lot, so the tooltip can keep clear of it.
 */
function healthStack(
  hex: Hex,
  marks: number
): {barY: number; marksY: number; top: number; bottom: number} {
  const c = center(hex);
  const barY = c.y - HEALTH_BAR.y - HEALTH_BAR.h;
  const marksY = c.y - MARKS_Y;
  const top = (marks > 0 ? marksY - MARK.r : barY) - 2;
  if (top >= TRACK_AREA.y + TRACK_AREA.height + 2)
    return {barY, marksY, top, bottom: c.y - HEALTH_BAR.y + 2};
  const below = c.y + SPRITE_FEET + 6;
  const belowMarks = below + HEALTH_BAR.h + 5 + MARK.r;
  return {
    barY: below,
    marksY: belowMarks,
    top: below - 2,
    bottom: (marks > 0 ? belowMarks + MARK.r : below + HEALTH_BAR.h) + 2,
  };
}

/** The hovered hex's outline. */
const HOVER: HighlightStyle = {fill: 'rgba(255,255,255,0.08)', stroke: '#ffffff'};

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
 * Draws everything over the board's tiles (which are hex entities): the
 * track of cards along the top (3.1, as in Mana Khemia), tile markings,
 * highlights, arrow lanes, hail, charging areas, units (their health and
 * statuses only on their turn, or when hovered, tapped or in an aimed
 * attack's reach), the
 * previewed outcome, and a tooltip for the hex under the mouse. Plain shapes and text (brief section 9). The page drives it with
 * `tactics:board` events; taps come from `TacticsInputSystem`.
 */
export class TacticsBoardSystem extends BaseSystem {
  // After RenderSystem (995) has drawn the tiles.
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
  private bus: EventBus | null = null;
  private cleanup: (() => void)[] = [];

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
      bus.on<TacticsHoverPayload>('tactics:hover', (hover) => (this.hover = hover))
    );
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
    if (!before || !after || before.mapId !== after.mapId || before.phase === 'deploy') return;
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

  onUpdate({ctx, deltaTime}: SystemContext): void {
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
    const map = MAPS[fight.mapId]!;
    // The board's weather moves with time, unless the device asks for reduced motion.
    const t = this.still ? null : this.time;
    for (const h of map.hexes) drawTile(ctx, h, tileAt(map, h), t);
    for (const fog of fight.fog ?? []) drawFog(ctx, fog.hex, t);
    for (const effect of fight.effects) drawHail(ctx, effect.hex, t);
    for (const h of map.hexes) if (tileAt(map, h) === 'obstacle') drawRuins(ctx, h);
    // Each unit's hex is tinted by side, under the highlights so moves and targets still show.
    const previewedTo = new Map(scene.preview.map((p) => [p.unitId, p]));
    for (const u of fight.units) {
      const hex = scene.positions?.[u.id] ?? u.hex;
      if (!u.alive || !hex) continue;
      const p = previewedTo.get(u.id);
      const moved = Boolean(p?.to && hexKey(p.to) !== hexKey(hex));
      tintHex(ctx, hex, SIDE_TINT[u.side], moved || p?.killed ? 0.4 : 1);
      if (p?.to && moved && !p.killed) tintHex(ctx, p.to, SIDE_TINT[u.side], 0.7);
    }
    for (const h of scene.highlights) fillHex(ctx, h.hex, HIGHLIGHT[h.kind]);
    // The hovered hex's outline goes under the units, so it never crosses a sprite.
    if (this.hover.hex) fillHex(ctx, this.hover.hex, HOVER);
    for (const a of scene.arrows ?? []) drawArrow(ctx, a.from, a.to, a.hits);
    for (const u of fight.units) if (u.alive && u.charging) drawCharge(ctx, u);

    const previewed = new Map(scene.preview.map((p) => [p.unitId, p]));
    const acting = fight.awaiting;
    for (const u of fight.units) {
      const hex = scene.positions?.[u.id] ?? u.hex;
      if (!u.alive || !hex) continue;
      const p = previewed.get(u.id);
      const moved = p && p.to && hexKey(p.to) !== hexKey(hex);
      drawUnit(ctx, u, hex, {
        acting: u.id === acting,
        selected: u.id === scene.selectedUnitId || u.id === this.hover.unitId,
        faded: Boolean(moved || p?.killed),
        frame: this.still ? 0 : idleFrame(u.id, this.time),
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

    if (playing) drawPlaybackEvent(ctx, playing);

    // Health and statuses show only on the unit whose turn it is, the unit
    // being looked at (hovered on the board or the track, or tapped), and
    // whoever an attack being aimed could hit.
    // Where it ends up when the turn moves it.
    const looked = new Set<string>();
    if (fight.awaiting) looked.add(fight.awaiting);
    if (scene.inspectedUnitId) looked.add(scene.inspectedUnitId);
    for (const id of scene.healthUnitIds ?? []) looked.add(id);
    if (this.hover.unitId) looked.add(this.hover.unitId);
    const hovered = this.hover.hex && unitAt(fight, this.hover.hex, scene.positions);
    if (hovered) looked.add(hovered.id);
    for (const u of fight.units) {
      const hex = scene.positions?.[u.id] ?? u.hex;
      if (!u.alive || !hex || !looked.has(u.id)) continue;
      const p = previewed.get(u.id);
      const at = p?.to && !p.killed ? p.to : hex;
      const marks = statusMarks(fight, u);
      const stack = healthStack(at, marks.length);
      drawHealthBar(ctx, u, at, stack.barY, p?.hpBefore ?? u.hp, p?.hpAfter);
      drawStatusMarks(ctx, marks, at, stack.marksY);
    }
    for (const e of this.expiries) {
      const u = fight.units.find((v) => v.id === e.unitId);
      const hex = u && (scene.positions?.[u.id] ?? u.hex);
      if (!u?.alive || !hex) continue;
      const k = e.elapsed / MARK_EXPIRE_SECONDS;
      const c = center(hex);
      const x = c.x + (e.index - (e.count - 1) / 2) * MARK.step;
      // Reduced motion: it fades where it was.
      const rise = this.still ? 0 : MARK_EXPIRE_RISE * (1 - (1 - k) ** 2);
      const y = healthStack(hex, e.count).marksY - rise;
      drawStatusMark(ctx, e.mark, x, y, 1 - k * k);
    }

    if (fight.phase !== 'deploy') {
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
    if (this.hover.hex) drawHover(ctx, fight, this.hover.hex, scene.positions);
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

/** An arrow's flight from the archer to where it stops: solid with a head if it hits, dashed if not. */
function drawArrow(ctx: CanvasRenderingContext2D, from: Hex, to: Hex, hits: boolean): void {
  const a = center(from);
  const b = center(to);
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  if (len === 0) return;
  const ux = (b.x - a.x) / len;
  const uy = (b.y - a.y) / len;
  // Start clear of the archer's circle; stop short of a target's.
  const sx = a.x + ux * 20;
  const sy = a.y + uy * 20;
  const ex = b.x - ux * (hits ? 18 : 0);
  const ey = b.y - uy * (hits ? 18 : 0);
  ctx.save();
  ctx.strokeStyle = hits ? '#fde047' : 'rgba(253,224,71,0.6)';
  ctx.fillStyle = ctx.strokeStyle;
  ctx.lineWidth = hits ? 2.5 : 2;
  ctx.setLineDash(hits ? [] : [6, 5]);
  ctx.beginPath();
  ctx.moveTo(sx, sy);
  ctx.lineTo(ex, ey);
  ctx.stroke();
  ctx.setLineDash([]);
  if (hits) {
    ctx.beginPath();
    ctx.moveTo(ex, ey);
    ctx.lineTo(ex - ux * 9 - uy * 5, ey - uy * 9 + ux * 5);
    ctx.lineTo(ex - ux * 9 + uy * 5, ey - uy * 9 - ux * 5);
    ctx.closePath();
    ctx.fill();
  } else {
    // Where a miss falls: a small cross.
    ctx.beginPath();
    ctx.moveTo(ex - 4, ey - 4);
    ctx.lineTo(ex + 4, ey + 4);
    ctx.moveTo(ex + 4, ey - 4);
    ctx.lineTo(ex - 4, ey + 4);
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * A numbered step badge on a hex's left edge, clear of the status markers
 * and damage labels above a unit; a second one on the same hex sits on the right.
 */
function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
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
  roundRect(ctx, x, y, width, height, 8);
  ctx.fillStyle = 'rgba(17,24,39,0.92)';
  ctx.fill();
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
  ctx.shadowColor = 'rgba(0,0,0,0.6)';
  ctx.shadowBlur = 4;
  ctx.shadowOffsetX = 2;
  roundRect(ctx, cx, cy, deck.cardW, h, 5);
  // The ghost is just an outline where the acting card lands: no portrait,
  // so the acting unit doesn't show twice.
  ctx.fillStyle = !u || ghost ? '#1f2937' : u.side === 'player' ? '#1e3a8a' : '#7f1d1d';
  ctx.fill();
  ctx.shadowColor = 'transparent';
  const strokeBorder = () => {
    ctx.setLineDash(ghost ? [3, 2] : []);
    ctx.strokeStyle = !u
      ? 'rgba(255,255,255,0.18)'
      : ghost || acting
        ? '#fde047'
        : u.id === opts.selected || u.id === opts.hovered
          ? '#ffffff'
          : SIDE_COLOR[u.side];
    ctx.lineWidth = acting || ghost ? 2.5 : 1.25;
    // The ghost's thick dashes sit inside its edge, so none show past the card in front.
    if (ghost) roundRect(ctx, cx + 1.25, cy + 1.25, deck.cardW - 2.5, h - 2.5, 4);
    ctx.stroke();
    ctx.setLineDash([]);
  };
  strokeBorder();

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
      roundRect(ctx, cx, cy, deck.cardW, h, 5);
      ctx.clip();
      ctx.imageSmoothingEnabled = false;
      ctx.translate(Math.round(mid - faceX), Math.round(cy));
      if (u.side === 'enemy') {
        ctx.translate(img.width * scale, 0);
        ctx.scale(-1, 1);
      }
      ctx.drawImage(img, 0, 0, img.width * scale, img.height * scale);
      ctx.restore();
      // The border again, over the portrait.
      roundRect(ctx, cx, cy, deck.cardW, h, 5);
      strokeBorder();
    } else {
      // No portrait yet: a disc in the hero's colour with its letter.
      const r = Math.min(11, deck.w / 2 - 2);
      ctx.beginPath();
      ctx.arc(mid, cy + h / 2 - 4, r, 0, Math.PI * 2);
      ctx.fillStyle = HERO_COLOR[u.hero];
      ctx.fill();
      ctx.strokeStyle = SIDE_COLOR[u.side];
      ctx.lineWidth = 1.5;
      ctx.stroke();
      label(ctx, HEROES[u.hero].letter, mid, cy + h / 2 - 3, '#ffffff', 11, true);
    }
    // A charging card: its ability triggers when this slot comes up.
    if (u.charging) label(ctx, '!', cx + deck.cardW - 5, cy + 8, '#d8b4fe', 12, true);
  }
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
  ctx.strokeStyle = '#fde047';
  ctx.lineWidth = 2;
  roundRect(ctx, left + 1, deck.y + 1, deck.w - 2, deck.h - 2, 4);
  ctx.stroke();
  ctx.setLineDash([]);
  const y = deck.y + deck.h - 18;
  const x1 = mid(aim);
  const x2 = mid(land) - 4;
  // Dark under yellow, so it reads over any card.
  for (const [color, width] of [
    ['rgba(0,0,0,0.75)', 4],
    ['#fde047', 2],
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

/** The hovered hex's tooltip: its tile, hail and unit (the outline is drawn under the units). */
function drawHover(
  ctx: CanvasRenderingContext2D,
  fight: FightState,
  h: Hex,
  positions?: Record<string, Hex>
): void {
  const map = MAPS[fight.mapId]!;
  const lines: {text: string; color: string; bold?: boolean}[] = [];
  const unit = unitAt(fight, h, positions);
  if (unit) {
    // The side shows in the colour, as on the board: just the hero's name
    // (its health is the bar over it).
    lines.push({text: HEROES[unit.hero].name, color: SIDE_COLOR[unit.side], bold: true});
  }
  const tile = tileAt(map, h);
  if (tile !== 'sand' || !unit) {
    const info = TILE_INFO[tile];
    lines.push({
      text: tile === 'sand' ? info.name : `${info.name}: ${info.short}`,
      color: '#f3f4f6',
      bold: !unit,
    });
  }
  const hail = fight.effects.find((e) => hexEquals(e.hex, h));
  if (hail) {
    const info = hailInfo(hail, fight.currentSlot);
    lines.push({text: `${info.name}: ${info.short}`, color: '#7dd3fc'});
  }
  const fog = fogAt(fight, h);
  if (fog) {
    const info = fogInfo(fog, fight.currentSlot);
    lines.push({text: `${info.name}: ${info.short}`, color: '#cbd5e1'});
  }
  ctx.save();
  ctx.font = 'bold 11px system-ui, sans-serif';
  const w = Math.max(...lines.map((l) => ctx.measureText(l.text).width)) + 14;
  const lh = 15;
  const boxH = lines.length * lh + 8;
  const c = center(h);
  const bx = Math.min(SCENE_SIZE.width - w - 4, Math.max(4, c.x - w / 2));
  // Above the hex (and a unit's health bar and statuses), or below it (and
  // them, when they're below too) when that would cover the track.
  const stack = unit && healthStack(h, statusMarks(fight, unit).length);
  const aboveStack = stack && stack.top < c.y ? stack.top : c.y - 36 * HEX_SCALE;
  const above = aboveStack - 2 - boxH;
  const belowStack = stack && stack.bottom > c.y ? stack.bottom + 2 : c.y + 36 * HEX_SCALE;
  const by = above < TRACK_AREA.y + TRACK_AREA.height + 2 ? belowStack : above;
  roundRect(ctx, bx, by, w, boxH, 5);
  ctx.fillStyle = 'rgba(17,24,39,0.94)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
  lines.forEach((l, i) => {
    ctx.save();
    ctx.font = `${l.bold ? 'bold ' : ''}11px system-ui, sans-serif`;
    ctx.fillStyle = l.color;
    ctx.textBaseline = 'middle';
    ctx.fillText(l.text, bx + 7, by + 4 + lh / 2 + i * lh);
    ctx.restore();
  });
}

/** The ground texture of each tile type; ruins stand on sand. */
const TILE_TEXTURE: Record<Tile, string> = {
  sand: sandImage,
  obstacle: sandImage,
  hazard: quicksandImage,
  conceal: sandstormImage,
};

/**
 * A pixel-art image (42×42 for a ground texture or effect) clipped to a hex,
 * at the sprites' scale, centred on it.
 */
function drawHexImage(
  ctx: CanvasRenderingContext2D,
  h: Hex,
  img: HTMLImageElement,
  opts: {alpha?: number; flipX?: boolean; dx?: number; dy?: number} = {}
): void {
  const c = center(h);
  const size = img.width * SPRITE_SCALE;
  // An offset in whole art pixels, so a moving image stays crisp.
  const dx = (opts.dx ?? 0) * SPRITE_SCALE;
  const dy = (opts.dy ?? 0) * SPRITE_SCALE;
  ctx.save();
  hexPath(ctx, h, 0);
  ctx.clip();
  ctx.globalAlpha = opts.alpha ?? 1;
  ctx.imageSmoothingEnabled = false;
  ctx.translate(Math.round(c.x) + dx, Math.round(c.y) + dy);
  if (opts.flipX) ctx.scale(-1, 1);
  ctx.drawImage(img, -size / 2, -size / 2, size, size);
  ctx.restore();
}

/**
 * A tile's ground: its texture (sand mirrored on alternate hexes, so the
 * board doesn't repeat) and its border. Until the image loads, the flat
 * colour under it and a code-drawn mark show. Ruins stand on sand and are
 * drawn later, by `drawRuins`.
 */
function drawTile(ctx: CanvasRenderingContext2D, h: Hex, tile: Tile, time: number | null): void {
  const ground = assetLoader.requestImage(TILE_TEXTURE[tile]);
  if (ground) {
    drawHexImage(ctx, h, ground, {flipX: tile === 'sand' && (h.q * 7 + h.r * 13) % 2 !== 0});
    if (tile === 'conceal' && time !== null) {
      // Sandstorm: the streaks gust back and forth along their diagonal, over
      // a still copy that fills any edge the moving one uncovers.
      const s = sway(time, SANDSTORM_SWAY_SECONDS, 2);
      if (s !== 0) drawHexImage(ctx, h, ground, {dx: s, dy: Math.trunc(s / 2)});
    }
    ctx.save();
    hexPath(ctx, h, 0.5);
    ctx.strokeStyle = '#8c7350';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  } else if (tile === 'hazard' || tile === 'conceal') {
    drawTileMark(ctx, center(h), tile);
  }
}

/** A ruin standing on its hex like a unit: over fog and hail, so it always reads as blocked. */
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

/** Seconds for fog to drift there and back. */
const FOG_SWAY_SECONDS = 6;
/** Seconds for a sandstorm's gust there and back. */
const SANDSTORM_SWAY_SECONDS = 2.4;

/**
 * A slow back-and-forth in whole art pixels, from −`amp` to `amp` and back
 * over `period` seconds (a triangle wave, so it holds no position longer).
 */
function sway(time: number, period: number, amp: number): number {
  const phase = (time / period) % 1;
  return Math.round((Math.abs(phase - 0.5) * 4 - 1) * amp);
}

/** Hailstones falling on a hail hex: each drops in turn, then a pause. */
const HAIL_DROPS = 3;
const HAIL_FALL_SECONDS = 0.45;
const HAIL_CYCLE_SECONDS = 1.5;

/**
 * Small outlined stones falling onto a hail hex and vanishing as they land
 * (the ground image already shows the fallen ones). Their columns, landing
 * rows and timing come from the hex, so hexes don't fall in step. Drawn in
 * art pixels at the sprites' scale, in the hail image's colours.
 */
function drawFallingHail(ctx: CanvasRenderingContext2D, h: Hex, time: number): void {
  const c = center(h);
  const px = SPRITE_SCALE;
  let seed = ((h.q * 73856093) ^ (h.r * 19349663)) >>> 0;
  const next = () => (seed = (seed * 1103515245 + 12345) >>> 0) / 2 ** 32;
  ctx.save();
  hexPath(ctx, h, 0);
  ctx.clip();
  for (let i = 0; i < HAIL_DROPS; i++) {
    const col = Math.round((next() - 0.5) * 24);
    const land = Math.round(next() * 22 - 8);
    const start = next() * HAIL_CYCLE_SECONDS;
    const k = ((time + start) % HAIL_CYCLE_SECONDS) / HAIL_FALL_SECONDS;
    if (k >= 1) continue;
    const top = -24;
    const row = Math.round(top + (land - top) * k * k);
    const x = Math.round(c.x) + col * px;
    const y = Math.round(c.y) + row * px;
    ctx.fillStyle = '#221816';
    ctx.fillRect(x - px, y - px, 4 * px, 4 * px);
    ctx.fillStyle = '#f1f5f9';
    ctx.fillRect(x, y, 2 * px, 2 * px);
    ctx.fillStyle = '#b8c8d0';
    ctx.fillRect(x + px, y + px, px, px);
  }
  ctx.restore();
}

function drawFog(ctx: CanvasRenderingContext2D, h: Hex, time: number | null): void {
  const img = assetLoader.requestImage(fogImage);
  // Drawn partly see-through, so the ground still shows under it, drifting
  // slowly side to side (every fogged hex together, so a bank moves as one).
  const dx = time === null ? 0 : sway(time, FOG_SWAY_SECONDS, 2);
  if (img) drawHexImage(ctx, h, img, {alpha: 0.7, dx});
  else fillHex(ctx, h, {fill: 'rgba(203,213,225,0.35)', stroke: 'rgba(226,232,240,0.6)'});
}

function drawHail(ctx: CanvasRenderingContext2D, h: Hex, time: number | null): void {
  const at = center(h);
  const img = assetLoader.requestImage(hailImage);
  if (img) {
    drawHexImage(ctx, h, img);
    if (time !== null) drawFallingHail(ctx, h, time);
    return;
  }
  fillHex(ctx, h, {fill: 'rgba(186,230,253,0.45)', stroke: '#7dd3fc'});
  ctx.save();
  ctx.translate(at.x, at.y);
  ctx.scale(HEX_SCALE, HEX_SCALE);
  const c = {x: 0, y: 0};
  ctx.fillStyle = '#e0f2fe';
  for (const [dx, dy] of [
    [-12, -12],
    [10, -14],
    [-16, 6],
    [14, 8],
    [0, 16],
  ] as const) {
    ctx.beginPath();
    ctx.arc(c.x + dx, c.y + dy, 2.2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawCharge(ctx: CanvasRenderingContext2D, u: Unit): void {
  const {ability, target} = u.charging!;
  const radius = ability === 'volley' ? ABILITY.volley.radius : ABILITY.freeze.radius;
  ctx.save();
  ctx.setLineDash([5, 4]);
  for (let q = -radius; q <= radius; q++) {
    for (let r = -radius; r <= radius; r++) {
      const h = {q: target.q + q, r: target.r + r};
      if (hexDistance(h, target) > radius) continue;
      hexPath(ctx, h, 4);
      ctx.strokeStyle = SIDE_COLOR[u.side];
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }
  ctx.restore();
  const c = center(target);
  label(ctx, ABILITIES[ability].name, c.x, c.y + 24 * HEX_SCALE, SIDE_COLOR[u.side], 10);
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
  const lift = e.how === 'throw' ? Math.sin(Math.PI * k) * 26 : 0;
  return {x: Math.round(lerp(a.x, b.x, t)), y: Math.round(lerp(a.y, b.y, t) - lift)};
}

/** Areas the playback lights up when an ability lands (its radius around the target). */
const PLAYBACK_RADIUS: Partial<Record<AbilityId, number>> = {
  volley: ABILITY.volley.radius,
  freeze: ABILITY.freeze.radius,
  fog: ABILITY.fog.radius,
};

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
  const map = MAPS[fight.mapId]!;
  const u = fight.units.find((v) => v.id === e.unitId);
  if (!u) return;
  const titleY = (h: Hex) => center(h).y - (HEALTH_BAR.y + HEALTH_BAR.h + 12);
  const title = (h: Hex, text: string, color: string) => {
    ctx.save();
    ctx.globalAlpha = k < 0.75 ? 1 : (1 - k) * 4;
    const c = center(h);
    ctx.font = 'bold 12px system-ui, sans-serif';
    const w = ctx.measureText(text).width + 12;
    ctx.fillStyle = 'rgba(17,24,39,0.85)';
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
          SIDE_COLOR[u.side]
        );
      return;
    case 'action':
    case 'charge': {
      const def = ABILITIES[e.ability];
      const name = e.kind === 'charge' ? `Charging ${def.name}` : def.name;
      if (u.hex) title(u.hex, name, e.kind === 'charge' ? '#d8b4fe' : '#fde047');
      if (!e.target) return;
      const radius = PLAYBACK_RADIUS[e.ability] ?? 0;
      ctx.save();
      ctx.globalAlpha = 1 - k * 0.6;
      for (const h of map.hexes)
        if (hexDistance(h, e.target) <= radius)
          fillHex(ctx, h, e.kind === 'charge' ? HIGHLIGHT.target : HIGHLIGHT.area);
      ctx.restore();
      // An arrow flying from the bow to its mark.
      if (e.ability === 'bow' && u.hex && k < 0.7) {
        const a = center(u.hex);
        const b = center(e.target);
        const t = k / 0.7;
        const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
        const dx = ((b.x - a.x) / len) * 14;
        const dy = ((b.y - a.y) / len) * 14;
        const x = lerp(a.x, b.x, t);
        const y = lerp(a.y, b.y, t) - 18;
        ctx.save();
        ctx.strokeStyle = '#fde68a';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(x - dx, y - dy);
        ctx.lineTo(x, y);
        ctx.stroke();
        ctx.restore();
      }
      return;
    }
    case 'damage':
    case 'heal': {
      if (!u.hex) return;
      const c = center(u.hex);
      if (e.kind === 'damage') tintHex(ctx, u.hex, 'rgba(239,68,68,0.55)', 1 - k);
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
    case 'step':
      return;
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
  }
): void {
  const c = opts.at ?? center(hex);
  ctx.save();
  ctx.globalAlpha = (opts.faded ? 0.35 : opts.ghost ? 0.85 : 1) * (opts.alpha ?? 1);
  if (!opts.at) {
    // The hex's border: yellow on the unit whose turn it is, white when
    // selected, otherwise its side's colour (the hex is tinted to match).
    hexPath(ctx, hex, 2.5);
    if (opts.ghost) ctx.setLineDash([5, 4]);
    ctx.strokeStyle = opts.acting ? '#fde047' : opts.selected ? '#ffffff' : SIDE_COLOR[u.side];
    ctx.lineWidth = opts.acting || opts.selected ? 3.5 : 3;
    ctx.stroke();
    ctx.setLineDash([]);
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
    ctx.strokeStyle = 'rgba(17,24,39,0.8)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    label(ctx, HEROES[u.hero].letter, c.x, c.y + 1, '#ffffff', 15, true);
  }
  ctx.restore();
}

/** Each status's marker: its letter and colour, in the order a row shows them. */
const STATUS_MARK: Record<StatusKind, [string, string]> = {
  immobilized: ['I', '#38bdf8'],
  slowed: ['S', '#a78bfa'],
  vulnerable: ['V', '#fb923c'],
  crushed: ['C', '#ef4444'],
  taunted: ['T', '#facc15'],
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
  if (isFlanked(fight, u)) marks.push(['F', '#f472b6']);
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
  ctx.strokeStyle = 'rgba(17,24,39,0.9)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  label(ctx, m, x, y + 0.5, '#111827', 9, true);
  ctx.restore();
}

/** The living unit standing at `h` (or placed there while deploying). */
function unitAt(fight: FightState, h: Hex, positions?: Record<string, Hex>): Unit | undefined {
  return fight.units.find((u) => {
    const at = positions?.[u.id] ?? u.hex;
    return u.alive && at && hexEquals(at, h);
  });
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
  roundRect(ctx, x - 2, y - 2, w + 4, h + 4, 4);
  ctx.fillStyle = 'rgba(17,24,39,0.9)';
  ctx.fill();
  ctx.strokeStyle = SIDE_COLOR[u.side];
  ctx.lineWidth = 1.5;
  ctx.stroke();
  const f = frac(after);
  if (after !== hp) {
    ctx.fillStyle = after < hp ? 'rgba(248,113,113,0.45)' : 'rgba(134,239,172,0.45)';
    ctx.fillRect(x + w * Math.min(f, frac(hp)), y, w * Math.abs(f - frac(hp)), h);
  }
  ctx.fillStyle = f > 0.5 ? '#4ade80' : f > 0.25 ? '#facc15' : '#f87171';
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
  ctx.font = 'bold 13px monospace';
  const w = ctx.measureText(text).width + 8;
  ctx.fillStyle = 'rgba(17,24,39,0.85)';
  ctx.fillRect(x - w / 2, y - 9, w, 17);
  ctx.restore();
  label(ctx, text, x, y, amount >= 0 ? '#fca5a5' : '#86efac', 13, true);
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
  ctx.font = `${bold ? 'bold ' : ''}${size}px system-ui, sans-serif`;
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y);
  ctx.restore();
}
