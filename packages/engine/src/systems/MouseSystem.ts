import {BaseSystem, type SystemContext} from 'core/System';

export const mouseService = {
  position: {x: 0, y: 0},
  isDown: false,
  justDown: false,
  justUp: false,
  flush() {
    this.justDown = false;
    this.justUp = false;
  },
};

export class MouseSystem extends BaseSystem {
  readonly priority = 950;
  private downHandler: ((e: MouseEvent) => void) | null = null;
  private moveHandler: ((e: MouseEvent) => void) | null = null;
  private upHandler: ((e: MouseEvent) => void) | null = null;

  onInit({canvas}: Omit<SystemContext, 'deltaTime'>): void {
    const rect = () => canvas.getBoundingClientRect();
    this.downHandler = (e) => {
      const r = rect();
      const scaleX = r.width / canvas.width;
      const scaleY = r.height / canvas.height;
      mouseService.position = {x: (e.clientX - r.left) / scaleX, y: (e.clientY - r.top) / scaleY};
      mouseService.isDown = true;
      mouseService.justDown = true;
    };
    this.moveHandler = (e) => {
      const r = rect();
      const scaleX = r.width / canvas.width;
      const scaleY = r.height / canvas.height;
      mouseService.position = {x: (e.clientX - r.left) / scaleX, y: (e.clientY - r.top) / scaleY};
    };
    this.upHandler = (e) => {
      const r = rect();
      const scaleX = r.width / canvas.width;
      const scaleY = r.height / canvas.height;
      mouseService.position = {x: (e.clientX - r.left) / scaleX, y: (e.clientY - r.top) / scaleY};
      mouseService.isDown = false;
      mouseService.justUp = true;
    };
    canvas.addEventListener('mousedown', this.downHandler);
    canvas.addEventListener('mousemove', this.moveHandler);
    canvas.addEventListener('mouseup', this.upHandler);
  }

  onUpdate(_ctx: SystemContext): void {
    mouseService.flush();
  }

  onDestroy({canvas}: Omit<SystemContext, 'deltaTime'>): void {
    if (this.downHandler) canvas.removeEventListener('mousedown', this.downHandler);
    if (this.moveHandler) canvas.removeEventListener('mousemove', this.moveHandler);
    if (this.upHandler) canvas.removeEventListener('mouseup', this.upHandler);
  }
}
