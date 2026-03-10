import {BaseSystem} from 'core/System';
import {renderQueue} from 'systems/renderQueue';
import type {TransformComponent} from 'components/TransformComponent';
import type {RenderableComponent} from 'components/RenderableComponent';

export abstract class BaseRenderSystem extends BaseSystem {
  // Captures the transform values and pushes a draw closure into the shared
  // render queue. zIndex is read from the renderable so global sort is correct
  // across all renderer systems.
  protected push(
    transform: TransformComponent,
    renderable: RenderableComponent,
    fn: (ctx: CanvasRenderingContext2D) => void
  ): void {
    const x = transform.position.x;
    const y = transform.position.y;
    const rotation = transform.rotation;
    const sx = transform.scale.x;
    const sy = transform.scale.y;
    const zIndex = renderable.zIndex;

    renderQueue.push(zIndex, (ctx) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rotation);
      ctx.scale(sx, sy);
      fn(ctx);
      ctx.restore();
    });
  }
}
