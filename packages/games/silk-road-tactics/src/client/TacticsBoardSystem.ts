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
import {MAPS, tileAt} from '../rules/map';
import type {FightState, Unit} from '../rules/types';
import {BOARD_LAYOUT, SCENE_SIZE, TRACK_AREA, trackCards, trackSlots} from './layout';
import type {TrackCard, TrackSlots} from './layout';
import type {TacticsHoverPayload} from './TacticsInputSystem';
import bokhPortrait from './sprites/bokh-portrait.png';
import bokhSprite from './sprites/bokh.png';
import mangudaiSprite from './sprites/mangudai.png';
import mangudaiPortrait from './sprites/mangudai-portrait.png';
import stormPortrait from './sprites/storm-portrait.png';
import stormSprite from './sprites/storm.png';

export {BOARD_LAYOUT, SCENE_SIZE};

export type HighlightKind =
  | 'zone'
  | 'move'
  | 'path'
  | 'target'
  | 'chosen'
  | 'area'
  | 'lane'
  | 'inspect';

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
  /** The planned turn's steps, numbered in the order they resolve, at the hex each happens. */
  steps?: {hex: Hex; n: number}[];
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
  move: {fill: 'rgba(255,255,255,0.18)', stroke: 'rgba(255,255,255,0.55)'},
  path: {fill: 'rgba(250,204,21,0.25)', stroke: 'rgba(250,204,21,0.8)'},
  /** Hexes an ability can target: the inspect purple, outlined solid, so it never reads as the enemy's red tint. */
  target: {fill: 'rgba(192,132,252,0.18)', stroke: 'rgba(192,132,252,0.95)'},
  chosen: {fill: 'rgba(192,132,252,0.45)', stroke: '#fde047'},
  area: {fill: 'rgba(251,146,60,0.28)', stroke: 'rgba(251,146,60,0.9)'},
  /** Hexes an arrow flies over. */
  lane: {fill: 'rgba(253,224,71,0.14)', stroke: 'rgba(253,224,71,0.35)'},
  /** Where an inspected unit could move. */
  inspect: {fill: 'rgba(192,132,252,0.12)', stroke: 'rgba(192,132,252,0.75)', dash: [5, 3]},
};

/** The health bar over an inspected unit: centred on the hex, its bottom edge `HEALTH_BAR.y` above the centre. */
const HEALTH_BAR = {w: 60, h: 10, y: 50};
/** Status markers in a row above the health bar: their radius, and the gap between centres. */
const MARK = {r: 6.5, step: 15};
/** How far above the hex's centre the markers' row is centred. */
const MARKS_Y = HEALTH_BAR.y + HEALTH_BAR.h + 5 + MARK.r;

/** The hovered hex's outline. */
const HOVER: HighlightStyle = {fill: 'rgba(255,255,255,0.08)', stroke: '#ffffff'};

