import type {HookFactory} from '@canvas/engine';

interface ScoreDisplayState {
  score: number;
  unsubScore: () => void;
}

export const createScoreDisplayHook: HookFactory<ScoreDisplayState, Record<string, never>> = (
  _config
) => ({
  onInit(ctx) {
    ctx.state.score = 0;

    ctx.state.unsubScore = ctx.events.on('score:increment', () => {
      ctx.state.score += 1;
    });
  },

  onUpdate(ctx) {
    const world = ctx.world as unknown as {ctx?: CanvasRenderingContext2D};
    const canvasCtx = world.ctx;
    if (!canvasCtx) return;

    canvasCtx.save();
    canvasCtx.fillStyle = '#ffffff';
    canvasCtx.font = 'bold 18px monospace';
    canvasCtx.fillText(`Score: ${ctx.state.score}`, 10, 25);
    canvasCtx.restore();
  },

  onDestroy(ctx) {
    ctx.state.unsubScore();
  },
});
