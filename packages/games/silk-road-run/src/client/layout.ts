/**
 * Where things sit on the canvas: the track strip along the top, then room
 * for what's drawn over the board's top row (a unit's health bar, statuses
 * and turn arrow), then the board. Shared by the drawing system and the
 * input system, so a tap lands on what was drawn.
 */
import {hexKey, pixelToHex} from '@canvas/engine';
import type {Hex, HexLayout} from '@canvas/engine';
import {RULES} from '../rules/config';
import {onMap} from '../rules/map';
import type {MapData} from '../rules/map';
import type {FightState} from '../rules/types';

/** The scene's size in pixels (game.json's canvas). */
export const SCENE_SIZE = {width: 594, height: 826} as const;

/** The track strip: one card per unit, left to right in turn order (3.1). */
export const TRACK_AREA = {x: 6, y: 6, width: 582, height: 86} as const;

/**
 * The board: a hexagon of flat-top hexes of size 42 (owner, 2026-10-24;
 * 9 rows of pointy hexes before, and size 32 until 2026-10-20), nine
 * columns across: 588 × 655 pixels, from y 164 to 819, its centre hex at
 * the origin, 3 pixels from each side of the scene (672 wide until
 * 2026-10-23, its 78 spare pixels empty on a phone). The 72 pixels between
 * it and the track hold what's drawn over the top point's unit (its health
 * bar, statuses and turn arrow), so the track never covers it and nothing
 * has to move below the unit. A hex is 73 pixels tall, room for a
 * 36-pixel mounted sprite at 2×.
 */
export const BOARD_LAYOUT: HexLayout = {orientation: 'flat', size: 42, origin: {x: 297, y: 491}};

export interface TrackCard {
  unitId: string;
  slot: number;
  /** Where the acting unit's card would land after the planned turn. */
  ghost: boolean;
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * The deck's cards: at least this many, more when a unit's card lies
 * further out (a Delay). The camel's start slot and its speed-0 action
 * cost of 12 both reach 13 cards; nothing else goes further without a Delay.
 */
const MIN_SLOT_CELLS = RULES.camelStartSlot + 1;

export interface TrackSlots {
  /** The slot of the first card (now). */
  start: number;
  count: number;
  x0: number;
  /** Distance between cards: the strip of each that shows. */
  w: number;
  /** A whole card's width; the next card tucks under all but its last `w`. */
  cardW: number;
  y: number;
  h: number;
}

/** A deck card is this many strips wide: nearly square, for the portrait that fills it. */
const DECK_CARD_STRIPS = 2.2;

/** Slots the planned turn moves other cards to, by unit id (3.3). */
export type TrackBumps = Record<string, number>;

function trackEntries(fight: FightState, previewSlot: number | null, bumps: TrackBumps = {}) {
  const shown = (u: {id: string; slot: number | null}) =>
    previewSlot !== null ? (bumps[u.id] ?? u.slot!) : u.slot!;
  const entries = fight.units
    .filter((u) => u.alive && u.slot !== null)
    .map((u) => ({unitId: u.id, slot: shown(u), ghost: false}));
  if (fight.awaiting && previewSlot !== null)
    entries.push({unitId: fight.awaiting, slot: previewSlot, ghost: true});
  return entries.sort((a, b) => a.slot - b.slot || Number(a.ghost) - Number(b.ghost));
}

/**
 * The track as a fanned deck, as in Mana Khemia: every slot from now on is
 * a card, empty ones included, so a turn's cost reads as how far back in
 * the deck it lands. `start` is the slot in front; while spent cards lift
 * away after a turn it lags behind the fight's, and may be fractional.
 */
export function trackSlots(
  fight: FightState,
  previewSlot: number | null,
  start = fight.currentSlot,
  bumps: TrackBumps = {}
): TrackSlots {
  const entries = trackEntries(fight, previewSlot, bumps);
  // Cards the planned turn moves earlier keep the slots they leave on the deck, marked.
  const last = Math.max(
    entries.length > 0 ? entries[entries.length - 1]!.slot : start,
    ...fight.units.filter((u) => u.alive && u.slot !== null).map((u) => u.slot!)
  );
  const count = Math.max(MIN_SLOT_CELLS, last - start + 1);
  const x0 = TRACK_AREA.x + 6;
  const w = (TRACK_AREA.width - 12) / (count - 1 + DECK_CARD_STRIPS);
  return {
    start,
    count,
    x0,
    w,
    cardW: w * DECK_CARD_STRIPS,
    y: TRACK_AREA.y + 7,
    h: TRACK_AREA.height - 14,
  };
}

/**
 * Each unit's card on the track, in slot order, with the previewed landing
 * card if any; its rectangle is the strip of it that shows, for taps.
 */
export function trackCards(
  fight: FightState,
  previewSlot: number | null,
  bumps: TrackBumps = {}
): TrackCard[] {
  const {start, x0, w, cardW, y, h} = trackSlots(fight, previewSlot, fight.currentSlot, bumps);
  return trackEntries(fight, previewSlot, bumps).map((e) => ({
    ...e,
    x: x0 + (e.slot - start) * w + cardW - w,
    y,
    w,
    h,
  }));
}

export function cardAt(cards: TrackCard[], p: {x: number; y: number}): TrackCard | undefined {
  return cards.find((c) => p.x >= c.x && p.x <= c.x + c.w && p.y >= c.y && p.y <= c.y + c.h);
}

/** The map hex under a point, or null off the board. */
export function hexAt(map: MapData, p: {x: number; y: number}): Hex | null {
  if (p.y < TRACK_AREA.y + TRACK_AREA.height) return null;
  const h = pixelToHex(p, BOARD_LAYOUT);
  return onMap(map, h) ? h : null;
}

export const sameHex = (a: Hex | null, b: Hex | null): boolean =>
  a === b || (a !== null && b !== null && hexKey(a) === hexKey(b));
