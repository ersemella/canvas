interface RenderCommand {
  zIndex: number;
  draw: (ctx: CanvasRenderingContext2D) => void;
}

export const renderQueue = {
  commands: [] as RenderCommand[],

  push(zIndex: number, draw: (ctx: CanvasRenderingContext2D) => void): void {
    this.commands.push({zIndex, draw});
  },

  flush(ctx: CanvasRenderingContext2D): void {
    this.commands.sort((a, b) => a.zIndex - b.zIndex);
    for (const cmd of this.commands) cmd.draw(ctx);
    this.commands = [];
  },
};
