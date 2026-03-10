import {BaseSystem, type SystemContext} from 'core/System';
import {renderQueue} from 'systems/renderQueue';

// Sorts all pending render commands by zIndex and executes them.
// Must run after all renderer systems that push to the render queue.
export class RenderFlushSystem extends BaseSystem {
  readonly priority = 1000;

  onUpdate({ctx}: SystemContext): void {
    renderQueue.flush(ctx);
  }
}
