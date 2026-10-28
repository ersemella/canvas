/**
 * The track of cards along the top (3.1): each unit's card, its marks
 * (charging, ultimate ready, skipped), yielding, and the deck running on.
 */
import {assetLoader} from '@canvas/engine';
import {HEROES} from '../../rules/config';
import type {CardLeg} from '../../rules/preview';
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
 * its unit. The planned turn's landing card is dashed; when it lands off
 * the slot its cost aimed at (it yields past taken slots, or is Hastened),
 * that slot is marked too, with arrows on to where it lands, and so is
 * every other card the turn moves (Hastened, Delayed or bumped on), from
 * its slot now to where it goes, a leg per cause (`drawMoves`). The acting unit's card stands a little taller in
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
  moves: Record<string, CardLeg[]>,
  advance: TrackAdvance | null,
  slides: Map<string, CardSlide>,
  opts: {selected: string | null; hovered: string | null}
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
    const charging = Boolean(u && !ghost && !spent && isCharging(fight, u));
    drawCard(ctx, deck, u, {i, lift, ghost, acting, grow, charging}, opts);
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
  if (!advance && previewSlot !== null) drawMoves(ctx, deck, trackMoves(fight, moves));
}

/** A card the planned turn moves on the track, leg by leg (`TurnPreview.moves`). */
interface TrackMove {
  legs: CardLeg[];
  /** The acting unit's own card: from the slot its cost aims at. */
  acting: boolean;
}

/** Every card the planned turn moves, the acting card's first (its arrows on the bottom rows). */
function trackMoves(fight: FightState, moves: Record<string, CardLeg[]>): TrackMove[] {
  return Object.entries(moves)
    .filter(([, legs]) => legs.length > 0)
    .map(([id, legs]) => ({legs, acting: id === fight.awaiting}))
    .sort((a, b) => Number(b.acting) - Number(a.acting) || a.legs[0]!.from - b.legs[0]!.from);
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
  },
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

/** A leg's colour by its cause: jade brought earlier, gold sent later, ivory bumped on. */
const LEG_COLOR: Record<CardLeg['cause'], string> = {
  earlier: PALETTE.jade,
  later: PALETTE.gold,
  bumped: PALETTE.ivory,
};

/** Pixels between rows of move arrows. */
const MOVE_ROW_STEP = 9;

/**
 * The planned turn's moves on the track (3.3, Haste and Delay): for each
 * card, the strip of the slot it leaves (or, for the acting card, the slot
 * its cost aimed at) outlined dashed, blue for the acting card and else in
 * its first leg's colour, and arrows below the units from there to where
 * it lands, over the cards in the way, one leg per cause: solid jade where
 * the turn brings it earlier, solid gold where it sends it later, and a
 * dotted ivory leg, starting at a spark, where it collides and is bumped
 * on (it yields, or a faster card takes its slot). A card Hastened onto a
 * taken slot so reads as a jade arrow and then a bump, not one arrow
 * whose length is neither. A leg turning back steps up a row; moves whose
 * spans overlap sit on rows one above another, so each reads.
 */
function drawMoves(ctx: CanvasRenderingContext2D, deck: TrackSlots, moves: TrackMove[]): void {
  const rows: {lo: number; hi: number}[][] = [];
  const placed: {m: TrackMove; rows: number[]}[] = [];
  const fits = (row: number, lo: number, hi: number) =>
    (rows[row] ?? []).every((o) => hi < o.lo || lo > o.hi);
  for (const m of moves) {
    // Each leg's row above the chain's first: one more each time it turns back.
    const up: number[] = [];
    m.legs.forEach((l, k) => {
      const prev = m.legs[k - 1];
      const turns =
        prev !== undefined && Math.sign(l.to - l.from) !== Math.sign(prev.to - prev.from);
      up.push(k === 0 ? 0 : up[k - 1]! + Number(turns));
    });
    const span = (l: CardLeg) => [Math.min(l.from, l.to), Math.max(l.from, l.to)] as const;
    let base = 0;
    while (!m.legs.every((l, k) => fits(base + up[k]!, ...span(l)))) base++;
    m.legs.forEach((l, k) => {
      const [lo, hi] = span(l);
      (rows[base + up[k]!] ??= []).push({lo, hi});
    });
    placed.push({m, rows: up.map((u) => base + u)});
  }
  // The acting card's drawn last, so its outline shows over any card that leaves the same slot.
  for (const {m, rows: at} of placed.reverse())
    drawMove(ctx, deck, m.legs, at, m.acting ? PALETTE.lapisLight : LEG_COLOR[m.legs[0]!.cause]);
}

