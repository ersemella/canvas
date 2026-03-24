import {BaseSystem, type SystemContext} from 'core/System';
import {inputService} from 'systems/InputSystem';

export class InputFlushSystem extends BaseSystem {
  readonly priority = 951;
  onUpdate(_context: SystemContext): void {
    inputService.flush();
  }
}
