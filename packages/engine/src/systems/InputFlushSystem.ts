import {BaseSystem, type SystemContext} from 'core/System';
import {inputService} from 'systems/InputSystem';

export class InputFlushSystem extends BaseSystem {
  readonly priority = 950;
  onUpdate(_context: SystemContext): void {
    inputService.flush();
  }
}
