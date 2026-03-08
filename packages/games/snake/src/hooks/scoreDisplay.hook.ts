import type { LifecycleHook, HookContext } from '@canvas/engine';

export function createScoreDisplayHook(_config: Record<string, unknown>): LifecycleHook {
  return {
    onInit(ctx: HookContext) {
      ctx.state['score'] = 0;
      ctx.state['gameOver'] = false;

      ctx.state['unsubScore'] = ctx.events.on('score:increment', () => {
        ctx.state['score'] = ((ctx.state['score'] as number) ?? 0) + 1;
      });

      ctx.state['unsubDied'] = ctx.events.on('snake:died', () => {
        ctx.state['gameOver'] = true;
      });
    },

    onUpdate(ctx: HookContext) {
      // Access the canvas 2D context via world
      const world = ctx.world as unknown as { ctx?: CanvasRenderingContext2D };
      const canvasCtx = world.ctx;
      if (!canvasCtx) return;

      canvasCtx.save();
      canvasCtx.fillStyle = '#ffffff';
      canvasCtx.font = 'bold 18px monospace';
      canvasCtx.fillText(`Score: ${ctx.state['score'] as number}`, 10, 25);

      if (ctx.state['gameOver']) {
        canvasCtx.fillStyle = 'rgba(0,0,0,0.6)';
        canvasCtx.fillRect(0, 0, 600, 400);
        canvasCtx.fillStyle = '#ffffff';
        canvasCtx.font = 'bold 32px monospace';
        canvasCtx.textAlign = 'center';
        canvasCtx.fillText('Game Over', 300, 180);
        canvasCtx.font = '20px monospace';
        canvasCtx.fillText(`Score: ${ctx.state['score'] as number}`, 300, 220);
        canvasCtx.font = '16px monospace';
        canvasCtx.fillText('Refresh to play again', 300, 260);
      }

      canvasCtx.restore();
    },

    onDestroy(ctx: HookContext) {
      (ctx.state['unsubScore'] as (() => void) | undefined)?.();
      (ctx.state['unsubDied'] as (() => void) | undefined)?.();
    },
  };
}
