import {type SystemContext} from 'core/System';
import {BaseRenderSystem} from 'systems/BaseRenderSystem';
import type {RenderableComponent} from 'components/RenderableComponent';
import type {TransformComponent} from 'components/TransformComponent';

export class CardRendererSystem extends BaseRenderSystem {
  readonly priority = 996;

  onUpdate({scene}: SystemContext): void {
    const entities = scene.query({all: ['Transform', 'Renderable', 'Card']});

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

        ctx.strokeStyle = '#cccccc';
        ctx.lineWidth = 1;
        ctx.strokeRect(
          -renderable.width / 2,
          -renderable.height / 2,
          renderable.width,
          renderable.height
        );

        if (renderable.text) {
          const tx = -renderable.width / 2 + 4;
          const ty = -renderable.height / 2 + 4;
          ctx.font = `bold ${renderable.fontSize ?? 14}px monospace`;
          ctx.fillStyle = renderable.textColor ?? '#000000';
          ctx.textAlign = 'left';
          ctx.textBaseline = 'top';
          ctx.fillText(renderable.text, tx, ty);

          ctx.save();
          ctx.rotate(Math.PI);
          ctx.fillText(renderable.text, tx, ty);
          ctx.restore();
        }
      });
    }
  }
}
