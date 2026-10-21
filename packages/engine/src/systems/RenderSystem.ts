import {BaseSystem, type SystemContext} from '../core/System';
import type {TransformComponent} from '../components/TransformComponent';
import type {RenderableComponent} from '../components/RenderableComponent';
import type {IEntity} from '../core/Entity';
import {hexCorners} from '../math/Hex';
import {assetLoader} from '../loader/AssetLoader';

export class RenderSystem extends BaseSystem {
  readonly priority = 995;

  /** Seconds since the system started, for sprite animations. */
  private time = 0;

  onUpdate({scene, world, ctx, deltaTime}: SystemContext): void {
    this.time += deltaTime;
    // Nothing new to draw: what the canvas shows stays.
    if (world.frameHeld) return;
    // Draw in scene pixels; the world's scale maps them onto the canvas.
    ctx.setTransform(world.scale, 0, 0, world.scale, 0, 0);
    ctx.imageSmoothingEnabled = !world.pixelArt;
    ctx.clearRect(0, 0, world.width, world.height);

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
    if (renderable.renderType === 'sprite') {
      // Whole pixels, so pixel art doesn't blur between them.
      ctx.translate(Math.round(transform.position.x), Math.round(transform.position.y));
    } else {
      ctx.translate(transform.position.x, transform.position.y);
    }
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
      case 'hex':
        this.drawHex(ctx, renderable);
        break;
      case 'sprite':
        this.drawSprite(ctx, renderable);
        break;
    }

    ctx.restore();
  }

  private drawRect(ctx: CanvasRenderingContext2D, r: RenderableComponent): void {
    const x = -r.width / 2;
    const y = -r.height / 2;
    if (r.radius !== undefined && r.radius > 0) {
      ctx.beginPath();
      ctx.roundRect(x, y, r.width, r.height, r.radius);
      ctx.fillStyle = r.color;
      ctx.fill();
      if (r.borderColor !== undefined) {
        ctx.strokeStyle = r.borderColor;
        ctx.lineWidth = r.borderWidth ?? 1;
        ctx.stroke();
      }
    } else {
      ctx.fillStyle = r.color;
      ctx.fillRect(x, y, r.width, r.height);
      if (r.borderColor !== undefined) {
        ctx.strokeStyle = r.borderColor;
        ctx.lineWidth = r.borderWidth ?? 1;
        ctx.strokeRect(x, y, r.width, r.height);
      }
    }
  }

  private drawText(ctx: CanvasRenderingContext2D, r: RenderableComponent): void {
    const text = r.text;
    if (!text) return;
    const weight = r.bold === true ? 'bold ' : '';
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

  private drawHex(ctx: CanvasRenderingContext2D, r: RenderableComponent): void {
    const corners = hexCorners(r.orientation ?? 'pointy', r.radius ?? r.height / 2);
    ctx.beginPath();
    corners.forEach(({x, y}, i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
    ctx.closePath();
    ctx.fillStyle = r.color;
    ctx.fill();
    if (r.borderColor !== undefined) {
      ctx.strokeStyle = r.borderColor;
      ctx.lineWidth = r.borderWidth ?? 1;
      ctx.stroke();
    }
  }

  private drawSprite(ctx: CanvasRenderingContext2D, r: RenderableComponent): void {
    const sprite = r.sprite;
    if (!sprite) return;
    const img = assetLoader.requestImage(sprite.image);
    if (!img) return; // still loading (or failed)

    const {frames, fps} = sprite.animation ?? {frames: [], fps: 0};
    const frame =
      frames.length > 0
        ? frames[Math.floor(this.time * fps) % frames.length]!
        : (sprite.frame ?? 0);
    const perRow = Math.max(1, Math.floor(img.width / sprite.frameWidth));
    const sx = (frame % perRow) * sprite.frameWidth;
    const sy = Math.floor(frame / perRow) * sprite.frameHeight;

    const pivot = sprite.pivot ?? {x: 0.5, y: 0.5};
    if (sprite.flipX === true) ctx.scale(-1, 1);
    ctx.drawImage(
      img,
      sx,
      sy,
      sprite.frameWidth,
      sprite.frameHeight,
      Math.round(-pivot.x * r.width),
      Math.round(-pivot.y * r.height),
      r.width,
      r.height
    );
  }
}
