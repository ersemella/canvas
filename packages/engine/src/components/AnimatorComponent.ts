import { BaseComponent } from '../core/Component';

export interface AnimationClip {
  name: string;
  frames: number[];
  fps: number;
  loop: boolean;
}

export class AnimatorComponent extends BaseComponent {
  readonly componentType = 'Animator';
  static readonly componentType = 'Animator';

  clips: AnimationClip[];
  currentClip: string;
  currentFrame: number;
  elapsed: number;

  constructor(
    data: {
      clips?: AnimationClip[];
      defaultClip?: string;
    } = {}
  ) {
    super();
    this.clips = data.clips ?? [];
    this.currentClip = data.defaultClip ?? '';
    this.currentFrame = 0;
    this.elapsed = 0;
  }
}
