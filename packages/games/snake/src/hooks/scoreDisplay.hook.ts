import type {LifecycleHook, HookContext} from '@canvas/engine';

export function createScoreDisplayHook(_config: Record<string, unknown>): LifecycleHook {
  return {
    onInit(ctx: HookContext) {
      ctx.state['score'] = 0;

      ctx.state['unsubScore'] = ctx.events.on('score:increment', () => {
        ctx.state['score'] = ((ctx.state['score'] as number) ?? 0) + 1;
      });
    },

    onUpdate(ctx: HookContext) {
      const world = ctx.world as unknown as {ctx?: CanvasRenderingContext2D};
      const canvasCtx = world.ctx;
      if (!canvasCtx) return;

      canvasCtx.save();
      canvasCtx.fillStyle = '#ffffff';
      canvasCtx.font = 'bold 18px monospace';
      canvasCtx.fillText(`Score: ${ctx.state['score'] as number}`, 10, 25);
      canvasCtx.restore();
    },

    onDestroy(ctx: HookContext) {
      (ctx.state['unsubScore'] as (() => void) | undefined)?.();
    },
  };
}
