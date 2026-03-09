import {BaseSystem, type SystemContext} from 'core/System';

export class AISystem extends BaseSystem {
  readonly priority = 400;

  onUpdate(_context: SystemContext): void {
    // Behavior tree runner — stub for future implementation
  }
}
