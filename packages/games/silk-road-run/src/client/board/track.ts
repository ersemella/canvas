/**
 * The track of cards along the top (3.1): each unit's card, its marks
 * (charging, ultimate ready, skipped), yielding, and the deck running on.
 */
import {assetLoader} from '@canvas/engine';
import {HEROES} from '../../rules/config';
import type {FightState, Unit} from '../../rules/types';
import {TRACK_AREA, trackSlots} from '../layout';
import type {TrackBumps, TrackCard, TrackSlots} from '../layout';
import {PALETTE} from '../palette';
import {HERO_COLOR, SIDE_LIGHT, label, pixelRect, pixelShadow} from './pixels';
import {HERO_PORTRAIT} from './units';

/**
 * A track card's ground, behind the portrait: two flat bands of its side's
 * colour, the light one on top, like a pixel sky; dusk when empty.
 */
const CARD_BANDS = {
  player: {top: PALETTE.lapis, bottom: PALETTE.lapisDark},
  enemy: {top: PALETTE.madder, bottom: PALETTE.madderDark},
};
/** Seconds one spent card takes to lift off the track. */
const CARD_LIFT_SECONDS = 0.18;
/** The most a whole advance takes, however many slots it passes. */
const ADVANCE_MAX_SECONDS = 1.2;

/** Seconds a card takes to slide back to the slot of its unit's next turn. */
export const CARD_SLIDE_SECONDS = 0.55;
/** How many pixels the card Alignment has picked up stands above the deck. */
const ARRANGE_RAISE = 5;
/** How many pixels the front card grows above and below while its unit acts. */
const FRONT_CARD_GROW = 5;

/** A card sliding back along the deck after its unit's turn, from the position it left. */
export interface CardSlide {
  /** How far back in the deck it started (0 in front). */
  from: number;
  elapsed: number;
}

/**
 * The track running on after a turn: the cards from `from` up to `to` (the
 * next turn's) lift away one by one and the deck slides up behind them.
 */
export interface TrackAdvance {
  from: number;
  to: number;
  /** The units whose cards sat in the passed slots, as they were before. */
  spent: Map<number, Unit>;
  elapsed: number;
}

/**
 * The slot in front of the deck partway through an advance: each passed
 * card in turn eases off over its share of the time.
 */
