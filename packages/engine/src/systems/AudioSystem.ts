import { BaseSystem, type SystemContext } from '../core/System';

export class AudioSystem extends BaseSystem {
  readonly priority = 600;

  onUpdate(_context: SystemContext): void {
    // Web Audio API — stub for future implementation
  }
}
