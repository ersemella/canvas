import {type SystemContext} from 'core/System';
import {BaseRenderSystem} from 'systems/renderer/BaseRenderSystem';
import type {TransformComponent} from 'components/TransformComponent';
import type {RenderableComponent} from 'components/RenderableComponent';

export class RectRendererSystem extends BaseRenderSystem {
  readonly priority = 995;

  onUpdate({scene}: SystemContext): void {
    const entities = scene.query({all: ['Transform', 'Renderable'], none: ['Card']});

    for (const entity of entities) {
      const renderable = entity.getComponent<RenderableComponent>('Renderable')!;
      if (!renderable.visible) continue;

      const transform = entity.getComponent<TransformComponent>('Transform')!;

      this.push(transform, renderable, (ctx) => {
        ctx.fillStyle = renderable.color;
        ctx.fillRect(
          -renderable.width / 2,
          -renderable.height / 2,
          renderable.width,
          renderable.height
        );

        if (renderable.text) {
          ctx.font = `bold ${renderable.fontSize ?? 14}px monospace`;
          ctx.fillStyle = renderable.textColor ?? '#000000';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(renderable.text, 0, 0);
        }
      });
    }
  }
}
