import {BaseSystem, type SystemContext} from 'core/System';

/** Max gap and distance between two releases for them to count as a double click/tap. */
const DOUBLE_MS = 350;
const DOUBLE_PX = 12;

export const mouseService = {
  position: {x: 0, y: 0},
  isDown: false,
  justDown: false,
  justUp: false,
  /** True on the frame a release completes a double click or double tap. */
  justDoubleUp: false,
  upConsumed: false,
  lastUpTime: -Infinity,
  lastUpPos: {x: -1e9, y: -1e9},
  consumeUp() {
    this.upConsumed = true;
  },
  flush() {
    this.justDown = false;
    this.justUp = false;
    this.justDoubleUp = false;
    this.upConsumed = false;
  },
};

/**
 * Tracks the pointer over the canvas in canvas coordinates. Uses Pointer
 * Events, so mouse, touch and pen all drive the same `mouseService` state —
 * taps click and touch drags drag. The pointer is captured on press so a
 * drag released outside the canvas still ends.
 */
export class MouseSystem extends BaseSystem {
  readonly priority = 950;
  private handlers: Array<[string, (e: PointerEvent) => void]> = [];

  onInit({canvas}: Omit<SystemContext, 'deltaTime'>): void {
    const toCanvas = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      return {
        x: (e.clientX - r.left) / (r.width / canvas.width),
        y: (e.clientY - r.top) / (r.height / canvas.height),
      };
    };
    // Ignore extra fingers; the first pointer down drives everything.
    let activeId: number | null = null;

    const down = (e: PointerEvent) => {
      if (activeId !== null) return;
      activeId = e.pointerId;
      canvas.setPointerCapture?.(e.pointerId);
      mouseService.position = toCanvas(e);
      mouseService.isDown = true;
      mouseService.justDown = true;
    };
    const move = (e: PointerEvent) => {
      if (activeId !== null && e.pointerId !== activeId) return;
      mouseService.position = toCanvas(e);
    };
    const up = (e: PointerEvent) => {
      if (e.pointerId !== activeId) return;
      activeId = null;
      const pos = toCanvas(e);
      const now = performance.now();
      const near =
        Math.abs(pos.x - mouseService.lastUpPos.x) <= DOUBLE_PX &&
        Math.abs(pos.y - mouseService.lastUpPos.y) <= DOUBLE_PX;
      mouseService.justDoubleUp = near && now - mouseService.lastUpTime <= DOUBLE_MS;
      // A double ends the sequence so a third click doesn't count again.
      mouseService.lastUpTime = mouseService.justDoubleUp ? -Infinity : now;
      mouseService.lastUpPos = pos;
      mouseService.position = pos;
      mouseService.isDown = false;
      mouseService.justUp = true;
    };
    const cancel = (e: PointerEvent) => {
      if (e.pointerId !== activeId) return;
      activeId = null;
      mouseService.isDown = false;
      mouseService.justUp = true;
      mouseService.upConsumed = true; // a cancelled gesture never clicks
    };

    this.handlers = [
      ['pointerdown', down],
      ['pointermove', move],
      ['pointerup', up],
      ['pointercancel', cancel],
    ];
    for (const [type, fn] of this.handlers) canvas.addEventListener(type, fn as EventListener);
  }

  onUpdate(_ctx: SystemContext): void {
    mouseService.flush();
  }

  onDestroy({canvas}: Omit<SystemContext, 'deltaTime'>): void {
    for (const [type, fn] of this.handlers) canvas.removeEventListener(type, fn as EventListener);
    this.handlers = [];
    mouseService.isDown = false;
  }
}