/** Seconds one spent card takes to lift off the track. */
const CARD_LIFT_SECONDS = 0.18;
/** The most a whole advance takes, however many slots it passes. */
const ADVANCE_MAX_SECONDS = 1.2;

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
  /** Seconds since the board started, for the units' idle animations. */
  private time = 0;
  /** The player's device asks for reduced motion: units hold still. */
  private still = false;
  private cleanup: (() => void)[] = [];

  onInit({events}: Omit<SystemContext, 'deltaTime'>): void {
    const bus: EventBus = events;
    this.still =
      typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.cleanup.push(
      bus.on<BoardScene>('tactics:board', (scene) => {
        this.startAdvance(this.scene.fight, scene.fight);
        this.scene = scene;
      })
    );
    this.cleanup.push(
      bus.on<TacticsHoverPayload>('tactics:hover', (hover) => (this.hover = hover))
    );
  }

  onDestroy(): void {
    for (const fn of this.cleanup) fn();
    this.cleanup = [];
  }

  /** A turn moved the track on: animate the cards it passed, from wherever the deck shows now. */
  private startAdvance(before: FightState | null, after: FightState | null): void {
    if (!before || !after || before.mapId !== after.mapId || before.phase === 'deploy') return;
    if (after.currentSlot <= before.currentSlot) return;
    if (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches)
      return;
    const prev = this.advance;
    const from = prev ? Math.floor(trackStart(prev)) : before.currentSlot;
    const spent = new Map(prev?.spent);
    for (const u of before.units) {
      if (u.alive && u.slot !== null && u.slot >= before.currentSlot && u.slot < after.currentSlot)
        spent.set(u.slot, u);
    }
    this.advance = {from, to: after.currentSlot, spent, elapsed: 0};
  }

  onUpdate({ctx, deltaTime}: SystemContext): void {
    const {fight} = this.scene;
    if (!fight) return;
    this.time += deltaTime;
    if (this.advance) {
      this.advance.elapsed += deltaTime;
      if (trackStart(this.advance) >= this.advance.to) this.advance = null;
    }
    const map = MAPS[fight.mapId]!;
    for (const [key, tile] of Object.entries(map.tiles)) {
      const [q, r] = key.split(',').map(Number);
      drawTileMark(ctx, center({q: q!, r: r!}), tile);
    }
    for (const fog of fight.fog ?? []) drawFog(ctx, fog.hex);
    for (const effect of fight.effects)
      drawHail(ctx, effect.hex, effect.untilSlot - fight.currentSlot + 1);
    // Each unit's hex is tinted by side, under the highlights so moves and targets still show.
    const previewedTo = new Map(this.scene.preview.map((p) => [p.unitId, p]));
    for (const u of fight.units) {
      const hex = this.scene.positions?.[u.id] ?? u.hex;
      if (!u.alive || !hex) continue;
      const p = previewedTo.get(u.id);
      const moved = Boolean(p?.to && hexKey(p.to) !== hexKey(hex));
      tintHex(ctx, hex, SIDE_TINT[u.side], moved || p?.killed ? 0.4 : 1);
      if (p?.to && moved && !p.killed) tintHex(ctx, p.to, SIDE_TINT[u.side], 0.7);
    }
    for (const h of this.scene.highlights) fillHex(ctx, h.hex, HIGHLIGHT[h.kind]);
    // The hovered hex's outline goes under the units, so it never crosses a sprite.
    if (this.hover.hex) fillHex(ctx, this.hover.hex, HOVER);
    for (const a of this.scene.arrows ?? []) drawArrow(ctx, a.from, a.to, a.hits);
    for (const u of fight.units) if (u.alive && u.charging) drawCharge(ctx, u);

    const previewed = new Map(this.scene.preview.map((p) => [p.unitId, p]));
    const acting = fight.awaiting;
    for (const u of fight.units) {
      const hex = this.scene.positions?.[u.id] ?? u.hex;
      if (!u.alive || !hex) continue;
      const p = previewed.get(u.id);
      const moved = p && p.to && hexKey(p.to) !== hexKey(hex);
      drawUnit(ctx, u, hex, {
        acting: u.id === acting,
        selected: u.id === this.scene.selectedUnitId || u.id === this.hover.unitId,
        faded: Boolean(moved || p?.killed),
        frame: this.still ? 0 : idleFrame(u.id, this.time),
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

    // Health and statuses show only on the unit whose turn it is, the unit
    // being looked at (hovered on the board or the track, or tapped), and
    // whoever an attack being aimed could hit.
    // Where it ends up when the turn moves it.
    const looked = new Set<string>();
    if (fight.awaiting) looked.add(fight.awaiting);
    if (this.scene.inspectedUnitId) looked.add(this.scene.inspectedUnitId);
    for (const id of this.scene.healthUnitIds ?? []) looked.add(id);
    if (this.hover.unitId) looked.add(this.hover.unitId);
    const hovered = this.hover.hex && unitAt(fight, this.hover.hex, this.scene.positions);
    if (hovered) looked.add(hovered.id);
    for (const u of fight.units) {
      const hex = this.scene.positions?.[u.id] ?? u.hex;
      if (!u.alive || !hex || !looked.has(u.id)) continue;
      const p = previewed.get(u.id);
      const at = p?.to && !p.killed ? p.to : hex;
      drawHealthBar(ctx, u, at, p?.hpBefore ?? u.hp, p?.hpAfter);
      drawStatusMarks(ctx, statusMarks(fight, u), at);
    }

    const badgesAt = new Map<string, number>();
    for (const step of this.scene.steps ?? []) {
      const k = hexKey(step.hex);
      const i = badgesAt.get(k) ?? 0;
      badgesAt.set(k, i + 1);
      drawStepBadge(ctx, step.hex, step.n, i);
    }

    if (fight.phase !== 'deploy') {
      drawTrack(
        ctx,
        fight,
        trackCards(fight, this.scene.previewSlot ?? null),
        this.scene.previewSlot ?? null,
        this.scene.aimSlot ?? null,
        this.advance,
        {
          selected: this.scene.selectedUnitId,
          hovered: this.hover.unitId,
        }
      );
    }
    if (this.hover.hex) drawHover(ctx, fight, this.hover.hex, this.scene.positions);
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
function drawStepBadge(ctx: CanvasRenderingContext2D, h: Hex, n: number, index: number): void {
  const c = center(h);
  const x = c.x + (index === 0 ? -21 : 21);
  const y = c.y;
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, 7.5, 0, Math.PI * 2);
  ctx.fillStyle = '#fde047';
  ctx.fill();
  ctx.strokeStyle = '#111827';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();
  label(ctx, `${n}`, x, y + 0.5, '#111827', 10, true);
}

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
 * on to where it lands. After a turn, the
 * cards it passed lift up off the track one by one, the rest sliding
 * forward, until the next turn's card is in front.
 */
function drawTrack(
  ctx: CanvasRenderingContext2D,
  fight: FightState,
  cards: TrackCard[],
  previewSlot: number | null,
  aimSlot: number | null,
  advance: TrackAdvance | null,
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
  // Back to front, so each card covers the left of the one behind it.
  for (let slot = Math.ceil(start + deck.count - 1); slot >= Math.floor(start); slot--) {
    const passed = advance !== null && slot < advance.to;
    const spent = passed ? advance.spent.get(slot) : undefined;
    const card = passed ? undefined : bySlot.get(slot);
    const u = spent ?? (card ? fight.units.find((v) => v.id === card.unitId)! : null);
    const ghost = Boolean(card?.ghost);
    const acting = Boolean(card && !ghost && u!.id === fight.awaiting);
    // How far back in the deck it sits (0 in front), and how far a passed card has lifted.
    const i = Math.max(0, slot - start);
    const lift = passed ? Math.min(1, Math.max(0, start - slot)) : 0;
    const cx = deck.x0 + i * deck.w;
    const cy = deck.y - lift * (deck.y + deck.h + 4);
    ctx.save();
    ctx.globalAlpha = 1 - lift * 0.6;
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 4;
    ctx.shadowOffsetX = 2;
    roundRect(ctx, cx, cy, deck.cardW, deck.h, 5);
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
        const scale = Math.max(deck.h, deck.cardW) / img.height;
        const faceX = (u.side === 'enemy' ? img.width - portrait.faceX : portrait.faceX) * scale;
        ctx.save();
        roundRect(ctx, cx, cy, deck.cardW, deck.h, 5);
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
        roundRect(ctx, cx, cy, deck.cardW, deck.h, 5);
        strokeBorder();
      } else {
        // No portrait yet: a disc in the hero's colour with its letter.
        const r = Math.min(11, deck.w / 2 - 2);
        ctx.beginPath();
        ctx.arc(mid, cy + deck.h / 2 - 4, r, 0, Math.PI * 2);
        ctx.fillStyle = HERO_COLOR[u.hero];
        ctx.fill();
        ctx.strokeStyle = SIDE_COLOR[u.side];
        ctx.lineWidth = 1.5;
        ctx.stroke();
        label(ctx, HEROES[u.hero].letter, mid, cy + deck.h / 2 - 3, '#ffffff', 11, true);
      }
      // A charging card: its ability triggers when this slot comes up.
      if (u.charging) label(ctx, '!', cx + deck.cardW - 5, cy + 8, '#d8b4fe', 12, true);
    }
    ctx.restore();
  }
  if (!advance && previewSlot !== null && aimSlot !== null && aimSlot < previewSlot)
    drawYield(ctx, deck, aimSlot, previewSlot);
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
  // Above the hex (and a unit's health bar and statuses), or below it when that would cover the track.
  const clear = !unit
    ? 36 * HEX_SCALE
    : statusMarks(fight, unit).length > 0
      ? MARKS_Y + MARK.r + 3
      : HEALTH_BAR.y + HEALTH_BAR.h + 4;
  const above = c.y - clear - boxH;
  const by = above < TRACK_AREA.y + TRACK_AREA.height + 2 ? c.y + 36 * HEX_SCALE : above;
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

function drawFog(ctx: CanvasRenderingContext2D, h: Hex): void {
  fillHex(ctx, h, {fill: 'rgba(203,213,225,0.35)', stroke: 'rgba(226,232,240,0.6)'});
}

function drawHail(ctx: CanvasRenderingContext2D, h: Hex, slotsLeft: number): void {
  fillHex(ctx, h, {fill: 'rgba(186,230,253,0.45)', stroke: '#7dd3fc'});
  const at = center(h);
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
  label(ctx, `${slotsLeft}`, c.x + 18, c.y - 20, '#0c4a6e', 10);
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
  }
): void {
  const c = center(hex);
  ctx.save();
  ctx.globalAlpha = opts.faded ? 0.35 : opts.ghost ? 0.85 : 1;
  // The hex's border: yellow on the unit whose turn it is, white when
  // selected, otherwise its side's colour (the hex is tinted to match).
  hexPath(ctx, hex, 2.5);
  if (opts.ghost) ctx.setLineDash([5, 4]);
  ctx.strokeStyle = opts.acting ? '#fde047' : opts.selected ? '#ffffff' : SIDE_COLOR[u.side];
  ctx.lineWidth = opts.acting || opts.selected ? 3.5 : 3;
  ctx.stroke();
  ctx.setLineDash([]);
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

/** A unit's status markers: I(mmobilized), S(lowed), V(ulnerable), C(rushed), T(aunted), F(lanked). */
function statusMarks(fight: FightState, u: Unit): [string, string][] {
  const marks: [string, string][] = [];
  if (statusValue(u, 'immobilized')) marks.push(['I', '#38bdf8']);
  if (statusValue(u, 'slowed')) marks.push(['S', '#a78bfa']);
  if (statusValue(u, 'vulnerable')) marks.push(['V', '#fb923c']);
  if (statusValue(u, 'crushed')) marks.push(['C', '#ef4444']);
  if (u.statuses.some((s) => s.kind === 'taunted')) marks.push(['T', '#facc15']);
  if (isFlanked(fight, u)) marks.push(['F', '#f472b6']);
  return marks;
}

/** A looked-at unit's status markers, in a centred row above its health bar. */
function drawStatusMarks(ctx: CanvasRenderingContext2D, marks: [string, string][], hex: Hex): void {
  const c = center(hex);
  const y = c.y - MARKS_Y;
  marks.forEach(([m, color], i) => {
    const x = c.x + (i - (marks.length - 1) / 2) * MARK.step;
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, MARK.r, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = 'rgba(17,24,39,0.9)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
    label(ctx, m, x, y + 0.5, '#111827', 9, true);
  });
}

/** The living unit standing at `h` (or placed there while deploying). */
function unitAt(fight: FightState, h: Hex, positions?: Record<string, Hex>): Unit | undefined {
  return fight.units.find((u) => {
    const at = positions?.[u.id] ?? u.hex;
    return u.alive && at && hexEquals(at, h);
  });
}

/**
 * A looked-at unit's health, floating above its sprite, under its status markers;
 * just the bar (the numbers are in the page's details). A previewed change
 * shows the health it would lose as a pale stretch past the bar's end (or
 * gain, in green).
 */
function drawHealthBar(
  ctx: CanvasRenderingContext2D,
  u: Unit,
  hex: Hex,
  hp: number,
  hpAfter?: number
): void {
  const c = center(hex);
  const {w, h} = HEALTH_BAR;
  const x = c.x - w / 2;
  const y = c.y - HEALTH_BAR.y - h;
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
