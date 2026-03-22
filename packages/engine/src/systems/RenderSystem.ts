import {BaseSystem, type SystemContext} from 'core/System';
import type {TransformComponent} from 'components/TransformComponent';
import type {RenderableComponent} from 'components/RenderableComponent';
import type {IEntity} from 'core/Entity';

export class RenderSystem extends BaseSystem {
  readonly priority = 995;

  onUpdate({scene, ctx, canvas}: SystemContext): void {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const entities = scene.query({all: ['Transform', 'Renderable']});
    const visible = entities.filter((e) => {
      const r = e.getComponent<RenderableComponent>('Renderable')!;
      return r.visible;
    });
    visible.sort((a, b) => {
      const za = a.getComponent<RenderableComponent>('Renderable')!.zIndex;
      const zb = b.getComponent<RenderableComponent>('Renderable')!.zIndex;
      return za - zb;
    });

    for (const entity of visible) {
      this.drawEntity(ctx, entity);
    }
  }

  private drawEntity(ctx: CanvasRenderingContext2D, entity: IEntity): void {
    const transform = entity.getComponent<TransformComponent>('Transform')!;
    const renderable = entity.getComponent<RenderableComponent>('Renderable')!;

    ctx.save();
    ctx.translate(transform.position.x, transform.position.y);
    ctx.rotate(transform.rotation);
    ctx.scale(transform.scale.x, transform.scale.y);

    switch (renderable.renderType) {
      case 'rect':
        this.drawRect(ctx, renderable);
        break;
      case 'text':
        this.drawText(ctx, renderable);
        break;
      case 'circle':
        this.drawCircle(ctx, renderable);
        break;
    }

    ctx.restore();
  }

  private drawRect(ctx: CanvasRenderingContext2D, r: RenderableComponent): void {
    ctx.fillStyle = r.color;
    ctx.fillRect(-r.width / 2, -r.height / 2, r.width, r.height);
    if (r.borderColor !== undefined) {
      ctx.strokeStyle = r.borderColor;
      ctx.lineWidth = r.borderWidth ?? 1;
      ctx.strokeRect(-r.width / 2, -r.height / 2, r.width, r.height);
    }
  }

  private drawText(ctx: CanvasRenderingContext2D, r: RenderableComponent): void {
    const text = r.text;
    if (!text) return;
    const weight = r.bold !== false ? 'bold ' : '';
    ctx.font = `${weight}${r.fontSize ?? 14}px ${r.fontFamily ?? 'monospace'}`;
    ctx.fillStyle = r.textColor ?? '#000000';
    if (r.textAnchor === 'top-left') {
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
    } else {
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
    }
    ctx.fillText(text, 0, 0);
  }

  private drawCircle(ctx: CanvasRenderingContext2D, r: RenderableComponent): void {
    const radius = r.radius ?? r.width / 2;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fillStyle = r.color;
    ctx.fill();
    if (r.borderColor !== undefined) {
      ctx.strokeStyle = r.borderColor;
      ctx.lineWidth = r.borderWidth ?? 1;
      ctx.stroke();
    }
  }
}
