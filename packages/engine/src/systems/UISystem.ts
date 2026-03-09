import {BaseSystem, type SystemContext} from 'core/System';

export class UISystem extends BaseSystem {
  readonly priority = 900;

  onUpdate(_context: SystemContext): void {
    // Canvas HUD rendering — stub for future implementation
  }
}
