/**
 * Where things sit on the canvas: the track strip along the top, the board
 * below it, and the cards on the track. Shared by the drawing system and
 * the input system, so a tap lands on what was drawn.
 */
import {hexKey, pixelToHex} from '@canvas/engine';
import type {Hex, HexLayout} from '@canvas/engine';
import {onMap} from '../rules/map';
import type {MapData} from '../rules/map';
import type {FightState} from '../rules/types';

/** The scene's size in pixels (game.json's canvas). */
export const SCENE_SIZE = {width: 600, height: 460} as const;

/** The track strip: one card per unit, left to right in turn order (3.1). */
export const TRACK_AREA = {x: 6, y: 6, width: 588, height: 86} as const;

/**
 * The board: 7 rows of pointy hexes of size 32, odd rows 10 hexes wide
 * (columns −1 to 8), centred under the track.
 */
export const BOARD_LAYOUT: HexLayout = {orientation: 'pointy', size: 32, origin: {x: 78, y: 132}};

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

/** The deck's cards: at least this many, more when a unit's card lies further out. */
const MIN_SLOT_CELLS = 18;

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

/** A deck card is this many strips wide. */
const DECK_CARD_STRIPS = 1.7;

function trackEntries(fight: FightState, previewSlot: number | null) {
  const entries = fight.units
    .filter((u) => u.alive && u.slot !== null)
    .map((u) => ({unitId: u.id, slot: u.slot!, ghost: false}));
  if (fight.awaiting && previewSlot !== null) entries.push({unitId: fight.awaiting, slot: previewSlot, ghost: true});
  return entries.sort((a, b) => a.slot - b.slot || Number(a.ghost) - Number(b.ghost));
}

/**
 * The track as a fanned deck, as in Mana Khemia: every slot from now on is
 * a card, empty ones included, so a turn's cost reads as how far back in
 * the deck it lands. `start` is the slot in front; while spent cards lift
 * away after a turn it lags behind the fight's, and may be fractional.
 */
export function trackSlots(fight: FightState, previewSlot: number | null, start = fight.currentSlot): TrackSlots {
  const entries = trackEntries(fight, previewSlot);
  const last = entries.length > 0 ? entries[entries.length - 1]!.slot : start;
  const count = Math.max(MIN_SLOT_CELLS, last - start + 1);
  const x0 = TRACK_AREA.x + 6;
  const w = (TRACK_AREA.width - 12) / (count - 1 + DECK_CARD_STRIPS);
  return {start, count, x0, w, cardW: w * DECK_CARD_STRIPS, y: TRACK_AREA.y + 7, h: TRACK_AREA.height - 14};
}

/**
 * Each unit's card on the track, in slot order, with the previewed landing
 * card if any; its rectangle is the strip of it that shows, for taps.
 */
export function trackCards(fight: FightState, previewSlot: number | null): TrackCard[] {
  const {start, x0, w, cardW, y, h} = trackSlots(fight, previewSlot);
  return trackEntries(fight, previewSlot).map((e) => ({...e, x: x0 + (e.slot - start) * w + cardW - w, y, w, h}));
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