/**
 * One card's move (`drawMoves`): the strip of its first leg's slot
 * outlined dashed in `outline`, and each leg an arrow `rows[k]` rows up
 * from the bottom, joined where the move turns back.
 */
function drawMove(
  ctx: CanvasRenderingContext2D,
  deck: TrackSlots,
  legs: CardLeg[],
  rows: number[],
  outline: string
): void {
  // The middle of a slot's showing strip: the right `w` of its card.
  const mid = (slot: number) => deck.x0 + (slot - deck.start) * deck.w + deck.cardW - deck.w / 2;
  const rowY = (row: number) => deck.y + deck.h - 18 - row * MOVE_ROW_STEP;
  const left = mid(legs[0]!.from) - deck.w / 2;
  ctx.save();
  ctx.setLineDash([3, 2]);
  ctx.strokeStyle = outline;
  ctx.lineWidth = 2;
  pixelRect(ctx, left + 1, deck.y + 1, deck.w - 2, deck.h - 2, 4);
  ctx.stroke();
  ctx.setLineDash([]);
  // Dark under the colour, so it reads over any card: the whole move in ink first.
  for (const pass of ['ink', 'colour'] as const) {
    const width = pass === 'ink' ? 4 : 2;
    legs.forEach((l, k) => {
      const color = pass === 'ink' ? PALETTE.ink : LEG_COLOR[l.cause];
      const y = rowY(rows[k]!);
      // Pointing right to a later slot, left to an earlier one; stopping short for the arrowhead.
      const dir = Math.sign(l.to - l.from);
      const x1 = mid(l.from);
      const x2 = mid(l.to) - 4 * dir;
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineWidth = width;
      // A bump dotted, over its ink, so it reads as no effect of the turn's own.
      ctx.setLineDash(pass === 'colour' && l.cause === 'bumped' ? [2, 2] : []);
      ctx.beginPath();
      // Turning back: up from the leg before's row at the joint.
      ctx.moveTo(x1, rowY(k > 0 ? rows[k - 1]! : rows[k]!));
      ctx.lineTo(x1, y);
      ctx.lineTo(x2 - 2 * dir, y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(x2 + (width / 2 + 2) * dir, y);
      ctx.lineTo(x2 - 5 * dir, y - 4 - width / 2);
      ctx.lineTo(x2 - 5 * dir, y + 4 + width / 2);
      ctx.closePath();
      ctx.fill();
    });
  }
  // Where it leaves from, a dot; where a leg collides and is bumped on, a spark.
  legs.forEach((l, k) => {
    const x = mid(l.from);
    const y = rowY(rows[k]!);
    if (l.cause === 'bumped') drawSpark(ctx, x, y);
    else if (k === 0) {
      ctx.fillStyle = LEG_COLOR[l.cause];
      ctx.beginPath();
      ctx.arc(x, y, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
  });
  ctx.restore();
}

/** A collision's spark (`drawMove`): a small four-pointed star in ivory, outlined in ink. */
function drawSpark(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  const star = (r: number, waist: number) => {
    ctx.beginPath();
    for (let k = 0; k < 8; k++) {
      const a = (k * Math.PI) / 4;
      const d = k % 2 === 0 ? r : waist;
      ctx.lineTo(x + Math.cos(a) * d, y + Math.sin(a) * d);
    }
    ctx.closePath();
  };
  star(6, 2.5);
  ctx.fillStyle = PALETTE.ink;
  ctx.fill();
  star(4.5, 1.5);
  ctx.fillStyle = PALETTE.ivory;
  ctx.fill();
}
