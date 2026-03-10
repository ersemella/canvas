import {BaseSystem, type SystemContext} from 'core/System';
import type {TransformComponent} from 'components/TransformComponent';
import type {RenderableComponent} from 'components/RenderableComponent';

export class RendererSystem extends BaseSystem {
  readonly priority = 1000;

  onUpdate(context: SystemContext): void {
    const {scene, ctx, canvas} = context;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const entities = scene
      .query({all: ['Transform', 'Renderable']})
      .filter((e) => {
        const r = e.getComponent<RenderableComponent>('Renderable')!;
        return r.visible;
      })
      .sort((a, b) => {
        const ra = a.getComponent<RenderableComponent>('Renderable')!;
        const rb = b.getComponent<RenderableComponent>('Renderable')!;
        return ra.zIndex - rb.zIndex;
      });

    for (const entity of entities) {
      const transform = entity.getComponent<TransformComponent>('Transform')!;
      const renderable = entity.getComponent<RenderableComponent>('Renderable')!;

      ctx.save();
      ctx.translate(transform.position.x, transform.position.y);
      ctx.rotate(transform.rotation);
      ctx.scale(transform.scale.x, transform.scale.y);

      ctx.fillStyle = renderable.color;
      ctx.fillRect(
        -renderable.width / 2,
        -renderable.height / 2,
        renderable.width,
        renderable.height
      );

      if (renderable.text) {
        ctx.strokeStyle = '#cccccc';
        ctx.lineWidth = 1;
        ctx.strokeRect(
          -renderable.width / 2,
          -renderable.height / 2,
          renderable.width,
          renderable.height
        );
        const topLeft = renderable.textAnchor === 'top-left';
        ctx.font = `bold ${renderable.fontSize ?? 14}px monospace`;
        ctx.fillStyle = renderable.textColor ?? '#000000';
        ctx.textAlign = topLeft ? 'left' : 'center';
        ctx.textBaseline = topLeft ? 'top' : 'middle';
        const tx = topLeft ? -renderable.width / 2 + 4 : 0;
        const ty = topLeft ? -renderable.height / 2 + 4 : 0;
        ctx.fillText(renderable.text, tx, ty);
        if (topLeft) {
          ctx.save();
          ctx.rotate(Math.PI);
          ctx.fillText(renderable.text, tx, ty);
          ctx.restore();
        }
      }

      ctx.restore();
    }
  }
}
