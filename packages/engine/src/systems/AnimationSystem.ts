import { BaseSystem, type SystemContext } from '../core/System';
import type { AnimatorComponent } from '../components/AnimatorComponent';

export class AnimationSystem extends BaseSystem {
  readonly priority = 300;

  onUpdate(context: SystemContext): void {
    const { scene, deltaTime } = context;
    const entities = scene.query({ all: ['Animator'] });

    for (const entity of entities) {
      const animator = entity.getComponent<AnimatorComponent>('Animator')!;
      const clip = animator.clips.find((c) => c.name === animator.currentClip);
      if (!clip || clip.frames.length === 0) continue;

      animator.elapsed += deltaTime;
      const frameDuration = 1 / clip.fps;

      if (animator.elapsed >= frameDuration) {
        animator.elapsed -= frameDuration;
        animator.currentFrame++;
        if (animator.currentFrame >= clip.frames.length) {
          animator.currentFrame = clip.loop ? 0 : clip.frames.length - 1;
        }
      }
    }
  }
}