export function trackStart(a: TrackAdvance): number {
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
export function slideIndex(s: CardSlide, slot: number, start: number): number {
  const e = slideProgress(s);
  return s.from * (1 - e) + Math.max(0, slot - start) * e;
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
 * The track as a fanned deck, as in Mana Khemia: a card for every
 * slot from now on, empty ones blank, the current one in front at the left
 * and each later one tucked behind the one before, showing a strip with
 * its unit. The planned turn's landing card is dashed, with an arrow from
 * the acting card to it, and every other card the turn moves (Hastened,
 * Delayed or bumped on) has one too, from its slot now to where it goes
 * (`drawMoves`). The acting unit's card stands a little taller in
 * front. After a turn, its card slides back to its new slot over the
 * others, and the empty cards it passed lift up off the track one by one,
 * the rest sliding forward, until the next turn's card is in front.
 */
export function drawTrack(
  ctx: CanvasRenderingContext2D,
  fight: FightState,
  cards: TrackCard[],
  previewSlot: number | null,
  bumps: TrackBumps,
  advance: TrackAdvance | null,
  slides: Map<string, CardSlide>,
  opts: TrackOpts
): void {
  const {x, y, width, height} = TRACK_AREA;
  const start = advance ? trackStart(advance) : fight.currentSlot;
  const deck = trackSlots(fight, previewSlot, start, bumps);
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
    // A charging card, or one a grapple holds off the track, greyed.
    const charging = Boolean(u && !ghost && !spent && (card?.held || isCharging(fight, u)));
    const mark = passed ? undefined : arrangeMark(opts, u, slot, ghost);
    drawCard(ctx, deck, u, {i, lift, ghost, acting, grow, charging, mark}, opts);
  }
  for (const {u, i} of sliding) {
    const acting = u.id === fight.awaiting;
    const charging = isCharging(fight, u);
    drawCard(
      ctx,
      deck,
      u,
      {i, lift: 0, ghost: false, acting, grow: Math.max(0, 1 - i), charging},
      opts
    );
  }
  if (!advance && previewSlot !== null) drawMoves(ctx, deck, trackMoves(fight, previewSlot, bumps));
  // The card Alignment has picked up, dragged: over everything, centred under the pointer.
  const dragged = opts.arrange?.held && fight.units.find((u) => u.id === opts.arrange!.held);
  if (dragged && opts.dragX != null) {
    const i = Math.max(
      0,
      Math.min(deck.count - 1, (opts.dragX - deck.x0 - deck.cardW / 2) / deck.w)
    );
    drawCard(ctx, deck, dragged, {i, lift: 0, ghost: false, grow: 0, mark: 'held'}, opts);
  }
}

/** What the track marks: the card selected and hovered, and Alignment's arranging (`BoardScene.arrange`). */
export interface TrackOpts {
  selected: string | null;
  hovered: string | null;
  arrange?: {movable: string[]; held: string | null; open: number[]} | null;
  /** Where the picked-up card is being dragged along the track, in scene pixels; null when it isn't. */
  dragX?: number | null;
}

/** How Alignment's arranging marks a card: one it may move, the one picked up, or a blank one it may go on. */
type ArrangeMark = 'movable' | 'held' | 'open';

function arrangeMark(
  opts: TrackOpts,
  u: Unit | null,
  slot: number,
  ghost: boolean
): ArrangeMark | undefined {
  const a = opts.arrange;
  if (!a || ghost) return undefined;
  if (u) return a.held === u.id ? 'held' : a.movable.includes(u.id) ? 'movable' : undefined;
  return a.held && a.open.includes(slot) ? 'open' : undefined;
}

/** A card the planned turn moves on the track, from the slot it holds to where it lands. */
interface TrackMove {
  from: number;
  to: number;
  /** The acting unit's own card, from the front to its landing, however it gets there. */
  acting: boolean;
}

/**
 * Every card the planned turn moves, one arrow each for its whole move
 * (owner, 2026-10-28): the acting card, from the front to where it lands
 * (its cost, yielding and any Haste in one), and every other card it
 * Hastens, Delays or bumps on (`TurnPreview.bumped`).
 */
function trackMoves(fight: FightState, previewSlot: number, bumps: TrackBumps): TrackMove[] {
  const moves: TrackMove[] = [];
  if (fight.awaiting && previewSlot !== fight.currentSlot)
    moves.push({from: fight.currentSlot, to: previewSlot, acting: true});
  for (const u of fight.units) {
    const to = bumps[u.id];
    if (u.id === fight.awaiting || to === undefined || u.slot === null || to === u.slot) continue;
    moves.push({from: u.slot, to, acting: false});
  }
  return moves;
}

/** Whether `u`'s card is out charging (a drawn arrow of its in the air): drawn greyed. */
function isCharging(fight: FightState, u: Unit): boolean {
  return Boolean(fight.shots?.some((v) => v.source === u.id));
}

/**
 * One deck card, `i` cards back from the front (fractional while the deck
 * moves): blank when empty, a dashed outline for the planned landing, else
 * its unit's portrait. `lift` is how far a passed card has lifted off the
 * track; `grow` how much taller the acting unit's front card stands;
 * `charging` greys it, for a charge that lands when it comes back.
 */
function drawCard(
  ctx: CanvasRenderingContext2D,
  deck: TrackSlots,
  u: Unit | null,
  card: {
    i: number;
    lift: number;
    ghost: boolean;
    acting?: boolean;
    grow: number;
    charging?: boolean;
    mark?: ArrangeMark | undefined;
  },
  opts: TrackOpts
): void {
  const {i, lift, ghost, grow, mark} = card;
  const acting = Boolean(card.acting);
  const cx = deck.x0 + i * deck.w;
  const h = deck.h + 2 * FRONT_CARD_GROW * grow;
  // The card Alignment has picked up stands raised, out of the deck.
  const raise = mark === 'held' ? ARRANGE_RAISE : 0;
  const cy = deck.y - FRONT_CARD_GROW * grow - lift * (deck.y + deck.h + 4) - raise;
  ctx.save();
  ctx.globalAlpha = 1 - lift * 0.6;
  pixelShadow(ctx);
  pixelRect(ctx, cx, cy, deck.cardW, h, 3);
  // The ghost is just an outline where the acting card lands: no portrait,
  // so the acting unit doesn't show twice.
  if (!u || ghost) {
    ctx.fillStyle = mark === 'open' ? PALETTE.dusk2 : PALETTE.dusk1;
    ctx.fill();
  } else {
    bandCard(ctx, cx, cy, deck.cardW, h, u.side);
  }
  ctx.shadowColor = 'transparent';
  const strokeBorder = () => {
    ctx.setLineDash(ghost || mark === 'open' ? [3, 2] : []);
    ctx.strokeStyle =
      mark === 'open'
        ? PALETTE.jade
        : mark === 'held'
          ? PALETTE.ivory
          : mark === 'movable'
            ? PALETTE.goldLight
            : !u
              ? PALETTE.dusk2
              : acting
                ? PALETTE.goldLight
                : ghost
                  ? PALETTE.lapisLight
                  : u.id === opts.selected || u.id === opts.hovered
                    ? PALETTE.ivory
                    : SIDE_LIGHT[u.side];
    ctx.lineWidth = acting || ghost || mark ? 2.5 : 1.25;
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
      // would (the strip that shows, on a card behind). The party faces left.
      const scale = Math.max(h, deck.cardW) / img.height;
      const faceX = (u.side === 'player' ? img.width - portrait.faceX : portrait.faceX) * scale;
      ctx.save();
      pixelRect(ctx, cx, cy, deck.cardW, h, 3);
      ctx.clip();
      ctx.imageSmoothingEnabled = false;
      ctx.translate(Math.round(mid - faceX), Math.round(cy));
      if (u.side === 'player') {
        ctx.translate(img.width * scale, 0);
        ctx.scale(-1, 1);
      }
      ctx.drawImage(img, 0, 0, img.width * scale, img.height * scale);
      ctx.restore();
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
    if (card.charging) greyCard(ctx, cx, cy, deck.cardW, h);
    // A card whose last turn was skipped (Stunned, or it could only Hold): marked till it next acts.
    if (u.skipped && !card.charging) drawSkipMark(ctx, cx + deck.cardW - deck.w / 2, cy + h - 9);
  }
  ctx.restore();
}

/**
 * A charging card, greyed: its colour drained (portrait and border too)
 * and dimmed toward the dusk, so it reads as no turn of its own.
 */
function greyCard(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  ctx.save();
  pixelRect(ctx, x, y, w, h, 3);
  ctx.globalCompositeOperation = 'saturation';
  ctx.fillStyle = '#808080';
  ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 0.45;
  ctx.fillStyle = PALETTE.dusk1;
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
 * The planned turn's moves on the track (3.3, Haste and Delay): for each,
 * the strip of the slot it leaves outlined dashed (not the acting card's,
 * which stays in front), and an arrow below the units from there to where
 * it lands, over the cards in the way: jade for a card brought earlier,
 * gold for one sent later, the acting card's as any other's. Arrows whose
 * spans overlap sit on rows one above another, so each reads.
 */
function drawMoves(ctx: CanvasRenderingContext2D, deck: TrackSlots, moves: TrackMove[]): void {
  const rows: {lo: number; hi: number}[][] = [];
  // The acting card's first, on the bottom row; then the rest, nearest first.
  const ordered = [...moves].sort((a, b) => Number(b.acting) - Number(a.acting) || a.from - b.from);
  for (const m of ordered) {
    const lo = Math.min(m.from, m.to);
    const hi = Math.max(m.from, m.to);
    let row = rows.findIndex((r) => r.every((o) => hi < o.lo || lo > o.hi));
    if (row < 0) row = rows.push([]) - 1;
    rows[row]!.push({lo, hi});
    const color = m.to < m.from ? PALETTE.jade : PALETTE.gold;
    drawMove(ctx, deck, m.from, m.to, color, row, !m.acting);
  }
}

/** Pixels between rows of move arrows. */
const MOVE_ROW_STEP = 9;

/**
 * One move (`drawMoves`): with `outline`, the strip of slot `from` outlined
 * dashed in `color`; and an arrow `row` rows up from the bottom from there to `to`.
 */
function drawMove(
  ctx: CanvasRenderingContext2D,
  deck: TrackSlots,
  from: number,
  to: number,
  color: string,
  row: number,
  outline: boolean
): void {
  // The middle of a slot's showing strip: the right `w` of its card.
  const mid = (slot: number) => deck.x0 + (slot - deck.start) * deck.w + deck.cardW - deck.w / 2;
  const left = mid(from) - deck.w / 2;
  ctx.save();
  if (outline) {
    ctx.setLineDash([3, 2]);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    pixelRect(ctx, left + 1, deck.y + 1, deck.w - 2, deck.h - 2, 4);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  const y = deck.y + deck.h - 18 - row * MOVE_ROW_STEP;
  // Pointing right to a later slot, left to an earlier one.
  const dir = to > from ? 1 : -1;
  const x1 = mid(from);
  const x2 = mid(to) - 4 * dir;
  // Dark under the colour, so it reads over any card.
  for (const [stroke, width] of [
    [PALETTE.ink, 4],
    [color, 2],
  ] as const) {
    ctx.strokeStyle = stroke;
    ctx.fillStyle = stroke;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(x1, y);
    ctx.lineTo(x2 - 2 * dir, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x2 + (width / 2 + 2) * dir, y);
    ctx.lineTo(x2 - 5 * dir, y - 4 - width / 2);
    ctx.lineTo(x2 - 5 * dir, y + 4 + width / 2);
    ctx.closePath();
    ctx.fill();
  }
  ctx.beginPath();
  ctx.arc(x1, y, 2.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
