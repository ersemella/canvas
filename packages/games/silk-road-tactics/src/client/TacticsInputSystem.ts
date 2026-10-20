import {BaseSystem, mouseService} from '@canvas/engine';
import type {Hex, SystemContext} from '@canvas/engine';
import {mapOf} from '../rules/fight';
import {cardAt, hexAt, sameHex, trackCards} from './layout';
import type {BoardScene} from './TacticsBoardSystem';

export interface TacticsTapPayload {
  hex: Hex;
}

export interface TacticsCardPayload {
  unitId: string;
}

/** The hex or track card under a mouse pointer; null when it leaves or a finger is used. */
export interface TacticsHoverPayload {
  hex: Hex | null;
  unitId: string | null;
}

/**
 * The board's taps and hover. Taps on a map hex emit `tactics:tap`, taps on
 * a track card `tactics:card`; a mouse moving over either emits
 * `tactics:hover` when what's under it changes. Picks against the map's own
 * hexes (odd rows reach column −1, which a `HexGrid` rectangle can't), and
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
    const map = mapOf(fight);
    const cards = trackCards(fight, this.scene!.previewSlot ?? null);
    const p = mouseService.position;

    const hover: TacticsHoverPayload = this.mouseOver
      ? {hex: hexAt(map, p), unitId: cardAt(cards, p)?.unitId ?? null}
      : {hex: null, unitId: null};
    if (!sameHex(hover.hex, this.hover.hex) || hover.unitId !== this.hover.unitId) {
      this.hover = hover;
      events.emit<TacticsHoverPayload>('tactics:hover', hover);
    }

    if (!mouseService.justUp || mouseService.upConsumed) return;
    const card = cardAt(cards, p);
    if (card) {
      events.emit<TacticsCardPayload>('tactics:card', {unitId: card.unitId});
      return;
    }
    const hex = hexAt(map, p);
    if (hex) events.emit<TacticsTapPayload>('tactics:tap', {hex: {q: hex.q, r: hex.r}});
  }
}
