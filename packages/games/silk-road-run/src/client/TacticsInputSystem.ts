import {BaseSystem, mouseService} from '@canvas/engine';
import type {Hex, SystemContext} from '@canvas/engine';
import {mapOf} from '../rules/fight';
import {cardAt, hexAt, sameHex, slotAt, trackCards, trackDrag} from './layout';
import type {BoardScene} from './board/scene';

export interface TacticsTapPayload {
  hex: Hex;
}

export interface TacticsCardPayload {
  unitId: string;
}

/**
 * The track's deck while Alignment arranges it (`BoardScene.arrange`), by slot,
 * blank cards included: a press on a slot (`down`), a release on the slot
 * pressed (`tap`), or a release on another after dragging from `from`
 * (`drop`).
 */
export type TacticsSlotPayload =
  | {phase: 'down' | 'tap'; slot: number}
  | {phase: 'drop'; slot: number; from: number};

/** The hex or track card under a mouse pointer; null when it leaves or a finger is used. */
export interface TacticsHoverPayload {
  hex: Hex | null;
  unitId: string | null;
}

/**
 * The board's taps and hover. Taps on a map hex emit `tactics:tap`, taps on
 * a track card `tactics:card` (while Alignment arranges the track, presses,
 * taps and drags on any deck card `tactics:slot`); a mouse moving over either emits
 * `tactics:hover` when what's under it changes. Picks against the map's own
 * hexagon (which a `HexGrid` rectangle can't describe), and
 * runs before `MouseSystem` (950) clears the frame's tap.
 */
export class TacticsInputSystem extends BaseSystem {
  readonly priority = 57;
  private scene: BoardScene | null = null;
  private mouseOver = false;
  private hover: TacticsHoverPayload = {hex: null, unitId: null};
  private cleanup: (() => void)[] = [];

  onInit({events, canvas}: Omit<SystemContext, 'deltaTime'>): void {
    this.cleanup.push(events.on<BoardScene>('tactics:board', (scene) => (this.scene = scene)));
    const move = (e: PointerEvent) => (this.mouseOver = e.pointerType === 'mouse');
    const leave = () => (this.mouseOver = false);
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerleave', leave);
    this.cleanup.push(() => {
      canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerleave', leave);
    });
  }

  onDestroy(): void {
    for (const fn of this.cleanup) fn();
    this.cleanup = [];
  }

  onUpdate({events}: SystemContext): void {
    const fight = this.scene?.fight;
    if (!fight) return;
    const tap = mouseService.justUp && !mouseService.upConsumed;
    // Arranging the track (Alignment): a press on a deck card, then a release
    // on it (a tap) or on another (a drag and drop), blank cards included.
    const arrange = this.scene!.arrange;
    if (!arrange) trackDrag.from = null;
    const slotUnder = () =>
      slotAt(
        fight,
        this.scene!.previewSlot ?? null,
        this.scene!.previewBumps ?? {},
        mouseService.position
      );
    if (arrange && mouseService.justDown) {
      trackDrag.from = slotUnder();
      if (trackDrag.from !== null)
        events.emit<TacticsSlotPayload>('tactics:slot', {phase: 'down', slot: trackDrag.from});
    }
    if (arrange && mouseService.justUp && trackDrag.from !== null) {
      const from = trackDrag.from;
      trackDrag.from = null;
      const slot = tap ? slotUnder() : null;
      if (slot === from) events.emit<TacticsSlotPayload>('tactics:slot', {phase: 'tap', slot});
      else if (slot !== null)
        events.emit<TacticsSlotPayload>('tactics:slot', {phase: 'drop', slot, from});
      return;
    }
    // Nothing to pick: no mouse over the board, no tap.
    if (!this.mouseOver && !tap) {
      if (this.hover.hex || this.hover.unitId) {
        this.hover = {hex: null, unitId: null};
        events.emit<TacticsHoverPayload>('tactics:hover', this.hover);
      }
      return;
    }
    const map = mapOf(fight);
    const cards = trackCards(fight, this.scene!.previewSlot ?? null, this.scene!.previewBumps);
    const p = mouseService.position;

    const hover: TacticsHoverPayload = this.mouseOver
      ? {hex: hexAt(map, p), unitId: cardAt(cards, p)?.unitId ?? null}
      : {hex: null, unitId: null};
    if (!sameHex(hover.hex, this.hover.hex) || hover.unitId !== this.hover.unitId) {
      this.hover = hover;
      events.emit<TacticsHoverPayload>('tactics:hover', hover);
    }

    if (!tap) return;
    const card = cardAt(cards, p);
    if (card) {
      events.emit<TacticsCardPayload>('tactics:card', {unitId: card.unitId});
      return;
    }
    const hex = hexAt(map, p);
    if (hex) events.emit<TacticsTapPayload>('tactics:tap', {hex: {q: hex.q, r: hex.r}});
  }
}
