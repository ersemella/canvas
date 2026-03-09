import {BaseComponent} from 'core/Component';

export class AudioSourceComponent extends BaseComponent {
  readonly componentType = 'AudioSource';
  static readonly componentType = 'AudioSource';

  clip: string;
  volume: number;
  loop: boolean;
  autoPlay: boolean;

  constructor(
    data: {
      clip?: string;
      volume?: number;
      loop?: boolean;
      autoPlay?: boolean;
    } = {}
  ) {
    super();
    this.clip = data.clip ?? '';
    this.volume = data.volume ?? 1;
    this.loop = data.loop ?? false;
    this.autoPlay = data.autoPlay ?? false;
  }
}
