import {BaseSystem, type SystemContext} from 'core/System';

// Clears the canvas at the start of each frame. Must run before all
// renderer systems that push to the render queue.
export class RendererSystem extends BaseSystem {
  readonly priority = 990;

  onUpdate({ctx, canvas}: SystemContext): void {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
}
